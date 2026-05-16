-- Ola 3 F3: tabla puente policy_agreements (acuerdos que aprueban/modifican/derogan políticas)
CREATE TABLE IF NOT EXISTS policy_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  agreement_id uuid NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  relationship_kind text NOT NULL DEFAULT 'APPROVES'
    CHECK (relationship_kind IN ('APPROVES','AMENDS','REVOKES','RATIFIES','SUSPENDS')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, agreement_id)
);

CREATE INDEX IF NOT EXISTS idx_policy_agreements_policy  ON policy_agreements(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_agreements_agr     ON policy_agreements(agreement_id);
CREATE INDEX IF NOT EXISTS idx_policy_agreements_tenant  ON policy_agreements(tenant_id);

COMMENT ON TABLE policy_agreements IS 'Relación N:M entre políticas y acuerdos societarios (reemplaza ILIKE fallback heurístico)';
COMMENT ON COLUMN policy_agreements.relationship_kind IS 'APPROVES (aprobación inicial) | AMENDS (modificación) | REVOKES (derogación) | RATIFIES (ratificación) | SUSPENDS (suspensión temporal)';
