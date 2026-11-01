-- M16: optimistic concurrency for PRIVATE offchain native Uniq metadata drafts.
-- Must run after db/011_uniq_creation_drafts.sql; no onchain NFT changes.
ALTER TABLE looke_uniq_collection_drafts
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1
  CHECK (revision >= 1);
ALTER TABLE looke_uniq_item_drafts
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1
  CHECK (revision >= 1);
ALTER TABLE looke_uniq_item_drafts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
-- Each metadata update checks the exact expected revision before committing;
-- concurrent edits return a conflict rather than silently overwriting.
