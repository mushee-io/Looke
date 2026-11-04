# M15 — Real creator network, reviewed media and Ultra evidence

## Starting point
- M14 PR #16 was already merged before M15 began. Independently verified all 10 final workflows and 16 individual jobs green at head `22c76fecc992630b28115061a5d3932e59b252fe`.
- Main starting SHA `763ae76806d32275922dcc890237f05e61620af0`.
- Public domain: `looke-alpha.vercel.app`. It must stay untouched, beta closed.

## Real features implemented
- Search real moderated creator posts, handles and display names with parameterized PostgreSQL `position(...)` checks. Search runs on the server **before cursor pagination**, not only the 20 entries previously loaded in a browser.
- Social and Trending feed now display images/videos only when an existing real post carries `media_status='approved'`. Rejected/pending media is never emitted by the feed or profile-post APIs.
- Social composer accepts a **local image/video preview** (PNG/JPEG/WEBP/GIF <=5 MB; MP4/WEBM <=20 MB). It never uploads the file automatically. Optional independently hosted HTTPS media URL can be submitted for moderation *only* if `LOOKE_SOCIAL_MEDIA_HOSTS` explicitly contains the exact trusted CDN host and `LOOKE_SOCIAL_WRITES_ENABLED=true` is separately approved. Arbitrary domains, HTTP, credentials, query tokens, SVG and mismatched extensions are rejected.
- New operator-only `approve_media` / `reject_media` actions must pass existing signed-session moderator authorization, rate limits and append a `social_moderation_audit` record. Pending media remains invisible. **Moderator review does not certify malware-free media contents; hosting security/CSP review remains required.**
- New `db/migrations/002_social_media_review.sql` adds moderated media metadata with SQL status checks, read indexes and expanded audit enum. Migration script explicitly applies 001 then 002; no migrations run in public Preview automatically. Disposable PostgreSQL 16 CI checks the columns, pending/approved/rejected visibility and audit action.
- Creator profiles show 12 real posts per stable server cursor and actual total count, with a Load older button. No fake followers/posts are created.
- Notifications refresh actual session-scoped follows/comments every 60 seconds or by click; all other category tabs remain honestly empty when no index exists.
- `GET /api/experience/assets` supports genuine, read-only verifications:
  * EVM token (18881): only a canonical factory-indexed `CoinCreated` receipt from a **bounded finalized 600-block page** is independently verified. Missing/unindexed evidence is NOT a claim of nonexistence.
  * Native Ultra Uniq: caller must supply a native account separately; `ownedUniqs(account,50)` checks the correct native Testnet ID and scoped `token.b` table, reporting a positive scoped holding only if found. A missing token in this first 50-entry page is NOT proof of non-ownership. Native and EVM identities are **not** cryptographically linked.
  * Verified evidence cards are user-initiated inside social/Trending posts, never trigger wallet signatures or financial transactions.
- Messaging has a static read-only `GET /api/experience/messaging/readiness` showing disabled encryption/key management/recovery; `validateEnvelope` purely enforces future ciphertext fields and forbids plaintext. **There is no sender, receiver, key-registration, send, storage or decrypt API activated.** Real E2EE requires an independent cryptographic audit.

## Activation prerequisites and no-go
1. Social Postgres 15+, TLS, schema migration 002, real moderation controls and owner sign-off.
2. Approved CDN/asset hosting, content scan and media safety policy; configure exact host allowlist only after review.
3. Independently verified Ultra EVM creator token factory + genuine owner-signed event receipts, and Ultra native Uniq mint/ownership evidence.
4. Server pagination/search needs database operational checks and moderate rate controls before broad scale.
5. Messaging encryption, secure key registration, recovery, abuse protections and independent audit (not done).
6. Existing market liquidity/security gates and explicit wallet authorization for any financial operation (not done).
7. Restore/rollback rehearsal, monitoring, operator signoff (not done for real production).

## Protected staging
- **Project:** existing connected Vercel `looke`, ID `prj_QXWBZ7UU1AtxXJ7XbckAwLrRZbdO`.
- Generated Vercel Preview URLs must remain protected with `ssoProtection.deploymentType=all_except_custom_domains`. Do not assume custom production domains are protected by that setting.
- Verify exactly these five Preview-scoped flags are false/empty: `LOOKE_PUBLIC_BETA_ENABLED=false`, `LOOKE_M4_TRADING_ENABLED=false`, `LOOKE_SOCIAL_WRITES_ENABLED=false`, `LOOKE_M6_EVIDENCE_ENABLED=false`, `LOOKE_M4_MARKETS_JSON=[]`.
- Deploy only immutable fully-green M15 PR head to **Preview**. In Vercel API, omit `target` for Preview; do not set production target or alias. Confirm READY, exact head SHA, and a signed-out visitor sees `login_required`.
- Recheck original `looke-alpha.vercel.app` production SHA and `/api/beta/readiness?mode=config` reports `publicBetaOpen:false`.
- No hourly builds, cron bots, scheduled trades or notifications were created by this milestone.

**Green CI validates deterministic code and disposable DB behavior, not the existence of any actual new media approvals, accounts, token listings, minted Uniqs, trades or audited messaging.**
