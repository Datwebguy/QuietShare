/**
 * ★ ABI decoding for QuietShare's two instruction payloads.
 *
 * Both are ABI-encoded structs, matching RecordDepositMessage / GetBalanceMessage
 * in contracts/QuietShareInstructionSender.sol. The contract attaches `member` as
 * `msg.sender` itself — this handler never trusts a caller-supplied identity field.
 */

import { decodeAbiParameters, type Hex } from "viem";

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

export interface RecordDepositMessage {
  potId: Hex;
  member: Hex;
  encryptedNote: Hex;
}

export interface GetBalanceMessage {
  potId: Hex;
  member: Hex;
}

export function decodeRecordDeposit(data: Hex): RecordDepositMessage {
  try {
    const [decoded] = decodeAbiParameters(RECORD_DEPOSIT_PARAMS, data);
    return { potId: decoded.potId, member: decoded.member, encryptedNote: decoded.encryptedNote };
  } catch (e) {
    throw new Error(`ABI decode failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function decodeGetBalance(data: Hex): GetBalanceMessage {
  try {
    const [decoded] = decodeAbiParameters(GET_BALANCE_PARAMS, data);
    return { potId: decoded.potId, member: decoded.member };
  } catch (e) {
    throw new Error(`ABI decode failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
