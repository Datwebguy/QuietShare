import { afterEach, describe, expect, it } from "vitest";

import {
  balanceRequestMessage,
  depositRequestMessage,
  isFreshTimestamp,
  rememberOnce,
  requestMaxAgeMs,
  resetDemoGuard,
  spendRequestMessage,
} from "../demoGuard.js";

afterEach(() => resetDemoGuard());

describe("rememberOnce", () => {
  it("accepts a key the first time and rejects a replay", () => {
    expect(rememberOnce("deposit:0xabc")).toBe(true);
    expect(rememberOnce("deposit:0xabc")).toBe(false);
  });

  it("treats different keys as independent", () => {
    expect(rememberOnce("deposit:0x1")).toBe(true);
    expect(rememberOnce("deposit:0x2")).toBe(true);
  });
});

describe("isFreshTimestamp", () => {
  it("accepts now and rejects a 5-minute-old timestamp", () => {
    const now = 1_700_000_000_000;
    expect(isFreshTimestamp(now, now)).toBe(true);
    expect(isFreshTimestamp(now - requestMaxAgeMs() - 1, now)).toBe(false);
  });
});

describe("request messages", () => {
  it("match the frontend byte-for-byte contract", () => {
    expect(balanceRequestMessage("0xpot", "0xmember", 123)).toBe(
      "QuietShare balance request\npotId:0xpot\nmember:0xmember\ntimestamp:123"
    );
    expect(depositRequestMessage("0xpot", "0xmember", "0xnote", 123)).toBe(
      "QuietShare deposit request\npotId:0xpot\nmember:0xmember\nencryptedNote:0xnote\ntimestamp:123"
    );
    expect(spendRequestMessage("0xpot", "0xmember", "0xtx", "0xprop", "50", 123)).toBe(
      "QuietShare spend request\npotId:0xpot\nmember:0xmember\ntxHash:0xtx\nproposalId:0xprop\namount:50\ntimestamp:123"
    );
  });
});
