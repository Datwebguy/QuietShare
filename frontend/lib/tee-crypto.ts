import { TEE_PUBLIC_KEY } from "./chain";
import { utf8ToHex } from "./hex";

export interface DepositNote {
  potId: string;
  amount: string; // decimal string, token base units
  memo?: string;
}

/**
 * Encrypts a deposit note to the TEE extension's public key (ECIES), matching the
 * format fce-extension/typescript/src/app/handlers.ts decrypts. The note is what
 * the TEE credits; the ERC20 transfer amount on the same deposit is still public
 * (see README "What's public vs. private"). This is not a shielded-pool encrypt.
 *
 * eth-crypto is imported dynamically (not at module top-level) because its
 * eccrypto fallback contains browser-only code that crashes Next.js's SSR pass
 * of this "use client" page — a dynamic import defers loading it until this
 * function actually runs in the browser.
 */
export async function encryptDepositNote(note: DepositNote): Promise<`0x${string}`> {
  if (!TEE_PUBLIC_KEY) {
    throw new Error("NEXT_PUBLIC_TEE_PUBLIC_KEY is not configured");
  }
  const { default: EthCrypto } = await import("eth-crypto");
  const encrypted = await EthCrypto.encryptWithPublicKey(TEE_PUBLIC_KEY, JSON.stringify(note));
  const json = EthCrypto.cipher.stringify(encrypted);
  return utf8ToHex(json);
}
