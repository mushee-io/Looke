# Looke M17 — Real creator engagement (protected Preview)

## Source and deployment boundaries
- Start only from M16's fully green and squash-merged `main`, PR #18.
- Add genuine, unique per-wallet likes, reposts and **private** bookmarks in PostgreSQL 15+.
- Existing wallet-signed profiles, Follow/Unfollow and blocks remain the sole account authority.
- Public feed includes creator posts and genuine repost events; respects moderation, suspension, blocks, following and stable cursor order.
- Likes and repost counts come from stored rows; bookmarks count and owner lists are never public.
- Owner-scoped, 40-item recent activity includes real liked/reposted/bookmarked posts, with separate following directory.
- Notifications include genuine likes and reposts alongside follows/comments, with wallet-scoped read/unread cursor.
- One-use signed hosted media and approved content remain subject to M16's manual moderation.
- No fabricated profiles, posts, likes, reposts, rewards, trades or token ownership.

## API acceptance
- `POST /api/social/engagement` supports exactly like, unlike, repost, unrepost, bookmark, unbookmark with canonical post UUID, matching Origin, signed-in unsuspended wallet and `LOOKE_SOCIAL_WRITES_ENABLED=true`.
- All additive mutations select only unhidden, undeleted, approved-media posts from unsuspended authors; blocklists and self-like/repost safeguards apply.
- Each mutation is rate-limited and idempotent with DB-enforced `UNIQUE(actor,post_id)`. Removes only affect rows belonging to the signed-in actor.
- Bookmarks stay private. `GET /api/social/engagement?view=activity&kind=...` is owner-scoped; `view=following` reads true follow relationships.
- `GET /api/experience/notifications` returns only real, visible events from allowed authors and posts; no generated trade or message events.
- Mark-all-read from M16 is retained and protected by session/Origin.
- Comments and blocked activity retain M16 moderation constraints.
- Security tests cover unauthenticated requests, CSRF, stale media, self-repost/like, duplicates, blocked relationships, account isolation and genuine event counts.

## Database and CI
- Apply `001_social_foundation.sql` → `002_social_media_review.sql` → `003_signed_media_and_notification_state.sql` → **`004_creator_engagement.sql`** using an operator-approved, backed-up TLS PostgreSQL environment.
- GitHub Actions PostgreSQL 16 disposable service runs `npm run test:m17-db`; CI mocks are **not** live user usage evidence.
- Run all pure tests, TypeScript typecheck, Next production build and all previous milestone workflows at exact final SHA before release.
- Do not automatically run migrations during Vercel build or request handling. Missing migration means explicit backend unavailable, not fake activity.

## Release boundaries
- Only existing Vercel project `looke`'s login-protected **Preview**, exact final green SHA.
- Verify Vercel `ssoProtection.enabled=true` with `deploymentType=all_except_custom_domains`, then READY SHA match and signed-out authentication challenge.
- Keep `LOOKE_PUBLIC_BETA_ENABLED=false`, `LOOKE_M4_TRADING_ENABLED=false`, `LOOKE_SOCIAL_WRITES_ENABLED=false`, `LOOKE_M6_EVIDENCE_ENABLED=false`, `LOOKE_MEDIA_UPLOADS_ENABLED=false`, `LOOKE_M4_MARKETS_JSON=[]`.
- Production `looke-alpha.vercel.app` remains unchanged. No messaging, E2EE sending, wallet approvals, minting or financial operations.
- Real likes, reposts and bookmarks are not operationally enabled until TLS DB, migration, moderation, operator sign-off and real wallet acceptance pass.
- No recurring build automation or generated activity.
