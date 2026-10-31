-- Run after 001_social.sql. Only confirmed Ultra EVM testnet logs are indexed.
CREATE TABLE IF NOT EXISTS looke_coin_events (
  tx_hash CHAR(66) NOT NULL,
  log_index INTEGER NOT NULL,
  coin_address VARCHAR(42) UNIQUE NOT NULL,
  creator_address VARCHAR(42) NOT NULL,
  kind SMALLINT NOT NULL CHECK (kind BETWEEN 0 AND 2),
  content_ref CHAR(66) NOT NULL,
  supply_raw NUMERIC(78,0) NOT NULL,
  metadata_uri VARCHAR(256) NOT NULL,
  block_number BIGINT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS looke_coins_by_block ON looke_coin_events(block_number DESC);
CREATE TABLE IF NOT EXISTS looke_indexer_cursors (
  network TEXT PRIMARY KEY,
  last_block BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
