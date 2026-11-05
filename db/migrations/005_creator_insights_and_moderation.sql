-- Looke M18: account-only controls and review history, PostgreSQL 15+.
-- No sample posts, engagement or moderation decisions may be inserted.
CREATE TABLE IF NOT EXISTS social_mutes (
  muter text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  muted text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(muter,muted),
  CHECK(muter<>muted)
);
CREATE INDEX IF NOT EXISTS social_mutes_reverse_m18 ON social_mutes(muted);

CREATE TABLE IF NOT EXISTS social_notification_preferences (
  owner text PRIMARY KEY REFERENCES social_profiles(address) ON DELETE CASCADE,
  follows boolean NOT NULL DEFAULT true,
  comments boolean NOT NULL DEFAULT true,
  likes boolean NOT NULL DEFAULT true,
  reposts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Resolution is separate from user-submitted reports and from post-level
-- moderator audit events; each report may be resolved only once.
CREATE TABLE IF NOT EXISTS social_report_resolutions (
  report_id uuid PRIMARY KEY REFERENCES social_reports(id) ON DELETE CASCADE,
  moderator text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  decision text NOT NULL CHECK(decision IN ('dismissed','actioned')),
  explanation varchar(500) NOT NULL CHECK(char_length(btrim(explanation)) BETWEEN 8 AND 500),
  resolved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_reports_pending_m18
  ON social_reports(created_at DESC) WHERE reviewed_at IS NULL;
CREATE INDEX IF NOT EXISTS social_report_resolutions_moderator_m18
  ON social_report_resolutions(moderator,resolved_at DESC);
