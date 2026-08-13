import EthCrypto from "eth-crypto";

/**
 * Generates the TEE service's ECIES keypair. In production this runs once, inside
 * the GCP Confidential Space enclave at first boot, and the private key never leaves
 * enclave memory (see docs/architecture.md "State" — the TEE has no durable storage,
 * so real extensions must generate/derive keys at boot rather than load a secret
 * from disk). For local/dev runs against Coston2, generate one here and pass it in
 * via env.
 */
const identity = EthCrypto.createIdentity();

console.log("TEE_PRIVATE_KEY=" + identity.privateKey);
console.log("TEE_PUBLIC_KEY=" + identity.publicKey);
console.log("\nPut TEE_PRIVATE_KEY in fce-extension/.env (the extension container's env).");
console.log("Put TEE_PUBLIC_KEY in frontend/.env.local as NEXT_PUBLIC_TEE_PUBLIC_KEY");
console.log("(the frontend needs it to encrypt deposit notes client-side).");
