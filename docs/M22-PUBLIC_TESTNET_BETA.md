# M22 — Controlled Ultra Testnet beta preparation

**Status: source-only beta workspace built; public beta NOT OPEN.** M22 is a *Testnet-before-mainnet* engineering gate. Do not represent code merge, RPC availability, a wallet account listing or sample market figures as a live financial market. Public issuance, swaps, NFT purchases and mainnet remain disabled.

## Product functionality in this milestone

- Added a visible **Testnet beta** navigation destination (`/#beta`) and M22 dashboard. It clearly distinguishes native Ultra and Ultra EVM chain 18881. Links lead into the existing signed social feed, creator/content coin *draft* labs, read-only/native Uniq source tools and sourced EVM/native portfolio views. The Explore market table, sample prices and NFT gallery remain separately labelled fictional previews.
- `GET /api/beta/status` is a public, cache-disabled **read-only** endpoint. It checks the documented Ultra EVM RPC's chain and head height at request time (single source only, not finality evidence). The response always reports public beta CLOSED, unsigned execution DISABLED, mainnet NOT READY and each external acceptance gate pending. It never returns operator configuration, access tokens, private wallets or unverified audit/volume numbers.
- The wallet lab asks the browser's already-authorized provider for **`eth_accounts` and `eth_chainId` only**, on an explicit tester action. It checks whether the connected account, chain 18881 and current signed-in Looke social session address agree. No `eth_requestAccounts`, wallet signature, allowance, funds or private key is requested by M22. A matching account/session is **not a fresh cryptographic proof** or authorization to mint/trade. Native Ultra accounts are separate, and an extension-reported native address is not independently signed evidence.
- A responsive, keyboard-accessible tester journey links into existing functionality without fabricating success receipts. Failed or unsafe status API responses are treated as *unavailable* and the financial NO-GO stays visible.
- `scripts/m22-beta-smoke.mjs` checks **only** `GET /api/beta/status` on an explicitly approved public HTTPS staging origin. It refuses local/private or credential-bearing URLs, disallows redirects, sends no cookies and rejects any response claiming live financial permission. Node tests cover wrong-chain RPC observations, wallet/session mismatch, fake approval overrides, unsafe URLs and credential-free requests.

## Testnet staging operator procedure (requires external authorization)

1. Obtain the missing Looke Vercel project/preview permissions (previous project creation was denied 403). Deploy the existing main branch to a **protected staging origin** and a separate, appropriately migrated Looke Neon database with dedicated least-privilege credentials. Do not post credentials, attestor keys, mnemonic phrases or private Neon URLs to a chat or repository.
2. Verify that `/#beta` renders on Windows and mobile in a protected session. Use a genuine EVM Testnet wallet on chain 18881; connect with the existing wallet dialog, complete the **existing user-initiated signed login**, and use the read-only M22 account check. Test disconnect, account switch, wrong chain, revoked sessions, reload and two distinct accounts. The M22 wallet check cannot replace signed login.
3. Confirm real Feed create/edit/delete, moderation, likes/follows and access isolation using two tester accounts with logged test evidence. In the creator/content labs, save/edit/delete **private drafts only**; issuance must remain inaccessible. Test hidden/reported posts and stale snapshot rejection in the operator attestor review. Run a separate independent security review before actual issuance.
4. Independently verify native Ultra testnet wallet/device pairing and source-backed Uniq holdings, factory eligibility and resale states. The native chain is separate from Ultra EVM and requires its own wallet-signed transaction evidence and security review.
5. Confirm sourced EVM UOS and approved ERC-20 balances, bounded confirmed transfer events, monitored indexer/reorg checkpoints, and provider/source disagreement handling. Never present an incomplete history, inferred PnL, fictional prices or a sample coin as a real balance/trade.
6. After independent audit and an externally controlled attestor/custody policy, use the M21 **unsigned** testnet factory manifest and separately owner-approved wallet actions. Record genuine externally signed deployment and, later, issuance transaction hashes, pin source-to-runtime provenance and independently inspect the EVM explorer. Use M21's two-RPC read-only acceptance verifier. No part of M22 submits these transactions.
7. Validate operator incident response, backup/RPC outage handling, WAF/rate limits, moderation appeals, UX and keyboard/screen-reader QA. Confirm all financial functionality remains inactive until contracts, liquidity, economics and real receipts have independently passed acceptance. An RFC/PR/CI result alone is not release approval.
8. Run the smoke checker only against your approved HTTPS staging origin:

   ```powershell
   $env:LOOKE_BETA_STAGING_ORIGIN="https://your-approved-staging.example"
   $env:LOOKE_BETA_SMOKE_ACK="READ_ONLY"
   npm run beta:smoke
   ```

   The script returns an honest **preview-only NO-GO** status on success. It cannot approve public trading, add users to any allowlist or activate production.

## Public-betatest / financial release gates (not yet met)

- [ ] Protected HTTPS staging, isolated database and real multi-account QA.
- [ ] Hardware/test-wallet user-authorized Ultra EVM and separate native extension evidence.
- [ ] Reviewed M21 attestor provenance, policy, revocation and independent contract audit.
- [ ] Genuine signed Ultra EVM factory and token receipts, third-party explorer corroboration, indexer reconciliation.
- [ ] Native Uniq signed test acceptance, independent native economic/contract review.
- [ ] Moderation, anti-Sybil/abuse, monitoring, accessible UI and incident response acceptance.
- [ ] Separate economic/liquidity and security approvals for any token issuance, swaps, fees, payouts or mainnet.

**M22 engineering status: gated beta status, navigation, user verification lab and safe smoke tooling implemented; operational Testnet launch acceptance remains partial/blocked.** Existing public financial operations are not activated by a new feature flag, UI button, CI or environment value.
