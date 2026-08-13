/** QuietShare private-ledger handlers. */

import EthCrypto from "eth-crypto";
import { encodeAbiParameters, type Hex } from "viem";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes } from "../base/encoding.js";
import type { HandlerResult } from "../base/types.js";

let identity: ReturnType<typeof EthCrypto.createIdentity>;
let handlers: typeof import("../app/handlers.js");

const RECORD_DEPOSIT_PARAMS = [
  {
    type: "tuple",
    components: [
      { name: "potId", type: "bytes32" },
      { name: "member", type: "address" },
      { name: "encryptedNote", type: "bytes" },
    ],
  },
] as const;

const GET_BALANCE_PARAMS = [
  {
    type: "tuple",
    components: [
      { name: "potId", type: "bytes32" },
      { name: "member", type: "address" },
    ],
  },
] as const;

const POT_ID = ("0x" + "11".repeat(32)) as Hex;
const MEMBER = "0x00000000000000000000000000000000000000A1" as Hex;

function parseData(result: HandlerResult): Record<string, unknown> {
  return JSON.parse(Buffer.from(hexToBytes(result[0]!)).toString("utf-8"));
}

async function encryptedNoteHex(potId: string, amount: string, publicKey: string): Promise<Hex> {
  const encrypted = await EthCrypto.encryptWithPublicKey(publicKey, JSON.stringify({ potId, amount }));
  const json = EthCrypto.cipher.stringify(encrypted);
  return bytesToHex(Buffer.from(json, "utf-8")) as Hex;
}

async function recordDepositMsg(potId: Hex, member: Hex, note: Hex): Promise<string> {
  return encodeAbiParameters(RECORD_DEPOSIT_PARAMS, [{ potId, member, encryptedNote: note }]);
}

function getBalanceMsg(potId: Hex, member: Hex): string {
  return encodeAbiParameters(GET_BALANCE_PARAMS, [{ potId, member }]);
}

beforeAll(async () => {
  identity = EthCrypto.createIdentity();
  process.env.TEE_PRIVATE_KEY = identity.privateKey;
  handlers = await import("../app/handlers.js");
});

beforeEach(() => handlers.resetState());
afterEach(() => handlers.resetState());

describe("handleRecordDeposit", () => {
  it("decrypts the note and credits the on-chain member's private balance", async () => {
    const note = await encryptedNoteHex(POT_ID, "100000000", identity.publicKey);
    const r = await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER, note));
    expect([r[1], r[2]]).toEqual([1, null]);
    expect(parseData(r)).toEqual({
      recorded: true,
      potId: POT_ID.toLowerCase(),
      member: MEMBER,
    });

    const balanceResult = handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER));
    expect(parseData(balanceResult).balance).toBe("100000000");
  });

  it("accumulates multiple deposits from the same member", async () => {
    const note1 = await encryptedNoteHex(POT_ID, "50", identity.publicKey);
    const note2 = await encryptedNoteHex(POT_ID, "25", identity.publicKey);
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER, note1));
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER, note2));

    const r = handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER));
    expect(parseData(r).balance).toBe("75");
  });

  it("rejects a note encrypted to the wrong key", async () => {
    const wrongIdentity = EthCrypto.createIdentity();
    const note = await encryptedNoteHex(POT_ID, "10", wrongIdentity.publicKey);
    const r = await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER, note));
    expect(r[1]).toBe(0);
    expect(r[2]).toContain("decrypting note");
  });

  it("rejects a note whose potId does not match the on-chain potId", async () => {
    const otherPot = ("0x" + "22".repeat(32)) as Hex;
    const note = await encryptedNoteHex(otherPot, "10", identity.publicKey);
    const r = await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER, note));
    expect(r[1]).toBe(0);
    expect(r[2]).toContain("potId does not match");
  });

  it("rejects invalid hex", async () => {
    const r = await handlers.handleRecordDeposit("0xZZ");
    expect(r[1]).toBe(0);
    expect(r[2]).toContain("decoding request");
  });
});

describe("handleGetBalance", () => {
  it("returns zero for a member with no deposits", () => {
    const r = handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER));
    expect([r[1], r[2]]).toEqual([1, null]);
    expect(parseData(r).balance).toBe("0");
  });

  it("never returns another member's balance", async () => {
    const otherMember = "0x00000000000000000000000000000000000000b2" as Hex;
    const note = await encryptedNoteHex(POT_ID, "999", identity.publicKey);
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER, note));

    const r = handlers.handleGetBalance(getBalanceMsg(POT_ID, otherMember));
    expect(parseData(r).balance).toBe("0");
  });
});

describe("recordSpendExecuted", () => {
  const MEMBER_A = "0x00000000000000000000000000000000000000a1" as Hex;
  const MEMBER_B = "0x00000000000000000000000000000000000000b2" as Hex;
  const MEMBER_C = "0x00000000000000000000000000000000000000c3" as Hex;

  it("debits every member proportionally and the total debited matches the spend", async () => {
    const noteA = await encryptedNoteHex(POT_ID, "60", identity.publicKey);
    const noteB = await encryptedNoteHex(POT_ID, "40", identity.publicKey);
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER_A, noteA));
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER_B, noteB));

    handlers.recordSpendExecuted(POT_ID, 50n);

    const balanceA = parseData(handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER_A))).balance;
    const balanceB = parseData(handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER_B))).balance;
    expect(balanceA).toBe("30"); // 60 - 60% of 50
    expect(balanceB).toBe("20"); // 40 - 40% of 50
  });

  it("never drives a small-balance member negative when rounding dust would otherwise land on them", async () => {
    // Regression test: the original implementation dumped 100% of the
    // floor-division rounding remainder onto whichever member happened to be
    // last in iteration order, uncapped by that member's own balance. With
    // balances 10/10/1 (total 21) and a spend of 20, the two non-last members
    // floor to 9 each (18 total), leaving a remainder of 2 — which the old
    // code assigned entirely to the last member regardless of their balance,
    // driving a member with only 1 unit to -1.
    const noteA = await encryptedNoteHex(POT_ID, "10", identity.publicKey);
    const noteB = await encryptedNoteHex(POT_ID, "10", identity.publicKey);
    const noteC = await encryptedNoteHex(POT_ID, "1", identity.publicKey);
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER_A, noteA));
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER_B, noteB));
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER_C, noteC));

    handlers.recordSpendExecuted(POT_ID, 20n);

    const balanceA = BigInt(parseData(handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER_A))).balance as string);
    const balanceB = BigInt(parseData(handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER_B))).balance as string);
    const balanceC = BigInt(parseData(handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER_C))).balance as string);

    expect(balanceA).toBeGreaterThanOrEqual(0n);
    expect(balanceB).toBeGreaterThanOrEqual(0n);
    expect(balanceC).toBeGreaterThanOrEqual(0n);
    expect(balanceA + balanceB + balanceC).toBe(1n); // 21 total - 20 spent = 1 left, exactly
  });

  it("leaves totalDeposited untouched — it only ever tracks deposit history, never spends", async () => {
    const note = await encryptedNoteHex(POT_ID, "100", identity.publicKey);
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER_A, note));

    handlers.recordSpendExecuted(POT_ID, 40n);

    const result = parseData(handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER_A)));
    expect(result.balance).toBe("60");
    expect(result.totalDeposited).toBe("100");
  });
});

describe("reportState", () => {
  it("never exposes balances, only counts", async () => {
    const note = await encryptedNoteHex(POT_ID, "10", identity.publicKey);
    await handlers.handleRecordDeposit(await recordDepositMsg(POT_ID, MEMBER, note));
    handlers.handleGetBalance(getBalanceMsg(POT_ID, MEMBER));

    expect(handlers.reportState()).toEqual({
      potsTracked: 1,
      depositsRecorded: 1,
      balanceQueriesServed: 1,
      spendsRecorded: 0,
    });
  });
});
