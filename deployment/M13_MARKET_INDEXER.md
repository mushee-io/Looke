# Looke M13 — Verified Ultra EVM Testnet creator indexing

**M12 status:** PR #13 merged into `main` after all eight CI workflows and their individual jobs passed on commit `91ae3cd8091a9f21f3f403b129d501e71bab6420`. M13 builds real indexing and transparent financial analytics in the same market-first Discover UI.

## Data integrity and network
- All data comes exclusively from Ultra **EVM Testnet chain 18881**. Indexer and quote market reads use actual RPC, never fake coins, fabricated users or invented transactions.
- The factory indexer is **read-only**. It requires **both** the verified factory address and its genuine creation transaction hash, in server-side configuration:
  ```text
  LOOKE_M13_FACTORY_ADDRESS=0x<real verified factory>
  LOOKE_M13_FACTORY_DEPLOY_TX=0x<real verified factory deployment hash>
  ```
- Missing values yield `status=unconfigured` and zero launched coins, not a green "indexed" badge. No factory was supplied during this milestone; do not infer or manufacture an address or transaction hash.
- `GET /api/discover/launches` scans `CoinCreated` logs from the **verified deployed factory** on finalized EVM blocks only. It verifies exact `CoinCreated` event fields, contract runtime bytecode, token creator, canonical block hash, successful transaction receipt, and creator/signing identity.
- Every page covers at most **600 contiguous finalized blocks**, returning `fromBlock`, `throughBlock`, and `nextCursor` for the previous (older) page. The UI's **Scan older blocks** button advances with that exact cursor. It never claims a full-history search until `complete=true`.
- An RPC error, invalid cursor, unverified event, missing archive history, or over-limit block page is **blocked or excluded**, never silently replaced with sample results. `GET /api/discover/health` reports indexer/network state; when factory is absent it returns a truthful degraded HTTP 503.
- The server is currently a **stateless on-demand read-only cursor indexer**, not an always-on database-backed historical journal or a scheduled cron. A persistent reorg-safe Postgres indexer and broader search can be added in M14–M15 after real DB and operator review. Users must not interpret an incomplete page as all tokens ever deployed on Ultra.

## Market rankings, statistics and pagination
- `GET /api/discover?sort=trending|top|new&page=1&limit=5&q=...&quote=UOS` combines **operator-allowlisted, independently verified active V2 markets** with real bounded pair `Swap` event observations. Max 8 allowlisted markets in the current trading module.
- **Trending:** sorts by actual observed quote-token volume from the bounded recent-block scan. It is **not** a complete 24-hour volume number.
- **Top:** sorts by verified quote-denominated market capitalization when a verified factory `CoinCreated` origin is indexed, otherwise genuine quoted reserves. The two measures are not identical; a row must be read in its own asset units.
- **New:** displays genuine `CoinCreated` events from the finalized factory scan, ordered by actual block timestamp; these tokens may not have a trading pool yet and therefore cannot be bought or sold through Looke.
- **Market cap:** only calculated if token creation is independently verified, the real current token supply is read from its contract, and there is a verified nonzero pair reserve price. The unit is the market's **quote token** (e.g. UOS), **not USD**; no FX rates or invented token dollar prices.
- **Holder count:** from real ERC20 `Transfer` logs starting at the verified `CoinCreated` block and ending at the finalized head. Only shown if the **entire history** is covered in at most 3,600 blocks, all logs are present, balances never go negative, and the sum reconciles exactly to current contract `totalSupply`. Partial histories or unsupported contract semantics result in null, not zero.
- **24-hour change:** only if the token existed before 24h, a real historical **archive-capable** RPC can supply a block at the prior timestamp, and actual historical and current V2 `getReserves` both prove a positive price. Missing historical data stays null, not zero.
- **Age:** only derived from genuine `CoinCreated` block timestamps. A `null` value renders `—`.
- **Filtering:** case-insensitive token symbol/name or contract search, quote asset filter, Top/Trending/New/Watchlist. Server accepts bounded page (1–9999) and page size (1–20), reports `total`, `page`, `hasMore`; New scans older finalized block windows via `cursor`. Search on launch pages is scoped to each scanned page and clearly labeled.
- The client bookmark list remains local-browser storage only; no social user account or watchlist backend is pretended.

## Operations and safeguards
- CI keeps `LOOKE_PUBLIC_BETA_ENABLED=false`, `LOOKE_M4_TRADING_ENABLED=false`, `LOOKE_SOCIAL_WRITES_ENABLED=false`, `LOOKE_M6_EVIDENCE_ENABLED=false`, and `LOOKE_M4_MARKETS_JSON=[]`.
- The existing Vercel project `looke` (`prj_QXWBZ7UU1AtxXJ7XbckAwLrRZbdO`) provides authenticated generated Vercel Preview URLs. **Never change or repoint `looke-alpha.vercel.app` production** during this milestone. Its public beta must remain closed.
- Deploy ONLY the final CI-green immutable M13 Git SHA into authenticated Preview (omit literal target `preview` in the Vercel API; omitting `target` selects Preview for the feature branch). Confirm `target:null`, READY, matching SHA.
- Test generated Preview and branch URLs signed-out: both must return `login_required`. Confirm original production alias has the previous commit and `publicBetaOpen:false`.
- No M13 script or endpoint signs, broadcasts, funds, mints, creates a user, trades or modifies blockchain state. Tests use synthetic fixtures ONLY for pure-function unit validation, never as published market listings.
- `/api/discover/health` is an on-demand monitoring endpoint. No hourly bot, cron or background indexer is automatically enabled.

## Operator checklist
- [ ] All eight M12 workflows green; M12 merged
- [ ] M13 PR CI green on exact SHA
- [ ] New M13 indexer/metrics unit tests and closed-beta smoke pass
- [ ] Authentic independent Ultra factory deployment receipt and address configured (currently not available)
- [ ] Genuine `CoinCreated` events, verified liquidity pool(s), transfer history and archive RPC exist for nonempty metrics (currently not proven)
- [ ] Authenticated M13 Preview READY, login protection verified
- [ ] Production `looke-alpha.vercel.app` unchanged and beta closed
- [ ] Security, wallet-signature, token-launch, native NFT and social DB operational approvals (not yet passed)

**Successful engineering CI does NOT mean tokens were deployed, traded, ranked, or approved for public beta.**
