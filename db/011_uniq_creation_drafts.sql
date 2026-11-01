-- M14: offchain metadata manifests; NO verified native wallet association, NFT factory or issuance.
-- Apply after db/001_social.sql, only to Looke's dedicated Neon environment.
CREATE TABLE IF NOT EXISTS looke_uniq_collection_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL CHECK(octet_length(name) BETWEEN 2 AND 80),
  description VARCHAR(1000) NOT NULL CHECK(octet_length(description) BETWEEN 1 AND 1000),
  image_uri VARCHAR(256) NOT NULL CHECK(image_uri LIKE 'ipfs://%'),
  planned_native_account VARCHAR(12),
  planned_factory_id VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS looke_uniq_collections_owner ON looke_uniq_collection_drafts(profile_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS looke_uniq_item_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES looke_uniq_collection_drafts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES looke_profiles(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL CHECK(octet_length(name) BETWEEN 2 AND 80),
  description VARCHAR(1000) NOT NULL CHECK(octet_length(description) BETWEEN 1 AND 1000),
  image_uri VARCHAR(256) NOT NULL CHECK(image_uri LIKE 'ipfs://%'),
  edition_limit INTEGER NOT NULL CHECK(edition_limit BETWEEN 1 AND 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS looke_uniq_items_collection ON looke_uniq_item_drafts(collection_id,profile_id,updated_at DESC);
-- Proposed native account and factory ID are unverified self-reported metadata.
-- Neither table constitutes actual native Uniq ownership or any minted token.
