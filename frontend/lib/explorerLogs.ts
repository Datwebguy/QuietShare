import { ethers } from "ethers";
import { COSTON2_EXPLORER_URL } from "./chain";

// PotVault's Coston2 deployment block (from the explorer's getcontractcreation
// API). The public RPC caps eth_getLogs at a 30-block range — nowhere near
// enough to scan a contract's history in one call, and chunking into ~30-block
// windows would mean well over a thousand requests over the contract's
// lifetime. The block explorer's own logs API queries its indexed database
// instead of a live node, so it isn't subject to that per-call range limit.
const POT_VAULT_DEPLOY_BLOCK = 33_924_593;

interface ExplorerLog {
  topics: (string | null)[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

export interface DecodedVaultEvent {
  args: ethers.Result;
  blockNumber: number;
  transactionHash: string;
}

type ExplorerResponse = { status: string; message: string; result: ExplorerLog[] | string };

/** The explorer indexes blocks slightly behind the chain head, so a query for
 *  an event fired by a transaction that just got confirmed can transiently
 *  fail or come back empty for a moment. Retried with backoff rather than
 *  surfaced immediately — otherwise an action that actually succeeded on
 *  chain (deposit/propose/approve) looks like it failed, when it's really
 *  just the follow-up list refresh racing the indexer. */
async function fetchLogsWithRetry(url: string, attempts = 4, delayMs = 1200): Promise<ExplorerResponse> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      const json = (await res.json()) as ExplorerResponse;
      if (json.status === "1" || json.message === "No records found") {
        return json;
      }
      lastError = new Error(typeof json.result === "string" ? json.result : json.message || "explorer log query failed");
    } catch (e) {
      lastError = e;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastError;
}

/** Fetches PotVault events by name via the block explorer, optionally filtered
 *  to a single indexed bytes32 (potId or proposalId) as topic1. */
export async function fetchVaultEvents(
  vault: ethers.Contract,
  eventName: string,
  indexedTopic1?: string
): Promise<DecodedVaultEvent[]> {
  const fragment = vault.interface.getEvent(eventName);
  if (!fragment) throw new Error(`unknown event ${eventName}`);

  const address = await vault.getAddress();
  const params = new URLSearchParams({
    module: "logs",
    action: "getLogs",
    fromBlock: String(POT_VAULT_DEPLOY_BLOCK),
    toBlock: "latest",
    address,
    topic0: fragment.topicHash
  });
  if (indexedTopic1) {
    params.set("topic1", indexedTopic1);
    params.set("topic0_1_opr", "and");
  }

  const json = await fetchLogsWithRetry(`${COSTON2_EXPLORER_URL}/api?${params.toString()}`);

  if (json.message === "No records found" || !Array.isArray(json.result)) return [];

  const decoded: DecodedVaultEvent[] = [];
  for (const log of json.result) {
    try {
      // Blockscout pads `topics` to a fixed 4-element array with `null` for
      // unused slots (an event with fewer indexed params than 3 still gets
      // trailing nulls) — ethers.parseLog expects only the topics that
      // actually exist, and throws deep inside its ABI decoder on a literal
      // null entry rather than a clean "wrong shape" error.
      const topics = log.topics.filter((t): t is string => t !== null);
      const parsed = vault.interface.parseLog({ topics, data: log.data ?? "0x" });
      if (!parsed) continue;
      decoded.push({
        args: parsed.args,
        blockNumber: parseInt(log.blockNumber, 16),
        transactionHash: log.transactionHash
      });
    } catch {
      // Skip anything that doesn't decode against this ABI rather than fail the whole page.
    }
  }
  return decoded;
}
