# Looke M32 — genuine legacy/source reconciliation (NO-GO)

## Exact baseline and protected production
- M31 PR #33 merged into main at d59b991837149bdf114e47879918de443060e770, after final M31 head bca0673b5e11090385bbb59b8042610fa064ff4e passed 27 workflows and 33 individual jobs.
- The existing protected production alias looke-alpha.vercel.app was verified as assigned to dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG.
- Only the existing SSO-authenticated branch Preview, not the pinned production alias, may carry M32 candidate code. NEVER promote to production or open public beta as part of M32.

## Fresh genuine source-backed observations on 5 November 2026
Authorized connected Neon and Cloudinary tools were queried read-only; no database or hosting changes:
- Neon looke-ultra-staging (project winter-credit-26110568, branch br-lucky-dream-zarpvhyd): 25 legacy looke_* tables, zero current social_* tables.
- PostgreSQL information_schema genuinely confirmed legacy looke_profiles.evm_address, looke_posts.profile_id/text/moderation_status, looke_post_media.cloud_public_id/status, looke_sessions.token_hash, looke_challenges.consumed_at, looke_coin_events.tx_hash/log_index, and looke_post_reports.reason. This is schema metadata, not proof of user ownership.
- Genuine aggregate SQL returned 0 profiles, 0 posts, 0 media, 0 sessions, 0 challenges, 0 coin events and 0 reports for the named tables.
- Authenticated Cloudinary prefix search for public IDs beginning with looke returned 0 matching assets. This is a scoped search, not proof of global account emptiness.
- The Vercel Preview project has only 5 flags: LOOKE_PUBLIC_BETA_ENABLED=false, LOOKE_M4_TRADING_ENABLED=false, LOOKE_SOCIAL_WRITES_ENABLED=false, LOOKE_M6_EVIDENCE_ENABLED=false, LOOKE_M4_MARKETS_JSON=[]. It has no authorized DATABASE_URL or separate LOOKE_M32_LEGACY_DATABASE_URL.

## M32 engineering deliverables
1. Read-only compiled allowlist maps legacy tables to current counterparts and explicit no-transfer policies. PostgreSQL read-only repeatable snapshots and TLS are required outside disposable CI tests. Aggregate counts only, no personal rows. Identical database addresses with distinct logins fail separation.
2. Preview-only GET /api/experience/m32-reconciliation: requires VERCEL_ENV=preview. Both independently approved TLS URLs must be configured by an operator. This does not automatically access the Neon connector, returns redacted diagnostics and release NO_GO; production 404. No POST/PUT.
3. npm run m32:reconcile: one-shot operator command emits artifacts/m32/reconciliation.json; --require-connected returns exit code 2 without both actual TLS source checks and 19 current social tables. No database mutation.
4. Social M32 reconciliation tab explicitly separates genuine live Preview status from historical Neon/Cloudinary observations.
5. Adversarial unit tests, disposable PostgreSQL read-only integration, dedicated M32 CI and every existing historical workflow.

## Human migration prerequisites — NOT granted by M32
- Identity and lawful-purpose review; owner consent; reauthenticate wallets for any real user. NEVER copy old sessions or challenges/nonces.
- Independently inspect original moderated hosted media and security audit findings; legacy media status is not current moderation proof.
- Reverify canonical Ultra EVM creator receipts and native irreversible Uniq ownership; legacy coin-event records or Uniq drafts are not on-chain proof.
- Obtain a separately restored 19-table TLS backup, full source-backed Points anti-sybil evidence, independent human risk/security review and an approved explicit migration plan before any later migration write is authorized.
- Keep database credentials in operator/Vercel secret management, not GitHub, prompts, screenshots or logs.

## Operator commands
- npm run m32:reconcile — local NO_GO JSON report; missing sources remain blocked.
- npm run m32:reconcile -- --require-connected — fails with exit code 2 if source missing or incompatible.
- CI disposable PostgreSQL tests use LOOKE_M32_DISPOSABLE_DB_TESTS=true and the looke_social_ci database only. Test fixtures are never actual end-user activity.
- New Social tab: /social → M32 source reconciliation.

M32 performs zero migrations, account copies, approved-media transfers, token claims, on-chain broadcasts, financial transactions, human approvals or recurring builds. Public beta remains NO_GO. Preserve protected production alias on dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG.
