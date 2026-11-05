# Looke M20 — durable creator indexing, Points reconciliation and audit monitoring

## Verified merge baseline
- M19 PR #21 exact head `3c2ab256b87892f563eb3b9ad7f4ac99287f9619` passed **15 workflows and 21 jobs**.
- M19 squash-merged to `main` at `49a9350f2ca0c3ef5cd5df43ec6e093019b86a19`.
- Production alias `looke-alpha.vercel.app` remained pointed to `dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG` after the merge. **Do not alter production.**

## Actual creator indexing
- `007_durable_creator_index_and_review.sql` extends the current Postgres schema. No sample creator activity, rewards, allocations, fake posts or indices are seeded. One empty index checkpoint is valid backend metadata.
- `social_activity_index` holds only references to real social posts, comments, likes received, reposts received, original creator/actor and source creation timestamp; no public pending media contents or private messages are indexed.
- All owner/actor attribution derives from the original database tables, never from browser-submitted IDs.
- A **manual** `POST /api/social/index` scan processes up to 100 genuine events, ordered by (source timestamp, kind, source UUID); excludes the newest two minutes to reduce uncommitted-source races.
- The checkpoint, newly inserted event references and review journal update in the **same locked transaction**. Duplicate source keys are no-ops.
- An operator may explicitly `rewind` the checkpoint with an audited reason and replay scanned records. Existing index rows and reviewed Points are **not deleted**. Transaction rollback must revert checkpoint changes after failures.
- Backfilled historical events or source transactions committed unusually late may need operator rewind. Do not call indexing fully up-to-date based only on a recent revision or a single scan.
- No cron or background loop is activated; CI smoke remains read-only and refuses writes.

## Point reconciliation and audit
- `GET /api/social/ops/health`: moderator-only DB health; real recorded index rows, last manual run, pending Points, unresolved reports, 24h moderation/Points audit counts.
- Read-only reconciliation independently verifies a bounded 40-row sample of **approved** M19 ledger records against current source existence and eligibility, actual owner/actor/date and season policy. If more than 40 exist, `complete=false`; never imply a full scan.
- Drift after hiding/suspending a previously awarded post is shown as `source_missing_or_ineligible`, not automatically reversed or concealed. Authorized human reversal belongs to the existing M19 review gate.
- `GET /api/social/ops/activity` derives **only the current wallet's** indexed activity and genuine Points status counts. It does not allow account selection or cross-wallet leaks.
- No aggregate is called "unique people," "impressions," "token balance," "eligible allocation" or "claimable Points."

## Manual anti-abuse review
- `GET /api/social/ops/risk` identifies two bounded real-indexed patterns in the last 24 hours: 3+ recorded reactions from the same counterparty to one creator; or 8+ original posts from a creator. These are **signals, not evidence of one real person or proof of sybil abuse**.
- `POST /api/social/ops/risk` requires a signed-in unsuspended wallet in `LOOKE_SOCIAL_MODERATORS`, exact origin, `LOOKE_SOCIAL_WRITES_ENABLED=true` and a separate `LOOKE_M20_INDEX_WRITES_ENABLED=true`. A reasoned human disposition is append-only and must match current genuine indexed evidence. No automatic account freeze, rewards reversal, ban, reporting to third parties or transaction action.
- The account-integrity panel is private; backend operations and risk evidence are restricted to moderators even if UI navigation is visible.

## CI and protected Preview sign-off
1. Apply `001`–`006` migrations to disposable PostgreSQL 16, then `007_durable_creator_index_and_review.sql`. Snapshot/backup production-grade TLS DB before operator changes. Migrations do not auto-run at Vercel build.
2. Verify genuine source tracking, creator vs commenter ownership, repeated idempotent scans, 100-event bounds, checkpoint locking and rollback, rewind/replay recovery, missing-source alerting, tenant isolation, CSRF rejection, fail-closed flags and human review audit in `npm run test:m20-db`.
3. Run `npm test`, `npm run typecheck`, `npm run build`, legacy security pipelines and dedicated M20 closed-preview workflow on the **exact final SHA**.
4. Verify the existing `looke` Vercel project has SSO protection enabled, that a nonproduction Preview deployment is READY for that exact SHA, and (when browser access available) that signed-out users receive authentication challenge.
5. Verify production alias unchanged at `dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG`. Revert production assignment **immediately** if a Git merge moves it.
6. Preview flags: `LOOKE_PUBLIC_BETA_ENABLED=false`, `LOOKE_M4_TRADING_ENABLED=false`, `LOOKE_SOCIAL_WRITES_ENABLED=false`, `LOOKE_POINTS_ACCOUNTING_ENABLED=false`, `LOOKE_M20_INDEX_WRITES_ENABLED=false`, `LOOKE_MEDIA_UPLOADS_ENABLED=false`, `LOOKE_M6_EVIDENCE_ENABLED=false`, `LOOKE_M4_MARKETS_JSON=[]`. Missing new flags are fail-closed.
7. Do not enable public beta, social/media writes, token minting or claims, private messaging/E2EE, exchange operations or any financial transaction without separate authorization and audit.
8. M20 release is a **code-level Preview and disposable-db acceptance**, not a claim of live indexing, completed season, verified unique humans, deployed workers, 100% coverage or active customer rewards.
