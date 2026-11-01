# M3 — Persistent authentication state and session revocation

Looke's M3 includes a **server-session-backed account security panel** and **revoke all sessions** endpoint, plus wallet/account state synchronization in the login modal.

## Behavior
- `GET /api/auth/sessions` requires a valid HttpOnly session cookie. It returns only timestamps and current-session flags, not bearer tokens, token hashes, private keys, wallet signing material or IP addresses.
- `DELETE /api/auth/sessions` checks the first-party Origin header, checks the session owner and revokes **all** active login sessions for that profile in PostgreSQL. If the database operation fails, the route returns an error and does not claim revocation.
- The UI requires a second explicit confirmation before a global sign-out and updates its authenticated state after success.
- Login modal reflects the server's session state on reload, separately from whichever wallet is currently connected. An account/chain change invalidates the local EVM connection, requiring a new manual connect before signing another message.
- Session revocation **does not** revoke a wallet connection, token approval or blockchain transaction. No financial permissions are requested.

## Verification gates (not yet fulfilled)
1. Deploy protected staging and apply existing `db/001_social.sql` migration to its dedicated PostgreSQL database. No new schema migration is required.
2. Sign in with two real Ultra EVM testnet wallets/browsers, verify that both sessions appear without exposing hashes, revoke all and verify both cookies are rejected by `GET /api/auth/me`.
3. Check wallet account and chain-change handling in MetaMask or another compatible provider.
4. Test mobile, keyboard and screen readers, production edge rate limiting, operational monitoring, and independent security review before production.
5. Google, Apple and email authentication are still not configured; wallet EIP-191 remains the implemented login method.

**M3 is not fully accepted until real staging, independent wallet/session validation and production security checks are complete.** No trading, minting or spending is enabled here.
