import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const UsernameRegistry = await ethers.getContractFactory("UsernameRegistry");
  const registry = await UsernameRegistry.deploy();
  await registry.waitForDeployment();
  console.log("UsernameRegistry:", await registry.getAddress());

  console.log("\nAdd this to your .env files:");
  console.log(`NEXT_PUBLIC_USERNAME_REGISTRY_ADDRESS=${await registry.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
