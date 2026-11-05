# Looke M19 — evidence-backed community Points and read-only vesting

## Exact merge baseline
- M18 PR #20 head `1615a955f99c0e6695e6c3b9e384e5fcd2a42099` passed all 14 workflows and 20 individual CI jobs.
- M18 squash-merged to `main` at `871bf20fc7413b05e7c0548f19441aa98422eef3`.
- M19 is feature-branch Preview only. `looke-alpha.vercel.app` production traffic must continue on `dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG`. Do not merge M19 without separately approved production handling.

## Points are not tokens
- `LOOKE_POINTS` are **nontransferable off-chain participation accounting entries**, not minted assets, promises of token supply, deposits or withdrawal rights.
- No issuance, mint, claim, cash-out, conversion or financial-transaction endpoints. `POST /api/social/points` must return **405**.
- `GET /api/social/points` is read-only and derives **only the session wallet's** real ledger rows; ignores wallet/owner query parameters.
- Each season is an actual operator-configured Postgres row. Migrations do **not** seed a fake season or an artificial Points balance.
- `approvedPoints` counts only reviewed, evidence-backed `status=approved` records. Pending/rejected/reversed are separate and do not count as earned Points.
- Vesting is an informational time schedule for **approved Points only**, with dates configured in the season: vest start, cliff and end. Values use UTC server time and exact integer/bigint arithmetic, and are visibly **not claimable**. Do not label any number a token balance or a claimable allocation.

## Eligible source events and fairness
- Operator-reviewed `post` (author's original, visible, approved-media post).
- `comment` (real visible comment on **another** author's eligible visible post).
- `like_received` or `repost_received` (non-self participant's real unique reaction to a visible original creator post).
- Evidence is independently loaded from social Posts, Comments, Likes or Reposts by server-side table selection; wallet/profile IDs, actor, dates and point amounts are never supplied by the requester.
- Reject hidden/deleted posts, pending or rejected media, suspended profiles, invalid account age, cross-blocked accounts, self-interactions and out-of-window events. Minimum **24-hour account age at activity time** for participating profiles.
- Daily per-creator caps per source kind: **2 posts, 5 comments, 5 likes received, 3 reposts received**. A reaction from the same actor to the same creator in one UTC day counts at most once per kind. Duplicate original source across seasons is forbidden.
- Row-level uniqueness and a per-wallet/activity-day advisory transaction lock prevent double counting and cap races. These limits reduce straightforward farming but **do not prove unique human identity**. Cross-wallet sybil detection needs further independent review before activation.
- All new evidence is `pending` even if accepted by preflight. A reviewer must explicitly approve or reject each with a meaningful reason. A later reversal leaves the permanent audit history.

## Operator-controlled review and safeguards
- `POST /api/social/points/operator` requires exact Origin, signed-in unsuspended moderator wallet in `LOOKE_SOCIAL_MODERATORS`, `LOOKE_SOCIAL_WRITES_ENABLED=true`, and separate `LOOKE_POINTS_ACCOUNTING_ENABLED=true`.
- By default both write flags are **false** in authenticated Preview. No automatic accrual loop, cron, or reward minting.
- `GET /api/social/points/operator` is restricted to moderators and lists actual unawarded social source candidates and pending reviews. Candidate display alone is NOT an eligibility proof.
- Accepts only `queue` from a real source/active season, and `review` with `approved`, `rejected` or reversal of an approved record.
- Recheck backing social evidence during approval. Decisions and reasons are recorded in `social_points_review_audit`.
- Do not copy secrets or access tokens into GitHub; operator allowlist wallets are public identities.

## Postgres and CI acceptance
1. Back up the operator-approved TLS PostgreSQL database before any migration.
2. Apply `001_social_foundation.sql` → `002_social_media_review.sql` → `003_signed_media_and_notification_state.sql` → `004_creator_engagement.sql` → `005_creator_insights_and_moderation.sql` → **`006_evidence_points_and_vesting.sql`**. Migrations never run automatically in Vercel.
3. **Do not create a season in Preview yet** unless independent team review establishes actual start/end dates, schedule and approved Points per source. No retrodrop or entitlement should be inferred.
4. In disposable CI PostgreSQL 16, run `npm run test:m19-db` with write flags explicitly true and never reuse the CI database for real users.
5. Verify negative tests: no anonymous/history reads; no unauthorized operator; no foreign-origin operator writes; no synthetic wallet/source IDs; no duplicate sources or same counterparty/day; hide unapproved media; daily caps; 24-hour profile age; account isolation; no claim endpoint; no financial transaction.
6. Verify approved/rejected/reversed audit history, exact integer vesting, source rechecks, and the empty-state UI when no season is approved.
7. Inspect all GitHub Actions workflows and individual jobs on the exact final SHA. Verify `looke` Preview READY with the same SHA and `ssoProtection.enabled=true`; independently test signed-out protected access when a browser is available.
8. Keep Preview flags `LOOKE_PUBLIC_BETA_ENABLED=false`, `LOOKE_M4_TRADING_ENABLED=false`, `LOOKE_SOCIAL_WRITES_ENABLED=false`, `LOOKE_POINTS_ACCOUNTING_ENABLED=false`, `LOOKE_MEDIA_UPLOADS_ENABLED=false`, `LOOKE_M6_EVIDENCE_ENABLED=false`, `LOOKE_M4_MARKETS_JSON=[]`. Do not alter production. Private messaging remains off.
9. Do not activate public beta, trading, E2EE, media uploads, financial transactions or any token claim. No recurring build automation.

## Operational readiness
Passing source tests and showing a protected Preview does not mean a real reward season exists, a real operator social database has been migrated, or Points are accruing. Report it as **implementation and disposable-database acceptance**, not a live token, claim, or operational reward distribution.
