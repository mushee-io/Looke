-- M17: real, wallet-scoped engagement. Never seed likes, reposts, bookmarks or follows.
-- Reusable on PostgreSQL 15+, applied only by the explicit operator migration.
CREATE TABLE IF NOT EXISTS social_post_likes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor,post_id)
);
CREATE INDEX IF NOT EXISTS social_post_likes_post_created_idx ON social_post_likes(post_id,created_at DESC);
CREATE INDEX IF NOT EXISTS social_post_likes_actor_created_idx ON social_post_likes(actor,created_at DESC);

CREATE TABLE IF NOT EXISTS social_post_reposts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor,post_id)
);
CREATE INDEX IF NOT EXISTS social_post_reposts_post_created_idx ON social_post_reposts(post_id,created_at DESC);
CREATE INDEX IF NOT EXISTS social_post_reposts_actor_created_idx ON social_post_reposts(actor,created_at DESC);

-- Bookmarks are private: never return their owners or count publicly.
CREATE TABLE IF NOT EXISTS social_post_bookmarks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor,post_id)
);
CREATE INDEX IF NOT EXISTS social_post_bookmarks_actor_created_idx ON social_post_bookmarks(actor,created_at DESC);
