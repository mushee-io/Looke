# Looke M14 — Creator app experience (Ultra Testnet, closed beta)

**Branch:** `feat/m14-zora-style-look-social-shell`  
**User reference:** Market-first Zora-style Discover, creator Trending feed, split-pane Messages, centered + token creation modal, categorized Notifications, wallet modal, and creator Profile.

Looke uses its **own** logo, blue/white identity and real Ultra data. No screenshots, images, sample tokens or market statistics from the reference service were copied or represented as Looke activity.

## Shipped in this milestone

1. **Discover (home):** preserves M12/M13 market-first real Testnet ranking, search and pagination. The global bar is now centered and the narrow sidebar uses quick navigation like the provided reference.
2. **Trending (lightning icon):** displays verified Ultra EVM markets in compact token cards, followed by a scrollable feed of **actual** Looke `social_posts` from the existing moderated read-only social API. Public posts currently contain text and optional real chain asset references; creator-uploaded photos/video will be added only when secure storage and moderation are implemented. No demo content is created.
3. **Messages (paper-plane icon):** reference-style split inbox with search, requests, new-conversation UI and appropriate empty states. The backend still rejects DM requests with 501. **No plaintext messages are collected or falsely advertised as encrypted.** Real sending requires cryptographic architecture, wallet key registration, key/device recovery, anti-abuse, and an independent audit.
4. **Create (+ icon):** centered modal with Pair / Post / Text / AI, local image preview (PNG/JPEG/GIF max 5 MB), validated name and ticker and **only** ULTRA or LOOKE pairing preferences. Post/Text link to actual public social composer; AI is not yet activated. Pressing Review takes validated values to the existing creator studio, but does **not** upload media or mint a token. The token execution button remains disabled until a verified factory, asset addresses, routing/liquidity security review and explicitly wallet-approved transactions support the chosen pair.
5. **Notifications (bell icon):** All, Subscriptions, Mentions, Trades, Comments, Follows, Other. New `GET /api/experience/notifications` uses the existing signed-in HttpOnly session and reads actual, visible, non-blocked follow/comment events. The other categories have transparent empty states; no fabricated trades, messages, mention subscriptions or push notifications.
6. **Wallet (wallet icon/header):** centered pop-up with connected address and copy, native Ultra EVM Testnet UOS balance read from **chain ID 18881**, Holdings / Tokens / Activity tabs, and Deposit / Swap / Send / Receive controls. Receive/Deposit show the actual account address. Swap links to the existing guarded Testnet trading terminal. Send does not initiate an unreviewed transaction. Fiat valuation and unindexed token/activity data show **unavailable**, never a made-up $0.
7. **Profile (avatar icon):** real signed-in creator profile from `/api/social`, actual follower/following counts and `GET /api/experience/profile-posts` for visible moderated posts and exact post count. Share points to `/social?profile=...`. Existing social profile editor recognizes this deep link. Collectibles/Coins tabs link to their separately verified asset modules, not fake holdings.

## Safety and quality
- No private keys, fake users, fake transactions, invented engagement, seeded database records or automatic financial execution.
- Local image previews are temporary browser object URLs, revoked on cleanup. Images are not silently uploaded, published, minted or stored.
- Pair choice is a **draft preference**, not a completed liquidity pair. Financial execution is specifically disabled from the draft page.
- Notifications and profile reads require real social Postgres; the API always checks current session/visibility/blocklists; unauthenticated notifications return an empty array without guessing users.
- The existing social posting/following backend remains gated behind `LOOKE_SOCIAL_WRITES_ENABLED` and real Postgres readiness. Do not change this flag as part of UI work.
- M14 includes unit tests for input validation and source-level safety, plus complete project tests, typecheck, production build, local closed-beta smoke and rollback rehearsal.

## Vercel acceptance
- **Only** use the existing connected project `looke`, ID `prj_QXWBZ7UU1AtxXJ7XbckAwLrRZbdO`.
- The public `looke-alpha.vercel.app` deployment remains unchanged. Do NOT promote, alias or push a public production version.
- Vercel project is configured with deployment protection `all_except_custom_domains`, so Preview URLs require login. Verify that project setting again immediately before deploying and test it as a signed-out user after READY.
- The five Preview-scoped safe flags must remain exactly:
  `LOOKE_PUBLIC_BETA_ENABLED=false`,
  `LOOKE_M4_TRADING_ENABLED=false`,
  `LOOKE_SOCIAL_WRITES_ENABLED=false`,
  `LOOKE_M6_EVIDENCE_ENABLED=false`,
  `LOOKE_M4_MARKETS_JSON=[]`.
- Deploy only the immutable M14 commit whose required workflows all passed, using Git-backed Preview deployment with `target` omitted (Vercel API infers Preview).
- Confirm Preview is READY at that commit, both generated URLs challenge signed-out visitors, and public alpha still reports `publicBetaOpen:false`.
- Avoid creating recurring jobs, hourly builds, automated market trades or push-notification automations.

## Remaining acceptance before functional launch

- [ ] Social DB and signed wallet sessions deployed to protected staging
- [ ] Image hosting, moderation and media feed vetted
- [ ] E2EE messaging, key recovery, abuse controls, audit
- [ ] Signed-in notification preferences and verified trade/mention event indexers
- [ ] Verified LOOKE and ULTRA pairing token addresses and active approved liquidity
- [ ] Real token launch and spot trade receipts with explicit independent wallet approval
- [ ] Native Uniq mint/ownership, profile portfolio indexing and verified USD pricing
- [ ] Independent audits, staging/restore drills and release operator sign-off
- [ ] Public beta may open ONLY after all enforced release gates have passed

**A green CI badge certifies build and deterministic tests, not the existence of social users, volume, liquidity, minted assets, or an authorized public launch.**
