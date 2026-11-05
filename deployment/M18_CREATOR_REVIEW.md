# Looke M18 — creator analytics, moderator queue and account controls

## Merge baseline
- M17 PR #19 commit `4adfa4a8ee1aeae4f1c9f0a629edab138f828e8f` passed 13 workflows / 19 jobs.
- M17 merged into `main` as `ab20099f64637be4c03b6fac8cffbf8a9936f867`.
- M18 is a new branch and must not be merged or deployed to production without separate direction.

## Actual records only
- `GET /api/social/analytics` requires a signed-in, unsuspended wallet. Never accepts an owner address from query data.
  Shows visible posts, genuine followers and follows, real likes/reposts/comments, pending media and hidden posts.
  The 14-day UTC posting series and 10 most-engaged posts come from PostgreSQL rows, not view/impression estimates.
- `GET /api/social?action=directory&sort=recent|engaged` returns at most 20 visible unsuspended creator profiles, with real follower, post, 30-day interaction counts. Viewer blocks and mutes are respected.
- `GET /api/social/controls` exposes only the caller's own notification preferences and up to 100 muted creators.
  Signed-wallet `POST` may update a strict four-boolean preferences object or mute/unmute a valid existing non-self wallet. Origin checked; writes disabled by default.
- Follow/Unfollow and Block/Unblock remain in original authenticated social routes. Mutes additionally hide posts, discover profiles, visible comments and notification events for the caller; they do not alter other wallets' views.

## Human moderation
- `GET /api/social/moderation` returns at most 40 genuine pending hosted-media posts, 40 unresolved user reports and 10 audit events **only** for authenticated wallets present in `LOOKE_SOCIAL_MODERATORS`.
- Only those wallets can use the existing `POST /api/social` `moderate` operation to manually approve/reject media or hide/restore content. Requires `LOOKE_SOCIAL_WRITES_ENABLED=true`, exact request Origin and minimum 8-character written reason.
- `POST /api/social/moderation` can dismiss a report or action it by hiding the reported post/comment. Each resolution uses row-lock `FOR UPDATE`, unique `social_report_resolutions` audit record and commits the target hide + audit + reviewed timestamp together.
- Server authorization is mandatory; hiding UI buttons is not a security gate. Pending media links are never returned to public feeds, comments or creator profiles before approval.
- Provider-hosted links could be accessible outside Looke **before** approval. Activation needs independent external scanning, hosting access/security policy review and operational signoff, not simply a code merge.

## Operators and tests
1. Back up the TLS PostgreSQL database, inspect current M16/M17 migrations, and apply explicit `005_creator_insights_and_moderation.sql` after earlier files. Migration is never automatic on Vercel.
2. Assign a reviewed, minimal `LOOKE_SOCIAL_MODERATORS` wallet allowlist; verify the signer with Ultra EVM Testnet wallet login.
3. Test denied anonymous access, unauthorized moderator access, non-owner analytics, forged Origin, disabled writes, duplicate reports and different-wallet mutes.
4. Test real moderator approval and report dismissal/actioned hide with genuine, separately inspected media/report evidence. CI database fixtures are NOT evidence of real provider uploads.
5. Confirm all GitHub workflows and all jobs on exact final head commit, then Vercel READY Preview with exact SHA and enabled SSO; separately confirm signed-out browser challenge.
6. Keep production alias `looke-alpha.vercel.app` directed to the pre-M17 protected deployment `dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG`. GitHub `main` merges can trigger automatic Vercel production builds; restore that alias immediately and verify.
7. Preview flags: `LOOKE_PUBLIC_BETA_ENABLED=false`, `LOOKE_M4_TRADING_ENABLED=false`, `LOOKE_SOCIAL_WRITES_ENABLED=false`, `LOOKE_M6_EVIDENCE_ENABLED=false`, `LOOKE_MEDIA_UPLOADS_ENABLED=false`, `LOOKE_M4_MARKETS_JSON=[]`.
8. No synthetic users, metrics, messages, likes, or financial transactions; no live E2EE or public beta. No recurring build bot required.

## Explicit readiness distinction
The code and PostgreSQL CI can pass while there is **no configured operator-approved social database in Preview**. A ready Next.js deployment is not evidence that actual account writes, production-grade scanning, or moderator approval operations are activated.
