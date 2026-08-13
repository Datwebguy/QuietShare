/**
 * ★ Configuration: version and operation identifiers.
 *
 * These strings MUST match the bytes32 constants in
 * contracts/QuietShareInstructionSender.sol exactly, or actions fall through to
 * "unsupported op type".
 */

export const VERSION = "0.1.0";

export const OP_TYPE_QUIETSHARE = "QUIETSHARE";
export const OP_COMMAND_RECORD_DEPOSIT = "RECORD_DEPOSIT";
export const OP_COMMAND_GET_BALANCE = "GET_BALANCE";

/**
 * The TEE's ECIES private key, used to decrypt deposit notes encrypted client-side
 * to TEE_PUBLIC_KEY (see frontend/lib/tee-crypto.ts). In production this is
 * generated inside the Confidential Space enclave on first boot and never leaves
 * it. For local/dev runs it's supplied via env — generate one with
 * `npm --prefix tee-service run keygen` (or any eth-crypto identity) and set both
 * TEE_PRIVATE_KEY here and NEXT_PUBLIC_TEE_PUBLIC_KEY in the frontend.
 */
export const TEE_PRIVATE_KEY = process.env.TEE_PRIVATE_KEY ?? "";

if (!TEE_PRIVATE_KEY) {
  // eslint-disable-next-line no-console
  console.warn("[quietshare] TEE_PRIVATE_KEY is not set — RECORD_DEPOSIT will fail to decrypt notes.");
}
