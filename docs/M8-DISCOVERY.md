# M8 — Real social search, trending and personalized feeds

Looke's M8 introduces PostgreSQL-backed social discovery. **This is a deterministic, transparent ranking system, not an AI model, reputation engine, token valuation or financial recommendation.** It uses no fabricated user, trade, or engagement metrics.

## Source features

- Public `GET /api/discovery/search?q=...` runs indexed, parameterized PostgreSQL full-text search over creators (handle/display name/bio) and *visible public* post text. Queries must contain 2–80 Unicode characters; results are capped at 12 creators and 20 posts, ordered by full-text relevance with deterministic tie breaks. Removed/hidden posts are excluded. Search terms are not saved to a Looke search-history table.
- The Explore screen includes a real search interface, fed by the sitewide header and a local input. It labels returned profiles/posts as **real social records**, in contrast to fictional preview coins and collections.
- `GET /api/discovery/feed?mode=trending` returns up to 20 visible recent posts scored from actual likes, comments, reposts and time decay; the candidate pool is at most the last 500 visible posts from 14 days. The scoring formula is:

  `(1 + ln(1 + 3*likes + 2*comments + 5*reposts)) / (1 + ageHours/24)`

- **For You** uses the same transparent formula, with a 2.5x boost for posts by creators the signed-in viewer already follows. If no session/follows exist, the feed defaults to public trending rather than pretending to have learned preferences.
- For You and Trending limit results to up to three posts per author to improve creator diversity. No historical engagement tracking, model training, embeddings, or arbitrary price/token signals are used for recommendations.
- **Following** strictly returns recent, visible posts by creators the current authenticated user follows, newest first. It rejects unsigned requests; it has no fabricated cold-start posts.
- **Latest** retains the M6 chronological paginated `/api/posts` endpoint rather than discarding its stable cursor.
- Feed UI selects all four backed modes and still supports comments, reposts, likes, and share links. The original fictional posts in the preview are explicitly separated and labelled.
- PostgreSQL migration `db/006_discovery.sql` adds public-content-only GIN indexes for creator/post full-text matching and a follower lookup index. This migration has been **applied** to Looke's dedicated Neon staging database.
- Pure regression tests cover search input normalization, accepted feed modes, rank monotonicity, recency and follow boosts, invalid ranking inputs.

## Safety and acceptance gates

- [ ] Deploy an authorized, protected HTTPS Looke staging project using the dedicated Neon database. Existing Vercel organization permissions currently prevent creating that project.
- [ ] With at least three real independent test accounts, verify indexed creator/post search, visibility filtering, following feed, for-you boost, tie-breaking, author diversity and cold-start behavior.
- [ ] Run live PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` tests against a representative dataset, load tests, concurrency tests and a malformed-query fuzz suite before broad public traffic.
- [ ] Add robust anti-sybil, brigading and coordinated engagement manipulation controls; raw likes/reposts should not be interpreted as trust or objective popularity.
- [ ] Investigate search relevance for prefixes, languages and misspellings. PostgreSQL `simple` full-text matching does **not** promise fuzzy search, semantic embeddings or multilingual stemming.
- [ ] Add pagination and longer-history coverage for ranked feeds and public search; the currently ranked result set is capped at 20 and the activity window is 14 days. Following uses the same recent candidate pool.
- [ ] Complete product accessibility, mobile QA, content reporting/moderation and security review. Keep search/engagement analytics privacy-respecting, with consent and retention controls if added later.
- [ ] Verify that no unpublished/removed content, raw session tokens, private comments or moderation reports are returned by the public endpoints.

**M8 is source-implemented but NOT accepted as production operational.** No mainnet spending, trading, creator coin issuance or NFT minting is activated.
