# Looke M21 — Independent Testnet & Security Acceptance

## Exact baseline and deployment scope
- M20 PR #22 head `5fffc838eb1f3a70dd72dbd08f539e1071a8352a` had **16 green workflows and 22 green CI jobs**, squash-merged to `main` at `a377a3298f7e0bbef8d2d2bb3bba9716b09b96ca`.
- Production `looke-alpha.vercel.app` must stay assigned to `dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG`. This M21 build is for the existing SSO-protected **Preview only**, never production.
- M21 changes **no financial execution**. It does not enable public beta or start scheduled verification, indexing or rewards.

## Evidence classes — never interchange them
1. **Disposable CI fixtures**: ephemeral EIP-191 keys, temporary test profiles/sessions, SQL upload metadata and Points entries can verify authorization/logic. They are **not actual human wallet acceptance, external media-provider receipts, real user content or token creation**. CI must leave the disposable database clean.
2. **Independent chain observations**: `npm run m21:acceptance` probes actual Ultra EVM Testnet (chain ID 18881) and native Ultra testnet for up-to-date read-only heads. RPC outages/unconfigured sources are explicitly blocked. A head alone is **not** evidence of token deployment or Uniq ownership.
3. **Optional on-chain manifest**: `npm run m21:acceptance -- ./path/to/public-proofs.json` uses only public contract addresses, actual deployment/creation transaction hashes, native factory/owner/token IDs. The script independently re-fetches and validates receipt status, code, creator, supply, confirmations and current owner-scoped Uniq row. No keys, signatures or session secrets should appear in the manifest. Invalid or missing proofs remain blocked.
4. **Actual operator DB and provider checks**: `GET /api/social/ops/acceptance` requires a signed-in unsuspended moderator wallet and returns actual PostgreSQL counts and a bounded (40 approved record) Points crosscheck. `?live=true` additionally re-verifies real provider uploads, TLS least-privilege DB role, Ultra chains and exact Vercel Preview protected identity **only when configured**.
5. **Independent human signoff**: genuine wallet challenge acceptance with a real user, different-wallet isolation witnessed by another tester, data restoration on an operator backup, actual host-media scan/privacy review, cross-wallet anti-sybil analysis, independent security review and signed operator beta decision are separate **blocked gates** until evidence is externally reviewed. CI cannot self-approve these.

## Database and adversarial tests
- No new schema migration is required by M21. Existing social/Points/index schemas M5–M20 remain unchanged. Run disposable PostgreSQL 16 tests with `npm run test:m21-db`.
- M21 tests must validate challenge origin, real EIP-191 signature recovery with disposable test wallet, failed impersonation, single-use nonce, session cookie isolation, media upload ownership, atomic one-use attachment, pending media hiding, explicit moderator decision audit, real approved-media engagement, self-like rejection, account-specific Points, no synthetic risk verdict and index replay with Points reconciliation.
- The M21 report never accepts an owner, creator wallet or launch state supplied by a client as identity evidence. Moderator GET is read-only, scoped and not cached.
- Run `npm test`, `npm run typecheck`, `npm run build`, all previous milestone workflows and dedicated M21 closed-preview workflow at the same exact final SHA.
- CI evidence artifact `artifacts/m21/acceptance.json` deliberately records unavailable checks as `blocked`; it cannot be interpreted as beta permission. The strict manual mode `npm run m21:acceptance -- --strict` fails when release gates are blocked.
- Account suspension, muted/blocked creator interactions, cross-origin CSRF, private bookmarks, visible-only media and no E2EE transmission remain separate red-team checkpoints.
- No live tokens, swaps, creator posts, Uniq ownership, external uploaded files or point entitlements are invented for demos.

## Preview and release gate
- Verify Vercel `looke` project (ID `prj_QXWBZ7UU1AtxXJ7XbckAwLrRZbdO`) has `ssoProtection.enabled=true` and `deploymentType=all_except_custom_domains`.
- Confirm the only M21 release is a Vercel `target:null` Preview deployment with exact **final all-green Git SHA** and `READY` state. Independently test signed-out authentication challenge where possible.
- Required Preview flags: `LOOKE_PUBLIC_BETA_ENABLED=false`, `LOOKE_M4_TRADING_ENABLED=false`, `LOOKE_SOCIAL_WRITES_ENABLED=false`, `LOOKE_MEDIA_UPLOADS_ENABLED=false`, `LOOKE_POINTS_ACCOUNTING_ENABLED=false`, `LOOKE_M20_INDEX_WRITES_ENABLED=false`, `LOOKE_M6_EVIDENCE_ENABLED=false`, `LOOKE_M4_MARKETS_JSON=[]`. Missing flags are fail-closed, not implicitly activated.
- Genuine social writes, Points accounting, manually authorized provider uploads, full indexing, anti-sybil adjudication, E2EE messaging and all transactions remain **off**.
- A passing CI set and an authenticated Preview constitute *engineering acceptance only*, not end-to-end beta acceptance. No public beta until **all independent external gates** have evidence reviewed by the operator and an independent security reviewer.
