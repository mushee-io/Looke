# M1 preview navigation & accessibility acceptance checks

Scope: original Looke preview UI only; no live exchange or NFT purchase enablement.

## Implemented in this change

- Browser hash routes for **Explore**, **Feed**, **NFTs**, **Activity**, **Profile**, and **Settings**.
- Back/forward navigation and deep links restore the active section (e.g., `/#nfts`).
- A skip-to-main-content link focuses the main landmark without overwriting the section URL.
- Mobile navigation toggle exposes its current expanded state to assistive technology.
- Preview dialogs focus their first control on open, trap Tab/Shift+Tab, close on Escape, restore prior focus, and prevent background scroll.
- Reduced-motion preference suppresses nonessential transitions/animations.
- Explore preview tabs sort by 24-hour change (Trending), real parsed demo market cap (Top), and comparable elapsed time (New); the market-cap header toggles order. Regression tests exercise the K/M/B and time-unit parsers.

## Manual browser verification required for M1 acceptance

- [ ] Test all six section deep links, browser back/forward, reload, and an invalid hash in Chrome, Firefox, and Safari.
- [ ] Test keyboard-only navigation: Tab to reveal skip link, activate it, open/close **Create**, **Connect**, **Trade** and Uniq preview dialogs, and confirm focus returns to the triggering control.
- [ ] Test the mobile rail (360px, 390px, 768px) with keyboard and touch; confirm expanded state and menu closing on section changes.
- [ ] Run an accessibility audit and inspect headings, landmark order, text contrast, dialog announcements, and screen reader behavior.
- [ ] Deploy preview to staging and visually verify Explore, Feed, NFT gallery, Profile, and Settings.
- [ ] Check that all illustrative prices, artworks and activity remain clearly labelled as fictional, and that live spending remains disabled.

## Release gate

Passing CI verifies source compilation and existing unit tests, **not** cross-browser behavior or production readiness. M1 remains **source implemented, staging/browser QA pending** until tested on a live preview.
