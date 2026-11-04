-- M15: moderation-first media metadata. No raw file uploads or blob storage.
-- Safe to run repeatedly against PostgreSQL 15+.
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_kind text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_status text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='social_post_media_integrity_m15') THEN
    ALTER TABLE social_posts ADD CONSTRAINT social_post_media_integrity_m15
      CHECK ((media_url IS NULL AND media_kind IS NULL AND media_status='none')
      OR (media_url IS NOT NULL AND length(media_url)<=800 AND media_url ~ '^https://'
      AND media_kind IN ('image','video')
      AND media_status IN ('pending','approved','rejected')));
  END IF;
END $$;

-- Extend the existing audited moderator operations (no silent approval).
ALTER TABLE social_moderation_audit DROP CONSTRAINT IF EXISTS social_moderation_audit_action_check;
ALTER TABLE social_moderation_audit ADD CONSTRAINT social_moderation_audit_action_check
  CHECK(action IN ('hide_post','hide_comment','suspend_profile',
    'restore_post','restore_comment','restore_profile',
    'approve_media','reject_media'));
CREATE INDEX IF NOT EXISTS social_posts_media_review_m15
  ON social_posts(media_status,created_at DESC) WHERE media_url IS NOT NULL;
