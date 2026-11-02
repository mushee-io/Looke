# Looke

**Create · Collect · Trade — built for Ultra**

Looke is an original Zora-style social coin ecosystem for Ultra, with additional native Uniq NFT features. This repository is currently **pre-release / testnet development**. No token trades, coin issuance, NFT mints, purchases or creator-earning claims are enabled in the application.

## Implemented source

- Responsive Explore, creator feed, original artwork, coin-detail previews, watchlists, creator drafts and Uniq gallery (all sample prices/collections clearly labeled).
- Ultra EVM testnet injected wallet and native Ultra Wallet extension connection.
- Replay-resistant EIP-191 Ultra EVM challenge/response login with HttpOnly server sessions (requires PostgreSQL); creator profile editing.
- PostgreSQL-backed social posts, likes, follows and social notifications (requires configured database and migration).
- Ultra EVM testnet RPC status and real UOS balance lookups.
- Server-side Ultra Uniq holdings GraphQL proxy (requires approved Ultra API credentials).
- Solidity fixed-supply ERC-20 factory prototype for creator/content/trend coins (**unaudited, undeployed**); an account-scoped M9 creator coin draft/review lab and isolated local EVM contract tests; pure BigInt AMM quote tests and event-indexing worker (**requires audited testnet deployment and keys**).
- GitHub CI typechecks, tests quote invariants, compiles the Solidity contracts, and runs the Next.js production build.

## Start locally

Node.js 22+ required.

```bash
npm install
npm run dev
npm run typecheck
npm run test:math
npm run contracts:check
npm run build
```

Without a PostgreSQL database, the UI sample feed and local drafts still work; server-backed social APIs explicitly return 503. Without Ultra API credentials, the holdings query returns 503. With no deployed factory, the event indexer is disabled and the real coin table stays empty.

## Real integrations (testnet first)

1. Provision dedicated TLS PostgreSQL. Store `DATABASE_URL` securely on the server and run `db/001_social.sql`, then `db/002_coin_events.sql` and the subsequent social/discovery/creator draft migrations through `db/007_creator_coin_drafts.sql`. Never place secret keys in `NEXT_PUBLIC_` variables.
2. Connect Ultra EVM wallet on chain 18881 and native Ultra Wallet extension on Ultra native testnet (distinct chains). Sign a login-only challenge for social publishing. No spending approval is requested.
3. Request Ultra NFT GraphQL access from developers@ultra.io, then configure `ULTRA_API_BEARER_TOKEN` and `ULTRA_API_CLIENT_ID` server-side to query native Uniqs.
4. Do not deploy the coin factory or enable financial functions until independent security review. After audited testnet deployment, configure `LOOKE_FACTORY_TESTNET_ADDRESS`, `LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK` and `LOOKE_INDEXER_SECRET` and run the protected indexer through an authorized scheduler.
5. Never treat successful compilation as proof of solvency, safety or economic operation. Record genuine signed testnet transaction receipts and independently audit contracts and fee accounting.

See [M1–M22 roadmap](docs/ROADMAP.md), [Ultra boundary](docs/ULTRA_INTEGRATION.md), [signed social backend](docs/SOCIAL_BACKEND.md), [wallets](docs/WALLET_NETWORK.md), [Uniqs](docs/UNIQ_API.md), [event indexer](docs/INDEXER.md), [coin engine](docs/COIN_ENGINE.md).
## M20 operator indexer monitoring (disabled by default)

The protected M13 Ultra EVM indexing code now has a separate operator heartbeat table (`db/015_indexer_operations.sql`), a bearer-protected `/api/operator/indexer/status` endpoint and a bounded GitHub Actions testnet scheduler (`.github/workflows/indexer-staging.yml`). The scheduled worker is **skipped** until the repository owner sets `LOOKE_INDEXER_SCHEDULER_ENABLED=true` and configures approved staging HTTPS URL and secrets. No real deployment, factory verification, trading, payout or fund movement follows from merging the workflow. See [M20 operator setup and incident guide](docs/M20-INDEXER_OPERATIONS.md).
