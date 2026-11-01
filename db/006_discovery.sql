-- M8 discovery search indexes. Run after 001_social.sql and 005_social_interactions.sql.
-- PostgreSQL's built-in, deterministic simple-language FTS; no external search provider.
-- Partial index excludes moderated and removed content from public discovery.
CREATE INDEX IF NOT EXISTS looke_posts_public_fts
  ON looke_posts USING GIN (to_tsvector('simple',text))
  WHERE moderation_status='visible';
CREATE INDEX IF NOT EXISTS looke_profiles_public_fts
  ON looke_profiles USING GIN (
    to_tsvector('simple',coalesce(handle,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(bio,''))
  ) WHERE handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS looke_follows_personalized
  ON looke_follows(follower_id,followed_id);
-- Engagement tables already have post_id indexes/primary keys in 001 and 005.
-- No user activity or personal search query is persisted by these indexes.
