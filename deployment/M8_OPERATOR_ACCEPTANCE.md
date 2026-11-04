# Looke M8 — Live staging acceptance, evidence and rollback

**Operational state on 4 November 2026:** M7 PR #7 merged after passing standard CI, M6 closed-beta staging CI and M7 operational CI. No public release is authorized. Both the read-only Ultra network proof collector and read-only PostgreSQL audit are implemented; **their live outcomes are only genuine when real endpoints respond successfully and their reports say verified**.

## Vercel access is still blocked

The connected team is `mushee-ios-projects` (`team_sUozs2OsaXlQcWcxyIjWzmRw`). It returned **zero existing projects** on reinspection. Creation of the distinct `looke-ultra-staging` project, with **Vercel Authentication protection on ALL deployment URLs** and these four flags all **false**:
- `LOOKE_PUBLIC_BETA_ENABLED=false`
- `LOOKE_M4_TRADING_ENABLED=false`
- `LOOKE_SOCIAL_WRITES_ENABLED=false`
- `LOOKE_M6_EVIDENCE_ENABLED=false`

was rejected again by Vercel with **HTTP 403 Forbidden: no project-creation permission**. No project, deployment URL, staging DB, wallet session, contract execution or beta activation was produced. No permission bypass or publicly exposed preview was attempted. An authorized team administrator must create or grant creation permission for a dedicated protected project. Project creation is a separate action from deploying; do not attempt the latter until protection and flags have been independently confirmed via Vercel project settings.

### Administrator checklist

1. In the **intended team**, grant project-creation permission to the connected Vercel account, or have an authorized admin create `looke-ultra-staging` with its own project.
2. Connect **only** `mushee-io/looke` on a reviewed preview branch. Select Next.js / Node 22. Ensure Vercel Authentication applies to **all URLs**, not just Preview. Check project API `ssoProtection.deploymentType = "all"` and manually verify a signed-out browser cannot access the URL.
3. Set the four release/write/evidence flags above to false in **every** enabled environment (including Preview). Set `LOOKE_M4_MARKETS_JSON=[]`, use correct EVM/native Testnet RPCs. Do not expose a production domain or create bypass links.
4. Only then deploy the **pinned approved SHA** as a Preview deployment. Inspect its Git revision and release flag values. Check `/api/beta/readiness` returns `publicBetaOpen:false`.
5. Keep access protected. Read-only wallet acceptance may start after the operator verifies this configuration. Never paste secret keys, raw database URIs or seed phrases into Git, CI, or chat.

## Read-only live Ultra chain evidence

**Collect now in a CI job or on an authorized operator machine:**

```bash
npm install
npm run m8:rpc-evidence
# Public report: artifacts/m8/rpc-evidence.json
```

The probe makes only these reads:
- Ultra EVM Testnet RPC: `eth_chainId` and `eth_getBlockByNumber` for latest block. Verifies chain **18881**, a valid block hash and a recent timestamp.
- Ultra *native* Testnet RPC: `/v1/chain/get_info`. Verifies exact native chain ID `7fc56be645bb76ab9d747b53089f132dcb7681db06f0852cfa03eaf6f7ac80e9`, head block and irreversible lag.

An RPC error is **blocked**. No fallback fixture, fake block or wallet action is used. CI uploads the public JSON for manual review. An Actions job marked successful is **not** proof that both RPCs were verified; inspect `allVerified`, `evm.status` and `native.status` in the report. Use `npm run m8:rpc-evidence -- --strict` to exit nonzero if either is unverified.

**On-chain contract evidence** still requires real wallet-signed factory creation, coin-creation and native Uniq mint results. Reuse `npm run m7:acceptance -- ./testnet-public-proofs.json` with public addresses, IDs and hashes generated independently by wallet owners. No signed transactions were made by M8.

## Independent wallet acceptance evidence

The **existing** `/beta` dashboard offers read-only, user-clicked wallet account/network connection tests in a protected browser. It does not authenticate ownership with a native chain signature, and the EVM EIP-191 signature cannot alone prove what network the browser was on.

The M8 acceptance format adds **two different wallet signatures**, one from the EVM participant and a separate human reviewer, over the exact same domain-, Git-revision-, Testnet-network-, timestamp- and GitHub-issue-bound **text-only** statement. The CLI verifies their cryptographic validity and checks that the native account exists on the verified native Testnet RPC. It **never signs** on behalf of anyone or broadcasts a transaction.

Example local public-record structure (the signatures and addresses below are illustrative placeholders, **not real evidence**):

```json
{
  "revision": "40-character-approved-git-sha",
  "stagingOrigin": "https://actual-protected-staging-host",
  "capturedAt": "actual-ISO-UTC-date",
  "evmAddress": "0xreal-user-address",
  "nativeAccount": "actual-ultra-account",
  "observerAddress": "0xindependent-reviewer-address",
  "evmSignature": "0xreal-65-byte-signature",
  "observerSignature": "0xreal-65-byte-signature",
  "reviewUrl": "https://github.com/mushee-io/looke/issues/ACTUAL_ISSUE_NUMBER"
}
```

```bash
npm run m8:wallet-acceptance -- ./public-wallet-evidence.json
```

**This CLI intentionally returns NOT APPROVED even if the public signatures validate**, until a separate human verifies that the linked GitHub issue actually contains authentic, independently reviewed browser acceptance, chain proof and staging protection. An on-chain native `get_account` response is **not** cryptographic proof of control over the native wallet; wallet connection must be witnessed and separately approved. The review record is not automatically created or accepted.

No token approval or transaction is requested by this process.

## Social database operational checks

A real staging PostgreSQL database must be configured and the M5 migration applied by an authorized database operator (never automatically on a public build). The audit runs **only a READ ONLY transaction**:

```bash
npm run m8:db-audit
```

It checks PostgreSQL 15+, current connection TLS via `pg_stat_ssl`, required 12 social relations, required indexes, and active read-only transaction mode. It does **not** enumerate messages or profile contents. Production/staging databases require TLS. Only temporary CI database connections explicitly flagged from `localhost` may use a plaintext connection for disposable test purposes.

```text
LOOKE_M8_ALLOW_LOCAL_PLAINTEXT_DB=true
```

This exception is refused for remote database hosts. A passing disposable CI database audit does **not** prove a production social database is ready. Database URLs and authentication remain server-only.

## Alerting and rollback rehearsal

```bash
npm run m8:alert-summary
npm run m8:rollback-rehearsal
```

- One-time GitHub Actions M8 live-RPC observation emits explicit `EVM_BLOCKED`/`NATIVE_BLOCKED` alerts and uploads a **7-day public RPC evidence artifact**. Additional `STAGING_UNPROTECTED` and `SOCIAL_DB_UNVERIFIED` findings remain open until live staging and DB audits exist. Do **not** mistake an observation workflow's green status for operational acceptance.
- **No new hourly builds, scheduled cron job, webhook, or continuous bot have been enabled**. Operators can configure existing host alerting when staging exists.
- Rollback rehearsal models unsafe flags in memory and verifies that the recommended configuration sets public beta, trading, social writes and evidence endpoint access all to **false**. It makes **zero remote changes**.
- A real rollback requires an authorized operator to keep or reenable Vercel Authentication, disable those four flags, verify intended team/project, restore a known-good pinned commit if necessary, and recheck `/api/ops/monitor` and `/api/beta/readiness` before inviting testers.

## Remaining unfulfilled acceptance gates

- [ ] Authorized Vercel project creation + verified all-URL protection
- [ ] Actual protected Preview deployment URL + signed-out access check
- [ ] Actual EVM/native RPC artifact both verified (review the CI artifact, not just workflow color)
- [ ] Real authorized wallet connect-only session and independently reviewed GitHub issue
- [ ] Genuine wallet-signed creator-coin / native Uniq transaction and ownership proofs
- [ ] Real audited, funded AMM liquidity on Ultra EVM Testnet
- [ ] Real TLS-backed, moderated social staging PostgreSQL database and audit
- [ ] Security/audit and operator approval
- [ ] Separate revision-bound time-limited operator release signature and every M6 readiness gate passing

**M8 performs no token mint, exchange trade, private-key use, production DB write or public beta launch. The public beta remains CLOSED.**
