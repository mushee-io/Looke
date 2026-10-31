# Real social backend — deployment and security checklist

Looke now has SQL-backed creator profiles, authenticated text posts, likes, follows and signed EVM login endpoints. This code is **not a deployed service** until a PostgreSQL database is provisioned and its schema applied. Wallet connection alone is not login.

## Setup
1. Create a **dedicated** PostgreSQL database with TLS. Set `DATABASE_URL` as a server-only environment variable on Vercel (do not prefix with `NEXT_PUBLIC_`).
2. Run `psql "$DATABASE_URL" -f db/001_social.sql` from an authorized workstation.
3. Deploy the branch, verify `/api/auth/me` returns a logged-out response before connecting.
4. With an EVM wallet on Ultra EVM testnet (18881), request a server nonce from `/api/auth/challenge`, sign its explicit login-only message, and submit the signature to `/api/auth/verify`.
5. Check that one-time challenges cannot be reused, wrong accounts/chains cannot sign in, sessions are HttpOnly and logout revokes sessions. Test public feed and write operations.
6. Add production WAF rate limits, abuse reporting, automated moderation, and data retention controls before opening public posting.

## Security model
- Signatures are EIP-191 (EOA) login signatures only, checked by `viem.verifyMessage`. They do **not** approve token spending. ERC-1271 smart contract wallets need a separately reviewed path.
- Every mutating route checks Origin, accepts JSON, uses parameterized SQL, and checks an HttpOnly session cookie.
- Authentication nonce has 5-minute expiry and can be consumed only once. Session token is random, server stores only SHA-256 hash with 7-day expiry.
- Server APIs fail closed if the database or migration is missing; no in-memory fake account substitutes for durable storage.
- Text-only posts are limited to 1200 characters, with per-account rate limiting. Moderation is not production-ready.
- There is no personal email, OAuth, password flow, media upload or creator coin issuance in this phase.

## Related docs
- `docs/ULTRA_INTEGRATION.md`
- `docs/WALLET_NETWORK.md`
