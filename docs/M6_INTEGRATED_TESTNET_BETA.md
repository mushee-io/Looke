# Looke M6 — Integrated Ultra Testnet staging & public beta acceptance

**Status at M6 code review:** A development/staging foundation. All production flags are default-OFF. Neither an on-chain creator token/Uniq acceptance transaction nor funded DEX liquidity nor social production database availability is established by committing code. **Public beta is CLOSED.**

## Architecture and read-only verification

| Component | Network / system | Proof checked | Signing |
| --- | --- | --- | --- |
| Creator coin factory | Ultra EVM Testnet 18881 | Successful real contract-creation receipt, >=2 confirmations, code, coinCount(), runtime keccak against separately compiled artifact | No |
| Creator coin | Ultra EVM Testnet 18881 | Successful wallet-sent receipt, exactly one CoinCreated event, token runtime, fixed supply, creator balance, metadata | No |
| Native Uniq | Ultra *native* Testnet | True native chain ID, factory.b and token.b ownership, known factory ID and Uniq token ID, latest irreversible block | No |
| Markets | Ultra EVM Testnet 18881 | Real V2 router/factory/pair relationships, nonzero ERC20/ERC20 liquidity, explicit execution approval flag | No |
| Social | PostgreSQL | Real social schema and moderation tables, reachable database, explicit moderated-write flag and HTTPS application origin | No |
| Wallet acceptance | Browser extensions | Manually connect EVM and Ultra native Testnet wallet **without signing**; independent operator must attach evidence | Only explicit connection permission |
| Review & approval | Operator | Recent GitHub or Testnet explorer review records plus <=24h signature tied to immutable Git commit | Explicit EIP-191 *release* signature, separate from any token operation |

**Public release cannot be activated by passing CI alone.** The actual `/api/beta/readiness` computes eleven gates, all mandatory for public launch. A status of "passed" means that the corresponding configured check passed at the moment it was run; **it is not an independent security audit**. The wallet acceptance, security and operations evidence records are manually supplied and must be reviewed rather than blindly trusted.

## Before staging — project setup

1. Review and merge M2–M5 code via their own CI. Confirm `main` includes M5. M6 is a separate PR.
2. Connect this GitHub repository to a **new protected preview/staging Vercel project**, or use a self-hosted secure HTTPS preview; do not reconfigure an existing public mainnet app. **M6 does not push to Vercel or call a deployment API.**
3. Require hosting-provider Deployment Protection or equivalent before granting access to testers. In-app public beta controls are not an authentication substitute for protecting a staging URL.
4. Copy `deployment/staging.env.example` into host **environment settings**, not the repository. Use actual supported Testnet RPCs. Do not upload private keys, seed phrases, bot tokens, database passwords or raw wallet signatures to Git.
5. Configure a private PostgreSQL 15+ database only after reviewing the M5 migration, run `npm run db:migrate` from a trusted operator environment, check access logs and secure SSL connection. Ensure `LOOKE_SOCIAL_APP_ORIGIN` matches the protected HTTPS staging origin.
6. Keep **all** launch controls off for smoke tests:
   - `LOOKE_PUBLIC_BETA_ENABLED=false`
   - `LOOKE_M6_EVIDENCE_ENABLED=false`
   - `LOOKE_M4_TRADING_ENABLED=false`
   - `LOOKE_SOCIAL_WRITES_ENABLED=false`
7. Read `/api/beta/health?mode=live` to check the server is running (not release-ready). Inspect actual `/api/beta/health` for dependency status. Expect 503 if a database/RPC is unavailable; the **health error must not open beta**.
8. Read `/api/beta/readiness`. Expect `publicBetaOpen:false` and `stage:closed`. A special `?mode=config` output is for local CI smoke and always returns blocked; it must never be treated as real operational acceptance.

## Controlled read-only wallet acceptance

In a *protected* staging preview, open `/beta`:
- **EVM wallet:** manually click **Check EVM wallet**. Verify network is 18881. No `personal_sign` or `eth_sendTransaction` is called by this check.
- **Ultra native wallet:** manually click **Check native wallet**. Confirm Ultra Wallet browser **extension** is on native Ultra Testnet. Do not confuse native Ultra Testnet with Ultra EVM chain 18881.
- For read-only RPC proof checks, only after a protected preview is configured, set `LOOKE_M6_EVIDENCE_ENABLED=true`. The evidence endpoint is disabled by default to prevent uncontrolled on-chain history queries.
- Supply a real factory contract and real deployment hash from chain 18881, then a real creator-coin creation tx on the same factory. Check code, receipt, creator, total supply.
- Supply a real native factory ID, Uniq token ID and owner account; check the native factory and owner token tables. The read uses a bounded inventory page and **fails closed if the portfolio is larger than a single page**.
- Compare results against the official Ultra Testnet explorer and independent RPC. Zero demo activity means zero fabricated evidence. If no genuine transactions exist, the corresponding check remains blocked.

Any wallet action creating/minting/trading assets belongs in the M2–M4 flows, requires its own user-reviewed wallet signature and real Testnet balances, and is **outside this M6 read-only dashboard**.

## Public beta unlock — exact release gates

These inputs are **not provided by CI** and must not be set until independent acceptance:

- `LOOKE_FACTORY_ADDRESS`, `LOOKE_FACTORY_DEPLOY_TX`: a verified 18881 factory and its real creation receipt.
- `LOOKE_M6_FACTORY_RUNTIME_KECCAK`: on-chain runtime bytecode hash matched **independently** to the reviewed local `forge build` artifact. Can be obtained via M2 verifier, not guessed.
- `LOOKE_M6_COIN_CREATION_TX`: a real wallet-signed Testnet creator coin launch from that factory, with event/creator balance verified.
- `LOOKE_M6_UNIQ_FACTORY_ID`, `LOOKE_M6_UNIQ_TOKEN_ID`, `LOOKE_M6_UNIQ_OWNER`: a verified real Uniq mint and native owner on Ultra native Testnet.
- `LOOKE_M4_MARKETS_JSON`: validated real V2-compatible pair, router and factory with **positive reserves**; `LOOKE_M4_TRADING_ENABLED=true` only after security approval.
- `DATABASE_URL`, `LOOKE_SOCIAL_APP_ORIGIN`, `LOOKE_SOCIAL_WRITES_ENABLED=true`: real production-grade schema, TLS/credentials and moderation/abuse controls accepted.
- `LOOKE_M6_ACCEPTANCE_JSON`: structured records for `walletAcceptance`, `securityReview`, `operationsApproval`. Each record is `{"url":"https://github.com/mushee-io/looke/issues/NUMBER","reviewer":"0xREAL_REVIEWER_WALLET","reviewedAt":"2026-11-04T...Z"}`, with a real existing Looke GitHub review/issue or Ultra Testnet explorer transaction URL, an operator/reviewer wallet, and a timestamp from the last 30 days. **These fields are illustrative placeholders, not evidence; do not copy verbatim.** Review the linked evidence before enabling.
- `LOOKE_BETA_RELEASE_SIGNER`: an actual authorized operator EVM address that must **equal** the wallet in the `operationsApproval` record.
- `LOOKE_BETA_RELEASE_REVISION`: the immutable 40-character Git commit SHA deployed to hosting, equal to `VERCEL_GIT_COMMIT_SHA` (or configured `LOOKE_M6_DEPLOY_REVISION` on self-managed setups).
- `LOOKE_BETA_RELEASE_EXPIRES_AT`: an ISO UTC expiry **in the next 24 hours**, never a long-lived approval.
- `LOOKE_BETA_RELEASE_SIGNATURE`: EIP-191 signature of the **exact** message emitted by `npm run m6:release-text -- SHA ISO_EXPIRY`. The message is a release-only text authorization; it cannot transfer funds. The signature and release flag are separate release operations.
- Finally set `LOOKE_PUBLIC_BETA_ENABLED=true` **only after every gate passes** and organizational approval. Recompute `/api/beta/readiness`. If ANY mandatory gate becomes blocked or the signature expires, the dashboard returns `publicBetaOpen:false`.

The code does not automatically change hosting deployment protection or publish an app. Removing hosting protection is an additional **explicit human operational action** that must be done only after the deployment is signed and approved.

## CI / smoke / monitoring

- Standard GitHub Actions CI: Next.js build, TypeScript/unit tests, Forge build and tests, PostgreSQL 16 temporary migration/integration tests.
- M6 `m6-staging.yml`: builds the site with ALL beta-related flags OFF; starts a **local** Next.js instance on loopback `127.0.0.1:3100`; verifies `/beta`, `/uniqs`, `/social`, and `/trade` render; verifies local liveness, that configuration readiness is CLOSED, that evidence is disabled, and POST is not accepted on evidence endpoints.
- These workflow jobs **never broadcast contracts, execute market making, send NFT transactions, connect a live wallet, or deploy to Vercel**.
- Monitor HTTP 503 on `/api/beta/health` when dependencies are degraded, alerts and availability via existing host monitoring; use only aggregate metrics, not private keys, session cookies, sensitive wallet address logs or message content.
- Retention, backups, provider audit, rate-limit/DDoS review, accessibility, mobile acceptance, wallet permissions, rollback rehearsal and independent security assessment remain operator gates; a CI pass is not a public-beta approval.

## Halt / rollback procedures

1. Turn `LOOKE_PUBLIC_BETA_ENABLED=false` and re-deploy host configuration.
2. Disable `LOOKE_M4_TRADING_ENABLED`, `LOOKE_SOCIAL_WRITES_ENABLED`, and `LOOKE_M6_EVIDENCE_ENABLED` as appropriate.
3. Keep preview deployment protection in place. Review events and security alerts before re-opening.
4. No private keys are kept in repo; revoke/update compromised credentials through the provider.
5. Issue a **new** operator signature for a new reviewed Git revision; never reuse approval for a different commit.

**Out of scope:** production mainnet, permissionless market maker, automatic testnet trade generation, real-world value transfers, unrestricted social messaging or automatic deployment. M6 tests do not prove those systems operational.
