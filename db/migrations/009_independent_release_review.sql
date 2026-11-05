-- Looke M24: empty, append-only operator incident and evidence crosscheck journal.
-- Never grants a role, records an audit as approved, or switches beta/financial flags.
CREATE TABLE IF NOT EXISTS social_beta_incident_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('incident','rollback_rehearsal','recovery_observation')),
  severity text NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  reviewer text NOT NULL REFERENCES social_profiles(address) ON DELETE RESTRICT,
  preview_sha char(40) NOT NULL CHECK (preview_sha ~ '^[0-9a-f]{40}$'),
  observation varchar(1000) NOT NULL CHECK (char_length(btrim(observation)) BETWEEN 20 AND 1000),
  external_evidence_id uuid REFERENCES social_beta_evidence_signatures(id) ON DELETE RESTRICT,
  action_taken text NOT NULL DEFAULT 'none' CHECK (action_taken='none'),
  production_changed boolean NOT NULL DEFAULT false CHECK (production_changed=false),
  public_beta_activated boolean NOT NULL DEFAULT false CHECK (public_beta_activated=false),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_m24_incident_recent
  ON social_beta_incident_journal(preview_sha,created_at DESC);
CREATE INDEX IF NOT EXISTS social_m24_incident_evidence
  ON social_beta_incident_journal(external_evidence_id)
  WHERE external_evidence_id IS NOT NULL;
