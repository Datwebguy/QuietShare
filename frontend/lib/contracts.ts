import { ethers } from "ethers";
import { CONTRACTS } from "./chain";
import { INSTRUCTION_SENDER_ABI, MOCK_STABLE_ABI, POT_VAULT_ABI, USERNAME_REGISTRY_ABI } from "./abis";

export function getTokenContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(CONTRACTS.token, MOCK_STABLE_ABI, signerOrProvider);
}

export function getVaultContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(CONTRACTS.vault, POT_VAULT_ABI, signerOrProvider);
}

export function getInstructionSenderContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(CONTRACTS.instructionSender, INSTRUCTION_SENDER_ABI, signerOrProvider);
}

export function getUsernameRegistryContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(CONTRACTS.usernameRegistry, USERNAME_REGISTRY_ABI, signerOrProvider);
}

/** Deterministic potId from a human-readable pot name, so "Roommates Rent" always
 *  maps to the same bytes32 id — good enough for the demo's invite-by-link flow. */
export function potIdFromName(name: string): string {
  return ethers.id(name.trim().toLowerCase());
}
