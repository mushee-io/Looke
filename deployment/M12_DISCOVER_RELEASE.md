# Looke M12 — Discover redesign, protected Preview and genuine data

**Goal:** Zora-style creator market discovery using Looke's original blue/white design, not an imitation of brand assets, logos or fictitious trade activity.

## New interface
- Search bar with / keyboard shortcut, responsive small-icon navigation and wallet connection preserved from existing homepage.
- **Market-first design:** compact centered search and real category navigation, Trending/Top/New tabs, accurate token table in the first viewport. Removed the oversized blue hero entirely; creator/Uniq/social shortcut cards now sit BELOW the market feed.
- Real on-chain market directory with **Trending**, **Top**, **New** and local-browser **Watchlist** views.
- Trending sorts by **observed quote-token volume in a bounded recent blockchain scan**, not claimed 24h volume; Top sorts by verified quote reserves.
- New explicitly stays empty until an indexed coin creation-time source is available; no invented listing timestamps.
- Market cap, holders and 24h change render unavailable (—) until independently verified, instead of zeros or simulated numbers.
- Search and bookmark work with real verified markets only. Bookmark is browser-local and not a fabricated social Follow count.
- Native chain heartbeat is read from the existing native Testnet status API.
- Existing creator token launch form, Ultra native Uniq Studio, trading terminal and social backend were **preserved**, not rewritten.

## Backend
- `GET /api/discover` uses existing `activeMarkets()`, `verifiedMarket()` and `recentSwaps()` with strict allowlists.
- All data is Ultra EVM Testnet chain 18881, verified contract bytecode, provenance, two-sided reserves and actual on-chain swap events.
- Error responses are closed (503); no sample markets added. `observedQuoteVolume` is **not** a complete 24h figure and `partial` is explicit.
- Empty `LOOKE_M4_MARKETS_JSON=[]` means zero markets, as expected during beta closure.
- The API only performs read-only RPC; there are no wallet signatures, swaps, NFT mints or DB writes in M12 discovery.

## Release plan and existing Looke Vercel project
- Existing project: `looke`, ID `prj_QXWBZ7UU1AtxXJ7XbckAwLrRZbdO`.
- Public home: `https://looke-alpha.vercel.app/`, currently pinned to a prior production commit. **Do not overwrite production or change the alias.**
- Vercel Authentication is `all_except_custom_domains`: generated Vercel deployment Preview URLs are login-protected, while `looke-alpha.vercel.app` remains public.
- All five Preview-only environment variables were explicitly verified:
  - `LOOKE_PUBLIC_BETA_ENABLED=false`
  - `LOOKE_M4_TRADING_ENABLED=false`
  - `LOOKE_SOCIAL_WRITES_ENABLED=false`
  - `LOOKE_M6_EVIDENCE_ENABLED=false`
  - `LOOKE_M4_MARKETS_JSON=[]`
- For M12, deploy only the approved immutable M12 commit from a feature branch into **Preview**, with `target` omitted. On the API, using target literal `preview` is invalid; omitted target selects Preview. Confirm `target:null` and READY.
- Independently check signed-out visitor gets `login_required` for both generated Preview and branch URLs. Confirm public `looke-alpha.vercel.app` remains accessible and `/api/beta/readiness?mode=config` returns `publicBetaOpen:false`.
- Do not attach the public production alias to the Preview.
- The older M10 release gate hard-codes a separate `looke-ultra-staging` project with all-URL auth and all flags false. The shared Looke project Preview **does not satisfy that release gate**, so public beta stays closed. This can be revised only as a separately reviewed, tested release-policy change.

## Acceptance gates
- [ ] M12 PR full CI green on final SHA
- [ ] Dedicated M12 Discover tests green, including no fake metrics
- [ ] Preview READY on exact SHA; authenticated visitor can review it
- [ ] Signed-out Preview URL blocked by Vercel Authentication
- [ ] Original public landing page still running unchanged
- [ ] Public beta closed, markets/writes disabled
- [ ] Actual Testnet creator markets, CoinCreated and V2 liquidity — **not yet available**
- [ ] Real buyer/seller, native Uniq, independent audit and ops approval — **not yet available**

Use M13–M23 to complete real indexer, creator markets, native Uniq, wallet-approved trading, social, messaging, portfolio, rewards and security. UI success is not proof of real trading launch.
