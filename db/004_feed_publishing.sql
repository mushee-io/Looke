-- M6 publishing: safe editing and moderation reports. Apply after 001_social.sql.
ALTER TABLE looke_posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS looke_posts_visible_keyset ON looke_posts(created_at DESC,id DESC) WHERE moderation_status='visible';

CREATE TABLE IF NOT EXISTS looke_post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES looke_posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  reason VARCHAR(32) NOT NULL CHECK(reason IN ('spam','harassment','impersonation','illegal_content','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT looke_post_reports_unique UNIQUE(post_id,reporter_id)
);
CREATE INDEX IF NOT EXISTS looke_post_reports_created ON looke_post_reports(created_at DESC);
-- Reports are not public. Moderators must review and change moderation_status.
-- Future migrations may add an audited operator review ledger.
