-- M26: public evidence-reference acknowledgements only; NO trusted human identity claims.
-- Never seeds or approves independent security audits, GO decisions, beta, or finance.
CREATE TABLE IF NOT EXISTS social_beta_release_witnesses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 review_id uuid NOT NULL REFERENCES social_beta_release_reviews(id) ON DELETE RESTRICT,
 preview_sha char(40) NOT NULL CHECK(preview_sha ~ '^[a-f0-9]{40}$'),
 role text NOT NULL CHECK(role IN ('independent_security','independent_operator')),
 witness_wallet text NOT NULL CHECK(witness_wallet ~ '^0x[a-f0-9]{40}$'),
 submitted_by text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision IN ('hold','reference_acknowledged_unverified')),
 observed_at timestamptz NOT NULL,
 signature_sha256 char(64) NOT NULL UNIQUE CHECK(signature_sha256 ~ '^[a-f0-9]{64}$'),
 evidence_sha256 char(64) NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 independent_human_identity_verified boolean NOT NULL DEFAULT false CHECK(independent_human_identity_verified=false),
 audit_content_verified boolean NOT NULL DEFAULT false CHECK(audit_content_verified=false),
 live_wallet_sessions_verified boolean NOT NULL DEFAULT false CHECK(live_wallet_sessions_verified=false),
 real_restore_verified boolean NOT NULL DEFAULT false CHECK(real_restore_verified=false),
 beta_authorized boolean NOT NULL DEFAULT false CHECK(beta_authorized=false),
 production_changed boolean NOT NULL DEFAULT false CHECK(production_changed=false),
 CHECK(witness_wallet<>submitted_by),
 UNIQUE(review_id,role), UNIQUE(review_id,witness_wallet)
);
CREATE INDEX IF NOT EXISTS social_beta_release_witness_sha
 ON social_beta_release_witnesses(preview_sha,recorded_at DESC);
