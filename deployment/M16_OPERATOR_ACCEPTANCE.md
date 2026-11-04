# Looke M16 — Authorized creator media and account-scoped activity

## Baseline and approach

M15 PR #17 **squash merged** after independently verifying all **11** workflows and **17** jobs green at head `09e6c423f2423762b04cc805d53e521c5700b93b`. Main base for M16: `b3437bb8c356fe5f1534541ede5b1ae28c6ac963`.

M16 moves beyond displaying an untrusted hosted URL. Actual creator media uploads now have an **explicit opt-in action**, signed one-use permit, independently inspected provider record, wallet-bound database ownership, and moderator-only publication. There is **no claim that uploading to Cloudinary is private before moderation**; third parties may have the URL. The Looke feed only renders approved items.

## M16 code acceptance

### Secure hosted upload protocol — gated by the operator

1. An authenticated Ultra EVM Testnet wallet signs into Looke social using the existing nonce/domain-bound EIP-191 challenge. Uploads require that same server-side session.
2. Only when BOTH `LOOKE_SOCIAL_WRITES_ENABLED=true` and `LOOKE_MEDIA_UPLOADS_ENABLED=true`, with independently approved provider credentials and a migrated PostgreSQL database, POST `/api/experience/media` with `action=authorize` accepts `kind`, exact MIME and claimed size. Server validates allowed formats, image limit **5 MB**, video limit **20 MB**, request origin and rate limits. It issues a unique provider public ID inside `looke/social/<wallet>/`, server-signed upload parameters and a database UUID expiring in 15 minutes.
3. Browser explicitly presses **Upload file for moderator review**. The file goes direct to the fixed Cloudinary upload endpoint. No private API secret goes to the browser; the permit cannot authorize unrestricted directories, overwrite or arbitrary formats.
4. The browser POSTs `action=confirm` with its intent UUID. The server uses Cloudinary **server-to-server admin inspection** and verifies exact owner-scoped public ID, provider asset ID, URL host/path, type, file format, and exact expected byte count before marking the intent `verified`. An unverified browser upload response cannot certify ownership.
5. When the user publishes, `/api/social` accepts only `mediaUploadId` (not an arbitrary URL). A PostgreSQL `FOR UPDATE` transaction atomically creates the post as `media_status='pending'` and attaches the one-use upload record. Replay, another wallet's ID, stale and unverified intent all fail. Existing URL-only POST paths now reject.
6. Only an authorized audited `approve_media` action makes media visible to the social feed and profile views. Rejected/pending items are omitted from SELECT. Moderators need an actual role, reason, abuse/content scanning and operational acceptance before enabling this.
7. A signed Cloudinary asset is **not** a malware, content safety or rights audit. Before real creator activity: configure CSP/hosting controls, CDN limits, moderation queue, malware scanning, retention/deletion and explicit operator acceptance. Old pending media from M15 is not migrated to signed proof automatically.

**Required server-only environment variables:** `LOOKE_CLOUDINARY_CLOUD_NAME`, `LOOKE_CLOUDINARY_API_KEY`, `LOOKE_CLOUDINARY_API_SECRET`, `DATABASE_URL`, `LOOKE_SOCIAL_APP_ORIGIN`; operator switches `LOOKE_SOCIAL_WRITES_ENABLED`, `LOOKE_MEDIA_UPLOADS_ENABLED` default false. **Never** put API secret in a `NEXT_PUBLIC_` variable. The current protected Preview intentionally lacks activation and will show an upload-unavailable state.

### Real accounts and Ultra evidence
- PostgreSQL creator search and moderated feeds continue from M15.
- Notification list uses real follows/comments scoped to the current signed-in wallet. Migration 003 adds `social_notification_reads` per owner, GET returns unread flags and count, POST `mark_read` requires signed session, matching origin, enabled writes and DB-backed rate limit. No fabricated subscriptions, trade notifications or message alerts.
- Ultra EVM creator-token verification remains tied to indexed **real** canonical factory events on chain 18881. Native Uniq ownership requires a **separate native account** and uses a bounded 3-page read of real scoped `token.b` rows on the known Ultra native Testnet. A miss is not a negative proof, and neither chain's address is inferred to control the other.
- X25519 public-key registration **statement verification only**, including origin, nonce, version, short expiry, wallet EIP-191 signature, malformed key and replay-window tests. There is **no registered messaging key, client encryption protocol, delivery, device recovery or live send path** and **no independent encryption audit**. The messaging readiness endpoint remains disabled.

### Database and safety acceptance
- Apply explicit migrations 001 → 002 → **003** using `npm run db:migrate` only after operator backup and validation on a real TLS Postgres environment; NEVER run auto-migration during public/Preview deployment.
- GitHub CI uses disposable PostgreSQL 16 to exercise upload state constraints, one-use attachment, owner isolation, pending-media invisibility and per-wallet notification read state. Pure unit tests use ephemeral keys and synthetic **test fixtures only** (never presented as live evidence).
- Review and block suspicious media content, no fake media/engagement/trades, no bot, no hourly builds.
- The production app, public beta and financial execution remain unchanged, closed and disabled.

### Private Vercel Preview release
- Existing Vercel project `looke`: `prj_QXWBZ7UU1AtxXJ7XbckAwLrRZbdO`.
- Confirm Vercel `ssoProtection.enabled=true` and `deploymentType=all_except_custom_domains`; **this protects generated Preview URLs, not necessarily a custom domain**.
- Verify five Preview-scoped flags exactly: `LOOKE_PUBLIC_BETA_ENABLED=false`, `LOOKE_M4_TRADING_ENABLED=false`, `LOOKE_SOCIAL_WRITES_ENABLED=false`, `LOOKE_M6_EVIDENCE_ENABLED=false`, `LOOKE_M4_MARKETS_JSON=[]`. Also `LOOKE_MEDIA_UPLOADS_ENABLED` must not be `true`.
- Deploy only the exact M16 head after **all** CI workflows and individual jobs pass; omit Vercel target to use Preview. Confirm READY, SHA match and signed-out visitor gets `login_required`.
- Verify `looke-alpha.vercel.app` production SHA is unchanged and `/api/beta/readiness?mode=config` reports `publicBetaOpen:false`.

## Remaining external acceptance
- A reviewed, rate-limited Cloudinary tenant with secure uploads, moderation/scanning and real authenticated wallet sessions.
- Real Postgres TLS, backups, migration 003, moderator workflow, operational alerts/rollback drill; live upload and human review must be tested with explicit permission before flipping flags.
- Independent E2EE design and key management audit before any private messages.
- Real verified token markets, mint/ownership, funding and wallet-approved financial transaction receipts; no fake liquidity.
- Operator sign-off before ever opening public beta.

A green CI certifies guarded implementation and disposable tests, **not** that Cloudinary was configured, media published, wallets transacted or E2EE audited.
