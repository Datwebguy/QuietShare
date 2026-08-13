/**
 * ★ MAIN CUSTOMIZATION POINT: QuietShare's private-ledger handlers.
 *
 * This is the actual confidential compute: the pot's per-member balances are
 * computed and held ONLY here, inside the TEE process, never in a public contract
 * mapping. State is intentionally not persisted to disk (the TEE has no durable
 * storage, per docs/architecture.md) — it's fully reconstructible by replaying and
 * decrypting on-chain RECORD_DEPOSIT instructions with TEE_PRIVATE_KEY.
 *
 * Handler contract: (originalMessageHex) => [dataHexOrNull, status, errorOrNull].
 * status 0 = error, 1 = success. See docs/extension-contract.md §4.6.
 */

import EthCrypto from "eth-crypto";
import type { Hex } from "viem";

import { bytesToHex, hexToBytes } from "../base/encoding.js";
import type { Framework, HandlerResult } from "../base/types.js";

import { decodeGetBalance, decodeRecordDeposit } from "./abi.js";
import { OP_COMMAND_GET_BALANCE, OP_COMMAND_RECORD_DEPOSIT, OP_TYPE_QUIETSHARE, TEE_PRIVATE_KEY } from "./config.js";

interface DepositNote {
  potId: string;
  amount: string; // decimal string, token base units
  memo?: string;
}

// --- Private ledger -----------------------------------------------------------
// potId (lowercase) -> member address (lowercase) -> balance in token base units.
// `ledger` is the member's CURRENT stake — it moves both ways: up on deposit,
// down (proportionally, see debitSpend) when the pot pays something out.
// `totalDeposited` is separate and monotonic: the running total of everything
// a member has ever put in, never reduced by a spend. The UI shows both so
// "your balance went down" after an approved payment doesn't read as your
// deposit history being rewritten.
const ledger = new Map<string, Map<string, bigint>>();
const totalDeposited = new Map<string, Map<string, bigint>>();
let depositsRecorded = 0;
let balanceQueriesServed = 0;
let spendsRecorded = 0;

/** Reset all state. Used by tests; not part of the wire contract. */
export function resetState(): void {
  ledger.clear();
  totalDeposited.clear();
  depositsRecorded = 0;
  balanceQueriesServed = 0;
  spendsRecorded = 0;
}

/** Wire handlers to (opType, opCommand) pairs. */
export function register(framework: Framework): void {
  framework.handle(OP_TYPE_QUIETSHARE, OP_COMMAND_RECORD_DEPOSIT, handleRecordDeposit);
  framework.handle(OP_TYPE_QUIETSHARE, OP_COMMAND_GET_BALANCE, handleGetBalance);
}

/** Snapshot returned by GET /state. Intentionally excludes balances — see docs/architecture.md. */
export function reportState(): unknown {
  return {
    potsTracked: ledger.size,
    depositsRecorded,
    balanceQueriesServed,
    spendsRecorded,
  };
}

function creditDeposit(potId: string, member: string, amount: bigint): void {
  const potKey = potId.toLowerCase();
  const memberKey = member.toLowerCase();

  let pot = ledger.get(potKey);
  if (!pot) {
    pot = new Map();
    ledger.set(potKey, pot);
  }
  pot.set(memberKey, (pot.get(memberKey) ?? 0n) + amount);

  let depositedPot = totalDeposited.get(potKey);
  if (!depositedPot) {
    depositedPot = new Map();
    totalDeposited.set(potKey, depositedPot);
  }
  depositedPot.set(memberKey, (depositedPot.get(memberKey) ?? 0n) + amount);
}

/** Reduces every member's current stake proportionally to their share of the
 *  pot at the moment a payout executes — the pot is commingled money, so a
 *  payment isn't "whose" deposit it came from, everyone's stake shrinks
 *  together. Floor division per member never debits more than that member's
 *  own balance (amount < total here always makes the ratio < 1), but it
 *  under-debits the total by up to (memberCount - 1) base units of rounding
 *  dust. That remainder is handed out one base unit at a time to members who
 *  still have balance left, cycling through the group — never dumped onto a
 *  single member, which previously could (and did) push a small-balance
 *  member's tracked balance negative. If the pot's tracked total is less
 *  than `amount` — the in-memory ledger can drift from the chain's real
 *  potTotal after a server restart, since this ledger isn't persisted —
 *  every member is floored to zero rather than going negative.
 */
function debitSpend(potId: string, amount: bigint): void {
  const potKey = potId.toLowerCase();
  const pot = ledger.get(potKey);
  if (!pot || pot.size === 0 || amount <= 0n) return;

  const total = [...pot.values()].reduce((sum, b) => sum + b, 0n);
  if (total <= 0n) return;

  if (amount >= total) {
    for (const member of pot.keys()) pot.set(member, 0n);
    return;
  }

  const members = [...pot.entries()];
  const shares = new Map<string, bigint>();
  let remaining = amount;
  for (const [member, balance] of members) {
    const share = (balance * amount) / total;
    shares.set(member, share);
    remaining -= share;
  }

  // remaining is at most (members.length - 1) here, so one full extra pass
  // around the group is always enough — the `* 2` is just headroom, not load-bearing.
  for (let i = 0; remaining > 0n && i < members.length * 2; i++) {
    const [member, balance] = members[i % members.length];
    const already = shares.get(member)!;
    if (already < balance) {
      shares.set(member, already + 1n);
      remaining -= 1n;
    }
  }

  for (const [member, balance] of members) {
    pot.set(member, balance - shares.get(member)!);
  }
}

function readBalance(potId: string, member: string): bigint {
  return ledger.get(potId.toLowerCase())?.get(member.toLowerCase()) ?? 0n;
}

function readTotalDeposited(potId: string, member: string): bigint {
  return totalDeposited.get(potId.toLowerCase())?.get(member.toLowerCase()) ?? 0n;
}

/** QUIETSHARE/RECORD_DEPOSIT — ABI-encoded (bytes32 potId, address member, bytes encryptedNote). */
export async function handleRecordDeposit(msg: string): Promise<HandlerResult> {
  // 1. Decode
  let hex: string;
  try {
    hex = bytesToHex(hexToBytes(msg));
  } catch (e) {
    return [null, 0, `decoding request: invalid hex: ${String(e)}`];
  }

  let decoded: { potId: Hex; member: Hex; encryptedNote: Hex };
  try {
    decoded = decodeRecordDeposit(hex as Hex);
  } catch (e) {
    return [null, 0, `decoding request: ${e instanceof Error ? e.message : String(e)}`];
  }

  // 2. Validate + decrypt. The note is what this ledger credits. The on-chain
  //    ERC20 transfer amount for the same deposit is still public.
  if (!TEE_PRIVATE_KEY) {
    return [null, 0, "TEE_PRIVATE_KEY not configured"];
  }

  let note: DepositNote;
  try {
    const cipherJson = Buffer.from(decoded.encryptedNote.slice(2), "hex").toString("utf-8");
    const encrypted = EthCrypto.cipher.parse(cipherJson);
    const plaintext = await EthCrypto.decryptWithPrivateKey(TEE_PRIVATE_KEY, encrypted);
    note = JSON.parse(plaintext) as DepositNote;
  } catch (e) {
    return [null, 0, `decrypting note: ${e instanceof Error ? e.message : String(e)}`];
  }

  if (note.potId.toLowerCase() !== decoded.potId.toLowerCase()) {
    return [null, 0, "note potId does not match on-chain potId"];
  }

  let amount: bigint;
  try {
    amount = BigInt(note.amount);
  } catch {
    return [null, 0, "note amount is not a valid integer"];
  }
  if (amount <= 0n) {
    return [null, 0, "note amount must be > 0"];
  }

  // 3. Execute — member is the on-chain msg.sender the contract attached, never
  //    a value from inside the encrypted note, so a forged note can't credit
  //    someone else's balance.
  creditDeposit(decoded.potId, decoded.member, amount);
  depositsRecorded++;

  // 4. Respond
  const resp = { recorded: true, potId: decoded.potId, member: decoded.member };
  return [bytesToHex(Buffer.from(JSON.stringify(resp), "utf-8")), 1, null];
}

/** QUIETSHARE/GET_BALANCE — ABI-encoded (bytes32 potId, address member). */
export function handleGetBalance(msg: string): HandlerResult {
  // 1. Decode
  let hex: string;
  try {
    hex = bytesToHex(hexToBytes(msg));
  } catch (e) {
    return [null, 0, `decoding request: invalid hex: ${String(e)}`];
  }

  let decoded: { potId: Hex; member: Hex };
  try {
    decoded = decodeGetBalance(hex as Hex);
  } catch (e) {
    return [null, 0, `decoding request: ${e instanceof Error ? e.message : String(e)}`];
  }

  // 2. Validate — nothing extra; any address may ask for its own balance.
  // 3. Execute
  const balance = readBalance(decoded.potId, decoded.member);
  const deposited = readTotalDeposited(decoded.potId, decoded.member);
  balanceQueriesServed++;

  // 4. Respond — only the caller's own balance, never another member's.
  const resp = {
    potId: decoded.potId,
    member: decoded.member,
    balance: balance.toString(),
    totalDeposited: deposited.toString(),
  };
  return [bytesToHex(Buffer.from(JSON.stringify(resp), "utf-8")), 1, null];
}

/** Demo-mode-only: proportionally debits every member's current stake when a
 *  spend executes on chain. This has no counterpart in the real wire contract
 *  — QuietShareInstructionSender.sol only ever forwards deposit notes and
 *  balance queries to the TEE, since spending was added directly on
 *  PotVault.sol with no on-chain relay to notify the confidential-compute
 *  side at all. So unlike the two handlers above, this isn't dispatched
 *  through the framework's opType/opCommand routing — local-demo-server.ts
 *  calls it directly off PotVault's public SpendExecuted event. */
export function recordSpendExecuted(potId: string, amount: bigint): void {
  debitSpend(potId, amount);
  spendsRecorded++;
}
