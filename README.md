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

## M21 read-only testnet receipt corroboration (NO-GO)

M21 introduces private operator-only endpoints `GET /api/operator/testnet/evidence` (factory or allowlisted pool receipt/log checks across two distinct-host testnet RPCs) and `GET /api/operator/testnet/readiness` (hard NO-GO while independent security/real signed evidence is missing). A second server-only `LOOKE_INDEPENDENT_EVM_TESTNET_RPC` is required; absent configuration fails closed. The revised **source-only** factory now requires signed EIP-712 authorization and globally unique references for content/trend issuance; older deployed factory bytecode would remain unsafe. This code **does not** deploy/fund a wallet, operate a trusted attestor, validate native Ultra Uniq transactions or approve financial execution. See [M21 security runbook](docs/M21-TESTNET_SECURITY.md).


## M21 operator attestor review and testnet factory preparation

A private **read-only** content-post review route is available at `GET /api/operator/attestor/review?postId=<uuid>` using its own 32+ character `LOOKE_ATTESTATION_REVIEW_SECRET`. The route is **disabled** by default; it requires `LOOKE_ATTESTATION_REVIEW_ENABLED=true`, a dedicated protected staging database, a pinned independently reviewed factory runtime code hash, an expected immutable attestor and two HTTPS Ultra EVM Testnet RPCs. It checks live post ownership, edits, moderation reports, factory bytecode, ERC-20 reference uniqueness and EIP-712 nonce across matching 12-confirmed blocks. It returns **unsigned**, five-minute review data and cannot mint, trade, issue a signature or approve a release. Trend issuance stays disabled pending reviewed governance.

Two manual operator CLI commands are provided, with no wallet access or secrets:

- `LOOKE_UNSIGNED_DEPLOY_ACK=REVIEWED_TESTNET_ONLY npm run factory:prepare:testnet > unsigned-factory.json` — locally compiles a Shanghai-compatible factory and produces an unsigned deployment manifest, after `LOOKE_EXPECTED_ATTESTOR_ADDRESS` is configured.
- `LOOKE_TESTNET_ACCEPTANCE_ACK=REVIEWED_TESTNET_ONLY npm run factory:verify:testnet` — requires real externally wallet-signed Ultra 18881 deployment receipt, pinned runtime bytecode hash, attestor and independent RPC. Optional external wallet-signed content issuance receipt proves onchain events, registry and supply. No transaction is sent.

See [M21 runbook](docs/M21-TESTNET_SECURITY.md). A signed Testnet receipt is evidence of a chain event, **not** a contract security audit or approval to launch.
