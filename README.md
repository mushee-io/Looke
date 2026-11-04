# Looke — create on Ultra

Looke is an **Ultra-first** creator platform for coins, native Uniq NFTs and communities. This is a fresh codebase in `mushee-io/looke`. It selectively reuses permitted open-source Zora SDK code; it is **not** a fork of Zora's commercial product, frontend or restricted coin contracts.

## Current capabilities

- Original Next.js frontend with Discover, Create, Uniq NFTs and Messages screens.
- Injected EVM wallet connection with an explicit Ultra EVM **Testnet** chain switch (chain ID `18881`).
- Creator coin draft, local image/metadata validation and fixed-supply preview.
- Independently implemented ERC-20 `LookeCoin` and `LookeCoinFactory` Solidity contracts.
- Wallet-approved `createCoin` transaction path **only when** a verified factory address is configured.
- Unit tests, Foundry contract tests and CI configuration.

**Not yet live:** creator token issuance (no deployed factory address supplied), NFT minting, real swaps/market liquidity, candlesticks, staking, production indexer, social messaging or public beta. A submitted hash is not the same as a confirmed transaction. Nothing here is an audited trading system.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Use an injected EVM wallet and switch to **Ultra EVM Testnet (18881)**. The UI can connect before any contract deployment.

## Tests

```bash
npm test
npm run typecheck
npm run build
forge test -vv
```

Foundry is needed for Solidity tests. The CI workflow runs frontend and contract tests separately.

## Creator coin deployment on testnet

1. Audit and test the independent contracts. There is **no mainnet release approval**.
2. Deploy `LookeCoinFactory` on Ultra EVM Testnet using Foundry with the correct RPC and an operator-controlled test wallet. Do **not** put private keys in the repository.
3. Independently verify contract bytecode and transaction receipt on chain ID 18881.
4. Set `NEXT_PUBLIC_LOOKE_FACTORY_ADDRESS` to that **verified testnet address**, rebuild the app, and connect an EVM wallet.
5. Prepare a valid published JSON metadata URI. Preview the draft, review supply and confirm the wallet transaction.
6. Verify the `CoinCreated` event, token address and actual token supply before declaring success.

The creator receives all fixed-supply tokens at launch. **Trading does not automatically exist**: liquidity pools and swap infrastructure are future work.

## Ultra is two integration tracks

**Ultra EVM:** creator coins, EVM wallets and eventual liquidity. **Ultra native:** Uniq NFT minting, ownership, collections and listings. Native Uniq functionality requires dedicated integration with Ultra's native wallet and APIs, not an ERC-721 factory.

## License and credits

Looke code: MIT, copyright © 2026 Mushee Labs. A small upstream metadata-validation utility from Zora's **MIT-licensed** `@zoralabs/coins-sdk` is vendored under `vendor/zora/` with Zora's MIT license and credit.

**Do not copy the current Zora Coins smart contracts**: multiple active contracts use `ZORA-DELAYED-OSL-v1`, which restricts commercial/competing use pending their applicable open dates. See [licensing and roadmap](docs/LICENSING_AND_ROADMAP.md).


## M2 — authorized Ultra EVM Testnet deployment (in review)

M2 adds an explicit testnet-only factory deployment script, a read-only gas/network preflight,
independent deployment bytecode and transaction receipt verifiers, and an on-chain verified
coin creation flow. None of these steps has deployed a contract on its own.

**Operator workflow** (no automatic broadcast):

```bash
npm install
forge build
npm run m2:preflight
# No signing/broadcast: simulate first
forge script script/DeployLookeCoinFactory.s.sol:DeployLookeCoinFactory --rpc-url https://evm.test.ultra.eosusa.io
# To deploy only AFTER owner authorization: follow docs/M2_TESTNET_RUNBOOK.md
# Then manually provide deployment address and hash:
LOOKE_FACTORY_ADDRESS=0x... LOOKE_FACTORY_DEPLOY_TX=0x... npm run m2:verify-factory
# Only after verification set matching NEXT_PUBLIC_... variables in the web build.
# After wallet-approved launch, verify a real coin-creation transaction:
LOOKE_FACTORY_ADDRESS=0x... LOOKE_COIN_TX=0x... npm run m2:verify-coin
```

See **[M2 Testnet runbook](docs/M2_TESTNET_RUNBOOK.md)** for explicit signing approval,
receipt checks, environment requirements and acceptance criteria. The UI does not
enable token creation without a confirmed factory address **and its real deployment hash**.
Trading, liquidity, Uniq NFT marketplace and live social messaging are out of scope.


## M4 — Verified Ultra EVM Testnet creator-token trading terminal

The `/trade` terminal is an integration for **real, operator-allowlisted V2-compatible Ultra EVM Testnet (chain 18881) pools**. It checks:
- router, factory, pair and ERC20 token code on the actual chain
- `router.factory()`, `pair.factory()`, `factory.getPair()`, `pair.token0/token1`, token creator, and positive real reserves
- real `getAmountsOut()` swap quotes with fixed-chain wallet signing, exact token approvals, bounded slippage (max 3%) and 5-minute deadlines
- real confirmed receipt, pair Swap event and actual ERC20 token Transfer to the wallet
- genuine pair Swap logs to construct trade candles, observed volume and explorer transaction links
- real on-chain balances in the portfolio view

**By default the market registry is empty and execution is disabled.** No funded Ultra EVM V2-compatible router/pair deployment is claimed. Without actual separately authorized liquidity and reviewed addresses, the terminal shows no market and **cannot buy or sell**. It does not fabricate orders, trades, prices or volume. No contract, transaction, or liquidity provisioning has been performed by M4 engineering work.

See [M4 trading testnet runbook](docs/M4_ULTRA_EVM_TRADING_RUNBOOK.md) and `.env.example` for configuration and acceptance steps.

## M3 — native Uniq collections and resale (in review)

The new [Uniq Studio](src/app/uniqs/page.tsx) at `/uniqs` is distinct from
Ultra EVM and includes: native Testnet extension wallet connect, direct
chain-table reads for owned `token.b` Uniqs, `factory.b` collections
and `resale.a` listings, and reviewed action builders for `create.b`,
`issue.b`, `resell`, `cancelresell` and `buy`. These actions are
never signed/broadcast without a user action and wallet approval.

The publicly documented Ultra NFT GraphQL API requires a `client_id`,
so M3 uses the chain's public Testnet RPC via a read-only server route.
M3 does not scrape arbitrary image metadata or invent creator content.
A wallet broadcast hash is *not* claimed as final: listing/buy/mint results
are checked against native Testnet's last irreversible block and relevant
chain-table state. New factory IDs require separate attribution/proof.
No real wallet transactions have been executed by this milestone.

See [M3 Testnet acceptance runbook](docs/M3_NATIVE_UNIQ_RUNBOOK.md) for
prerequisites, Testnet/extension support and operator test cases.

## M5 — creator profiles, public social feed and moderation

`/social` provides a distinct, wallet-signed Ultra EVM Testnet (18881)
social identity. The PostgreSQL-backed API implements real user profiles,
following, public posts, comments, token/Uniq references, search, blocking,
abuse reports, and audit-logged moderator controls.

- Sign-in is a **purpose-limited text signature** with a 5-minute
  single-use nonce, not a transaction, approval or token authorization.
- Sessions are hashed in Postgres and delivered in an HttpOnly
  SameSite=Strict cookie. Writes check same-origin and rate-limit actors.
- No fake posts, likes, follower counts, token holdings or sample conversations.
- The social backend fails closed without `DATABASE_URL`, and
  `LOOKE_SOCIAL_WRITES_ENABLED=false` **by default**.
- Private messaging is **not enabled**; encrypted-envelope table stubs
  await audited client-side encryption, key exchange and recovery.
- Public content links are not wallet-ownership attestations.

**Quick local setup (after reviewing the schema):**

```bash
npm install
# PostgreSQL connection is required; do not commit the credential
export DATABASE_URL=postgres://...
npm run db:migrate
export LOOKE_SOCIAL_APP_ORIGIN=http://localhost:3000
export LOOKE_SOCIAL_WRITES_ENABLED=true
npm run dev
# Visit http://localhost:3000/social
```

The GitHub Actions `social_db` job provisions a **disposable PostgreSQL
16** service for SQL integration tests; it does not touch production.
See [M5 social acceptance runbook](docs/M5_SOCIAL_ACCEPTANCE.md).

## M6 — integrated staging, Testnet proofs and fail-closed beta launch

Looke's new **`/beta`** dashboard combines Ultra EVM, native Ultra Uniq,
verified trading markets, and real PostgreSQL-backed social readiness.

- `/api/beta/health`: checks live Ultra EVM, Ultra native and social DB
  dependencies (503 if degraded); `?mode=live` is a separate CI-only
  liveness response, **not** public readiness.
- `/api/beta/readiness`: verifies **11 independent gates** and never
  reports a public launch until they all pass and the explicitly configured
  release flag is enabled.
- `/api/beta/evidence`: read-only independent factory, creator coin and Uniq
  ownership checks. Disabled by default, enabled only for access-protected
  staging acceptance with `LOOKE_M6_EVIDENCE_ENABLED=true`.
- Public beta additionally requires a real deployment-code hash, verified
  wallet-signed token and Uniq proofs, funded reviewed AMM pools, operational
  social DB, recent operator/security/wallet acceptance records, and a
  **wallet-signed, immutable-Git-revision-bound, ≤24-hour release authorization**.
- CI runs the existing unit/contracts/temporary PostgreSQL tests plus a
  separate **no-broadcast local staging smoke** that asserts the beta is
  closed and that the four application routes render.

All release flags default **false**. The staging configuration
[`deployment/staging.env.example`](deployment/staging.env.example) is
a template only; **no Vercel deployment, database configuration, private
wallet connection, on-chain transaction or public beta launch** is performed
by this engineering milestone.

See [M6 release runbook](docs/M6_INTEGRATED_TESTNET_BETA.md).

## M7 — protected staging, operational checks and acceptance tooling

The M6 beta-readiness foundations are now on `main`. M7 adds a read-only
`/api/ops/monitor` with both Testnet head checks, chain IDs, native
irreversibility, social database schema presence and strict release flag review.
It returns a **503 degraded** status when real dependencies are unavailable.
There are **no synthetic transactions, balances, NFTs, or social users**.

The `m7:acceptance` operator command accepts a private local file with
**public** factory/coin transaction hashes and native Uniq identifiers.
It independently checks receipts and ownership, prints verified/blocked
results, and never uses a wallet or broadcasts any transaction.
`m7:preflight` fails if public beta, social writes, trading or evidence flags
are on. `m7:rollback-plan` only **prints** manual rollback instructions.

The connected Vercel team returned **403 Forbidden** when asked to create a
new Looke staging project with Vercel Authentication on all deployment URLs.
Therefore **no protected Vercel staging deployment was created**; an authorized
team operator must create/protect the project before any release.
All public-beta gates remain closed.

CI has a dedicated `M7 protected staging & read-only acceptance` workflow
with Next.js build/tests and local no-broadcast smoke. The existing M6 smoke
also remains active.

See [M7 staging/acceptance/rollback runbook](deployment/m7-protected-staging.md).

## M8 — live RPC observations, wallet acceptance evidence and operational audit

- `npm run m8:rpc-evidence` makes **actual read-only** Ultra EVM (chain ID
  18881, recent block hash and timestamp) and Ultra-native (canonical
  chain ID, head and irreversible block) calls and saves a machine-readable
  `artifacts/m8/rpc-evidence.json` report. Missing/rejected RPCs are
  **blocked**, never simulated.
- `npm run m8:wallet-acceptance -- ./public-wallet-evidence.json`
  verifies two separately provided EIP-191 text signatures bound to a
  specific review issue, Git revision, staging origin and time, plus native
  Ultra account existence. This is intentionally **not** independently
  approved until a real human verifies the review issue and witnessed
  native wallet connection; no signing takes place in the tool.
- `npm run m8:db-audit` uses a **READ ONLY** PostgreSQL transaction
  to verify PostgreSQL 15+, TLS, social schema and indexes. A disposable
  localhost CI database may explicitly waive TLS; real environments may not.
- `npm run m8:alert-summary` emits clear one-time GitHub Actions
  annotations about absent live evidence; `npm run m8:rollback-rehearsal`
  simulates a safe flag shutdown in memory without touching Vercel.
- A dedicated M8 CI workflow makes live RPC observations and uploads a
  short-retention evidence artifact. Its green status is **not** proof
  the chain checks passed: review `allVerified` in the actual JSON.
  No hourly or scheduled build tasks are created.

**Staging still not deployed:** The connected Vercel team again returned
`403 Forbidden` when asked to create the protected Looke project. No
public preview URL, real wallet evidence or production social database
is claimed. Public beta is **closed**.

See [M8 operator acceptance runbook](deployment/M8_OPERATOR_ACCEPTANCE.md).

## M9 — Protected staging and genuine beta acceptance

M9 expands the read-only Testnet acceptance system with a **new independent
liquidity verifier** for explicitly configured Ultra EVM (18881) V2 AMM
router/factory/pair contracts, creator-token identities and real two-sided
reserves. Without a real, reviewed market allowlist, liquidity stays
**blocked**, and neither trades nor price candles are fabricated.

Run `npm run m9:acceptance` to produce a **12-stage blocked/verified
operator packet**, with actual EVM and native Ultra RPC responses,
optional real wallet-authorized factory/coin/Uniq transaction evidence
and optional TLS-backed PostgreSQL diagnostics. The command cannot
change any launch flag or sign a wallet transaction.

`npm run m9:vercel-audit` performs a **read-only** Vercel project
metadata/environment inspection using an operator's private `VERCEL_TOKEN`.
It requires a dedicated Looke staging project, Vercel Authentication
on **all URLs**, the expected repository and safe Preview/Production flags.
A successful metadata audit still requires an independent signed-out
browser check before staging is accepted.

Connected Vercel project creation remains **HTTP 403 Forbidden**:
there is no deployed or protected Looke staging URL. M9's new CI job
generates a one-shot real evidence artifact and runs safety tests,
but it **does not** install an hourly build, deploy to Vercel,
execute token operations or open the public beta.

Read [M9 operator and security acceptance](deployment/M9_OPERATOR_GATES.md).

## M10 — Independent Testnet proof, protected deployment and beta release safety

M10 adds a **twelfth, mandatory public-beta release gate** that refuses to
open beta without live Vercel staging metadata for the dedicated Looke
project, all-URL deployment authentication, exact safe Preview/Production
environment flags, a READY Preview belonging to the expected project and
immutable Git revision, and a signed-out authentication challenge.
**M10 never opens beta or deploys a Vercel project.** The existing team is
still returning **403 Forbidden** on project creation.

The native Uniq owner reader now makes a targeted `token.b` primary-index
lookup for the requested token ID instead of relying on a wallet's first
50 Uniqs. Factory identity, owner scope and irreversible block evidence
remain required. No NFT transaction is submitted.

`npm run m10:crosscheck` optionally compares genuinely **different**
HTTPS Ultra EVM Testnet providers at one real block hash and independent
native Ultra Testnet providers at one irreversible block ID. With no
second provider configured, independent verification is **blocked**;
single-RPC availability never silently becomes dual-provider agreement.

`npm run m10:acceptance` collects **read-only** live chain status,
secondary-source agreement, real V2 pool checks, optionally actual
wallet-authorized historical factory/coin/Uniq proofs, an optional
READ ONLY TLS-backed PostgreSQL audit, and Vercel deployment protection
state. It writes `artifacts/m10/acceptance.json` and never creates
fake events, sends transactions or opens public beta. Human wallet-witness,
security, audit, backup and operator approvals remain external.

The separate M10 PR-only GitHub Action runs safety tests and a local
no-broadcast staging smoke, plus an **unscheduled** read-only evidence job.
It creates no recurring builds or automated trading.

[Full M10 operator acceptance runbook](deployment/M10_OPERATOR_ACCEPTANCE.md).

### M10 GitHub integration status

M9's five required workflows succeeded and PR #9 is merged into `main`.
M10 PR #10 targets `main`; its initial Vercel authentication unit-test
fixture was corrected to compare normalized deployment origins with the URL
actually fetched. This did **not** relax live Vercel project/protection
checks. M10 must remain in draft until **new** workflows on its final
commit complete successfully. A previously failed workflow on an earlier
SHA is never accepted as evidence of a passing final revision.

Looke's public beta remains closed. Real protected Vercel staging is
unavailable until the team's project-creation `403 Forbidden` is resolved.
