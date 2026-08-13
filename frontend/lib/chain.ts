export const COSTON2_CHAIN_ID_DEC = 114;
export const COSTON2_CHAIN_ID_HEX = "0x72"; // per Flare's official Web3Auth Coston2 config
export const COSTON2_RPC_URL =
  process.env.NEXT_PUBLIC_COSTON2_RPC_URL ?? "https://coston2-api.flare.network/ext/C/rpc";
export const COSTON2_EXPLORER_URL = "https://coston2-explorer.flare.network";
export const COSTON2_FAUCET_URL = "https://faucet.flare.network/coston2";

export const CONTRACTS = {
  token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? "",
  vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "",
  instructionSender: process.env.NEXT_PUBLIC_INSTRUCTION_SENDER_ADDRESS ?? "",
  usernameRegistry: process.env.NEXT_PUBLIC_USERNAME_REGISTRY_ADDRESS ?? ""
};

// The FCE extension's TEE proxy, exposed via ngrok/cloudflared per
// fce-extension/docs/getting-started.md. Balance reads poll this directly —
// GET {EXT_PROXY_URL}/action/result/{instructionId} (fce-extension/tools/pkg/fccutils/tee_calls.go).
export const EXT_PROXY_URL = process.env.NEXT_PUBLIC_EXT_PROXY_URL ?? "";

// TEE's ECIES public key (from `npm --prefix fce-extension/typescript run keygen`).
// Used to encrypt deposit notes client-side before they ever touch the chain.
export const TEE_PUBLIC_KEY = process.env.NEXT_PUBLIC_TEE_PUBLIC_KEY ?? "";

// LOCAL DEMO MODE — see fce-extension/typescript/src/local-demo-server.ts.
// The real FCC wire (registry → proxy → TEE node) needs a Flare-internal indexer
// database not available in this build. When true, the confidential-compute leg
// (record deposit note / read private balance) talks directly to a local Express
// server that runs the *same* handler code, skipping only the on-chain relay.
// PotVault deposits still go through the real Coston2 chain either way.
export const LOCAL_DEMO_MODE = process.env.NEXT_PUBLIC_LOCAL_DEMO_MODE === "true";
export const LOCAL_DEMO_URL = process.env.NEXT_PUBLIC_LOCAL_DEMO_URL ?? "http://localhost:8090";
