# QuietShare

A dead-simple group money pot. Log in with Google or Apple, create a pot,
share a link, deposit, and see your share — without ever touching a seed phrase.
Built for the **Flare Summer Signal hackathon**, Confidential Compute track.

> Roommates splitting rent. A family saving for a trip. Friends collecting for a
> gift. QuietShare is the pot, not a full expense app. On-chain you see that a pot
> exists, who is in it, and that value moved (including ERC20 amounts). Per-member
> share is not stored in any public contract mapping — it is computed in the TEE
> and the app will only serve it to the member asking about themselves. A chain
> observer who replays public `Deposited` / `SpendExecuted` logs can still
> recompute those shares; hiding the transfer amount would need a shielded pool,
> which is out of scope.

## Live

- App: [quietshare-app.fly.dev](https://quietshare-app.fly.dev)
- Local demo bypass server: [quietshare-demo-tee.fly.dev](https://quietshare-demo-tee.fly.dev) (health check: `/health`)

Both are deployed on Fly.io. See "A blocker we hit, and how we handled it"
below for exactly what "local demo bypass" means and why it exists.

## Inspiration & credit

QuietShare's high-level idea — private group money, not full expense tracking —
was inspired by **[FHESplit](https://github.com/Wagalidoom/ethrome)** (2nd place,
Zama track, ETHRome 2025), which built private expense splitting using Fully
Homomorphic Encryption. We are **not** cloning their code or using FHE. We took
the "private group money" idea and implemented a simpler pot model on **Flare's
Confidential Compute** stack (TEEs), which is a genuinely different privacy
mechanism from FHE. Full credit to the FHESplit team for the original concept.

## What's public vs. private

| | Public (on-chain) | Private (TEE-only) |
|---|---|---|
| A pot exists | ✅ `PotVault.createPot` | |
| Who's a member | ✅ (`PotVault.members`) | |
| That a deposit happened, and its raw amount (standard ERC20 transfer) | ✅ | |
| **Each member's balance / share of the pot** | ❌ never stored in a contract mapping | ✅ computed & held in the Confidential Compute process; the API will not serve it to anyone else. A chain observer can still recompute it from public deposit/spend logs (see below). |
| Deposit memos | note format supports an optional memo | UI does not collect one today |

**Why the deposit amount is visible:** an ERC20 transfer's amount is unavoidably
public on any EVM chain — hiding that requires a shielded pool (ZK/FHE), which is
out of scope for a 3-day build and honestly disclosed here rather than faked.
`PotVault.sol` is deliberately designed to never store a per-member balance
mapping. The TEE decrypts each deposit note and holds the running share, and
will only return that number to a caller who authenticates as that member
(on-chain `msg.sender` on the real path; a 5-minute, one-use signature on the
demo bypass). That is an access-controlled cache, not confidentiality against
someone reading Coston2: current share is a deterministic function of public
`Deposited` amounts and public `SpendExecuted` amounts. The app will not show
another member's number; the explorer will still let you add it up.

## Architecture

Login is one tap: Google or Apple via **Web3Auth** (classic `@web3auth/modal` v9
API), which creates a non-custodial embedded wallet for the user via MPC/threshold
key management. Nobody — not the user, not us — ever sees a seed phrase or private
key; the app only ever touches the resulting signer.

```
┌─────────────────┐      social login       ┌──────────────────────┐
│   Next.js app    │ ───────────────────────▶│  Web3Auth (Google/    │
│  (mobile-first)  │◀─────── EIP-1193 ────────│   Apple → embedded    │
└────────┬─────────┘         provider         │      wallet)          │
         │                                    └──────────────────────┘
         │ 1. PotVault.deposit()  (real ERC20 transfer, amount is public)
         │ 2. QuietShareInstructionSender.sendRecordDeposit()
         │    — message = (potId, msg.sender, ECIES-encrypted note)
         ▼
┌───────────────────────────┐   TeeExtensionRegistry.sendInstructions()
│  PotVault.sol (Coston2)    │ ─────────────────────────────────────────▶ TEE machine
│  QuietShareInstructionSender│                                             │
└───────────────────────────┘                                             ▼
                                                          ┌──────────────────────────────┐
         3. sendGetBalance() ─────────────────────────▶  │ QuietShare FCE extension      │
            (embeds msg.sender, so you can only ever      │ (Flare Confidential Compute,  │
             read your own balance)                       │  Intel TDX / GCP Confidential │
                                                            │  Space)                       │
         4. poll EXT_PROXY_URL/action/result/{id} ◀──────  │  - decrypts notes with a key  │
                                                            │    that never leaves the TEE  │
                                                            │  - holds the private per-     │
                                                            │    member balance ledger      │
                                                            └──────────────────────────────┘
```

## Exactly how we use Flare Confidential Compute

This is not a generic "TEE-flavored" backend — it's built on Flare's actual,
documented **Flare Confidential Compute (FCC)** extension framework
([dev.flare.network/fcc](https://dev.flare.network/fcc/overview)), cloned from
the official [`fce-extension-scaffold`](https://github.com/flare-foundation/fce-extension-scaffold)
and customized in [`fce-extension/`](./fce-extension):

1. **`fce-extension/contracts/QuietShareInstructionSender.sol`** — the only
   on-chain address allowed to submit instructions to our TEE machines
   (enforced by Flare's `TeeExtensionRegistry`). It defines two ops:
   - `RECORD_DEPOSIT` — carries `(potId, member, encryptedNote)`, where
     `member` is `msg.sender` **attached by the contract itself**, never a
     caller-supplied value, so a forged note can't credit someone else.
   - `GET_BALANCE` — carries `(potId, member)`, same on-chain-attached
     authentication, so the TEE only ever answers with *your own* balance.
2. **`fce-extension/typescript/src/app/handlers.ts`** — the actual
   confidential compute. `RECORD_DEPOSIT` decrypts the note with the TEE's
   ECIES private key and credits an in-memory ledger
   (`potId → member → balance`) that is **never persisted anywhere public**.
   `GET_BALANCE` reads from that same ledger. Per Flare's own docs, a TEE
   process has no durable storage — so in the **real wire path**, this ledger
   is fully reconstructible by replaying and decrypting on-chain
   `RECORD_DEPOSIT` instructions, which is exactly what makes it trustworthy:
   the private state's integrity comes from the chain + the enclave key, not
   from a database we could tamper with. **Caveat for the deployed demo
   specifically:** the local-demo bypass (see below) never puts
   `RECORD_DEPOSIT` on chain at all, so that replay path isn't actually wired
   up in what's live today — a restart of `quietshare-demo-tee.fly.dev`
   currently loses the in-memory ledger with no recovery. Implementing the
   replay (scan `PotVault`'s `Deposited` events, which do carry
   `encryptedNote` on-chain per `contracts/PotVault.sol`, and decrypt each
   with `TEE_PRIVATE_KEY` on boot) would close this for the demo path too;
   it just isn't done yet.
3. **Production path (honestly scoped):** the scaffold's Docker image is
   designed to run unmodified inside a **GCP Confidential Space** VM (Intel
   TDX), which produces a hardware attestation binding the running code hash
   to Google's root of trust. See `fce-extension/docs/deployment-steps.md` for
   the exact commands to point this at a real TEE machine — the handler code
   itself does not change.

## A blocker we hit, and how we handled it

Getting a real, deployed FCC extension talking to Coston2 needs one more piece
neither `fce-extension-scaffold`'s public docs nor this repo ship: the
`tee-proxy`'s indexer database. Per `fce-extension/docs/getting-started.md`,
this indexer — plus, for local devnet mode, a Hardhat node and a "normal" TEE
proxy — lives in a separate, non-public `../../e2e/` repo maintained by Flare.
**This is true for both Coston2 and local/simulated mode** — there's no fully
public path to running the registry → proxy → TEE-node relay without either
Flare-issued Coston2 indexer credentials or access to that internal repo.

Everything up to that point in this repo is real and independently verified:
- `PotVault` + `MockStable` are **live on Coston2** (see addresses below) —
  create pot, deposit, and membership all run against the real chain.
- `QuietShareInstructionSender.sol` is a correctly-registered-shape contract;
  its Go bindings were regenerated from our actual (renamed) contract via
  `forge` + `abigen`, and `fce-extension/tools` compiles and vets clean against
  it — nothing here silently deploys the scaffold's original Hello World logic.
- The extension's own handler code — the actual confidential-compute logic —
  is fully implemented and tested (47 passing tests: decrypt, private ledger,
  wire format, balance isolation between members).

What we couldn't do without the missing infra is exercise that handler code
*through the real on-chain relay*. Rather than leave a broken demo or fake a
result, `fce-extension/typescript/src/local-demo-server.ts` runs the **exact
same** `handlers.ts` used by the real extension behind a small local HTTP
server, so the private-balance feature is genuinely demoable today. It skips
on-chain instruction submission/fees, TEE node signing, and hardware
attestation. One thing it does **not** skip: on the real path,
`QuietShareInstructionSender.sol` attaches `msg.sender` as `member` on-chain,
so a caller can't ask for or credit anyone's balance but their own — that
guarantee has no chain to lean on here, so `/balance` and `/record-deposit`
require the caller to sign a message proving they control the address they're
claiming to be (`recoverMessageAddress` against a 5-minute-fresh, **one-use**
signature) before either read or write proceeds. `/record-spend` is stricter
than a signature alone: the server fetches the Coston2 receipt, requires a
matching `PotVault.SpendExecuted`, and checks the explorer's `SpendProposed`
log so the spend is bound to the claimed `potId`. A bare `{potId, amount}` is
rejected. Each spend `txHash` is applied at most once.

Verified manually end-to-end: a deposit note encrypted client-side and recorded
via this path correctly credits only the depositing member's balance — a
different member querying the same pot gets `0`, proving API isolation actually
works, not just that the code compiles — and an unsigned/mismatched request to
`/balance` or `/record-deposit` is rejected outright.

`frontend/.env.local`'s `NEXT_PUBLIC_LOCAL_DEMO_MODE=true` controls this — it's
documented here rather than flagged in the UI, so this section is the place to
check what mode a given deployment is running in. Switching to the real FCC
relay once indexer infra is available is **not** a one-line env change:
`QuietShareInstructionSender` still has to be deployed, and it has no
`RECORD_SPEND` op — spend-debit exists only on this demo path (or would need
boot replay of `Deposited` + `SpendExecuted`). Deposit/balance `handlers.ts`
logic itself does not change.

## What's newly built vs. scaffolded

| Piece | Status |
|---|---|
| `contracts/` (PotVault, MockStable, Hardhat, tests) | 100% new |
| `fce-extension/contracts/QuietShareInstructionSender.sol` | New (adapted from the scaffold's `HelloWorldInstructionSender.sol` pattern) |
| `fce-extension/typescript/src/app/{config,abi,handlers}.ts` | New (the scaffold's own "customization point" files) |
| `fce-extension/typescript/src/base/*`, `scripts/`, `tools/`, `docker*` | Unmodified Flare scaffold infra (`docs/extension-guide.md`: "do not modify") |
| `frontend/` (Next.js app, Web3Auth login, deposit/balance UI) | 100% new |

## Repo layout

```
contracts/        PotVault.sol + MockStable.sol — Hardhat project, deploys to Coston2
fce-extension/     Flare Confidential Compute extension (cloned+customized scaffold)
frontend/          Next.js 14 + Tailwind, mobile-first
docs/              Execution plan
```

## Live on Coston2

| Contract | Address |
|---|---|
| `FXRP` (real FAsset, faucet-funded) | [`0x0b6A3645c240605887a5532109323A3E12273dc7`](https://coston2-explorer.flare.network/address/0x0b6A3645c240605887a5532109323A3E12273dc7) |
| `MockStable` (qUSD, kept for reference, no longer the default) | [`0xE395e7Cf5dc172aD447253ab53aa66F5dcc1A5Ef`](https://coston2-explorer.flare.network/address/0xE395e7Cf5dc172aD447253ab53aa66F5dcc1A5Ef) |
| `PotVault` | [`0xb3994e1d198aA61181306154Fe3f2DC031DC3216`](https://coston2-explorer.flare.network/address/0xb3994e1d198aA61181306154Fe3f2DC031DC3216) |
| `UsernameRegistry` (optional display names, purely cosmetic) | [`0xc12645A10b51f687367cFba0f0b2b5074f406111`](https://coston2-explorer.flare.network/address/0xc12645A10b51f687367cFba0f0b2b5074f406111) |

`PotVault` takes the pot's token as a parameter at `createPot` time, not a
fixed address, so no contract redeploy was needed to switch the frontend's
default token from `MockStable` to real `FXRP` — pots created before this
switch keep using `MockStable`; new pots use `FXRP`. `FXRP` resolves on-chain
via `FlareContractRegistry` (`0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`) →
`getContractAddressByName("AssetManagerFXRP")` → `fAsset()`, and is directly
faucet-available at https://faucet.flare.network/coston2 — no FAssets minting
flow needed on testnet.

`QuietShareInstructionSender` is not yet deployed — it needs the Flare indexer
infra described above; see "A blocker we hit" for the demo path used instead.

## Running it

### 1. Contracts (already deployed above — redeploy only if you want your own)

```bash
cd contracts
npm install
cp .env.example .env   # set DEPLOYER_PRIVATE_KEY (funded via https://faucet.flare.network/coston2)
npm run deploy:coston2
```

### 2. Confidential Compute extension — local demo mode

```bash
cd fce-extension/typescript
npm install
npm run keygen   # generates TEE_PRIVATE_KEY / TEE_PUBLIC_KEY
# paste TEE_PRIVATE_KEY into fce-extension/config/extension.env (create it if missing)
npm run demo     # starts the local demo bypass server on :8090
```

To run the **real** on-chain path instead once you have Flare indexer access:
copy `.env.example` → `.env` in `fce-extension/`, set
`INITIAL_OWNER`/`DEPLOYMENT_PRIVATE_KEY`, fill in
`config/proxy/extension_proxy.coston2.docker.toml` from its `.example`, start a
tunnel (`docs/cloudflared.md`), then `./scripts/full-setup.sh --chain coston2 --test`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in addresses above, a Web3Auth client ID, keep LOCAL_DEMO_MODE=true
npm run dev
```

### Deploying to Fly.io

Both services ship with a `Dockerfile` + `fly.toml` and are already deployed
(see "Live" above). To redeploy your own copy:

```bash
# Local demo bypass server
cd fce-extension/typescript
flyctl apps create <your-app-name>
flyctl secrets set TEE_PRIVATE_KEY=0x... --app <your-app-name>
flyctl deploy --app <your-app-name>

# Frontend — NEXT_PUBLIC_* vars are inlined at build time, so they're passed
# as --build-arg, not runtime secrets. Point NEXT_PUBLIC_LOCAL_DEMO_URL at the
# demo server's Fly URL from the step above.
cd frontend
flyctl apps create <your-app-name>
flyctl deploy --app <your-app-name> \
  --build-arg NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=... \
  --build-arg NEXT_PUBLIC_TOKEN_ADDRESS=0x0b6A3645c240605887a5532109323A3E12273dc7 \
  --build-arg NEXT_PUBLIC_VAULT_ADDRESS=0xb3994e1d198aA61181306154Fe3f2DC031DC3216 \
  --build-arg NEXT_PUBLIC_USERNAME_REGISTRY_ADDRESS=0xc12645A10b51f687367cFba0f0b2b5074f406111 \
  --build-arg NEXT_PUBLIC_TEE_PUBLIC_KEY=... \
  --build-arg NEXT_PUBLIC_LOCAL_DEMO_MODE=true \
  --build-arg NEXT_PUBLIC_LOCAL_DEMO_URL=https://<your-demo-app>.fly.dev
```

Whichever domain the frontend ends up on must be added to the Web3Auth
dashboard's allowed origins, or social login will fail there.

## Non-goals for v1 (disclosed, not hidden)

- Minting FXRP from XRPL yourself (the real XRPL-side collateral/mint flow) —
  the app deposits real Coston2 `FXRP` (see "Live on Coston2"), sourced from
  the [Coston2 faucet](https://faucet.flare.network/coston2) instead, since
  testnet FXRP is directly faucet-available there with no minting flow needed.
- Etherspot account abstraction / full gas sponsorship — Web3Auth gives the
  embedded wallet and social login; gasless transactions are a stretch goal.
- Live GCP Confidential Space attestation — see "Production path" above.
- Hiding the depositor's on-chain identity — an EVM tx sender is always public;
  what's private is each member's resulting balance, per the table above.
- Declining or expiring a spend proposal — `PotVault.proposeSpend` has no
  reject/expiry path, so an unapproved proposal just sits open indefinitely.
  It doesn't block anything else (deposits, balance reads, and other proposals
  all work fine), so this was deliberately deprioritized this close to the
  deadline: fixing it needs a contract change and a redeploy to a new address,
  which would orphan every pot created against the current one.
