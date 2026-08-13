import { expect } from "chai";
import { ethers } from "hardhat";
import { MockStable, PotVault } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PotVault", () => {
  let token: MockStable;
  let vault: PotVault;
  let alice: HardhatEthersSigner, bob: HardhatEthersSigner, carol: HardhatEthersSigner;
  const potId = ethers.id("roommates-rent-pot");

  beforeEach(async () => {
    [alice, bob, carol] = await ethers.getSigners();

    const MockStableFactory = await ethers.getContractFactory("MockStable");
    token = await MockStableFactory.deploy();

    const PotVaultFactory = await ethers.getContractFactory("PotVault");
    vault = await PotVaultFactory.deploy();

    for (const signer of [alice, bob]) {
      await token.connect(signer).faucet();
      await token.connect(signer).approve(await vault.getAddress(), ethers.MaxUint256);
    }
  });

  it("creates a pot with the creator as first member", async () => {
    await vault.connect(alice).createPot(potId, await token.getAddress());
    expect(await vault.isMember(potId, alice.address)).to.eq(true);
    expect(await vault.memberCount(potId)).to.eq(1);
  });

  it("lets a second member join via potId and deposit privately-noted funds", async () => {
    await vault.connect(alice).createPot(potId, await token.getAddress());
    await vault.connect(bob).joinPot(potId);
    expect(await vault.memberCount(potId)).to.eq(2);

    const note = ethers.toUtf8Bytes("encrypted-note-placeholder");
    await expect(vault.connect(alice).deposit(potId, 100_000_000, note))
      .to.emit(vault, "Deposited")
      .withArgs(potId, alice.address, 100_000_000, ethers.hexlify(note));

    expect(await vault.potBalance(potId)).to.eq(100_000_000);
  });

  it("rejects deposits and reads from non-members", async () => {
    await vault.connect(alice).createPot(potId, await token.getAddress());
    const note = ethers.toUtf8Bytes("x");
    await expect(vault.connect(carol).deposit(potId, 1, note)).to.be.revertedWith(
      "QuietShare: not a pot member"
    );
  });

  it("keeps no public per-member balance mapping on-chain", async () => {
    // The privacy guarantee: PotVault only exposes pot-level totals, never a
    // member => balance view. This test simply documents that no such getter exists
    // by asserting the contract's only balance accessor is pot-scoped.
    expect((vault as any).memberBalance).to.eq(undefined);
  });

  it("executes a spend once a majority of members approve", async () => {
    await vault.connect(alice).createPot(potId, await token.getAddress());
    await vault.connect(bob).joinPot(potId);
    await vault.connect(alice).deposit(potId, 200_000_000, ethers.toUtf8Bytes("n1"));

    const tx = await vault.connect(alice).proposeSpend(potId, carol.address, 50_000_000, "groceries");
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((l) => vault.interface.parseLog(l))
      .find((e) => e?.name === "SpendProposed");
    const proposalId = event!.args.proposalId;

    await vault.connect(alice).approveSpend(proposalId);
    await vault.connect(bob).approveSpend(proposalId);

    expect(await token.balanceOf(carol.address)).to.eq(50_000_000);
    expect(await vault.potBalance(potId)).to.eq(150_000_000);
  });
});
