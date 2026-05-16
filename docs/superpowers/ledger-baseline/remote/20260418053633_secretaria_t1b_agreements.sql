-- Secretaría T1b: agregado raíz 'agreements' + FKs desde tablas existentes

CREATE TABLE IF NOT EXISTS agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_id uuid REFERENCES entities(id),
  body_id uuid REFERENCES governing_bodies(id),
  code text,
  agreement_kind text NOT NULL,
  matter_class text NOT NULL CHECK (matter_class IN ('ORDINARIA','ESTATUTARIA','ESTRUCTURAL')),
  inscribable boolean NOT NULL DEFAULT false,
  adoption_mode text NOT NULL CHECK (adoption_mode IN ('MEETING','UNIVERSAL','NO_SESSION','UNIPERSONAL_SOCIO','UNIPERSONAL_ADMIN')),
  required_quorum_code text,
  required_majority_code text,
  jurisdiction_rule_id uuid REFERENCES jurisdiction_rule_sets(id),
  proposal_text text,
  decision_text text,
  decision_date date,
  effective_date date,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PROPOSED','ADOPTED','CERTIFIED','INSTRUMENTED','FILED','REGISTERED','REJECTED_REGISTRY','PUBLISHED')),
  parent_meeting_id uuid REFERENCES meetings(id),
  unipersonal_decision_id uuid REFERENCES unipersonal_decisions(id),
  no_session_resolution_id uuid REFERENCES no_session_resolutions(id),
  statutory_basis text,
  compliance_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agreements_tenant        ON agreements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agreements_entity        ON agreements (entity_id);
CREATE INDEX IF NOT EXISTS idx_agreements_body          ON agreements (body_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status        ON agreements (status);
CREATE INDEX IF NOT EXISTS idx_agreements_meeting       ON agreements (parent_meeting_id);
CREATE INDEX IF NOT EXISTS idx_agreements_unipersonal   ON agreements (unipersonal_decision_id);
CREATE INDEX IF NOT EXISTS idx_agreements_nosession     ON agreements (no_session_resolution_id);

-- FKs desde tablas existentes hacia agreements
ALTER TABLE certifications        ADD COLUMN IF NOT EXISTS agreement_id uuid REFERENCES agreements(id);
ALTER TABLE registry_filings      ADD COLUMN IF NOT EXISTS agreement_id uuid REFERENCES agreements(id);
ALTER TABLE meeting_resolutions   ADD COLUMN IF NOT EXISTS agreement_id uuid REFERENCES agreements(id);

CREATE INDEX IF NOT EXISTS idx_certifications_agreement      ON certifications (agreement_id);
CREATE INDEX IF NOT EXISTS idx_registry_filings_agreement    ON registry_filings (agreement_id);
CREATE INDEX IF NOT EXISTS idx_meeting_resolutions_agreement ON meeting_resolutions (agreement_id);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION fn_agreements_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agreements_touch_updated_at ON agreements;
CREATE TRIGGER trg_agreements_touch_updated_at
  BEFORE UPDATE ON agreements
  FOR EACH ROW
  EXECUTE FUNCTION fn_agreements_touch_updated_at();
