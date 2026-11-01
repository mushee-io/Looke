# M7 — Social interactions, notifications and sharing

M7 adds more creator-to-creator social functionality to Looke's **dedicated** PostgreSQL-backed feed. These interactions are offchain social records, not token trades, financial activity or onchain transfers.

## Implemented

- Likes and follows remain authenticated database writes. Invalid UUIDs and malformed payloads now fail validation explicitly instead of returning an internal-service error.
- **Comments:** `GET/POST /api/posts/[id]/comments` lists up to 30 visible comments on a visible post and permits authenticated creation (500 Unicode characters maximum). A per-account 10-comments/5-minutes transaction lock enforces the throttle under concurrency. `DELETE /api/comments/[id]` is author-only.
- **Reposts:** `POST /api/posts/[id]/repost` records or removes an authenticated user repost, uses a unique (profile,post) key and a 30-new-reposts/day rate limit. You cannot repost your own post; only visible posts may be newly reposted. **This is repost tracking and counts, not full repost syndication into follower feeds.**
- **Sharing:** A share control uses the device share sheet or copies an original Looke link such as `/?post=<uuid>#feed`. The feed retrieves a shared post via public `GET /api/posts/[id]`, which returns only visible posts; posts not in the current first page can still be opened. Sharing does not create an onchain transaction.
- **Feed:** Public comments/repost counts plus the viewer's repost state are computed from real rows; no fabricated social numbers.
- **Notifications:** `GET /api/notifications` derives follow, like, comment and repost alerts only from real interactions, excluding hidden/removed posts and comments and the author's own reactions. The read flag is a per-account persistent timestamp in `looke_notification_state`. Signed-in `POST /api/notifications` allows a user to mark their own notifications as read.
- Notification links direct visitors to a creator or shared public post; unread totals are computed server-side from current activity. No web push, email notifications, device background polling or artificial fanout claims.
- The M7 SQL migration is `db/005_social_interactions.sql`, applied to the **dedicated Looke Neon staging database**.
- Regression tests cover UUID parsing, comment sanitization, length limits, and shared post URL generation.

## Safety and open work

- A moderation operator must still be able to hide/remove reported comments and abusive accounts. There is no live moderation dashboard, enforcement workflow or appeal process yet.
- Repost tracking doesn't presently resurface a post on a follower's feed. Feed syndication, anti-spam/farm detection, engagement integrity and indexed ranking need separate design and tests.
- Notification events are derived from current database rows; an unlike, unfollow, deleted comment or deleted repost removes the corresponding alert. An immutable audit log or durable delivery queue isn't implemented.
- Notification read state marks all currently visible events as read using the server time; it does not implement per-alert read acknowledgements.
- Comments currently show the newest 30 per post; complete comment paging, threads, edits, blocking/muting, user-level visibility controls, and media comments remain pending.
- Multi-account staging tests, actual signed wallet/browser sessions, accessibility testing, load tests, abuse controls and independent security assessment are still required.
- No mainnet launch, public NFT mint, token purchase or wallet spending has been activated.

## Verification checklist

- [ ] Deploy authorized protected HTTPS staging linked to Looke's dedicated Neon database.
- [ ] Verify all four event types, unread counts and read marking with multiple independent real accounts.
- [ ] Exercise simultaneous comments and reposts from the same account and confirm transaction-safe throttles and unique keys.
- [ ] Confirm private session material and reports never leak through public comment/post/notification responses.
- [ ] Check ownership protections for deleting comments, wrong-chain/offline wallets, hidden-post behavior and deleted-post cascades.
- [ ] Test shared links to older posts, 404 behavior for removed content, keyboard/screen readers, and mobile shares.
- [ ] Implement operational comment moderation and blocking/reporting policies; review all abusive or sensitive content workflows.
- [ ] Conduct independent DB/security review and evidence-based product acceptance.

**M7 remains partial until protected live staging and abuse/security acceptance are completed.**
