-- M13 confirmed Ultra EVM testnet market activity and canonical cursor checkpoints.
-- No simulated swaps, fiat prices, trading permission or personal wallet histories.
-- Apply AFTER db/002_coin_events.sql. Re-scan/reconcile older indexer cursors
-- with NULL last_block_hash before treating previously indexed data as verified.
ALTER TABLE looke_indexer_cursors
  ADD COLUMN IF NOT EXISTS last_block_hash CHAR(66);
ALTER TABLE looke_coin_events
  ADD COLUMN IF NOT EXISTS block_hash CHAR(66);

CREATE TABLE IF NOT EXISTS looke_market_swaps (
  pool_address VARCHAR(42) NOT NULL,
  tx_hash CHAR(66) NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash CHAR(66) NOT NULL,
  amount0_in NUMERIC(78,0) NOT NULL CHECK(amount0_in>=0),
  amount1_in NUMERIC(78,0) NOT NULL CHECK(amount1_in>=0),
  amount0_out NUMERIC(78,0) NOT NULL CHECK(amount0_out>=0),
  amount1_out NUMERIC(78,0) NOT NULL CHECK(amount1_out>=0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(pool_address,tx_hash,log_index),
  CHECK(amount0_in+amount1_in+amount0_out+amount1_out>0)
);
CREATE INDEX IF NOT EXISTS looke_market_swaps_pool_block
  ON looke_market_swaps(pool_address,block_number DESC,log_index DESC);
-- Only a protected bearer-authorized indexer can write these records.
-- Block-hash continuity errors halt ingestion; resolve reorgs via audited recovery
-- rather than automatically rewriting canonical history.
