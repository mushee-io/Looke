# Looke M1–M22 — implementation and release gates

Target: Zora-style social trading on **Ultra EVM**, plus native **Ultra Uniq** NFTs.
Status terms: **Preview** = interactive demo only; **Built (unverified)** = code present but no deployed proof; **Partial** = real code plus remaining dependencies; **Blocked** = requires external infrastructure, onchain receipts, security review or credentials. No milestone status here implies public readiness.

| ID | Milestone | Code as of this PR | Remaining acceptance |
|---|---|---|---|
| M1 | Initial UI | Original preview source built and merged into main | Staging deployment and cross-browser review |
| M2 | Zora-inspired original design | Partial: original Looke UI plus narrow-screen touch targets, forced-colors and increased-contrast CSS (PR pending verification) | Browser/device pixel QA, screen-reader and accessibility audit, mobile usability acceptance |
| M3 | Authentication | Partial: EVM signature nonce/session; strict host, address, chain, nonce and validity-window challenge binding; canonical challenge ID checks (source PR pending CI) | Provision DB; prove live login with genuine wallets; rate-limit by IP; Google/Apple/email optional |
| M4 | Ultra wallets | Partial: EVM and native testnet connect | Test physical wallets, chain/account changes, real receipts |
| M5 | Social profiles | Partial: SQL and editor | DB migration, identity integrity, moderation |
| M6 | Feed/publishing | Partial: verified-session text posts | Database, media upload, moderation and scale |
| M7 | Likes/follows/notifications | Partial: DB APIs and UI | Real-user tests and notification fanout |
| M8 | Discovery/recommendations | Preview search and filters | Personalized server-side ranking and search index |
| M9 | Creator coins | Undeployed ERC20 factory prototype | Audit and onchain creator launch receipts |
| M10 | Content coins | Undeployed factory kind/reference | Authenticated content attestation, liquidity |
| M11 | Trend coins | Undeployed factory kind/reference | Governance, spam policies, liquidity |
| M12 | Token trades | Pure BigInt quote tests and allowlisted real-reserve read-only quote API | AMM/router, approvals, slippage, real swaps |
| M13 | Live markets | Confirmed testnet factory-event indexer skeleton | Contract deployment, scheduler, real liquidity/price source |
| M14 | Uniq NFT creation | Partial: guarded authorized-factory native testnet mint lab (disabled by default) | Genuine signed mint receipts, collection launch and native factory management |
| M15 | Uniq marketplace | Preview only | Verified resale, buy/cancel and receipts |
| M16 | NFT creator tools | Drafts and native read-only Uniq query | Asset hosting, collections, mint controls, metadata review |
| M17 | Fee sharing/creator revenue | Not implemented | Fee allocation specification, treasury/liability audits |
| M18 | Portfolios and history | Partial: live UOS testnet balance, native Uniq query | Token balances, PnL, receipts, cost basis |
| M19 | Rewards/community | Not implemented | Anti-abuse rules, audited reward accounting |
| M20 | Indexing/backend | Partial: isolated Neon staging database migrated, social APIs, indexer source | Vercel staging blocked by 403, monitoring and jobs |
| M21 | Testnet/security | CI typecheck, math tests and Solidity compile | Signed test transactions, adversarial tests and independent audit |
| M22 | Mainnet release | Not implemented | Hosting rights, security audit, all gates complete and approved |

## Immediate execution path

1. Source merged after passing CI; the dedicated Looke Neon staging database and migrations are prepared. Resolve Vercel 403 team create-project permissions, then deploy protected staging and run live smoke tests.
2. Connect an actual Ultra EVM testnet wallet and native Ultra extension, obtain signed login receipts, validate post/follow/like flows with independent accounts.
3. Confirm Ultra API client credentials and native Uniq query on staging. Create audited native factory, mint and resale flows with proper wallet consent.
4. Audit and deploy the prototype coin factory to Ultra EVM testnet. Configure indexer against **real** address/deployment block and reconcile events with explorer receipts.
5. Implement chain-specific routing/liquidity, accounting, creator earnings, gas/allowance simulation and security tests. Never turn on swaps merely because a quote works.
6. Conduct product QA and security audit, publish measured real activity and compliance review, then consider an explicitly approved mainnet release.

### No-go rules
- No trading, minting, investment, earnings, market cap or volume claims without verifiable chain-backed transactions and reconciliation.
- No storing private keys or mnemonic phrases. Never send a wallet signing request outside a user gesture.
- EVM and native Ultra accounts are distinct; no unverified atomic Uniq-to-coin settlement.
- UI uses original Looke assets and conventions; do not copy Zora code/artwork or misrepresent their branding.
- Deployment secrets and third-party credentials remain on server-side secret storage.

## M2 accessibility implementation note (31 October 2026)

- Added `app/m2-accessibility.css` and loaded it after the original stylesheet to preserve the existing visual identity.
- Mobile controls gain 44px touch targets; 390px and smaller layouts receive narrower header and typography adjustments.
- Forced-colors mode restores visible borders and selected states; increased-contrast preference strengthens text and control boundaries.
- Verification gate: run CI (typecheck, tests, contract compile, build), then manually test at 320/360/390/768px, 200% text zoom, Windows High Contrast, macOS increased contrast, VoiceOver/NVDA, keyboard focus and actual mobile devices. These tests are **not** claimed as complete by source-only changes.
- No live trading, minting, spending or mainnet actions are introduced.

## M3 login challenge hardening (1 November 2026)

- Verification now rejects persisted challenges whose signed domain, address, chain, nonce, timestamp format or expiry window does not match the request context, before signature verification and consumption.
- Added pure regression tests for cross-host replay, wallet mismatch, chain alteration, malformed nonce, excessive expiry and injected lines.
- This does not replace origin checking, database-backed one-time consumption, production edge rate limiting, genuine wallet signing tests or an external security review.
- Deployment and live login verification remain blocked by staging hosting permissions and genuine test-wallet acceptance.

## M3 challenge freshness hardening (1 November 2026)

- Verify a persisted signed challenge is within its issue/expiry window, permitting no more than 30 seconds of clock skew in either direction. Existing database expiry and single-use consumption remain authoritative and stricter.
- Add regression tests for stale and future-issued challenges, boundary clock skew, and non-finite timestamps.
- Source tests and CI do **not** establish live authentication. Protected staging deployment, independent EVM wallet sign-in, session persistence checks, rate limiting at the edge and security review remain required.

## M3 CI repair (1 November 2026)

- PR #6 initial CI failed at `npm run test:math` because literal `\\n` characters were accidentally committed between JavaScript statements in `lib/auth-challenge.mjs`.
- Replaced those literal escape sequences with actual source newlines in the PR branch. A successful rerun of all checks is required before merge; this repair alone is not verification.
- M3 remains partial until protected staging, independent wallet sign-in and production rate limiting are verified.

## M3 issuance/verification compatibility (1 November 2026)

- Extracted the Ultra EVM login challenge message into a deterministic, validated formatter shared by the challenge issuance endpoint.
- Added regression coverage that generates a real-format challenge and checks acceptance by the verification parser, plus malformed host/nonce/address/timestamp rejection.
- This is source-level hardening only. Protected staging deployment, real wallet signatures, rate limiting at the edge and independent security review are still required; M3 remains partial.

## M3 canonical UTC timestamp validation (1 November 2026)

- Reject impossible calendar dates and non-round-tripping UTC timestamps in persisted login challenges before signature verification; do not rely on permissive `Date.parse` normalization.
- Add Node regression tests for canonical dates, invalid calendar dates and the five-minute challenge window boundary.
- This is source-only defense in depth. CI, genuine wallet acceptance, protected staging deployment, edge rate limiting and independent review are still required; M3 remains partial. No transaction or spending capabilities are enabled.

## M3 challenge identifier input validation (1 November 2026)

- Added a pure canonical UUID-shape validator and wired it into the wallet signature verification endpoint before database lookup. Previously a permissive 36-character hex-and-hyphen pattern could admit malformed UUID strings.
- Added Node regression tests for valid mixed-case identifiers and malformed lengths, separators, characters and input types.
- This is input validation, not proof of live wallet authentication or a replacement for one-time database consumption. Require passing CI, protected staging, independent wallet testing, production edge rate limiting and security review before M3 acceptance.

## M3 PR #9 typecheck repair (1 November 2026)

- Initial PR #9 CI failed during `npm run typecheck`: the pure JavaScript UUID validator does not provide TypeScript control-flow narrowing for an `unknown` challenge ID used in parameterized SQL.
- Added an explicit `typeof payload.challengeId === "string"` guard before the canonical UUID validation, preserving strict runtime rejection while narrowing the SQL argument safely.
- Repair committed to the existing PR branch; passing full CI is required before merge. Protected staging, genuine wallet signature tests, production rate limiting and independent review remain outstanding.

## M3 bounded JSON request parsing (1 November 2026)

- Added a 16 KiB actual-byte limit for shared session API JSON parsing, including requests without Content-Length; oversize bodies are rejected before JSON decoding.
- Added regression tests for accepted JSON, invalid content type, oversize UTF-8 input, malformed and empty JSON.
- This is defense in depth, not a substitute for upstream edge limits, production IP-based rate limiting, protected staging, genuine wallet-signature acceptance or security review. M3 remains partial and all spending/minting/trading remain disabled.
- Verify GitHub CI before merge; no live staging validation claimed.

## M3 declared JSON body-length preflight (1 November 2026)

- Reject malformed or oversized declared `Content-Length` before consuming authentication JSON request streams; continue enforcing the streamed 16 KiB byte cap even when the header understates the body.
- Add tests for oversized declarations, malformed declarations, false low declarations and exact-boundary requests. This is defense in depth, not an IP-based rate limiter or proof of live wallet login.
- Acceptance remains blocked on protected Vercel staging permissions, genuine independent wallet sign-in, database-backed sessions, production edge rate limiting and security review. No trading, minting or spending is enabled.

## M3 strict authentication JSON media type (1 November 2026)

- Require an exact `application/json` media type (optionally with a UTF-8 charset parameter) for the bounded authentication JSON parser; reject prefix lookalikes such as `application/jsonp` and unsupported parameters.
- Add regression coverage for accepted UTF-8 variants and rejected misleading content types. This is source-only input hardening; successful CI and protected staging acceptance remain separate gates.
- M3 remains partial pending independent wallet sign-in, production edge rate limiting, Vercel staging access and security review. No trading, minting or spending is enabled.
