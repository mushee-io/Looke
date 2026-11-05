-- M25: evidence review register for operator-controlled acceptance. No seeded approvals.
-- Cryptographic reviewer acknowledgements are NOT independent verification of actual artifacts
-- and CANNOT activate public beta, token mint, finance or production.
CREATE TABLE IF NOT EXISTS social_beta_release_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 gate text NOT NULL CHECK (gate IN (
  'two_real_wallets_with_independent_human_witness',
  'genuine_hosted_media_provider_scan_and_moderation',
  'current_ultra_evm_creator_coin_receipt',
  'current_ultra_native_uniq_ownership',
  'complete_points_reconciliation_and_anti_sybil_review',
  'complete_postgres_backup_restore_hashes',
  'different_operator_witnessed_restore',
  'independent_security_audit_content_hash_and_signoff',
  'signed_out_preview_authentication_witness',
  'incident_drill_and_verified_rollback_procedure',
  'explicit_operator_public_beta_go_live_authorization'
 )),
 preview_sha char(40) NOT NULL CHECK(preview_sha ~ '^[a-f0-9]{40}$'),
 evidence_id uuid NOT NULL REFERENCES social_beta_evidence_signatures(id) ON DELETE RESTRICT,
 recorded_by text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
 external_reviewer text NOT NULL CHECK (external_reviewer ~ '^0x[a-f0-9]{40}$'),
 decision text NOT NULL CHECK(decision IN ('reviewed_reference_only','needs_more_evidence')),
 signature_sha256 char(64) NOT NULL UNIQUE CHECK(signature_sha256 ~ '^[a-f0-9]{64}$'),
 observed_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 artifact_bytes_verified boolean NOT NULL DEFAULT false CHECK(artifact_bytes_verified=false),
 real_human_identity_verified boolean NOT NULL DEFAULT false CHECK(real_human_identity_verified=false),
 external_security_approval boolean NOT NULL DEFAULT false CHECK(external_security_approval=false),
 beta_release_authorized boolean NOT NULL DEFAULT false CHECK(beta_release_authorized=false),
 production_changed boolean NOT NULL DEFAULT false CHECK(production_changed=false),
 CHECK(recorded_by <> external_reviewer),
 UNIQUE(gate,preview_sha,evidence_id,external_reviewer)
);
CREATE INDEX IF NOT EXISTS social_beta_release_reviews_preview
 ON social_beta_release_reviews(preview_sha, recorded_at DESC);
