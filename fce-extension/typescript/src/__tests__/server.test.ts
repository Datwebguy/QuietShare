/** Server routing and wire format — docs/extension-contract.md §2, §4. */

import { encodeAbiParameters, type Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VERSION } from "../app/config.js";
import * as handlers from "../app/handlers.js";
import { bytesToHex, hexToBytes, stringToBytes32Hex } from "../base/encoding.js";
import { Server } from "../base/server.js";

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

function getBalancePayload(): Uint8Array {
  return hexToBytes(encodeAbiParameters(GET_BALANCE_PARAMS, [{ potId: POT_ID, member: MEMBER }]));
}

let srv: Server;

beforeEach(() => {
  handlers.resetState();
  srv = new Server(0, 0, VERSION, handlers.register, handlers.reportState);
});
afterEach(() => handlers.resetState());

/** Build a POST /action body in the exact shape tee-node sends. */
function buildAction(opts: {
  opType?: string;
  opCommand?: string;
  original?: Buffer | Uint8Array;
  actionId?: string;
} = {}): string {
  const {
    opType = "QUIETSHARE",
    opCommand = "GET_BALANCE",
    original = Buffer.alloc(0),
    actionId = `0x${"11".repeat(32)}`,
  } = opts;

  const dataFixed = {
    instructionId: actionId,
    teeId: `0x${"22".repeat(20)}`,
    timestamp: 1700000000,
    rewardEpochId: 42,
    opType: stringToBytes32Hex(opType),
    opCommand: stringToBytes32Hex(opCommand),
    cosigners: [],
    cosignersThreshold: 0,
    originalMessage: bytesToHex(new Uint8Array(original)),
    additionalFixedMessage: "0x",
  };

  return JSON.stringify({
    data: {
      id: actionId,
      type: "instruction",
      submissionTag: "submit",
      message: bytesToHex(Buffer.from(JSON.stringify(dataFixed), "utf-8")),
    },
    additionalVariableMessages: [],
    timestamps: [],
    additionalActionData: "0x",
    signatures: [],
  });
}

describe("routing", () => {
  it("returns 405 for GET /action", async () => {
    expect((await srv.handleRequest("GET", "/action", ""))[0]).toBe(405);
  });

  it("returns 405 for POST /state", async () => {
    expect((await srv.handleRequest("POST", "/state", ""))[0]).toBe(405);
  });

  it("returns 404 for unknown paths", async () => {
    expect((await srv.handleRequest("GET", "/nope", ""))[0]).toBe(404);
    expect((await srv.handleRequest("POST", "/nope", ""))[0]).toBe(404);
  });

  it("returns 501 for an unknown op type", async () => {
    const [status, body] = await srv.handleRequest(
      "POST", "/action", buildAction({ opType: "NOPE" }),
    );
    expect(status).toBe(501);
    expect(body).toBe("unsupported op type");
  });

  it("returns 501 for an unknown op command", async () => {
    const [status] = await srv.handleRequest(
      "POST", "/action", buildAction({ opCommand: "NOPE" }),
    );
    expect(status).toBe(501);
  });

  it("ignores the query string", async () => {
    expect((await srv.handleRequest("GET", "/state?verbose=1", ""))[0]).toBe(200);
  });
});

describe("malformed input", () => {
  it("returns 400 for a non-JSON body", async () => {
    expect((await srv.handleRequest("POST", "/action", "not json"))[0]).toBe(400);
  });

  it("returns 400 when data is missing", async () => {
    expect((await srv.handleRequest("POST", "/action", '{"foo":1}'))[0]).toBe(400);
  });

  it("returns 400 for invalid hex in message", async () => {
    const body = JSON.stringify({
      data: { id: "0x1", type: "instruction", submissionTag: "submit", message: "0xZZ" },
    });
    expect((await srv.handleRequest("POST", "/action", body))[0]).toBe(400);
  });

  it("returns 400 when message is not JSON", async () => {
    const body = JSON.stringify({
      data: {
        id: "0x1", type: "instruction", submissionTag: "submit",
        message: bytesToHex(Buffer.from("not json")),
      },
    });
    expect((await srv.handleRequest("POST", "/action", body))[0]).toBe(400);
  });
});

describe("ActionResult wire format", () => {
  it("returns the success shape", async () => {
    const [status, body] = await srv.handleRequest(
      "POST", "/action", buildAction({ original: getBalancePayload() }),
    );
    const r = body as Record<string, unknown>;

    expect(status).toBe(200);
    expect(r.status).toBe(1);
    expect(r.log).toBe("ok");
    expect(r.opType).toBe(stringToBytes32Hex("QUIETSHARE"));
    expect(r.opCommand).toBe(stringToBytes32Hex("GET_BALANCE"));
    expect(String(r.data).startsWith("0x")).toBe(true);
  });

  it("sends version as a plain string, not bytes32", async () => {
    // Contract §4.4: tee-node declares `Version string`. The sign repo's
    // Python/TS ports hex-encode this and are wrong; this test pins it.
    const [, body] = await srv.handleRequest(
      "POST", "/action", buildAction({ original: getBalancePayload() }),
    );
    const r = body as Record<string, unknown>;

    expect(r.version).toBe("0.1.0");
    expect(String(r.version).startsWith("0x")).toBe(false);
  });

  it("reports handler failure as HTTP 200 with status 0", async () => {
    const [status, body] = await srv.handleRequest(
      "POST", "/action", buildAction({ original: Buffer.from("not abi") }),
    );
    const r = body as Record<string, unknown>;

    expect(status).toBe(200);
    expect(r.status).toBe(0);
    expect(String(r.log).startsWith("error: ")).toBe(true);
    // Present as "0x", not omitted: the Go struct has no omitempty.
    expect(r.data).toBe("0x");
  });

  it("always emits every field", async () => {
    // tee-node's ActionResult has no omitempty tags, so every field appears on
    // the wire regardless of value. Verified against Go by the conformance
    // fixtures in testdata/conformance/.
    const [, body] = await srv.handleRequest(
      "POST", "/action", buildAction({ original: getBalancePayload() }),
    );
    const r = body as Record<string, unknown>;

    expect(Object.keys(r).sort()).toEqual([
      "additionalResultStatus", "data", "id", "log", "opCommand",
      "opType", "status", "submissionTag", "version",
    ]);
    expect(r.additionalResultStatus).toBe("0x");
  });

  it("echoes id and submissionTag", async () => {
    const actionId = `0x${"ab".repeat(32)}`;
    const [, body] = await srv.handleRequest(
      "POST", "/action", buildAction({ original: getBalancePayload(), actionId }),
    );
    const r = body as Record<string, unknown>;

    expect(r.id).toBe(actionId);
    expect(r.submissionTag).toBe("submit");
  });

  it("returns the requester's own balance", async () => {
    const [, body] = await srv.handleRequest(
      "POST", "/action", buildAction({ original: getBalancePayload() }),
    );
    const r = body as Record<string, unknown>;

    expect(r.status).toBe(1);
    expect(JSON.parse(Buffer.from(hexToBytes(r.data as string)).toString("utf-8"))).toEqual({
      potId: POT_ID,
      member: MEMBER,
      balance: "0",
      totalDeposited: "0",
    });
  });
});

describe("state wire format", () => {
  it("sends stateVersion as bytes32", async () => {
    // Asymmetric with ActionResult.version by design — contract §4.5.
    const [status, body] = await srv.handleRequest("GET", "/state", "");
    const r = body as Record<string, unknown>;

    expect(status).toBe(200);
    expect(r.stateVersion).toBe(stringToBytes32Hex("0.1.0"));
    expect(String(r.stateVersion).length).toBe(66);
  });

  it("reflects handler effects without exposing balances", async () => {
    await srv.handleRequest("POST", "/action", buildAction({ original: getBalancePayload() }));
    const [, body] = await srv.handleRequest("GET", "/state", "");
    const state = (body as { state: Record<string, unknown> }).state;

    expect(state.balanceQueriesServed).toBe(1);
    expect(state).not.toHaveProperty("balance");
  });
});

describe("serialization", () => {
  it("does not wedge the queue when a handler throws", async () => {
    // A rejected handler must not block subsequent requests (contract §5).
    const boom = new Server(0, 0, VERSION, (f) => {
      f.handle("QUIETSHARE", "GET_BALANCE", () => {
        throw new Error("boom");
      });
    }, () => ({ ok: true }));

    await expect(
      boom.handleRequest("POST", "/action", buildAction({ original: getBalancePayload() })),
    ).rejects.toThrow("boom");

    // The queue must still be usable.
    const [status] = await boom.handleRequest("GET", "/state", "");
    expect(status).toBe(200);
  });
});
