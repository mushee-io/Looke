# Looke M10 — Independent Ultra Testnet Acceptance and Protected Beta Gate

**Updated integration state, 4 Nov 2026:** M9 PR #9 passed all five required workflows and merged into `main` (merge commit `82e461b929c9b2b58cf520ea5cefbb1537e3a714`). M10 PR #10 was retargeted to `main`, with its M9 ancestry reconciled. M10 must **not** merge until CI on its final commit is green. The connected Vercel team `mushee-ios-projects` has no Looke staging project and still rejects project creation with **403 Forbidden**. No deployment, wallet signature, financial transaction, liquidity addition, NFT mint, database provisioning, or public beta opening has occurred.

## New security invariant

M10 upgrades `/api/beta/readiness` from **11 to 12 mandatory gates**, adding `stagingProtection`. All 12 gates must pass for `publicBetaOpen` to ever be true, including the previously required signed Git-revision-bound release authorization. The new gate is deliberately **blocked by default**, even if an operator accidentally enables `LOOKE_PUBLIC_BETA_ENABLED=true`.

This gate independently requires ALL of:
1. Authorized server-only Vercel token with read-only project and environment access; never expose `VERCEL_TOKEN` in NEXT_PUBLIC variables, Git, CI, social content, or logs.
2. Dedicated Vercel project `looke-ultra-staging`, team `team_sUozs2OsaXlQcWcxyIjWzmRw`, linked specifically to `mushee-io/looke`.
3. `ssoProtection.deploymentType=all` (Vercel Authentication across **all deployment URLs**).
4. Exact disabled Preview **and** Production environment values:
   ```text
   LOOKE_PUBLIC_BETA_ENABLED=false
   LOOKE_M4_TRADING_ENABLED=false
   LOOKE_SOCIAL_WRITES_ENABLED=false
   LOOKE_M6_EVIDENCE_ENABLED=false
   LOOKE_M4_MARKETS_JSON=[]
   ```
5. The `LOOKE_M10_STAGING_URL` is canonical HTTPS `*.vercel.app`, and actually appears among READY **Preview** deployments of this exact project, with the same immutable deployed Git SHA.
6. A signed-out HTTP request (without any auth cookie or bypass header) is blocked by a recognizable Vercel authentication challenge. A 200, 404 or ordinary application redirect does **not** pass.

**Important configuration distinction:** the safe staging environment has all four write flags false and cannot open beta. A future public rollout requires a separate, independently approved deployment environment/release policy and explicit re-evaluation of all conditions. M10 is not a claim that such a rollout is operational or ready. An operator cannot override this gate with a self-attested JSON link or a GitHub CI green badge.

Because no Vercel project exists and permission remains denied, the staging-protection gate will remain blocked in M10. An administrator must grant project creation permission or create this *dedicated authenticated project* before integration can continue. Do not deploy into another project or disable protection to get a preview URL.

## Native Uniq ownership: targeted verification

The M6/M7 reader previously looked only at the first 50 `token.b` rows of a native Ultra account and rejected larger holdings. M10 now performs an **exact primary-index lookup** scoped to the claimed owner:
- `token.b` table, claimed owner scope, `lower_bound = tokenId`, `limit = 1`.
- The returned token must have the requested token ID and the same real native factory ID. Factory must separately exist, and the result must have a positive irreversible ledger height.
- This is a **read-only** ownership proof; it neither creates, transfers, buys nor lists any Uniq.
- An owner-scoped table result is not proof the user controls the browser wallet; acceptance still needs an actual witnessed native extension connection and independent approval.

## EVM creator coins and liquidity

For actual wallet-created Testnet coins, the existing verifier requires the real factory deployment receipt and bytecode, real successful creator-coin receipt emitted from that factory, token bytecode, supply, creator balance, and a factory `CoinCreated` event whose `creator` matches the actual transaction signer. No wallet private key or synthetic transaction is accepted.

```bash
npm run m10:acceptance -- ./actual-public-testnet-proofs.json
npm run m9:liquidity
```

The optional local manifest reuses the M7 format for actual public factory/creator coin/native Uniq IDs and receipt hashes. If absent, those checks remain **blocked**. No transaction is sent.

For pools, M9 reads actual V2 pair/router/factory token relationships, code existence, creator identity and **nonzero two-sided reserves**. With no allowlisted, independently reviewed market, liquidity remains zero and trading stays disabled. This does not equate to a smart-contract security audit.

## Independent chain RPC: two separate providers

The previous M8/M9 work verified single live EVM and native RPCs. M10 adds an **optional second-provider proof**. Without a second configured independent provider, a green CI run does **not** claim dual-provider agreement.

Configure two distinct, trusted HTTPS provider hostnames in your own operator environment:

```text
ULTRA_EVM_RPC_URL=https://evm.test.ultra.eosusa.io
LOOKE_M10_SECONDARY_EVM_RPC_URL=https://<second-verified-ultra-evm-provider>
ULTRA_NATIVE_TESTNET_RPC_URL=https://ultra-testnet.eosphere.io
LOOKE_M10_SECONDARY_NATIVE_RPC_URL=https://<second-verified-native-ultra-provider>
```

The secondary URLs above are **placeholders**, not known working endpoints. Replace only with verified actual provider addresses. No arbitrary IP/private, non-HTTPS, credential-bearing or unknown-host origins are accepted.

```bash
npm run m10:crosscheck
# Real output: artifacts/m10/dual-rpc.json
```

- EVM: both nodes must return chain 18881, recent timestamps, compatible heads, and the same hash at a mutually confirmed block height.
- Native: both nodes must return the canonical native Ultra Testnet chain ID and must agree on the actual irreversible block ID at a common ledger height.
- Any RPC mismatch, missing second source, stale/invalid response or unavailable endpoint reports **blocked**.
- The checker cannot sign or broadcast, so **zero user transactions** are initiated.

## Social DB, wallet witnesses and security signoff

- The existing `m8:db-audit` checks a real external TLS-backed PostgreSQL 15+ connection in a READ ONLY transaction, social schema, indexes and encryption in transit. Disposable localhost CI PostgreSQL proves software only, **not production readiness**.
- Provider backups, restoration test, rate limiting, privacy/retention, moderation review and credential permissions require separate operator acceptance.
- `m8:wallet-acceptance` checks two independent human-provided EIP-191 text signatures (wallet holder and reviewer), native account existence and a review issue. It intentionally **cannot** approve a human-review issue merely from a well-formed URL. The real native wallet browser extension must be witnessed independently.
- Real coin and Uniq ownership must be supported by genuine user-authorized historical transactions. No M10 job requests or signs new transactions.
- Security auditor and product/operations signoff must be recorded externally and independently verified. A completed PR or CI run is not an audit.

## Monitoring, rollback and operator action

Run `npm run m10:acceptance` to save `artifacts/m10/acceptance.json` containing genuine single- and dual-RPC statuses, optional receipts, liquidity, social DB/TLS state, staging protection, and the 12 M9 operator gates. The JSON never claims beta was opened; missing inputs are blocked.

Existing `/api/ops/monitor` returns 503 for degraded live chain or PostgreSQL. GitHub Actions performs a **one-shot** read-only acceptance during PR review and uploads its short-retention artifact. **No hourly builds, bots, automated trading, periodic monitoring jobs or open beta are initiated.**

`npm run m8:rollback-rehearsal` rehearses setting public beta, trading, social writes and evidence APIs to false **in memory only**. A **real** rollback must be carried out by an authorized Vercel operator on the exact protected project, retaining authentication and verifying a known-good pinned SHA and database backups. No M10 script changes Vercel environments.

## Current blockers

- [x] Latest M9 commit's five CI workflows completed successfully; M9 merged before M10.
- [ ] Vercel administrator authorizes and verifies dedicated all-URL-authenticated staging project.
- [ ] A real protected Preview deployment passes signed-out Vercel authentication and pinned revision check.
- [ ] Optional second, trusted EVM and native RPC providers cross-verify real canonical blocks.
- [ ] Real wallet-approved creator-coin factory and coin receipts and a native Uniq-owned token exist.
- [ ] Actual audited/approved funded V2 liquidity is supplied and verified.
- [ ] Real TLS-backed staging social DB, backup restoration and moderation are accepted.
- [ ] Two real-wallet witnessed acceptance records and independent human issue review are completed.
- [ ] Independent security audit and ops approval recorded.
- [ ] All beta release gates and a separately approved signed-revision release authorization pass.

**M10 PR #10 remains draft until all GitHub Actions workflows on its final SHA pass. Public beta remains CLOSED.**
