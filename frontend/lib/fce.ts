import { EXT_PROXY_URL } from "./chain";
import { hexToUtf8 } from "./hex";

export interface ActionResult {
  id: string;
  submissionTag: string;
  status: number; // 0 = error, 1 = success (fce-extension/docs/extension-contract.md §4.4)
  log: string;
  opType: string;
  opCommand: string;
  additionalResultStatus: string;
  version: string;
  data: string; // hex-encoded UTF-8 JSON
}

/**
 * Polls the TEE extension's proxy for an instruction's result — the client-facing
 * half of the flow documented in fce-extension/docs/extension-guide.md:
 * "Caller polls the proxy for the result" at GET /action/result/{instructionId}.
 */
export async function pollActionResult<T>(
  instructionId: string,
  { timeoutMs = 30_000, intervalMs = 1_500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<T> {
  if (!EXT_PROXY_URL) {
    throw new Error("NEXT_PUBLIC_EXT_PROXY_URL is not configured");
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${EXT_PROXY_URL}/action/result/${instructionId}`);
    if (res.status === 404) {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    if (!res.ok) {
      throw new Error(`proxy returned ${res.status}`);
    }
    const result = (await res.json()) as ActionResult;
    if (result.status === 0) {
      throw new Error(`TEE handler error: ${result.log}`);
    }
    return JSON.parse(hexToUtf8(result.data)) as T;
  }
  throw new Error("timed out waiting for TEE result — is the extension proxy running and tunneled?");
}
