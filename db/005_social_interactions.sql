-- M7: comments, repost tracking and notification read state.
-- Apply to Looke's isolated PostgreSQL after 001_social.sql and 004_feed_publishing.sql.
CREATE TABLE IF NOT EXISTS looke_comments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 post_id UUID NOT NULL REFERENCES looke_posts(id) ON DELETE CASCADE,
 profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
 text VARCHAR(500) NOT NULL CHECK(char_length(text)>0 AND char_length(text)<=500),
 moderation_status VARCHAR(16) NOT NULL DEFAULT 'visible'
   CHECK (moderation_status IN ('visible','hidden','removed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS looke_comments_post_visible
 ON looke_comments(post_id,created_at,id) WHERE moderation_status='visible';
CREATE INDEX IF NOT EXISTS looke_comments_author_recent
 ON looke_comments(profile_id,created_at DESC);

CREATE TABLE IF NOT EXISTS looke_reposts (
 profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
 post_id UUID NOT NULL REFERENCES looke_posts(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(profile_id,post_id)
);
CREATE INDEX IF NOT EXISTS looke_reposts_post ON looke_reposts(post_id,created_at DESC);

CREATE TABLE IF NOT EXISTS looke_notification_state (
 profile_id UUID PRIMARY KEY REFERENCES looke_profiles(id) ON DELETE CASCADE,
 last_read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Notification events are derived from follow, like, comment and repost rows.
-- Mark-as-read stores the user's read watermark, not private push credentials.
