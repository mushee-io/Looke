# Ultra EVM coin-creation event indexer

This indexer cannot operate until LookeCoinFactory has been **audited and deployed to Ultra EVM testnet**. No factory address or deployment block is provided or invented.

- Run `db/001_social.sql` and `db/002_coin_events.sql` in a dedicated PostgreSQL database.
- Configure server-only `DATABASE_URL`, `LOOKE_FACTORY_TESTNET_ADDRESS`, `LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK`, and long random `LOOKE_INDEXER_SECRET`.
- Invoke `POST /api/indexer` with `Authorization: Bearer <secret>` from a trusted scheduler. Each run ingests up to 500 confirmed blocks, waiting 12 blocks before marking logs as observed.
- The indexer checks the RPC chain ID is 18881, only decodes the audited factory address, and keeps an idempotent event table.
- `GET /api/coins` returns indexed creation events for read-only UI, without inventing market caps, trade volume or prices.
- Before production, add reorg rollback on deep reorganizations, contract code-hash verification, metrics/alerts, retries, rate limits and a transaction reconciliation process.

No orders or swaps are sent by the indexer.
