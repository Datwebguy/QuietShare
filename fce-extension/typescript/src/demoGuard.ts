/**
 * Auth helpers for the local-demo HTTP bypass.
 *
 * Message strings MUST stay byte-identical with frontend/lib/localDemo.ts.
 * Replay keys live in process memory only — same lifetime as the ledger.
 */

const REQUEST_MAX_AGE_MS = 5 * 60 * 1000;

const usedKeys = new Map<string, number>();

export function requestMaxAgeMs(): number {
  return REQUEST_MAX_AGE_MS;
}

export function resetDemoGuard(): void {
  usedKeys.clear();
}

/** Returns false if `key` was already consumed and has not yet expired. */
export function rememberOnce(key: string, ttlMs: number = REQUEST_MAX_AGE_MS): boolean {
  const now = Date.now();
  for (const [k, exp] of usedKeys) {
    if (exp <= now) usedKeys.delete(k);
  }
  const existing = usedKeys.get(key);
  if (existing !== undefined && existing > now) return false;
  usedKeys.set(key, now + ttlMs);
  return true;
}

export function isFreshTimestamp(timestamp: number, now: number = Date.now()): boolean {
  return Number.isFinite(timestamp) && Math.abs(now - timestamp) <= REQUEST_MAX_AGE_MS;
}

export function balanceRequestMessage(potId: string, member: string, timestamp: number): string {
  return `QuietShare balance request\npotId:${potId}\nmember:${member}\ntimestamp:${timestamp}`;
}

export function depositRequestMessage(
  potId: string,
  member: string,
  encryptedNote: string,
  timestamp: number
): string {
  return `QuietShare deposit request\npotId:${potId}\nmember:${member}\nencryptedNote:${encryptedNote}\ntimestamp:${timestamp}`;
}

export function spendRequestMessage(
  potId: string,
  member: string,
  txHash: string,
  proposalId: string,
  amount: string,
  timestamp: number
): string {
  return `QuietShare spend request\npotId:${potId}\nmember:${member}\ntxHash:${txHash}\nproposalId:${proposalId}\namount:${amount}\ntimestamp:${timestamp}`;
}

export const SPEND_PROPOSED_TOPIC0 =
  "0xe0cd74888375dd91f90549a37ae85e1d20b01cc360f1a5019383ac85dd843718";
