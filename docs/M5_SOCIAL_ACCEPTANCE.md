# M5 — Creator social network and messaging security foundation

M5 adds public wallet-authenticated creator profiles, following, public posts/comments, asset references, a discovery feed, blocking, user reports, and an audited moderator back office (API only).

**M5 never signs, submits, approves or transfers financial assets.** A wallet signs only a short-lived challenge authorizing Looke social session creation on Ultra EVM Testnet. No fake posts, users, follower counts or messages are inserted into production.

## Deployment configuration and gates

- PostgreSQL 15+ is required. Provision a TLS-enabled hosted database and set server-only `DATABASE_URL`.
- Run migration explicitly: `npm run db:migrate` (review SQL first).
- Configure canonical origin: `LOOKE_SOCIAL_APP_ORIGIN=https://YOUR_HTTPS_HOST` (no path). Exact same-origin `Origin` and JSON content type are required for all mutation requests.
- Default `LOOKE_SOCIAL_WRITES_ENABLED=false`. Only enable after schema, rate-limit, moderation and wallet acceptance tests pass.
- Configure optional `LOOKE_SOCIAL_MODERATORS` as comma-separated EVM addresses. **Only successfully signed-in, allowlisted moderators** may hide/unhide posts/comments or suspend/restore profiles, and each action is recorded in `social_moderation_audit`.
- GitHub Actions spins up temporary PostgreSQL 16 for integration tests; no production credentials are stored in CI.
- Missing `DATABASE_URL` fails closed (503), never returns fake empty content as if verified.
- No server-side API route calls `eth_sendTransaction`, wallet approvals, token transfers or DEX contracts.

## Security design

1. **Sign in:** User connects an EVM wallet on Ultra EVM Testnet (chain 18881), reviews a purpose-limited text challenge, and signs with `personal_sign` (EIP-191).
2. **Challenge:** 128-bit random nonce, a strict domain and origin, wallet binding, issued time, 5-minute expiry, one-time database consumption; concurrent replay must not create another valid session.
3. **Sessions:** 256-bit random bearer tokens, SHA-256 hashes in Postgres, 7-day expiry, secure HttpOnly `SameSite=Strict` cookie (production `__Host-` prefix). The raw token is not kept in Postgres.
4. **CSRF:** Every write endpoint checks exact origin and requires JSON content type.
5. **Rate limits:** Atomically updated persistent buckets for auth, posts, comments, follows and reports. Production deployment should *also* configure edge/IP bot protection for public sign-in challenges.
6. **Visibility:** Blocks remove reciprocal follows, exclude blocked authors from feeds/searches and stop blocked users replying to each other's posts. Moderators can hide content and suspend accounts; actions are audited.
7. **Public content:** Bound length, plain-text React rendering; share references to Ultra EVM creator tokens and native Uniq IDs. **Sharing is not proof of ownership, price or token legitimacy.**
8. **Authorization:** Wallet addresses on public writes come from signed sessions, never untrusted request-body actor fields.
9. **Messaging:** Only database foundation tables for future per-account encryption public keys and encrypted envelopes. No private-message send/read API is exposed. Do not claim end-to-end encryption or private chat is live until audited client key exchange, multi-device recovery, ciphertext controls and message moderation/abuse controls exist.

## Acceptance checklist

- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, `forge test`
- [ ] Postgres service integration tests pass; migration explicitly applied
- [ ] Verify invalid signature, expired challenge and consumed challenge cannot create sessions
- [ ] Log in using two distinct Ultra EVM Testnet wallet addresses (signature only)
- [ ] Create/edit each creator profile and test handle uniqueness
- [ ] Post public content, comment, follow/unfollow, inspect global/following feeds
- [ ] Post a real token address reference and native Uniq ID reference; verify no false ownership claim
- [ ] Block a profile and verify content/relationship filtering
- [ ] Report a post and observe moderator-only queue externally; test allowlisted moderator hide and audit
- [ ] Confirm social APIs never accept plaintext DMs or transmit financial transactions
- [ ] Load `/social` without any DB configured and confirm explicit unavailable state, not mocked posts
- [ ] Conduct security review, abuse/edge rate-limit review, privacy/retention review before public beta

## Remaining work / known limitations

- Messages are **not enabled**; there's no audited end-to-end encryption key management.
- Contract-wallet (ERC-1271) sign-in is not yet supported by EOA signature verification.
- Ultra native account sign-in is not yet included; M5 uses Ultra EVM wallet identity.
- Large social graphs will require indexer/feed pagination and additional query tuning.
- Media uploading, push notifications, spam detection, content abuse appeals and GDPR operations need future implementation.
- Social DB integration is not automatically live on Vercel just because GitHub CI passes.
- M3 and M4 remain separate PRs until their CI/test issues are resolved; M5's social code does not depend on them or overwrite their chain-specific integrations.
