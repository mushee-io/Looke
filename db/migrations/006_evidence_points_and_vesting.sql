-- Looke M19: off-chain, reviewed participation points. No token, claim, mint or payout tables.
-- No seasons or balances are seeded. All entries require genuine social source evidence.
CREATE TABLE IF NOT EXISTS social_points_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(48) NOT NULL UNIQUE CHECK(slug ~ '^[a-z][a-z0-9-]{2,47}$'),
  title varchar(100) NOT NULL CHECK(length(btrim(title))>=3),
  state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','active','closed')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  vest_start_at timestamptz NOT NULL,
  vest_cliff_at timestamptz NOT NULL,
  vest_end_at timestamptz NOT NULL,
  points_post integer NOT NULL DEFAULT 10 CHECK(points_post BETWEEN 1 AND 1000),
  points_comment integer NOT NULL DEFAULT 2 CHECK(points_comment BETWEEN 1 AND 1000),
  points_like_received integer NOT NULL DEFAULT 1 CHECK(points_like_received BETWEEN 1 AND 1000),
  points_repost_received integer NOT NULL DEFAULT 2 CHECK(points_repost_received BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(starts_at<ends_at),
  CHECK(ends_at<=vest_start_at AND vest_start_at<=vest_cliff_at AND vest_cliff_at<vest_end_at)
);
CREATE INDEX IF NOT EXISTS social_points_seasons_period ON social_points_seasons(starts_at,ends_at);

CREATE TABLE IF NOT EXISTS social_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES social_points_seasons(id) ON DELETE RESTRICT,
  owner text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK(source_kind IN ('post','comment','like_received','repost_received')),
  source_id uuid NOT NULL,
  source_actor text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  activity_at timestamptz NOT NULL,
  activity_day date NOT NULL,
  points integer NOT NULL CHECK(points BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','reversed')),
  review_note varchar(500),
  reviewed_by text REFERENCES social_profiles(address) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id,source_kind,source_id),
  UNIQUE(source_kind,source_id),
  CHECK((status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL
         AND review_note IS NULL) OR
        (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
         AND review_note IS NOT NULL
         AND char_length(btrim(review_note)) BETWEEN 8 AND 500)),
  CHECK(source_kind NOT IN ('like_received','repost_received') OR source_actor<>owner)
);
-- One credited reaction from the same counterparty to the same creator, per
-- activity category and UTC day, limits rapid multi-post farming.
CREATE UNIQUE INDEX IF NOT EXISTS social_points_counterparty_daily_m19
  ON social_points_ledger(season_id,owner,source_kind,source_actor,activity_day)
  WHERE source_kind IN ('like_received','repost_received');
CREATE INDEX IF NOT EXISTS social_points_owner_history_m19
  ON social_points_ledger(owner,recorded_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS social_points_review_queue_m19
  ON social_points_ledger(recorded_at ASC,id ASC) WHERE status='pending';

CREATE TABLE IF NOT EXISTS social_points_review_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid NOT NULL REFERENCES social_points_ledger(id) ON DELETE RESTRICT,
  moderator text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  decision text NOT NULL CHECK(decision IN ('approved','rejected','reversed')),
  reason varchar(500) NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 8 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ledger_id,decision)
);
CREATE INDEX IF NOT EXISTS social_points_audit_owner_m19
  ON social_points_review_audit(moderator,created_at DESC);
