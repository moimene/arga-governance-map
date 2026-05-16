-- =============================================================
-- B2: RBAC / Separation of Duties (SoD) Schema
-- 5 roles, toxic pairs, role assignments, permission checks
-- =============================================================

-- Roles enum
DO $$ BEGIN
  CREATE TYPE user_role_type AS ENUM (
    'SECRETARIO',
    'CONSEJERO',
    'COMPLIANCE',
    'ADMIN_TENANT',
    'AUDITOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Role definitions table
CREATE TABLE IF NOT EXISTS rbac_roles (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  role_code     text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  description   text,
  permissions   jsonb NOT NULL DEFAULT '[]',  -- ["agreements:read","agreements:write","audit:read"]
  is_system     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Role assignments per user per tenant
CREATE TABLE IF NOT EXISTS rbac_user_roles (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  user_id       uuid NOT NULL,  -- references persons.id or auth.users
  role_id       uuid NOT NULL REFERENCES rbac_roles(id),
  assigned_by   uuid,
  assigned_at   timestamptz DEFAULT now(),
  expires_at    timestamptz,
  is_active     boolean DEFAULT true,
  UNIQUE(tenant_id, user_id, role_id)
);

-- SoD toxic pairs table
CREATE TABLE IF NOT EXISTS sod_toxic_pairs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  role_a      text NOT NULL,
  role_b      text NOT NULL,
  reason      text NOT NULL,
  severity    text NOT NULL DEFAULT 'BLOCK' CHECK (severity IN ('BLOCK','WARN')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(role_a, role_b)
);

-- RLS on new tables
ALTER TABLE rbac_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY rbac_roles_public_read ON rbac_roles FOR SELECT USING (true);
CREATE POLICY rbac_roles_admin_write ON rbac_roles FOR ALL USING (true);

ALTER TABLE rbac_user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY rbac_user_roles_tenant ON rbac_user_roles FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

ALTER TABLE sod_toxic_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sod_toxic_pairs_read ON sod_toxic_pairs FOR SELECT USING (true);
CREATE POLICY sod_toxic_pairs_admin ON sod_toxic_pairs FOR ALL USING (true);

-- Seed 5 system roles with permissions
INSERT INTO rbac_roles (role_code, display_name, description, permissions) VALUES
  ('SECRETARIO', 'Secretario del Consejo', 'Gestión de actas, convocatorias, certificaciones, acuerdos y tramitaciones registrales',
   '["agreements:*","meetings:*","certifications:*","convocatorias:*","registry_filings:*","minutes:*","delegations:read","entities:read","governing_bodies:read","persons:read","plantillas:*","evidence:read"]'::jsonb),
  ('CONSEJERO', 'Consejero / Miembro del Órgano', 'Acceso de lectura a actas, acuerdos y documentación del órgano',
   '["agreements:read","meetings:read","certifications:read","convocatorias:read","minutes:read","entities:read","governing_bodies:read","persons:read","evidence:read"]'::jsonb),
  ('COMPLIANCE', 'Oficial de Cumplimiento', 'Gestión de políticas, obligaciones, hallazgos, incidentes y controles GRC',
   '["policies:*","obligations:*","findings:*","incidents:*","controls:*","risks:*","evidences:*","audit:read","entities:read","governing_bodies:read"]'::jsonb),
  ('ADMIN_TENANT', 'Administrador del Tenant', 'Administración completa: usuarios, roles, configuración, retención',
   '["*"]'::jsonb),
  ('AUDITOR', 'Auditor', 'Acceso de solo lectura a todo el sistema para fines de auditoría',
   '["agreements:read","meetings:read","certifications:read","convocatorias:read","minutes:read","policies:read","obligations:read","findings:read","incidents:read","controls:read","risks:read","evidences:read","audit:read","entities:read","governing_bodies:read","persons:read","retention:read","evidence:read"]'::jsonb)
ON CONFLICT (role_code) DO NOTHING;

-- Seed SoD toxic pairs
INSERT INTO sod_toxic_pairs (role_a, role_b, reason, severity) VALUES
  ('SECRETARIO', 'AUDITOR', 'El secretario no puede auditar sus propios actos societarios', 'BLOCK'),
  ('ADMIN_TENANT', 'AUDITOR', 'El administrador no puede auditar la configuración que él mismo gestiona', 'BLOCK'),
  ('SECRETARIO', 'COMPLIANCE', 'El secretario y compliance deben ser personas distintas para garantizar independencia del control', 'WARN'),
  ('CONSEJERO', 'COMPLIANCE', 'Un consejero no debe ser oficial de cumplimiento — conflicto de supervisión', 'WARN')
ON CONFLICT (role_a, role_b) DO NOTHING;

-- Assign demo roles to existing persons
-- Lucía Martín (secretaria) → SECRETARIO
INSERT INTO rbac_user_roles (tenant_id, user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid,
       p.id,
       r.id
FROM persons p, rbac_roles r
WHERE p.full_name ILIKE '%Lucía%Martín%'
  AND r.role_code = 'SECRETARIO'
  AND p.tenant_id = '00000000-0000-0000-0000-000000000001'
LIMIT 1
ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING;

-- Carlos Vega (presidente) → CONSEJERO + ADMIN_TENANT
INSERT INTO rbac_user_roles (tenant_id, user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid,
       p.id,
       r.id
FROM persons p, rbac_roles r
WHERE p.full_name ILIKE '%Carlos%Vega%'
  AND r.role_code = 'CONSEJERO'
  AND p.tenant_id = '00000000-0000-0000-0000-000000000001'
LIMIT 1
ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING;

-- Elena Ruiz (compliance) → COMPLIANCE
INSERT INTO rbac_user_roles (tenant_id, user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid,
       p.id,
       r.id
FROM persons p, rbac_roles r
WHERE p.full_name ILIKE '%Elena%Ruiz%'
  AND r.role_code = 'COMPLIANCE'
  AND p.tenant_id = '00000000-0000-0000-0000-000000000001'
LIMIT 1
ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING;

-- Admin user → ADMIN_TENANT
INSERT INTO rbac_user_roles (tenant_id, user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid,
       p.id,
       r.id
FROM persons p, rbac_roles r
WHERE p.full_name ILIKE '%Admin%'
  AND r.role_code = 'ADMIN_TENANT'
  AND p.tenant_id = '00000000-0000-0000-0000-000000000001'
LIMIT 1
ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING;

-- Function: check SoD violations for a user
CREATE OR REPLACE FUNCTION fn_check_sod_violations(
  p_tenant_id uuid,
  p_user_id uuid,
  p_proposed_role text
)
RETURNS TABLE(
  conflicting_role text,
  reason text,
  severity text
) AS $$
BEGIN
  RETURN QUERY
  SELECT sp.role_b, sp.reason, sp.severity
  FROM sod_toxic_pairs sp
  JOIN rbac_user_roles ur ON ur.role_id = (SELECT id FROM rbac_roles WHERE role_code = sp.role_a)
  WHERE ur.tenant_id = p_tenant_id
    AND ur.user_id = p_user_id
    AND ur.is_active = true
    AND sp.role_b = p_proposed_role
  UNION
  SELECT sp.role_a, sp.reason, sp.severity
  FROM sod_toxic_pairs sp
  JOIN rbac_user_roles ur ON ur.role_id = (SELECT id FROM rbac_roles WHERE role_code = sp.role_b)
  WHERE ur.tenant_id = p_tenant_id
    AND ur.user_id = p_user_id
    AND ur.is_active = true
    AND sp.role_a = p_proposed_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE rbac_roles IS 'RBAC role definitions with permission arrays. System roles: SECRETARIO, CONSEJERO, COMPLIANCE, ADMIN_TENANT, AUDITOR.';
COMMENT ON TABLE sod_toxic_pairs IS 'Separation of Duties: pairs of roles that cannot (BLOCK) or should not (WARN) coexist on the same user.';
COMMENT ON FUNCTION fn_check_sod_violations(uuid, uuid, text) IS 'Returns SoD violations if assigning p_proposed_role to p_user_id in p_tenant_id.';
