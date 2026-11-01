# M3 — Production authentication request throttling

- `lib/server/auth-rate-limit.ts` limits **request starts** to 12 login challenges and 30 signature verification attempts per trusted client IP per 10-minute window.
- Uses the documented Vercel-controlled `x-vercel-forwarded-for` header **only** when `VERCEL=1`. The app rejects missing/invalid/ambiguous IP data in production rather than trusting an arbitrary client-provided forwarding header.
- The bucket key is HMAC-SHA256 over the IP and route scope, using the server-only `LOOKE_AUTH_RATE_SECRET` (at least 32 random characters). Neither the raw IP nor the secret is stored in PostgreSQL.
- Uses a PostgreSQL fixed-window atomic upsert (`db/003_auth_rate_limits.sql`). This supplements the existing 6-per-address/15-minute challenge throttle.
- Returns HTTP 429 when a bucket is exhausted; if production rate-limit config, network provenance or PostgreSQL are unavailable, the login endpoint returns HTTP 503. Local development bypasses this production gate.
- Clean up old bucket rows with an authorized job: `DELETE FROM looke_auth_rate_limits WHERE window_started_at < now() - interval '24 hours';` This source change does not install a scheduler.
- Vercel WAF IP/JA4 rate limiting must additionally be configured for auth routes before launch; application throttles are not a substitute for perimeter abuse protection.

## Configuration and testing

1. Apply SQL migration 003 in Looke's **dedicated** Neon staging database.
2. Generate and store an independent random `LOOKE_AUTH_RATE_SECRET` in staging/production server-side secrets; never commit it, and never use a `NEXT_PUBLIC_` prefix.
3. Deploy to an authorized Vercel project with `VERCEL=1`; verify Vercel replaces forwarding headers. Do not infer trust if behind an unreviewed reverse proxy.
4. Exercise repeated requests from two independent trusted networks, confirm 429 at each limit and reset after 10 minutes; confirm invalid upstream IP/missing secret returns 503.
5. Enable Vercel WAF rate limits, log/alert on rejects, check protected deployment, then security-review and document operational incident response.

This does not create email/Apple/Google sign-in. M3 remains blocked on real-wallet sign-in, secure staging and operational verification.
