/**
 * LOCAL DEMO BYPASS — not the production wire path.
 *
 * The real Flare Confidential Compute flow is:
 *   user tx → QuietShareInstructionSender → TeeExtensionRegistry → tee-proxy
 *   → tee-node (inside a TEE) → POST /action on this same handler code
 *   → signed result → proxy → client polls /action/result/{id}
 *
 * Exercising that requires Flare-internal infrastructure this build doesn't have
 * access to: a reachable indexer database for the "normal" FTDC proxy, which per
 * fce-extension/docs/getting-started.md lives in a separate, non-public `../../e2e/`
 * repo — needed for BOTH Coston2 and local devnet modes, not just testnet.
 *
 * This server exposes the *same* handlers.ts logic (same decrypt-note, same
 * in-memory private ledger, same tests) directly over plain HTTP, so the product
 * — private per-member pot balances — can be demoed end-to-end today. It skips:
 *   - on-chain instruction submission / fee payment
 *   - TEE node signing and attestation
 *   - registry-enforced "only the registered InstructionSender can submit"
 *
 * Auth on this bypass (there is no chain msg.sender to lean on):
 *   /balance        — signature + 5-minute window + one-use signature
 *   /record-deposit — signature (note-bound) + 5-minute window + one-use signature
 *   /record-spend   — signature + Coston2 receipt must contain matching
 *                     PotVault.SpendExecuted + explorer SpendProposed must
 *                     bind that proposalId to the claimed potId + each
 *                     spend txHash is applied at most once
 *
 * Switching to the real FCC relay still needs indexer credentials, a deployed
 * QuietShareInstructionSender, and a RECORD_SPEND op (or boot replay of
 * Deposited + SpendExecuted). handlers.ts deposit/balance logic does not change;
 * spend-debit is demo-only today. See README "A blocker we hit".
 */
// TEE_PRIVATE_KEY is loaded via Node's --env-file flag (see package.json's "demo"
// script) rather than a dotenv import here — ESM hoists all imports above any
// top-level code, so a dotenv call in this file would run AFTER ./app/config.js
// has already read (and cached) process.env.TEE_PRIVATE_KEY as empty.
import express from "express";
import cors from "cors";
import {
  createPublicClient,
  encodeAbiParameters,
  http,
  parseEventLogs,
  recoverMessageAddress,
  type Hex
} from "viem";
import { bytesToHex } from "./base/encoding.js";
import { handleGetBalance, handleRecordDeposit, recordSpendExecuted, register as _register } from "./app/handlers.js";
import {
  balanceRequestMessage,
  depositRequestMessage,
  isFreshTimestamp,
  rememberOnce,
  spendRequestMessage,
  SPEND_PROPOSED_TOPIC0
} from "./demoGuard.js";

void _register; // silence unused-import — real registration only applies to the framework server (main.ts)

const COSTON2_RPC = process.env.COSTON2_RPC_URL ?? "https://coston2-api.flare.network/ext/C/rpc";
const VAULT_ADDRESS = (process.env.POT_VAULT_ADDRESS ?? "0xb3994e1d198aA61181306154Fe3f2DC031DC3216") as Hex;
const EXPLORER_URL = process.env.COSTON2_EXPLORER_URL ?? "https://coston2-explorer.flare.network";
const VAULT_DEPLOY_BLOCK = 33_924_593;

const rpc = createPublicClient({ transport: http(COSTON2_RPC) });

const spendExecutedEvent = {
  type: "event",
  name: "SpendExecuted",
  inputs: [
    { indexed: true, name: "proposalId", type: "bytes32" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "amount", type: "uint256" }
  ]
} as const;

const processedSpendTxs = new Set<string>();

const RECORD_DEPOSIT_PARAMS = [
  {
    type: "tuple",
    components: [
      { name: "potId", type: "bytes32" },
      { name: "member", type: "address" },
      { name: "encryptedNote", type: "bytes" }
    ]
  }
] as const;

const GET_BALANCE_PARAMS = [
  {
    type: "tuple",
    components: [
      { name: "potId", type: "bytes32" },
      { name: "member", type: "address" }
    ]
  }
] as const;

const app = express();
app.use(cors());
app.use(express.json());

async function lookupProposedPotId(proposalId: Hex): Promise<Hex | null> {
  const params = new URLSearchParams({
    module: "logs",
    action: "getLogs",
    fromBlock: String(VAULT_DEPLOY_BLOCK),
    toBlock: "latest",
    address: VAULT_ADDRESS,
    topic0: SPEND_PROPOSED_TOPIC0,
    topic2: proposalId,
    topic0_2_opr: "and"
  });

  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(`${EXPLORER_URL}/api?${params.toString()}`);
      const json = (await res.json()) as {
        status: string;
        message: string;
        result: { topics: (string | null)[] }[] | string;
      };
      if (json.status === "1" && Array.isArray(json.result) && json.result.length > 0) {
        const topic1 = json.result[0].topics[1];
        if (topic1) return topic1 as Hex;
      }
    } catch (e) {
      console.error("[quietshare] SpendProposed lookup failed:", e);
    }
    if (i < 3) await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  return null;
}

async function verifyOnChainSpend(opts: {
  potId: Hex;
  proposalId: Hex;
  amount: bigint;
  txHash: Hex;
}): Promise<string | null> {
  let receipt: Awaited<ReturnType<typeof rpc.getTransactionReceipt>>;
  try {
    receipt = await rpc.getTransactionReceipt({ hash: opts.txHash });
  } catch {
    return "spend transaction not found on Coston2";
  }
  if (receipt.status !== "success") return "spend transaction did not succeed";

  const logs = parseEventLogs({
    abi: [spendExecutedEvent],
    logs: receipt.logs,
    eventName: "SpendExecuted"
  });
  const match = logs.find(
    (l) =>
      l.address.toLowerCase() === VAULT_ADDRESS.toLowerCase() &&
      l.args.proposalId.toLowerCase() === opts.proposalId.toLowerCase() &&
      l.args.amount === opts.amount
  );
  if (!match) return "transaction is not a matching PotVault spend";

  const proposedPotId = await lookupProposedPotId(opts.proposalId);
  if (!proposedPotId) return "could not confirm this spend belongs to that pot, try again";
  if (proposedPotId.toLowerCase() !== opts.potId.toLowerCase()) {
    return "spend does not belong to this pot";
  }
  return null;
}

// Every route body below is wrapped in try/catch: Express 4 does not catch
// exceptions thrown inside an async handler (that's an Express 5 behavior),
// so an uncaught throw here becomes an unhandled promise rejection — which
// crashes the whole Node process by default. A single malformed request
// (bad hex, wrong-length address, garbage JSON) would otherwise take the
// entire demo server down for every pot until Fly restarts the machine.

app.post("/record-deposit", async (req, res) => {
  try {
    const { potId, member, encryptedNote, timestamp, signature } = req.body as {
      potId: Hex;
      member: Hex;
      encryptedNote: Hex;
      timestamp: number;
      signature: Hex;
    };

    if (!potId || !member || !encryptedNote || !timestamp || !signature) {
      res.status(400).json({ data: null, status: 0, error: "missing fields" });
      return;
    }

    if (!isFreshTimestamp(timestamp)) {
      res.status(400).json({ data: null, status: 0, error: "deposit request expired, try again" });
      return;
    }

    let recovered: Hex;
    try {
      recovered = await recoverMessageAddress({
        message: depositRequestMessage(potId, member, encryptedNote, timestamp),
        signature
      });
    } catch {
      res.status(400).json({ data: null, status: 0, error: "invalid signature" });
      return;
    }

    if (recovered.toLowerCase() !== member.toLowerCase()) {
      res.status(403).json({ data: null, status: 0, error: "signature does not match member" });
      return;
    }

    if (!rememberOnce(`deposit:${signature.toLowerCase()}`)) {
      res.status(403).json({ data: null, status: 0, error: "deposit request already used" });
      return;
    }

    const msgHex = bytesToHex(
      Buffer.from(
        encodeAbiParameters(RECORD_DEPOSIT_PARAMS, [{ potId, member, encryptedNote }]).slice(2),
        "hex"
      )
    );
    const [data, status, error] = await handleRecordDeposit(msgHex);
    res.json({ data, status, error });
  } catch (e) {
    console.error("[quietshare] /record-deposit failed:", e);
    res.status(400).json({ data: null, status: 0, error: "invalid request" });
  }
});

app.post("/balance", async (req, res) => {
  try {
    const { potId, member, timestamp, signature } = req.body as {
      potId: Hex;
      member: Hex;
      timestamp: number;
      signature: Hex;
    };

    if (!potId || !member || !timestamp || !signature) {
      res.status(400).json({ data: null, status: 0, error: "missing fields" });
      return;
    }

    if (!isFreshTimestamp(timestamp)) {
      res.json({ data: null, status: 0, error: "balance request expired, try again" });
      return;
    }

    let recovered: Hex;
    try {
      recovered = await recoverMessageAddress({
        message: balanceRequestMessage(potId, member, timestamp),
        signature
      });
    } catch {
      res.status(400).json({ data: null, status: 0, error: "invalid signature" });
      return;
    }

    if (recovered.toLowerCase() !== member.toLowerCase()) {
      res.status(403).json({ data: null, status: 0, error: "signature does not match member" });
      return;
    }

    const msgHex = bytesToHex(
      Buffer.from(encodeAbiParameters(GET_BALANCE_PARAMS, [{ potId, member }]).slice(2), "hex")
    );
    const [data, status, error] = handleGetBalance(msgHex);
    res.json({ data, status, error });
  } catch (e) {
    console.error("[quietshare] /balance failed:", e);
    res.status(400).json({ data: null, status: 0, error: "invalid request" });
  }
});

app.post("/record-spend", async (req, res) => {
  try {
    const { potId, amount, txHash, proposalId, timestamp, signature, member } = req.body as {
      potId: Hex;
      amount: string;
      txHash: Hex;
      proposalId: Hex;
      timestamp: number;
      signature: Hex;
      member: Hex;
    };

    if (!potId || !amount || !txHash || !proposalId || !timestamp || !signature || !member) {
      res.status(400).json({ data: null, status: 0, error: "missing fields" });
      return;
    }

    if (!isFreshTimestamp(timestamp)) {
      res.status(400).json({ data: null, status: 0, error: "spend request expired, try again" });
      return;
    }

    let amountBig: bigint;
    try {
      amountBig = BigInt(amount);
    } catch {
      res.status(400).json({ data: null, status: 0, error: "amount is not a valid integer" });
      return;
    }
    if (amountBig <= 0n) {
      res.status(400).json({ data: null, status: 0, error: "amount must be > 0" });
      return;
    }

    let recovered: Hex;
    try {
      recovered = await recoverMessageAddress({
        message: spendRequestMessage(potId, member, txHash, proposalId, amount, timestamp),
        signature
      });
    } catch {
      res.status(400).json({ data: null, status: 0, error: "invalid signature" });
      return;
    }

    if (recovered.toLowerCase() !== member.toLowerCase()) {
      res.status(403).json({ data: null, status: 0, error: "signature does not match member" });
      return;
    }

    if (!rememberOnce(`spend-sig:${signature.toLowerCase()}`)) {
      res.status(403).json({ data: null, status: 0, error: "spend request already used" });
      return;
    }

    const verifyError = await verifyOnChainSpend({ potId, proposalId, amount: amountBig, txHash });
    if (verifyError) {
      res.status(400).json({ data: null, status: 0, error: verifyError });
      return;
    }

    const txKey = txHash.toLowerCase();
    if (processedSpendTxs.has(txKey)) {
      res.json({ data: null, status: 1, error: null });
      return;
    }
    processedSpendTxs.add(txKey);
    recordSpendExecuted(potId, amountBig);
    res.json({ data: null, status: 1, error: null });
  } catch (e) {
    console.error("[quietshare] /record-spend failed:", e);
    res.status(400).json({ data: null, status: 0, error: "invalid request" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, mode: "local-demo-bypass" }));

// Belt-and-suspenders on top of the per-route try/catch above: Node exits on
// an unhandled rejection by default, and this server has no restart-on-crash
// story beyond Fly recreating the machine (losing the in-memory ledger). Log
// and keep serving rather than let one missed edge case end the demo.
process.on("unhandledRejection", (reason) => {
  console.error("[quietshare] unhandled rejection (server staying up):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[quietshare] uncaught exception (server staying up):", err);
});

const port = Number(process.env.LOCAL_DEMO_PORT ?? 8090);
app.listen(port, () => {
  console.log(`[quietshare] local demo bypass server on http://localhost:${port}`);
  console.log("[quietshare] NOT the production FCC wire path — see comment at top of this file.");
});
