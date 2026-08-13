# QuietShare — 72 Hour Execution Plan (Flare Summer Signal, due Aug 14 2026)

## Day 1 (today) — Core chain + private compute
1. Hardhat project, `MockStable.sol` (test qUSD) + `PotVault.sol` (createPot/deposit/inviteMember).
2. Deploy to Coston2, verify manually via block explorer.
3. `tee-service`: ECIES encrypt/decrypt utils, event watcher, in-memory ledger, SIWE-style auth, `/pots/:id/balance`.
4. Prove end-to-end with a script: create pot → two "members" deposit encrypted notes → TEE service returns correct private balances to each member, wrong member gets 403.

## Day 2 — Wallet + UI
5. Web3Auth Plug-and-Play integration (Google + Apple) on Coston2, ethers v6 signer.
6. Next.js pages: Login, Dashboard (list/create pot), Pot detail (deposit form, invite-link, private balance card).
7. Wire frontend → contract (deposit tx) → tee-service (balance read) end to end.
8. Stretch: propose/approve spend flow if steps 1–7 land by midday.

## Day 3 — Polish, demo, docs
9. Mobile responsiveness pass, empty/loading/error states, faucet link for test tokens.
10. Deploy frontend (Vercel) + tee-service (Render/Fly — normal container; document GCP Confidential Space as the production TEE target since we don't have cloud credentials to stand up real attested infra in this session).
11. Record 60–90s Loom: login → create pot → invite → two browsers deposit → each sees only their own private balance breakdown, public block explorer shows only "value moved."
12. Finalize README (privacy model, FHESplit credit, what's newly built vs inspired).

## Non-goals for v1 (explicitly out of scope, documented not hidden)
- Real FAssets/FXRP minting flow (XRPL-side multi-tx) — mock stablecoin instead, path documented.
- Etherspot account abstraction / full gas sponsorship — stretch only.
- Real deployment inside GCP Confidential Space — Dockerfile is built for it; attestation verification is a labeled stub in this submission.
- Hiding tx-sender identity on-chain — Ethereum tx sender is always public; what's private is each member's *balance/share* inside the pot, computed and gated by the TEE service, never written to a public contract mapping.
