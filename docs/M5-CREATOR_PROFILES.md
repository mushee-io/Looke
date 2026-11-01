# M5 — Creator profiles and discovery

Looke creator profiles are **database-backed identities linked to an authenticated Ultra EVM social account**. They are not verified real-world identities, token issuers, NFT collections, or guarantees of creator endorsement.

## Source implemented

- `PATCH /api/profile` requires a valid HttpOnly session, same-origin request and bounded JSON parser; it normalizes handle/name/bio and rejects reserved names or control characters.
- `GET /api/creators` returns real profiles with public handle, name, biography, follower and visible-post counts. No fake or cached follower counts are inserted.
- `GET /api/creators/[handle]` returns the public creator profile, an authenticated viewer's follow state and up to 20 **visible**, most recent text posts. Hidden or removed posts are excluded.
- `/creators/[handle]` renders a public, shareable creator page with a responsive layout and links back to Looke. Following uses the existing authenticated follow endpoint.
- Explore displays real creator cards when database connectivity is available, never fabricated creator activity; real feed posts link to their authors' saved handles.
- The creator profile editor displays the shareable link after it is saved. Reserved handles such as `admin`, `official`, `support`, `looke`, `api`, `root` are not available to users.
- SQL uses the existing `db/001_social.sql` tables and indexes, with no schema migration required. A new source-level test suite verifies normalization and reserved-handle rejection.

## Operational, safety and acceptance gates

- [ ] Deploy Looke to protected HTTPS staging with its dedicated Neon database and valid session secrets.
- [ ] With two **independent real Ultra EVM wallets**, edit creator profiles, verify unique-handle rejection (409), follow/unfollow, session revocation and persistence across browser reload.
- [ ] Verify handle collision and reserved-handle behavior under concurrent requests, including exact lowercase URLs and malformed slugs.
- [ ] Verify no private session cookie/token hashes, unpublished content, hidden or removed posts are exposed in public APIs.
- [ ] Test search/directory performance and accessibility across mobile devices and screen readers.
- [ ] Implement profile reporting, impersonation complaints, username-change history/redirects, abuse prevention and moderation operations before opening public registrations.
- [ ] Add media uploads, verified ownership badges or reputation only after securing media hosting, moderation and independent evidence.

**M5 remains PARTIAL until deployed multi-account acceptance and moderation controls are verified.** Wallet balances, market caps, coin launches and minting are not implied by a social profile.
