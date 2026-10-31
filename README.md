# Looke

**Create. Collect. Trade. On Ultra.**

Looke is a Zora-inspired social coin discovery and trading product for the **Ultra blockchain**, with an additional Ultra **Uniq NFT** launchpad and marketplace.

## Milestone 1 — interactive frontend preview

- Responsive original Looke interface inspired by the supplied Zora references: compact icon rail, Explore market tables, creator feed, discover tabs, authentication modal and profile.
- Explore sortable *illustrative* creator/content/trend coin rows and search across content.
- Open coin details with a sample price chart, watchlists and trade **preview** (no execution).
- Social feed with local like/follow interactions.
- Uniq NFT gallery and preview details.
- Create composer for creator coins, content coins, trend coins and Uniqs; saves browser-local drafts (does **not** mint, create live listings or post to a server).
- Saved watchlist and local drafts persist in `localStorage`.

**No real wallet connection, NFT minting, cryptocurrency trading, market prices, token issuance, orders or deployment are implemented. All displayed metrics and items are synthetic demos.**

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. To validate:

```sh
npm run typecheck
npm run build
```

## Technical scope

Next.js App Router + React + TypeScript + CSS. `lib/demo.ts` holds synthetic sample data; browser-only UI state is intentionally not a backend. The financial transaction buttons are safe explanatory previews, not fake execution flows.

The Ultra-specific integration requirements, security and live-readiness gates are in [docs/ULTRA_INTEGRATION.md](docs/ULTRA_INTEGRATION.md).
