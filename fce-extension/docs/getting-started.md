# Getting started — local

Runs the Hello World scaffold end to end on a local devnet: deploy the
`InstructionSender`, register the extension, start the TEE node + proxy, and send
`SAY_HELLO` / `SAY_GOODBYE` through it.

## Prerequisites

| Need | Why |
|---|---|
| Docker + Compose | runs the extension TEE, proxy and redis |
| Go 1.25+ | `tools/` CLIs, and the `go` language implementation |
| Foundry (`forge`, `cast`) | compiles `contracts/`, reads chain state |
| Node 20+ / Python 3.11+ | only for `LANGUAGE=typescript` / `python` |
| A funded key | deploys contracts and registers the extension |
| FCC infrastructure running | Hardhat node + indexer + redis + the "normal" TEE proxy. Not in this repo — see `../../e2e/` |

## Pick a language

The scaffold ships the same extension in Go, Python and TypeScript. Discovery is
by directory: each implementation has a `<lang>/language.env` manifest.

```bash
LANGUAGE=go ./scripts/full-setup.sh --test      # or python, typescript
```

`LANGUAGE` can also live in `.env`. See [languages.md](languages.md).

## One command

```bash
cp .env.example .env        # then set DEPLOYMENT_PRIVATE_KEY and CHAIN_ID
./scripts/full-setup.sh --test
```

That chains pre-build (deploy + register) → start-services (node, proxy, redis) →
post-build (allow version, set governance, register TEE) → `test.sh`.

For Coston2, add a tunnel so the proxy is publicly reachable:

```bash
./scripts/full-setup.sh --chain coston2 --tunnel --test
```

## Verify it works

```bash
docker compose ps                      # redis, ext-proxy, extension-tee
curl -s http://localhost:6674/info     # extension id, code hash, platform
./scripts/test.sh                      # SAY_HELLO + SAY_GOODBYE round-trip
```

A passing run prints `Hello, World! Welcome to Flare Confidential Compute.` and
`Goodbye, World!`.

## Configuration

Everything lives in `.env` (start from `.env.example`); per-chain copies go in
`.env.<chain>` and `use-chain.sh` activates them.

| Var | Note |
|---|---|
| `DEPLOYMENT_PRIVATE_KEY` | funded deployer; the Hardhat dev key works on local devnet |
| `CHAIN_URL` / `CHAIN_ID` | `CHAIN_ID` is **required** — unset leaves `chainID=0` and every TEE signature comes back empty |
| `LANGUAGE` | which implementation directory gets built |
| `EXT_PROXY_URL` | this extension's proxy; must be publicly reachable on testnets |
| `SIMULATED_TEE` | `true` on a laptop, **`false`** on real Confidential hardware |

## Ports

| Port | What |
|---|---|
| 6674 | extension proxy, external (Docker) |
| 6664 | extension proxy when run as a local Go process (`--local`) |
| 6662 | the "normal" FTDC proxy (infrastructure, not this repo) |
| 6382 | this extension's redis |

## Stopping

```bash
./scripts/stop-services.sh --chain local
./scripts/stop-services.sh --chain coston2 --tunnel   # also stops the tunnel
```

## Common failures

| Symptom | Cause |
|---|---|
| `config/proxy/extension_proxy.<chain>.docker.toml not found` | it is gitignored; copy the `.example` and fill in the `[db]` credentials |
| docker `rootfs` mount error, or the path is now a directory | an older run mounted the missing config; `rm -rf` the directory, then copy the `.example` |
| `tee-node v… is below the v0.0.22 minimum` | bump the pin in `go/go.mod` **and** `tools/go.mod` |
| `tee-node mismatch` from `check-versions.sh` | the two `go.mod` pins drifted; align them or the Go and non-Go images run different builds |
| `--chain` seems ignored | `.env` is sourced after flag parsing, so `CHAIN` in `.env` wins |
| `signature must be 65 bytes, got 0` | `CHAIN_ID` unset → `chainID=0` |
| `Verification.ChallengeExpired` | `register-tee` ran without `-command rRap` |
| `InvalidGovernanceHash` | `GOVERNANCE_SIGNERS` / `GOVERNANCE_THRESHOLD` differ between `post-build.sh` and the node container |
| `Extension ID already set.` | `setExtensionId()` is one-shot; redeploy the `InstructionSender` |
| `EXTENSION_ID … not found in proxy /info` | the proxy is filtering for a different extension |
| proxy `/info` wait times out on a testnet | `EXT_PROXY_URL` is not reachable from outside — start a tunnel ([cloudflared.md](cloudflared.md)) |
| `pollAction` timeout / `/action/result` 404 | more than one active TEE machine; see [deployment-steps.md](deployment-steps.md) |
