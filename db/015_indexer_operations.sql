-- M20 operator-only source-indexer heartbeat; no keys, wallets or payments.
-- Requires db/002_coin_events.sql and db/010_market_indexing.sql.
CREATE TABLE IF NOT EXISTS looke_indexer_operations (
  stream_key TEXT PRIMARY KEY CHECK(length(stream_key) BETWEEN 8 AND 120),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  last_status VARCHAR(40) NOT NULL CHECK(last_status IN
    ('indexed','caught_up','awaiting_confirmations','cursor_advanced_by_other_worker','failed')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_failures BETWEEN 0 AND 2147483647),
  last_error_code VARCHAR(40),
  last_indexed_count INTEGER NOT NULL DEFAULT 0 CHECK(last_indexed_count BETWEEN 0 AND 1000000),
  last_confirmed_block BIGINT CHECK(last_confirmed_block >= 0)
);
CREATE INDEX IF NOT EXISTS looke_indexer_ops_recent_attempt
 ON looke_indexer_operations(last_attempt_at DESC);
-- This heartbeat is best-effort observability: the canonical event cursor and
-- event writes remain authoritative and commit atomically in the M13 indexer.
