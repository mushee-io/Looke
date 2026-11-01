# M13 — Confirmed Ultra testnet market-data infrastructure

**Source-implemented, not production-accepted.** M13 upgrades the existing factory-log indexer and introduces separately indexed V2-compatible swap activity and a read-only market dashboard. It **does not** deploy pools, launch a market, generate trades, verify token trust, quote USD prices, compute TVL or enable trading.

## What has been implemented

- **Protected indexer:** Bearer-authorized `POST /api/indexer?stream=coins` and `POST /api/indexer?stream=swaps&pool=0x...` index confirmed Ultra EVM testnet events only. The swap pool must appear in the existing server-only `LOOKE_ALLOWED_TESTNET_POOLS`; the factory source must be configured explicitly. The read-only wallet and quoting APIs do not authorize this ingestion.
- **Canonical checkpoints:** Indexing uses 12-block depth and batches of at most 250 blocks. The cursor now includes `last_block_hash`; each event includes its own observed chain block hash. On every subsequent run, the cursor block's RPC hash must match the saved checkpoint. If it differs, ingestion **halts with 409** for explicit operator reconciliation. This is not irreversible finality, and an honest RPC alone does not prove contract authenticity.
- **Atomic commits:** PostgreSQL transaction wraps all Swap/CoinCreated event rows plus the corresponding cursor block/hash update. An advisory transaction lock and cursor compare-and-swap detect overlapping workers. Malformed logs, RPC failure, DB failure or a changed batch tip abort without advancing the failed batch cursor. Event uniqueness is `(tx_hash,log_index)` for factory and `(pool_address,tx_hash,log_index)` for swaps.
- **Market swap data:** The ingester stores raw integer `Swap` quantities `amount0In`, `amount1In`, `amount0Out`, `amount1Out` for operator-allowlisted, V2-shaped pools. It does **not** infer USD prices, gains, independent trader identity, buy/sell intent or notional trading volumes. Complex swaps remain labelled complex.
- **Readonly market sources:** `GET /api/markets` lists only operator-configured pool addresses, indexed block checkpoints, network and confirmed frontier. `GET /api/markets/pool?pool=...` checks chain 18881, code presence, token0/token1, both ERC-20 decimals/symbols and token reserves at a single block, plus the latest 30 indexed Swap events *only when the saved cursor hash still matches the RPC*. A pool's allowance to be read is **not independent source/bytecode or economic verification**.
- **Verified-shape coin visibility:** `GET /api/coins` no longer treats rows in Neon alone as verified launches. It checks a configured factory, 12-block depth, canonical saved cursor hash, code presence at the checkpoint and non-null event block hashes. It returns no claimed verified launches if the factory is missing or the cursor is legacy/unverified. It never implies a token price or trading availability.
- **Explore dashboard:** `components/LiveMarkets.tsx` shows honest RPC/indexer status, token reserve amounts, raw confirmed Swap history and explorer transaction links, refreshing about every 30 seconds while visible. It clearly distinguishes read-only reserve snapshots from confirmed logs and admits no data if no pool is configured.
- **Pure regression tests:** `lib/market/indexer-guards.mjs` and `tests/indexer-guards.test.mjs` cover confirmation boundaries, bounded batches, strict hash validation/continuity, unsigned swap amounts and complex swap classification.
- **Database:** `db/010_market_indexing.sql` adds block hash columns to the existing factory event/cursor tables, a new `looke_market_swaps` table with immutable log identity, and an indexed pool/block history path. This migration is applied to Looke's **isolated Neon staging project**. No non-Looke database or external trading wallet was touched.

## Configuration and operator runbook

The following remain **server-side secrets/configuration only**. Never expose them via `NEXT_PUBLIC_` or commit real credentials.

1. Set `DATABASE_URL` to Looke's isolated Neon instance and apply `db/001_social.sql`, `db/002_coin_events.sql`, then `db/010_market_indexing.sql` in the correct order (other Looke social migrations apply separately).
2. Configure a **genuinely deployed and independently reviewed** Ultra EVM testnet factory address, `LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK`, and a cryptographically random `LOOKE_INDEXER_SECRET` (minimum 24 characters). The existing factory is **unaudited and undeployed** as of this work.
3. Configure `LOOKE_ALLOWED_TESTNET_POOLS` only after independently verifying V2-compatible pool code, token contracts, liquidity, router provenance, actual fees and relevant risks. Set `LOOKE_MARKET_POOL_START_BLOCK` to a trusted block at/before the earliest relevant pool creation; configuring it too late misses earlier swaps. Pool addresses are **read-source identifiers**, not approved spending destinations.
4. Provision a **protected scheduler**. Call `POST /api/indexer?stream=coins` with header `Authorization: Bearer <LOOKE_INDEXER_SECRET>` repeatedly until caught up. Call `POST /api/indexer?stream=swaps&pool=<allowlisted-address>` for each configured pool on a separate schedule. Each request ingests **at most 250 blocks for one stream**; catch-up is iterative. Set a conservative cadence and rate limit. No scheduler has been configured or tested here.
5. Check `GET /api/markets` and the selected `GET /api/markets/pool?pool=...` results against the independent Ultra EVM testnet explorer, including block hash, log indices, token orientation and Swap amounts. Track RPC downtime, confirmation lag and missing updates.
6. **Reorg/legacy recovery is a manual, authorized operation:** legacy cursors with NULL block hashes, changed canonical checkpoints or a contract/starting-block migration halt ingestion. Do not forcibly set hashes to current RPC blocks or silently discard conflicting events. Use audited recovery tooling and documented chain evidence to reconcile/rebuild the affected event history in Looke-only staging before resuming. This PR does not automate destructive resets.
7. Test staging behind HTTPS with real Ultra EVM wallets and independently verified testnet receipts; configure operator alerting for halted/stale indexer streams. Existing Vercel project-creation permission has returned HTTP 403, preventing full protected staging validation.

## Critical limitations and next release gates

- Twelve block confirmations are only a configurable delay: deep reorgs and dishonest/incomplete RPC responses remain possible. Cursor continuity detects mismatches at recorded checkpoints, **not guaranteed canonicality of every historical event**. More robust multi-RPC crosschecks, block-by-block reconciliation, reorg tests and independent chain monitoring remain outstanding.
- V2-compatible read methods can be spoofed. Neither pool metadata nor logs establish approved/audited deployments. It is deliberately impossible to report audited liquidity, total value locked or token USD price with these data alone.
- The current factory is permissionless and has copied-reference vulnerabilities from M10/M11. Public token minting, liquidity placement, ERC-20 approvals and swaps must remain disabled until audited authorization and execution mechanisms exist.
- Real historical activity will only appear after correct source contracts are deployed, an authorized scheduler processes genuine confirmed Ultra testnet logs and the data is independently reconciled. No sample events, prices, volume or transaction hashes were seeded.
- A protected Vercel staging deployment, real testnet evidence, production scheduler + monitoring, independent security and economic review, wallet interoperability and scale testing remain required. This milestone is **partial**, not a shipped live exchange.

## Acceptance checklist

- [x] Guarded 12-confirmation indexing, atomic cursor+row commits, block-hash checkpointing source
- [x] Bounded allowlisted pool Swap-event ingestion and raw reserve/status API source
- [x] Staged Neon migration and dashboard source
- [x] Pure guard tests, plus GitHub CI to be verified before merge
- [ ] Authorized deployed audited Ultra factory and pool contracts with independently confirmed addresses
- [ ] Real Ultra EVM receipts and corroborated events in a protected staging deployment
- [ ] Operational scheduler, reorg incident recovery, alerting and read-only monitoring acceptance
- [ ] Independent review of contract origin, token safety, liquidity and data integrity
- [ ] Full accessibility, load, API abuse and real-wallet testing
- [ ] Audited router, allowances, swap simulations, receipts and user-controlled execution (separate M12/M21 gates)
