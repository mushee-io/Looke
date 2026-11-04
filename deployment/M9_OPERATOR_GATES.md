# Looke M9 — Protected staging activation and independent beta gates

**Implementation scope:** Read-only Ultra Testnet inspection, independent wallet evidence workflow, liquidity provenance checks, social database audit, Vercel project-protection audit, and rollback/monitoring controls.

**Status on 4 November 2026:** M8 PR #8 was merged into `main` after four successful workflows (standard CI, M6 staging regression, M7 safety regression, M8 live RPC observations). A new read of connected Vercel team `mushee-ios-projects` (`team_sUozs2OsaXlQcWcxyIjWzmRw`) found no existing Looke project. Attempting to create `looke-ultra-staging` with `ssoProtection.deploymentType="all"`, all four public/write flags false, and no automatic Preview deployment **again returned HTTP 403 Forbidden**. The CLI fallback was unavailable. **There is no protected Vercel staging project, deployment, or public URL. Beta remains CLOSED.**

## What M9 verifies, and what it does not

| Layer | Read-only verification | Remains blocked until |
| --- | --- | --- |
| EVM network | Live `eth_chainId=18881`, latest block hash/timestamp freshness | Real latest-block RPC succeeds |
| Ultra native | Real canonical chain ID and recent irreversible block | Native RPC responds correctly |
| Creator coin | Independent M2/M6 factory deployment receipt + CoinCreated logs + token state | Wallet owner explicitly signs a real deployment/coin creation in M2 flow |
| Native Uniq | Real native token/factory ID and owner ledger state | Native wallet owner separately authorizes mint/transfer, then RPC ownership verifies |
| Trading pool | Independently reread allowlisted contract bytecode, router/factory/pair provenance and two nonzero reserves | Reviewed, separately wallet-funded V2 pool exists; contract audit is independent |
| Social PostgreSQL | TLS-backed PG15+, required tables and indexes, READ ONLY schema audit | Staging DB credentials and authorized migrations configured |
| Browser wallet acceptance | Existing M8 signed witness format; no app-generated signatures | Two actual connected wallets, independent reviewer, real GitHub review issue, signed wallet evidence |
| Vercel staging | Read-only scoped project/protection/env audit | Team grants permission and creates protected project, signed-out visitor challenge confirmed |
| Security & release | M6 signed revision-bound release gate plus M9 blockers summary | Real audit, ops approval, funded liquidity review, and safe deploy evidence |
| Rollback | M8 in-memory flag shutdown rehearsal and M7 instructions | Independent exercise of authorized real staging rollback, without disabling protection |

None of these checks supplies fake liquidity, trades, candles, NFT mints, posts, wallet balances, or user signatures. Read-only network availability alone is **not creator-coin or marketplace acceptance**.

## Exact operational blocker — Vercel

The connected Vercel account has read access to team `team_sUozs2OsaXlQcWcxyIjWzmRw`, but receives **403 Forbidden** for project creation. The operator must do ONE of the following inside the intended team:

1. Have an authorized Vercel administrator create the dedicated Next.js project `looke-ultra-staging` from `mushee-io/looke`, OR explicitly grant the connected user project-creation permission.
2. Set **Vercel Authentication for ALL deployment URLs**, including Preview and any deployment alias. Use `ssoProtection.deploymentType="all"`.
3. Configure Preview and Production with **exactly** the following safe settings:
   ```text
   LOOKE_PUBLIC_BETA_ENABLED=false
   LOOKE_M4_TRADING_ENABLED=false
   LOOKE_SOCIAL_WRITES_ENABLED=false
   LOOKE_M6_EVIDENCE_ENABLED=false
   LOOKE_M4_MARKETS_JSON=[]
   ```
   Keep `DATABASE_URL` private in provider secrets; do not create/commit dummy data.
4. Enable Preview deployments only after the project is protected. Limit access to authorized testers and explicitly test the URL while signed out; do not generate bypass URLs.
5. Once created, an authorized operator can run **read-only** `npm run m9:vercel-audit` with `VERCEL_TOKEN` supplied privately in their own shell. It reads the actual Vercel project and env metadata, checks team/project identity, exact repo, all-URL protection and safe flags. It never logs tokens or modifies the project. A metadata pass **does not** prove a browser is challenged; attach the signed-out check to an independently reviewed GitHub issue.
6. Only after every check is performed and an approved immutable Git SHA is chosen should an operator create a single Preview deployment. **M9 does not automatically deploy to Vercel, push a mainnet build, or open public beta.**

Do not bypass the Vercel 403 by deploying to a different team, existing unrelated project, direct public URL, or unprotected hosting provider.

## M9 commands

```bash
npm install
npm run m7:preflight                  # flags must be OFF
npm run m9:acceptance                # actual Testnet chain heads + all launch blockers
npm run m9:liquidity                 # real allowlisted V2 contracts, real reserve amounts
npm run m8:db-audit                  # only when real secure DATABASE_URL exists
npm run m8:wallet-acceptance -- ./public-wallet-evidence.json
npm run m9:vercel-audit              # only authorized operator with VERCEL_TOKEN
npm run m8:rollback-rehearsal       # simulated flags, never remote mutation
```

The `m9:acceptance` script can optionally accept an **existing local JSON manifest of public factory/coin/Uniq IDs and receipt hashes** as in the M7 runbook. The script independently reads each genuine transaction and native ledger. It does not sign. Without this manifest, those three stages remain blocked.

A missing `LOOKE_M4_MARKETS_JSON` stays blocked with no fictitious market. To check real pairs, supply only an externally reviewed JSON registry with actual `factory`, `router`, `pair`, `baseToken`, and `quoteToken` addresses **on chain 18881**. The checker refuses wrong chain, mismatched relationships, absent bytecode, zero reserves, and invalid creator account.

`m9:acceptance` saves `artifacts/m9/acceptance-report.json` with statuses for **12 independent M9 review stages**, live RPC observations and liquidity evidence. Its `status="blocked"` is expected when deployment and approvals are missing. CI still succeeds in creating a truthful report; workflow green **must not** be interpreted as M9 acceptance.

Passing a check is not automatically approval of the paired smart-contract code, token behavior, treasury operations, market integrity or social moderation. A separate security review is required.

## Database and wallet acceptance

Database:
- Require a staging PostgreSQL 15+ database configured via a provider secret; a real external connection must use TLS.
- Apply the existing M5 migration **only** by an explicitly authorized operator.
- Run `npm run m8:db-audit` on an authorized machine. The query uses `BEGIN TRANSACTION READ ONLY`, checks transport TLS, all 12 relations and required indexes.
- Verify backups, role privileges, rate limiting, moderation workflows, retention policy, and restore rehearsal **separately**. The read-only schema audit cannot prove backups or security reviews exist.
- No production DB exists in this engineering run. GitHub's disposable PostgreSQL16 service proves only the schema/test code.

Wallet:
- On the protected staging preview, manually connect an EVM wallet on chain 18881 and an actual Ultra native Testnet extension wallet.
- The `/beta` acceptance screen requests account permissions only. It does not sign, transfer, mint or trade.
- For EVM authentication evidence, have the participant explicitly sign the M8 text-only witness statement **if they choose to** and have an independent second reviewer separately sign the exact statement. These must be provided by people, **never by CI or the assistant**.
- Verify the native account on the real chain. Native account existence does **not** prove wallet ownership; a separately witnessed native wallet connection and signed-off GitHub issue are still required.
- Real M2–M4 Testnet contract operations, if needed for proof, require fresh separate wallet authorization per transaction; no such actions are executed in M9.

## Monitoring, security and rollback

M7 `/api/ops/monitor` returns degraded/HTTP503 when live networks or social DB are down. M8 adds real RPC evidence JSON/one-time GitHub annotations. M9 records pool and 12-stage acceptance status, preserving zero activity when no trades exist.

To roll back **after staging eventually exists**, an authorized operator must:
- Keep/restore Vercel Authentication for every URL.
- Set public beta, trading, social writes and evidence endpoint flags to **false** in the exact protected project and environments.
- Verify the pinned last-known-good Git SHA and preview target; redeploy only after appropriate authorization.
- Check `/api/beta/readiness` reports `publicBetaOpen:false`; check monitor for explicit dependency status.
- Rehearse restoring PostgreSQL from provider backups independently; never simulate successful restoration through code alone.

### Unfulfilled real-world approvals

- [ ] Vercel project-create permission + authenticated staging, signed-out protection test
- [ ] User-authorized M2 factory and creator-coin deployment transactions and verified hashes
- [ ] User-authorized native Uniq mint plus independently confirmed token/factory ownership
- [ ] Reviewed live funded Ultra EVM Testnet V2 liquidity and contract audit
- [ ] Real SSL-backed staging Postgres, moderation, backups and restore
- [ ] Real browser wallet and independent signed acceptance issue
- [ ] External security review, risk controls, operator approval and rollback rehearsal
- [ ] Valid M6 revision-bound, time-limited wallet release signature and every required gate

**Until these are independently completed, PUBLIC BETA IS CLOSED.**
