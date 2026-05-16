-- ETD Enterprise Stubs — adapted to real schema

-- 1. retention_policies (new)
CREATE TABLE IF NOT EXISTS retention_policies (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  name            text NOT NULL,
  retention_days  integer NOT NULL DEFAULT 2555,
  legal_basis     text,
  applies_to      text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant ON retention_policies (tenant_id);

-- 2. audit_log — add missing columns
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS actor_email  text,
  ADD COLUMN IF NOT EXISTS delta        jsonb,
  ADD COLUMN IF NOT EXISTS ip_address   inet,
  ADD COLUMN IF NOT EXISTS hash_sha512  text;

-- 3. evidence_bundles — add missing columns
ALTER TABLE evidence_bundles
  ADD COLUMN IF NOT EXISTS reference_code  text,
  ADD COLUMN IF NOT EXISTS document_url    text,
  ADD COLUMN IF NOT EXISTS hash_sha512     text,
  ADD COLUMN IF NOT EXISTS signed_by       text,
  ADD COLUMN IF NOT EXISTS signature_date  timestamptz,
  ADD COLUMN IF NOT EXISTS chain_of_custody jsonb,
  ADD COLUMN IF NOT EXISTS legal_hold      boolean DEFAULT false;

-- 4. ETD columns on domain tables
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id);

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id),
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS approved_by          uuid;

ALTER TABLE obligations
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id);

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id),
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS approved_by          uuid,
  ADD COLUMN IF NOT EXISTS evidence_id          uuid REFERENCES evidence_bundles(id);

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id),
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS approved_by          uuid,
  ADD COLUMN IF NOT EXISTS verified_by          uuid,
  ADD COLUMN IF NOT EXISTS evidence_id          uuid REFERENCES evidence_bundles(id);

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS approved_by          uuid;

ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS verified_by          uuid,
  ADD COLUMN IF NOT EXISTS evidence_id          uuid REFERENCES evidence_bundles(id),
  ADD COLUMN IF NOT EXISTS hash_sha512          text;

ALTER TABLE regulatory_notifications
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS ack_evidence_id      uuid REFERENCES evidence_bundles(id),
  ADD COLUMN IF NOT EXISTS hash_sha512          text;

ALTER TABLE governing_bodies
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false;

-- 5. Composite indexes (skip meetings — no entity_id column)
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status ON incidents (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_status ON agreements (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_certifications_tenant_agreement ON certifications (tenant_id, agreement_id);

-- 6. Comments
COMMENT ON TABLE retention_policies IS 'ETD stub: catálogo de políticas de retención por tenant.';
COMMENT ON COLUMN incidents.legal_hold IS 'ETD: cuando true, el registro no puede ser purgado.';
COMMENT ON COLUMN agreements.legal_hold IS 'ETD: cuando true, el registro no puede ser purgado.';
