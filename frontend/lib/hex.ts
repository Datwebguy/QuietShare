/**
 * Browser-native hex/UTF-8 helpers. Deliberately avoid `Buffer` here — it's a
 * Node global that Next.js/webpack does not polyfill for client bundles, so
 * referencing it directly in "use client" code is a silent landmine.
 */

export function utf8ToHex(text: string): `0x${string}` {
  const bytes = new TextEncoder().encode(text);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return `0x${hex}`;
}

export function hexToUtf8(hex: string): string {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}
