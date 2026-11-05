# Looke M33 — real source-backed Preview integrations (NO-GO)

## Verified baseline
- M32 PR #34 final source head 0e12ccf7b29ba25869cf596b69c978fd66a9cbd8 passed 28/28 GitHub workflows and 35/35 individual jobs. Squash-merged into main as 7197d757020fe9982c022be8b5096e98b5a4e9b7.
- Protected production alias looke-alpha.vercel.app is pinned to dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG. M33 must never move, deploy to, or promote onto that alias.
- Existing Looke Vercel project has SSO protection enabled; the five Preview flags remain false/empty. The operator's connected old Neon source is NOT the new social database.

## What M33 actually integrates
1. A user-triggered, genuine Ultra EVM Testnet chain 18881 head query using the existing read-only chain client and strict chain-ID check, and a separate Ultra native Testnet head and last irreversible block check. Network failures are reported as unavailable; numbers are never fabricated.
2. A real current-schema 19-table PostgreSQL inspection when an authorized Preview DATABASE_URL exists, with mandatory PostgreSQL TLS and a repeatable READ ONLY transaction. Absent, legacy-only or incomplete schemas cannot be treated as functional social accounts or release approval.
3. An authenticated Cloudinary Search API query for assets with Looke public IDs using server-only credentials when configured. Returns ONLY the real aggregate matching count and provider-authentication status, never image data, secrets or alleged moderator approval; zero matching assets is a genuine empty observation, not a global assertion.
4. Exact factory deployment or CoinCreated transaction read-only verification using existing canonical Ultra EVM checks (chain 18881, transaction receipts, >=2 confirmations, matching factory, token code, creator and supply). Native Uniq verification uses actual irreversibility plus exact native account, factory and token identifiers. Operator must provide actual public references. A mismatched, missing or wrong-chain proof returns NOT VERIFIED.
5. A new Live Integrations tab within /social, with user-triggered live-check and proof actions. No wallet-signature request and no financial transaction, account writes or automated network heartbeat.
6. Preview-only API /api/experience/m33-live, modes config/live/proof. A production request returns 404; an open write/release flag returns 503; invalid/malicious queries return 400. All responses use private no-store and noindex headers. Missing credentials never produce synthetic creator, media or PostgreSQL rows.

## Test and release acceptance
- Unit/adversarial tests cover malformed addresses, duplicate params, wrong chain, insufficient confirmations, native owner mismatches, malformed Cloudinary counts, secret non-disclosure, no transactions and config-only NO-GO.
- A real disposable PostgreSQL 16 fixture runs existing migrations and tests current 19-table compatibility, missing schema denial, TLS requirement and actual database-level read-only mutation rejection. This is a disposable CI fixture, NOT live Neon evidence.
- Dedicated M33 CI has protected Preview smoke and PostgreSQL integration jobs, plus all retained M1–M32 workflows and full web/contract checks. Never introduce real credentials into PR CI.
- Only the EXACT final commit with all GitHub Actions workflows AND jobs green may be accepted for the existing branch Preview. Vercel Git integration may build a candidate earlier: that is not permission to call the candidate accepted or move production.
- The M33 role has NO authority to certify human user identities, approve media, migrate historic sessions/Points, mint tokens, enable trading, issue rewards, complete an independent security audit or open public beta.

## Actual remaining operator blockers
- No authorized current DATABASE_URL has been configured on the protected Preview. The connected Neon database has 25 old looke_* tables, zero required social_* tables and no checked real user/media/coin records.
- Authenticated connected Cloudinary prefix Looke search returned zero matching real assets on 5 November 2026. No cloud secrets have been supplied to Vercel for independent server verification.
- No canonical, user-supplied Testnet factory and CoinCreated hashes or native Uniq owner/factory/token proof have been independently confirmed in this milestone.
- Complete independently restored 19-table backup, original external security audit/report, real wallet-consent witnesses, full Points anti-sybil records, operator review and rollback rehearsal still require original human/source evidence.
- All social/media/financial/Points/token writes and public beta remain disabled and the immutable release decision stays NO_GO.

No recurrence/cron jobs, secrets, invented posts, approved media, real token claims, production alias changes or unauthorised migrations are created by M33.
