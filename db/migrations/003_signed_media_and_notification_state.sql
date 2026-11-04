-- M16: per-account, expiring, one-use upload authorization + read cursor.
-- Production migrations are never run automatically by Next.js.
CREATE TABLE IF NOT EXISTS social_media_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner text NOT NULL REFERENCES social_profiles(address) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'cloudinary' CHECK(provider = 'cloudinary'),
  public_id text NOT NULL UNIQUE CHECK(length(public_id) BETWEEN 25 AND 180),
  kind text NOT NULL CHECK(kind IN ('image','video')),
  mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm')),
  declared_bytes integer NOT NULL CHECK(declared_bytes BETWEEN 1 AND 20000000),
  state text NOT NULL DEFAULT 'issued' CHECK(state IN ('issued','verified','attached','expired')),
  verified_url text,
  provider_asset_id text,
  post_id uuid UNIQUE REFERENCES social_posts(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attached_at timestamptz,
  CHECK ((state IN ('issued','expired') AND verified_url IS NULL AND post_id IS NULL) OR
         (state='verified' AND verified_url IS NOT NULL AND post_id IS NULL) OR
         (state='attached' AND verified_url IS NOT NULL AND post_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS social_media_uploads_owner_idx
  ON social_media_uploads(owner,issued_at DESC);
CREATE INDEX IF NOT EXISTS social_media_uploads_expiry_idx
  ON social_media_uploads(expires_at) WHERE state='issued';

CREATE TABLE IF NOT EXISTS social_notification_reads (
  owner text PRIMARY KEY REFERENCES social_profiles(address) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
