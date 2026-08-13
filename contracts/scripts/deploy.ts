import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const MockStable = await ethers.getContractFactory("MockStable");
  const token = await MockStable.deploy();
  await token.waitForDeployment();
  console.log("MockStable (qUSD):", await token.getAddress());

  const PotVault = await ethers.getContractFactory("PotVault");
  const vault = await PotVault.deploy();
  await vault.waitForDeployment();
  console.log("PotVault:", await vault.getAddress());

  console.log("\nAdd these to your .env files:");
  console.log(`NEXT_PUBLIC_TOKEN_ADDRESS=${await token.getAddress()}`);
  console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${await vault.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
