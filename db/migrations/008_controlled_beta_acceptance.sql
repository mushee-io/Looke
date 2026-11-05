-- Looke M23: operator-only Testnet acceptance evidence. Nothing here enables public release.
-- No dummy users, posts, coins, Uniqs, rewards, financial transactions or seeded witnesses.
CREATE TABLE IF NOT EXISTS social_beta_wallet_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  reviewer text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  preview_origin text NOT NULL CHECK(preview_origin LIKE 'https://%'),
  preview_sha char(40) NOT NULL CHECK(preview_sha ~ '^[0-9a-f]{40}$'),
  challenge_message text NOT NULL CHECK(char_length(challenge_message) BETWEEN 150 AND 1500),
  nonce char(32) NOT NULL UNIQUE CHECK(nonce ~ '^[0-9a-f]{32}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK(wallet<>reviewer),
  CHECK(expires_at>created_at),
  CHECK(expires_at<=created_at+interval '5 minutes')
);
CREATE INDEX IF NOT EXISTS social_beta_challenges_live_m23
  ON social_beta_wallet_challenges(wallet,expires_at) WHERE consumed_at IS NULL;

-- Proof of cryptographic wallet control / consumed nonce only.
-- Not an active social-session cookie, human uniqueness, KYC or a token authorization.
CREATE TABLE IF NOT EXISTS social_beta_wallet_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL UNIQUE REFERENCES social_beta_wallet_challenges(id) ON DELETE RESTRICT,
  wallet text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  reviewer text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  signature_sha256 char(64) NOT NULL UNIQUE CHECK(signature_sha256 ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  session_expires_at timestamptz NOT NULL,
  CHECK(wallet<>reviewer),
  CHECK(session_expires_at>verified_at)
);
CREATE INDEX IF NOT EXISTS social_beta_acceptances_wallet_m23
  ON social_beta_wallet_acceptances(wallet,verified_at DESC);

-- Append-only cryptographic countersignature for a separately available evidence artifact.
-- This is *not* an independent verification of its content or a live release approval.
CREATE TABLE IF NOT EXISTS social_beta_evidence_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK(kind IN ('restore','security','operator')),
  evidence_sha256 char(64) NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_url text NOT NULL CHECK(evidence_url LIKE 'https://%'),
  preview_sha char(40) NOT NULL CHECK(preview_sha ~ '^[0-9a-f]{40}$'),
  auditor text NOT NULL CHECK(auditor ~ '^0x[0-9a-f]{40}$'),
  recorded_by text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  signed_at timestamptz NOT NULL,
  signature_sha256 char(64) NOT NULL UNIQUE CHECK(signature_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kind,evidence_sha256,auditor),
  CHECK(auditor<>recorded_by)
);
CREATE INDEX IF NOT EXISTS social_beta_signatures_recent_m23
  ON social_beta_evidence_signatures(kind,recorded_at DESC);
