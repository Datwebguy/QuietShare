import type { ethers } from "ethers";
import { LOCAL_DEMO_URL } from "./chain";
import { hexToUtf8 } from "./hex";

/**
 * Client for the local demo bypass server (fce-extension/typescript/src/local-demo-server.ts).
 * Calls the exact same decrypt-note / private-ledger handler code as the real FCC
 * extension — only the on-chain instruction relay is skipped. See LOCAL_DEMO_MODE
 * in lib/chain.ts and the README for why.
 */

/** In the real flow, only PotVault's `msg.sender` can ask for their own balance —
 *  that's enforced by the chain itself. This demo server has no chain in the loop
 *  for balance reads, so without this signature anyone who knows a potId/member
 *  pair (both public on-chain) could query anyone else's "private" balance with a
 *  bare curl. Signing proves the caller actually controls `member`'s key. */
export function balanceRequestMessage(potId: string, member: string, timestamp: number): string {
  return `QuietShare balance request\npotId:${potId}\nmember:${member}\ntimestamp:${timestamp}`;
}

// In the real flow, QuietShareInstructionSender attaches msg.sender as `member`
// on chain before a deposit note ever reaches the TEE — a forged note can't
// credit someone else's balance. This demo server has no chain in the loop for
// deposits either, so without this signature anyone who knows a potId/member
// pair (both public) and the TEE's public key (necessarily shipped in this
// same JS bundle, since the browser needs it to encrypt) could forge a validly
// encrypted note and credit an arbitrary member's private balance with a
// deposit that never actually happened. encryptedNote is included in what's
// signed so a captured signature can't be replayed against a swapped-in note.
function depositRequestMessage(potId: string, member: string, encryptedNote: string, timestamp: number): string {
  return `QuietShare deposit request\npotId:${potId}\nmember:${member}\nencryptedNote:${encryptedNote}\ntimestamp:${timestamp}`;
}

// Must match fce-extension/typescript/src/demoGuard.ts spendRequestMessage().
function spendRequestMessage(
  potId: string,
  member: string,
  txHash: string,
  proposalId: string,
  amount: string,
  timestamp: number
): string {
  return `QuietShare spend request\npotId:${potId}\nmember:${member}\ntxHash:${txHash}\nproposalId:${proposalId}\namount:${amount}\ntimestamp:${timestamp}`;
}

interface HandlerResponse<T> {
  data: string | null; // hex-encoded UTF-8 JSON on success
  status: number; // 0 = error, 1 = success
  error: string | null;
}

function decodeData<T>(hex: string): T {
  return JSON.parse(hexToUtf8(hex)) as T;
}

export async function recordDepositLocalDemo(potId: string, member: string, encryptedNote: string, signer: ethers.Signer) {
  const timestamp = Date.now();
  const signature = await signer.signMessage(depositRequestMessage(potId, member, encryptedNote, timestamp));
  const res = await fetch(`${LOCAL_DEMO_URL}/record-deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ potId, member, encryptedNote, timestamp, signature })
  });
  const result = (await res.json()) as HandlerResponse<{ recorded: boolean }>;
  if (result.status === 0) throw new Error(result.error ?? "record-deposit failed");
  return decodeData<{ recorded: boolean; potId: string; member: string }>(result.data!);
}

export async function getBalanceLocalDemo(potId: string, member: string, signer: ethers.Signer) {
  const timestamp = Date.now();
  const signature = await signer.signMessage(balanceRequestMessage(potId, member, timestamp));
  const res = await fetch(`${LOCAL_DEMO_URL}/balance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ potId, member, timestamp, signature })
  });
  const result = (await res.json()) as HandlerResponse<{ balance: string; totalDeposited: string }>;
  if (result.status === 0) throw new Error(result.error ?? "balance read failed");
  return decodeData<{ potId: string; member: string; balance: string; totalDeposited: string }>(result.data!);
}

/** Tells the TEE ledger a pot payout executed, so it can proportionally debit
 *  every member's current stake — see handlers.ts's recordSpendExecuted for
 *  why this has no on-chain-relay counterpart in the real wire contract.
 *  The demo server checks the Coston2 receipt + SpendProposed pot binding;
 *  a bare potId/amount is rejected. */
export async function recordSpendLocalDemo(
  potId: string,
  amount: bigint,
  txHash: string,
  proposalId: string,
  signer: ethers.Signer
) {
  const member = await signer.getAddress();
  const timestamp = Date.now();
  const amountStr = amount.toString();
  const signature = await signer.signMessage(
    spendRequestMessage(potId, member, txHash, proposalId, amountStr, timestamp)
  );
  const res = await fetch(`${LOCAL_DEMO_URL}/record-spend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ potId, member, amount: amountStr, txHash, proposalId, timestamp, signature })
  });
  const result = (await res.json()) as HandlerResponse<null>;
  if (result.status === 0) throw new Error(result.error ?? "record-spend failed");
}
