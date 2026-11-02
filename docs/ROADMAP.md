# Looke M1–M22 — implementation and release gates

Target: Zora-style social trading on **Ultra EVM**, plus native **Ultra Uniq** NFTs.
Status terms: **Preview** = interactive demo only; **Built (unverified)** = code present but no deployed proof; **Partial** = real code plus remaining dependencies; **Blocked** = requires external infrastructure, onchain receipts, security review or credentials. No milestone status here implies public readiness.

| ID | Milestone | Code as of this PR | Remaining acceptance |
|---|---|---|---|
| M1 | Initial UI | Original preview source built and merged into main | Staging deployment and cross-browser review |
| M2 | Zora-inspired original design | Partial: original Looke UI plus narrow-screen touch targets, forced-colors and increased-contrast CSS (PR pending verification) | Browser/device pixel QA, screen-reader and accessibility audit, mobile usability acceptance |
| M3 | Authentication | Partial: EVM signed challenge/session; active session inventory, global revocation; production trusted-IP HMAC rate-limiting source and staging migration; strict challenge and JSON validation | Protected Vercel staging, real-wallet/multi-IP verification, WAF policy, independent security review and optional Google/Apple/email providers |
| M4 | Ultra wallets | Partial: EVM and native testnet connect | Test physical wallets, chain/account changes, real receipts |
| M5 | Social profiles | Partial: authenticated profile editor with reserved-handle validation, public creator pages, directory, real follower/post counts and follow integration | Protected staging, multi-account acceptance, impersonation reporting/moderation, profile identity policies and mobile QA |
| M6 | Feed/publishing | Partial: real text feed with microsecond keyset pagination, browser drafts, owner edit/delete, atomic post throttles and private report intake | Image/video uploads, operator moderation, protected staging and real multi-account/load/security testing |
| M7 | Likes/follows/notifications | Partial: likes/follows, signed-in comments and author deletion, repost tracking/counts, shareable post links, four-type notifications with unread state | Protected staging, multi-account testing, operational moderation, repost syndication, push delivery and abuse/security review |
| M8 | Discovery/recommendations | Partial: indexed public creator/post full-text search; real Trending, For You (follow boost), Following and Latest feeds; tests and staging search indexes | Protected deployment, multi-account acceptance, moderation/anti-manipulation safeguards, search pagination and scale QA |
| M9 | Creator coins | Partial: one-draft-per-authenticated-creator launch lab, bounded metadata/supply, read-only 18881 factory preflight, factory local-EVM invariant tests; staged schema | Independent contract audit, protected staging, real Ultra EVM signed factory/token deployment and receipts, onchain creator attestation, UX/security approval |
| M10 | Content coins | Partial: authenticated creator-owned post snapshots, versioned contentRef, private draft UX, readonly 18881 factory mapping preflight and isolated kind-1 contract tests | Fix permissionless copied-ref authorization gap; independently audit, deploy on Ultra EVM testnet, verify signed receipts and content moderation/liquidity gates |
| M11 | Trend coins | Partial: deterministic canonical topic refs, evidence-gated nominations, social endorsements with private event ledger and rate limits, withdrawal, read-only factory preflight, local EVM kind-2 tests | Audited global topic authorization and anti-sybil governance, moderation, protected staging, real signed Ultra testnet deployment, economic/liquidity design |
| M12 | Token trades | Partial: safe BigInt simulator, slippage and price-impact review, pinned-block allowlisted V2 testnet quote, ERC-20/UOS balance preflight and read-only trading UI | Audited router/factory and real pools, allowances/gas/MEV and wallet simulation, protected staging, signed Ultra testnet swaps and security audit |
| M13 | Live markets | Partial: atomic confirmed factory/pool Swap event ingestion, 12-block hash checkpoints, onchain reserve/status APIs and read-only Explore market dashboard | Independently audited/deployed factory and pools, actual indexed Ultra testnet transactions, protected scheduler/staging, reorg recovery, monitoring and production integrity audits |
| M14 | Uniq NFT creation | Partial: private collection and edition metadata drafts, SHA-256 manifests, read-only native factory.b/authmintrs.a eligibility check and restricted testnet issue.b lab guarded by wallet/role review | Independently pinned media, authorized native create.b factory, native-wallet/EVM profile association, signed and verified testnet issuance receipts, protected staging and independent security review |
| M15 | Uniq marketplace | Partial: read-only native testnet resale.a discovery, token.b owner crosschecks, exact asset pricing, paginated marketplace board and non-executable buy/list/cancel preflight | Native wallet challenge, audited contract/version fee and resale-window simulation, real signed resale/purchase/cancel receipts, protected staging and security/legal approvals |
| M16 | NFT creator tools | Partial: authenticated revision-safe collection/edition metadata edits, edition-plan totals, deterministic per-item SHA-256 JSON bundle export and creator editing UI | Protected staging, native wallet association, verified IPFS pinning and true native NFT lifecycle operations, independent Ultra testnet signed receipts, security review |
| M17 | Creator earnings | Partial: native Uniq policy/beneficiary royalty projections from real resale/factory/global share tables, private unverified payout reference inbox, strict BigInt basis-point math and account-scoped API/UI | Finalized historical native transaction/action traces, actual verified receipts and wallet-beneficiary pairing, immutable reconciliation ledger, audited payout controls, protected staging |
| M18 | Portfolios and history | Partial: pinned-block EVM UOS/approved ERC-20 balance API, native account-scoped Uniq paging, recent 12-confirmed ERC-20 Transfer logs and checkpoint-checked creator launch events in unified Profile/Activity portfolio | Protected staging, independent real holdings and receipts, verified wallet control and source provenance, full/native transaction indexing, cost basis and independently priced PnL |
| M19 | Rewards/community | Partial: real visible-social-data 14-day provisional activity score, category/counterparty caps and age gates, private owner-only daily ledger, revised unverified snapshots and public aggregate community stats | Protected staging, independent anti-sybil and moderation audit, immutable source-event provenance and claims reviews, funded audited token distribution and real testnet receipts |
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

## M3 top-level authentication JSON shape (1 November 2026)

- Require a non-null, non-array JSON object from the shared bounded authentication/session JSON parser. Reject primitive and array top-level payloads before route-specific field validation.
- Add regression coverage for null, arrays, booleans, numbers, strings, empty objects and nested objects.
- This is source-only input validation, not proof of live authentication. Require passing CI, protected staging, genuine wallet sign-in, database-backed session acceptance, production IP rate limiting and independent security review before M3 completion. Trading, minting and irreversible spending remain disabled.

## M3 reject encoded authentication request bodies (1 November 2026)

- Reject Content-Encoding other than explicit identity in the bounded authentication/session JSON parser before reading the body. This prevents ambiguity about whether the 16 KiB streamed limit applies to encoded or decoded bytes; upstream reverse proxies must still enforce their own limits.
- Add regression tests for gzip, Brotli, deflate, combined and empty encodings, and accepted identity encoding. This does not constitute a decompression-bomb defense at the edge.
- M3 remains partial pending protected staging, genuine independent wallet sign-in, session persistence, IP-based rate limiting and independent security review. No trading, minting, mainnet or irreversible spending enabled.

## M3 authentication JSON nesting guard (1 November 2026)

- Limit nested JSON objects/arrays to 32 container levels after bounded UTF-8 parsing, using an iterative traversal to avoid recursive stack exhaustion. This is a defense-in-depth limit on shared authentication/session request parsing.
- Added tests for the boundary, excessive nested objects and excessive nested arrays. Verify CI before merging.
- M3 remains partial: genuine wallet signature/session acceptance, protected staging, IP-based edge rate limiting and independent security review are still outstanding. No trading, minting, spending or mainnet actions enabled.

## M3 nesting boundary CI repair (1 November 2026)

- PR #15 initial quality run #76 failed in `npm run test:math` because the new rejection test used 32 object containers, which is the permitted maximum. Corrected rejection coverage to 33 containers and acceptance coverage to exactly 32 containers.
- The iterative parser's limit remains unchanged. Require a new successful GitHub CI run before merging; source-level checks are not evidence of live wallet authentication.
- Protected staging, genuine wallet/session testing, production edge rate limiting and independent security review remain M3 release gates. No trading, minting, spending or mainnet actions enabled.

## M3 session management and wallet-state consistency (1 November 2026)

- Added authenticated session inventory (`GET /api/auth/sessions`) that returns only creation/expiry times and current-session flags. Bearer cookies and token hashes remain server-side; API responses are non-cacheable.
- Added Origin-protected `DELETE /api/auth/sessions` to revoke all server sessions for the signed-in profile and clear the HttpOnly cookie. The UI requires explicit second confirmation and does not claim success if database revocation fails.
- Restored signed-in session state from `/api/auth/me` into the wallet modal on reload. The active social account is separate from the connected wallet; account/chain changes invalidate stale local EVM connection state.
- Added regression tests for safe session metadata and invalid values. No trading, NFT minting, mainnet or irreversible spending was enabled.
- M3 remains **partial** until protected staging, independent real-wallet/session tests, edge IP rate limiting and security review. Google/Apple/email providers are not implemented.

## M3 trusted-IP production throttling (1 November 2026)

- Added server-side HMAC-hashed IP buckets in PostgreSQL (`db/003_auth_rate_limits.sql`) for login challenge and signature verification endpoints.
- Require platform-verified Vercel client IP and a separate server-only secret in production; missing or invalid prerequisites fail closed with 503. Exhausted buckets return 429. Existing per-address challenge throttling is retained.
- Includes regression tests for forwarded IP spoofing rejection, invalid addresses and HMAC scope isolation; does **not** replace a deployed Vercel WAF policy or proven live login. See `docs/M3-RATE_LIMITS.md`.
- M3 remains incomplete until real production-shaped acceptance, protected deployment and independent review.

## M5 public creator profiles (1 November 2026)

- Added shareable public creator routes, directory, database-backed follower/visible-post counts and follow state, with original Looke responsive UI.
- Hardened handle normalization and reserved creator names, and linked real social posts and saved profiles to public pages.
- Added regression tests and `docs/M5-CREATOR_PROFILES.md` acceptance guide. No token issuance, NFT minting or creator-earnings claims are enabled.
- Staging deployment, real multi-account tests and moderation remain required; M5 is not yet production accepted.

## M6 feed and author publishing controls (1 November 2026)

- Implemented deterministic keyset-pagination source and atomically rate-limited signed-in text publishing, owner-only edits/deletion, and private abuse report intake (no automatic removals).
- Added draft persistence in the browser, a load-more feed, owner edit/delete UI and a report form.
- Applied `db/004_feed_publishing.sql` to the dedicated Neon staging database; added tests for canonical cursors, text, UUIDs and report-reason validation.
- Media uploads and operational moderator tools remain disabled/pending. See `docs/M6-FEED_PUBLISHING.md` for staging acceptance gates. No live trading, NFT minting or market activity enabled.

## M7 comments, reposts and notification read state (1 November 2026)

- Added comment/repost data model, bounded text and identifier validation, rate limiting, author-only comment removal and share-link resolution.
- Added real feed counts and controls for commenting, repost tracking and sharing; notification API now includes comments and reposts alongside likes and follows, with server-persisted read state.
- Applied `db/005_social_interactions.sql` to the isolated Looke staging database. Added focused regression tests and `docs/M7-SOCIAL_INTERACTIONS.md` acceptance guidance.
- No background push, full follower-feed repost syndication or live moderation operations yet. M7 is partially implemented until real-wallet/staging, scaling, abuse and security verification succeed.

## M8 public search and transparent discovery (1 November 2026)

- Added `/api/discovery/search` for parameterized indexed public full-text search with strict query limits, and `/api/discovery/feed` for real engagement- and recency-based Trending, cold-start-safe For You and strict authenticated Following results.
- Wired real discovery to the Explore sitewide search, and working four-mode feed navigation. Fictional preview social posts are separated and explicitly labelled.
- Applied public-only full-text search indexes to Looke's isolated Neon staging database (`db/006_discovery.sql`). Added regression tests for query validation, modes, ranking time decay and following boost.
- See `docs/M8-DISCOVERY.md`: anti-manipulation, moderation, full production search/performance verification and protected staging are still required. M8 remains **partial**, not production-accepted.

## M9 creator coin draft, contract simulation and audit gates (1 November 2026)

- Added signed-in creator-specific private token launch drafts with strict name, uppercase symbol, whole-token supply and pinned IPFS CID URI validation. Drafts are stored only in Looke's isolated Neon project; this does not mint a token or create any financial claim.
- Added Profile creator coin lab and a strictly read-only Ultra EVM testnet factory check (`coinFor` address lookup; no signing, broadcasting or liquidity). The factory's code or address is **not** treated as audit evidence.
- Added isolated Ganache EVM runtime tests for the unaudited Solidity factory (one creator coin per EVM wallet, 18-decimal fixed supply, ownership, duplicate and invalid-parameter reverts). CI verification is required before merge.
- Applied `db/007_creator_coin_drafts.sql` to the dedicated Neon staging database. See `docs/M9-CREATOR_COINS.md` for remaining deployment, metadata/identity, independent audit and signed testnet receipt gates.
- M9 remains **partial**; no publicly enabled token issuer, creator earnings, active swaps, testnet deployment evidence or mainnet launch.

## M10 post-linked content coin preparation (1 November 2026)

- Created owner-only visible-post content coin proposals with a `looke.content.v1` domain-separated reference committed to Ultra EVM 18881, the creator EVM address, post UUID, exact source text and latest edited revision. Edit/hide invalidates the old proposal; deleting a post cascades to its private draft.
- Built authenticated API, Profile content-coin preparation UI, post-to-draft links, read-only factory `coinFor` preflight and isolated Ganache kind-1 factory tests. Applied `db/008_content_coin_drafts.sql` to the dedicated Neon staging database.
- Contract tests demonstrate a blocking copied-reference attack: a different wallet can launch against an identical reference in the existing **permissionless** factory. Audited onchain issuer attestation/authorization is mandatory before public content coins; no minting, liquidity or spending was enabled.
- See `docs/M10-CONTENT_COINS.md`. This source is partial and has no verified Ultra testnet deployment, audit, wallet acceptance or production release.

## M11 public-topic trend nominations and nonbinding signals (1 November 2026)

- Added a verifiable **offchain** canonical trend/topic reference for chain 18881 and a private-draft/community nomination workflow backed by real public post/author counts (minimum 3 posts from 2 accounts in 14 days).
- Added unique topic nominations, authenticated per-account endorsements, 3 nominations per 30 days and 15 endorsement events per 24 hours, private endorsement-action ledger to prevent simple quota bypass, creator withdrawal, and read-only factory mapping preflight.
- Wired a working topic nomination and endorsement board into Explore. Applied `db/009_trend_coin_governance.sql` to the isolated Looke Neon staging database; extended validation and Ganache tests for kind-2 fixed-supply trend tokens and copied-ref attacks.
- Fixed a malformed `db/008_content_coin_drafts.sql` source migration discovered while building M11. The M10 table was already present and valid in isolated staging Neon.
- See `docs/M11-TREND_COINS.md`. Community endorsements are **not** anti-sybil governance; the current permissionless factory accepts a copied trend ref from other wallets, so no public minting or trading is enabled. Full protected staging, independent audit, global authorization, moderator controls and signed real testnet receipts remain mandatory.

## M12 token swap simulation and Ultra testnet preflight (1 November 2026)

- Added strict BigInt AMM simulation with raw-unit amounts, LP fee assumption, quote minOut, high price-impact warning (above 1,500 bps), short quote expiry and explicit non-execution result. Tests cover invalid values, precision, fee/slippage bounds and preflight states.
- Replaced quote internals with an allowlisted same-block Ultra EVM 18881 V2 pool reader, reserve age guard, read-only token decimals/symbol and optional balance/UOS inspection. No unverified pool is recommended or executed. Without configured pools, live quotes fail closed rather than inventing reserves.
- Replaced the inert trade preview with a Trading Lab in Explore and the existing trade modal. The calculator is labelled hypothetical; real quote data is only displayed from explicitly configured testnet pools.
- No audited router, gas/allowance simulation, verified pool deployment, signed testnet swap or production payment exists. See `docs/M12-TRADING_LAB.md`. **M12 remains partial and trading disabled.**

## M13 confirmed markets and indexer integrity (1 November 2026)

- Extended the protected coin factory indexer to also ingest allowlisted V2 `Swap` logs into a new market-history table. Events and cursor advance atomically per 250-block batch after a 12-block confirmation delay; existing canonical cursor block hashes are revalidated and mismatches halt the stream for manual reconciliation.
- Added market source/status listing, same-block reserve and token metadata snapshots, 30-event confirmed history readout and a 30-second refreshing Explore dashboard. No configured/verified pool means no live data is shown. Refined `/api/coins` to fail closed without a factory and canonical indexed checkpoint.
- Added `db/010_market_indexing.sql` and applied it only to dedicated Looke Neon staging. Added pure tests for finality windows, block hashes, raw swap values and direction safety.
- Trading remains disabled. The current unaudited factory and unknown pools have no real verified swap/issuance evidence; protected Vercel staging, an authorized scheduler, external contract verification and a tested reorg runbook remain incomplete. See `docs/M13-LIVE_MARKETS.md`.

## M14 native Uniq Creator Studio and authorization gates (1 November 2026)

- Added original NFTs-page Creator Studio: private collection and item edition drafts, strict IPFS CID input/metadata checks, deterministic exact-byte JSON/SHA-256 previews, signed-in Looke profile ownership controls and draft deletion. M14 schema `db/011_uniq_creation_drafts.sql` applied and verified in the separate Looke Neon staging database.
- Added read-only Ultra native factory ID, state, minting window, supply, asset manager and authorized-minter checks via official `factory.b` and `authmintrs.a` native testnet tables. A typed native account is **not** wallet-proof. No arbitrary RPC source or production chain is accepted.
- Strengthened the existing default-disabled `issue.b` testnet lab: requires same connected native wallet, matching manager/minter permissions, active factory preflight and wallet-authorized one-Uniq issuance with a maximum 10 test UOS payment; a wallet broadcast is not treated as a confirmed receipt.
- **No actual NFT/factory was created, metadata pinned, or signed testnet receipt verified here.** Further native challenge binding, media hosting, protected deployment, audit and operational authorization are required. See `docs/M14-UNIQ_CREATION.md`.

## M15 read-only native Ultra resale marketplace and review (1 November 2026)

- Built source-backed **native testnet** Uniq marketplace board with strict chain-ID validation, bounded resale.a pagination, crosschecking each resale with seller-scoped token.b, exact BigInt price/fee display and clear skipped/unavailable states; existing example NFT cards remain labelled previews.
- Added no-spend preflight for buying (including seller self-buy rejection), owner-only cancellation and listing proposed owned/unlisted Uniqs; rechecks native resale/ownership and factory entry but **never** creates signable transaction data. Review expires after 15 seconds.
- No Neon migration: these are public native chain readings, not Looke-managed listings. No signed native resale/buy/cancel transaction has been executed or verified. Offchain native account names do not prove wallet control, and Ultra buy price protection differs by contract version.
- See `docs/M15-UNIQ_MARKETPLACE.md`. Full M15 remains partial and **public transaction execution disabled** pending real authorized testnet receipts and independently reviewed fee, wallet and NFT contract controls.

## M16 versioned Uniq creator editing and portable metadata (1 November 2026)

- Added optimistic-concurrency `PATCH` updates to private Uniq collection and edition drafts with owner-scoped PostgreSQL revision compare-and-swap. A stale browser revision fails with HTTP 409, not a silent overwrite; edited planned supply is explicitly **not onchain minted supply**.
- Added deterministic, sorted per-collection export with exact JSON/UTF-8 SHA-256 metadata fingerprints, planned edition totals, revision numbers and private repeatable-read snapshot; new NFTs-page Creator Tools supports edit, refresh and download.
- Applied `db/012_uniq_creator_tools.sql` revision columns and item `updated_at` only to dedicated Looke Neon staging; verified table structure. Tests cover unsafe input, edition caps, ownership-bound bundle shape, revision and hash determinism.
- M16 is **partial**: no live metadata pinning, native wallet/EVM association, actual NFT management, signed testnet issuance, protected staging or external audit. See `docs/M16-NFT_CREATOR_TOOLS.md`.

## M17 creator earnings foundation (1 November 2026)

- Added a strictly **read-only projected** native Uniq resale distribution view using real `resale.a`, seller-scoped `token.b`, `factory.b`, `global.share` and `saleshrlmcfg` on testnet, exact UOS and integer basis-point arithmetic, and transparent attribution to a selected beneficiary account. Listing value is *not* creator income; no historical sale or payout is inferred.
- Added owner-only private, unverified native transaction evidence reference collection with unique IDs, daily/account quotas, no credited amount, proof status locked to `unverified`, and removal of own evidence. Applied `db/013_creator_earnings_evidence.sql` to Looke-only Neon staging; no sample earnings or credited transfers.
- Integrated a creator royalty policy preview and reconciliation inbox on the NFTs page; tests cover no-FX exact UOS precision, payout allocations/rounding, malformed policy and evidence constraints.
- **M17 remains partial:** true realized earnings require irreversible native transfer receipts, historical share/beneficiary attribution, native-wallet signature linking, audited transfer accounting, protected staging and independent security review. No withdrawals, trading, royalty collection or income credits are enabled. See `docs/M17-CREATOR_EARNINGS.md`.

## M18 sourced Ultra portfolio and confirmed activity (1 November 2026)

- Built an original, unified read-only Ultra portfolio on Profile and Activity. EVM UOS and operator-allowlisted ERC-20 balances are read at one block with current bytecode/metadata checks; native Uniq IDs use owner-scoped native testnet `token.b` with pagination. Sources and networks are **separate**, and typed addresses do not prove user wallet ownership.
- Added limited EVM event history from curated token `Transfer` logs (250-block window, 12-block delay) plus previously indexed factory launch events behind M13 canonical checkpoint checks. Logs are real chain-sourced observations, not full history or cost basis; creator launches do not prove currently held coins.
- Added BigInt/address/native-id and log deduplication tests. No Neon migration, fabricated assets, payout credits, transaction sending, USD price, PnL or NFT trading activity included.
- See `docs/M18-PORTFOLIO.md`. Real testnet acceptance still needs protected staging (Vercel permissions), audited asset allowlists, genuine receipt checks, native wallet association, full-source history indexing and accuracy/security review.

## M19 provisional community participation and anti-abuse foundations (1 November 2026)

- Added live 14-day, UTC-bound, owner-only social participation ledger using currently visible posts and eligible cross-creator comments, likes, reposts and follows. Engagement is deduplicated by other creator/category/day, capped at 37 points/day, and subject to basic account age, multi-day activity and distinct-counterpart manual-review prerequisites.
- Added read-only public aggregate community stats without identifying public wallets/leaderboards. Users can explicitly save and reconcile private, non-redeemable snapshots of the most recent 14 *completed* UTC days; SHA-256 covers aggregate score evidence, not a fully audited underlying source-event trace.
- Applied `db/014_participation_snapshots.sql` only to the isolated Looke Neon staging project with strict `review_status='unverified'` and no asset/claim fields. Unit tests check caps, invalid events, UTC boundaries, age gates and score non-redeemability. The new dashboard is integrated into Activity and Profile.
- **M19 partial only:** wallet farms/engagement rings remain possible, no verified unique humans, independently audited event ledger, operator appeals, claim contracts, token payouts, production staging or user distribution evidence. See `docs/M19-COMMUNITY_REWARDS.md`.


## M3 authentication prototype-key defense (1 November 2026)

- Reject `__proto__`, `constructor`, and `prototype` keys in all nested bounded authentication JSON objects and arrays, with regression tests for malicious and ordinary keys.
- Source-only security hardening. CI, protected staging, genuine wallet/session testing, production WAF and independent security review remain mandatory. No live trading, minting, mainnet or irreversible spending is enabled.


## M3 bounded JSON structure complexity (1 November 2026)

- Added a 2,048-container traversal budget to the already byte-bounded, depth-limited authentication JSON parser. Wide arrays of nested objects/arrays now fail closed even if their payload fits the 16 KiB byte limit.
- Added tests for the exact accepted boundary and first rejected width. This is source-only denial-of-service defense in depth; CI and independent staging/wallet/security validation remain required.
- M3 remains partial. No public trading, minting, mainnet activity, or irreversible spending is enabled.

## M3 authentication JSON property budget (1 November 2026)

- Bound total enumerable JSON properties/array entries to 2,048 in the shared authentication parser, in addition to the existing 16 KiB byte, 32-container-depth and 2,048-container limits. This covers broad scalar-only objects that evade container-count checks.
- Add boundary regression tests for 2,048 accepted and 2,049 rejected scalar properties. Source-level defense in depth only; CI must pass before merge.
- M3 remains partial pending protected Vercel staging, genuine wallet and database-session acceptance, production WAF/rate-limiting checks and independent security review. No trading, minting, mainnet or irreversible spending enabled.

## M3 canonical UTF-8 authentication JSON (1 November 2026)

- Explicitly reject UTF-8 BOM-prefixed authentication JSON before decoding. The platform decoder otherwise strips the BOM, permitting an ambiguous noncanonical wire representation.
- Add regression tests for BOM rejection, malformed UTF-8 rejection and valid Unicode acceptance. This is source-level request hardening only; CI must pass before merge.
- M3 remains partial pending protected Vercel staging, genuine independent wallet signatures and database sessions, production WAF/rate-limit verification and independent security review. No public trading, minting, mainnet or irreversible spending enabled.

## M3 declared JSON framing consistency (2 November 2026)

- After bounded streaming, reject authentication JSON whose declared Content-Length differs from actual received bytes; previously a short or long declaration within the cap was accepted. Requests with no declaration remain valid.
- Add tests for underreported and overreported lengths and exact/missing declarations. This is defense in depth and does not replace reverse-proxy request framing enforcement or edge rate limiting.
- M3 remains partial pending protected Vercel staging, real wallet and database-session acceptance, WAF/rate-limiting verification and independent security review. No public trading, minting, mainnet actions or irreversible spending enabled.
