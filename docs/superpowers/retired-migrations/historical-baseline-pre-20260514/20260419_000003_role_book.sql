-- Motor de Reglas LSC: role book de secretaria y auditoria WORM
-- Corporate secretary role assignments and immutable audit trail
-- Tenant: 00000000-0000-0000-0000-000000000001 (ARGA Seguros demo)

-- ============================================================================
-- 1. secretaria_role_assignments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS secretaria_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN (
    'SECRETARIA_CORPORATIVA',
    'SECRETARIO',
    'PRESIDENTE',
    'MIEMBRO',
    'COMITE_LEGAL',
    'ADMIN_SISTEMA'
  )),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  body_id UUID REFERENCES governing_bodies(id) ON DELETE CASCADE,
  assigned_by UUID,
  assigned_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE secretaria_role_assignments IS 'Role book: role-person bindings scoped by entity/body for secretaria corporativa';
COMMENT ON COLUMN secretaria_role_assignments.role IS 'SECRETARIA_CORPORATIVA (global), SECRETARIO (per body), PRESIDENTE, MIEMBRO, COMITE_LEGAL (global), ADMIN_SISTEMA (global)';
COMMENT ON COLUMN secretaria_role_assignments.entity_id IS 'NULL = global role; non-NULL = scoped to entity (POR_ENTIDAD)';
COMMENT ON COLUMN secretaria_role_assignments.body_id IS 'NULL = global/entity-scoped; non-NULL = scoped to body (POR_ORGANO)';

-- ============================================================================
-- 2. rule_change_audit table (WORM — append-only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rule_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_id UUID,
  actor_role TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'INSERT', 'UPDATE', 'DELETE', 'PUBLISH', 'ARCHIVE', 'SIGN', 'CERTIFY', 'REJECT', 'CUSTOM'
  )),
  payload_before JSONB,
  payload_after JSONB,
  change_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sequence_no BIGINT GENERATED ALWAYS AS IDENTITY
);

COMMENT ON TABLE rule_change_audit IS 'WORM (Write-Once-Read-Many) audit trail: immutable, append-only. Only INSERT allowed. Tracks all rule/agreement mutations for compliance.';
COMMENT ON COLUMN rule_change_audit.actor_id IS 'UUID of person/admin who made the change. NULL = system action.';
COMMENT ON COLUMN rule_change_audit.actor_role IS 'Role of actor at time of action (cached for audit immutability).';
COMMENT ON COLUMN rule_change_audit.resource_type IS 'Entity type: agreement, rule, policy, delegation, etc.';
COMMENT ON COLUMN rule_change_audit.resource_id IS 'ID of the resource (UUID or code).';
COMMENT ON COLUMN rule_change_audit.action IS 'Type of mutation: INSERT, UPDATE, DELETE, PUBLISH, ARCHIVE, SIGN, CERTIFY, REJECT, CUSTOM.';
COMMENT ON COLUMN rule_change_audit.payload_before IS 'JSONB snapshot BEFORE the change (NULL for INSERT).';
COMMENT ON COLUMN rule_change_audit.payload_after IS 'JSONB snapshot AFTER the change.';
COMMENT ON COLUMN rule_change_audit.change_description IS 'Human-readable summary for audit logs.';
COMMENT ON COLUMN rule_change_audit.sequence_no IS 'Immutable sequence number for chain integrity verification.';

-- ============================================================================
-- 3. Row-Level Security (RLS)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE secretaria_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_change_audit ENABLE ROW LEVEL SECURITY;

-- secretaria_role_assignments: tenant isolation
CREATE POLICY secretaria_role_assignments_select ON secretaria_role_assignments
  FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY secretaria_role_assignments_insert ON secretaria_role_assignments
  FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY secretaria_role_assignments_update ON secretaria_role_assignments
  FOR UPDATE
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY secretaria_role_assignments_delete ON secretaria_role_assignments
  FOR DELETE
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- rule_change_audit: tenant isolation + WORM (INSERT only)
CREATE POLICY rule_change_audit_select ON rule_change_audit
  FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY rule_change_audit_insert ON rule_change_audit
  FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Explicitly DENY UPDATE and DELETE via RLS (defense in depth)
CREATE POLICY rule_change_audit_update_deny ON rule_change_audit
  FOR UPDATE
  USING (false);

CREATE POLICY rule_change_audit_delete_deny ON rule_change_audit
  FOR DELETE
  USING (false);

-- ============================================================================
-- 4. WORM Guard Trigger
-- ============================================================================

CREATE TRIGGER worm_rule_change_audit
  BEFORE UPDATE OR DELETE ON rule_change_audit
  FOR EACH ROW
  EXECUTE FUNCTION worm_guard();

-- ============================================================================
-- 5. Indexes for audit trail queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_secretaria_role_assignments_tenant
  ON secretaria_role_assignments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_secretaria_role_assignments_person
  ON secretaria_role_assignments(person_id);

CREATE INDEX IF NOT EXISTS idx_secretaria_role_assignments_entity
  ON secretaria_role_assignments(entity_id) WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_secretaria_role_assignments_body
  ON secretaria_role_assignments(body_id) WHERE body_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rule_change_audit_tenant
  ON rule_change_audit(tenant_id);

CREATE INDEX IF NOT EXISTS idx_rule_change_audit_actor
  ON rule_change_audit(actor_id) WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rule_change_audit_resource
  ON rule_change_audit(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_rule_change_audit_action
  ON rule_change_audit(action);

CREATE INDEX IF NOT EXISTS idx_rule_change_audit_created
  ON rule_change_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rule_change_audit_sequence
  ON rule_change_audit(sequence_no DESC);

-- ============================================================================
-- 6. Demo data (T1 seed)
-- ============================================================================

-- Lucía Martín (person already in persons table from core)
-- Assign her as SECRETARIA_CORPORATIVA globally + SECRETARIO for CdA

INSERT INTO secretaria_role_assignments (
  id,
  tenant_id,
  person_id,
  role,
  entity_id,
  body_id,
  assigned_by,
  assigned_date
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM persons WHERE name = 'Lucía Martín' LIMIT 1),
  'SECRETARIA_CORPORATIVA',
  NULL,
  NULL,
  NULL,
  '2026-04-15 10:00:00+02'
) ON CONFLICT DO NOTHING;

-- Sample audit entry (demonstrating WORM structure)
INSERT INTO rule_change_audit (
  id,
  tenant_id,
  actor_id,
  actor_role,
  resource_type,
  resource_id,
  action,
  payload_before,
  payload_after,
  change_description
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  NULL,
  'SYSTEM',
  'rule',
  'QUORUM_SIMPLE',
  'INSERT',
  NULL,
  '{"type":"quorum","name":"Quórum Simple","required_percentage":50}',
  'Initialized foundational quorum rule for demo'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON secretaria_role_assignments TO authenticated;
GRANT SELECT, INSERT ON rule_change_audit TO authenticated;
GRANT SELECT ON rule_change_audit TO service_role;
