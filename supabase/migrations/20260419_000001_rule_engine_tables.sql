-- Migration: Rule Engine Tables (Motor de Reglas LSC)
-- Created: 2026-04-19
-- Purpose: Corporate law rules engine for governance platform
-- Tenant: TGMS (arga-governance-map)

-- ============================================================================
-- 1. WORM GUARD FUNCTION — Reusable trigger to prevent UPDATE/DELETE
-- ============================================================================

CREATE OR REPLACE FUNCTION worm_guard()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'WORM protection: % operations are not allowed on %', TG_OP, TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. RULE_PACKS TABLE — Registry of available rule packs
-- ============================================================================

CREATE TABLE IF NOT EXISTS rule_packs (
  id TEXT PRIMARY KEY,                          -- e.g., 'APROBACION_CUENTAS', 'NOMBRAMIENTO_CONSEJERO'
  tenant_id UUID NOT NULL,
  descripcion TEXT NOT NULL,
  materia TEXT NOT NULL,                        -- Legal domain: 'APROBACION_CUENTAS', 'NOMBRAMIENTO', etc.
  organo_tipo TEXT,                             -- Optional: organ-specific (e.g., 'CONSEJO_ADMINISTRACION', 'JUNTA_GENERAL')
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT rule_packs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

ALTER TABLE rule_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_packs_tenant_isolation" ON rule_packs FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX idx_rule_packs_tenant ON rule_packs(tenant_id);
CREATE INDEX idx_rule_packs_materia ON rule_packs(materia);

-- ============================================================================
-- 3. RULE_PACK_VERSIONS TABLE — Immutable versions of rule packs
-- ============================================================================

CREATE TABLE IF NOT EXISTS rule_pack_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id TEXT NOT NULL,
  version TEXT NOT NULL,                        -- Semver: '1.0.0', '1.1.0', etc.
  payload JSONB NOT NULL,                       -- Full RulePack JSON structure
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT rule_pack_versions_pack_fk FOREIGN KEY (pack_id) REFERENCES rule_packs(id) ON DELETE CASCADE,
  CONSTRAINT rule_pack_versions_unique_version UNIQUE (pack_id, version)
);

ALTER TABLE rule_pack_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_pack_versions_read" ON rule_pack_versions FOR SELECT
  USING (true);  -- Read-only; versions are immutable and shared across tenant

CREATE INDEX idx_rule_pack_versions_pack ON rule_pack_versions(pack_id);
CREATE INDEX idx_rule_pack_versions_active ON rule_pack_versions(is_active) WHERE is_active = true;

-- ============================================================================
-- 4. RULE_PARAM_OVERRIDES TABLE — Tenant-specific parameter overrides
-- ============================================================================

CREATE TABLE IF NOT EXISTS rule_param_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  materia TEXT NOT NULL,                        -- Legal domain
  clave TEXT NOT NULL,                          -- Parameter key (e.g., 'QUORUM_MINIMO_CDA')
  valor JSONB NOT NULL,                         -- Parameter value (any JSON structure)
  fuente TEXT NOT NULL,                         -- Source: LEY, ESTATUTOS, PACTO_PARASOCIAL, REGLAMENTO
  referencia TEXT,                              -- Optional reference (e.g., article number)
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT rule_param_overrides_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT rule_param_overrides_entity_fk FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE,
  CONSTRAINT rule_param_overrides_fuente_check CHECK (fuente IN ('LEY', 'ESTATUTOS', 'PACTO_PARASOCIAL', 'REGLAMENTO')),
  CONSTRAINT rule_param_overrides_unique_key UNIQUE (entity_id, materia, clave)
);

ALTER TABLE rule_param_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_param_overrides_tenant_isolation" ON rule_param_overrides FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX idx_rule_param_overrides_tenant ON rule_param_overrides(tenant_id);
CREATE INDEX idx_rule_param_overrides_entity ON rule_param_overrides(entity_id);
CREATE INDEX idx_rule_param_overrides_materia ON rule_param_overrides(materia);

-- ============================================================================
-- 5. RULE_EVALUATION_RESULTS TABLE (WORM) — Immutable audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS rule_evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agreement_id UUID NOT NULL,
  etapa TEXT NOT NULL,                          -- Phase: 'CONVOCATORIA', 'REUNION', 'ACTA', 'CERTIFICACION'
  ok BOOLEAN NOT NULL,                          -- Compliance result: true = pass, false = fail
  explain JSONB NOT NULL,                       -- Detailed explanation of evaluation result
  rule_pack_id TEXT,                            -- Reference to applied rule pack
  rule_pack_version TEXT,                       -- Version of rule pack used
  tsq_token TEXT,                               -- Token for full-text search (future)
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT rule_evaluation_results_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT rule_evaluation_results_agreement_fk FOREIGN KEY (agreement_id) REFERENCES public.agreements(id) ON DELETE CASCADE,
  CONSTRAINT rule_evaluation_results_unique_etapa UNIQUE (agreement_id, etapa)
);

-- WORM protection: no UPDATE, no DELETE (trigger enforces, policy backs it up)
CREATE TRIGGER rule_evaluation_results_worm_guard_update
  BEFORE UPDATE ON rule_evaluation_results
  FOR EACH ROW
  EXECUTE FUNCTION worm_guard();

CREATE TRIGGER rule_evaluation_results_worm_guard_delete
  BEFORE DELETE ON rule_evaluation_results
  FOR EACH ROW
  EXECUTE FUNCTION worm_guard();

ALTER TABLE rule_evaluation_results ENABLE ROW LEVEL SECURITY;
-- Append-only policy: INSERT only when tenant matches
CREATE POLICY "rule_evaluation_results_append_only" ON rule_evaluation_results FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
-- Read policy
CREATE POLICY "rule_evaluation_results_read_own" ON rule_evaluation_results FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
-- Explicit deny UPDATE/DELETE at RLS level (trigger also enforces)
CREATE POLICY "rule_evaluation_results_deny_update" ON rule_evaluation_results FOR UPDATE
  WITH CHECK (false);
CREATE POLICY "rule_evaluation_results_deny_delete" ON rule_evaluation_results FOR DELETE
  USING (false);

CREATE INDEX idx_rule_evaluation_results_tenant ON rule_evaluation_results(tenant_id);
CREATE INDEX idx_rule_evaluation_results_agreement ON rule_evaluation_results(agreement_id);
CREATE INDEX idx_rule_evaluation_results_etapa ON rule_evaluation_results(etapa);
CREATE INDEX idx_rule_evaluation_results_created ON rule_evaluation_results(created_at DESC);

-- ============================================================================
-- 6. CONFLICTO_INTERES TABLE — Conflict of interest tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS conflicto_interes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agreement_id UUID NOT NULL,
  mandate_id UUID NOT NULL,
  tipo TEXT NOT NULL,                           -- EXCLUIR_QUORUM, EXCLUIR_VOTO, EXCLUIR_AMBOS
  motivo TEXT,                                  -- Reason for conflict (optional)
  capital_afectado NUMERIC,                     -- Capital affected (optional)
  resuelto_por UUID,                            -- User who resolved the conflict (optional)
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT conflicto_interes_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT conflicto_interes_agreement_fk FOREIGN KEY (agreement_id) REFERENCES public.agreements(id) ON DELETE CASCADE,
  CONSTRAINT conflicto_interes_mandate_fk FOREIGN KEY (mandate_id) REFERENCES public.mandates(id) ON DELETE CASCADE,
  CONSTRAINT conflicto_interes_tipo_check CHECK (tipo IN ('EXCLUIR_QUORUM', 'EXCLUIR_VOTO', 'EXCLUIR_AMBOS'))
);

ALTER TABLE conflicto_interes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conflicto_interes_tenant_isolation" ON conflicto_interes FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX idx_conflicto_interes_tenant ON conflicto_interes(tenant_id);
CREATE INDEX idx_conflicto_interes_agreement ON conflicto_interes(agreement_id);
CREATE INDEX idx_conflicto_interes_mandate ON conflicto_interes(mandate_id);

-- ============================================================================
-- 7. ALTER EXISTING TABLES — Add rule engine columns
-- ============================================================================

-- ALTER agreements table
ALTER TABLE IF EXISTS public.agreements
  ADD COLUMN IF NOT EXISTS rule_pack_id TEXT REFERENCES rule_packs(id),
  ADD COLUMN IF NOT EXISTS rule_pack_version TEXT,
  ADD COLUMN IF NOT EXISTS compliance_explain JSONB,
  ADD COLUMN IF NOT EXISTS gate_hash TEXT;

-- ALTER entities table
ALTER TABLE IF EXISTS public.entities
  ADD COLUMN IF NOT EXISTS forma_administracion TEXT DEFAULT 'CONSEJO'
    CONSTRAINT forma_administracion_check CHECK (forma_administracion IN ('ADMINISTRADOR_UNICO', 'ADMINISTRADORES_SOLIDARIOS', 'ADMINISTRADORES_MANCOMUNADOS', 'CONSEJO')),
  ADD COLUMN IF NOT EXISTS es_unipersonal BOOLEAN DEFAULT false;

-- ============================================================================
-- 8. SEED DATA — Demo rule packs (optional, for T1)
-- ============================================================================

-- Insert demo rule packs
INSERT INTO rule_packs (id, tenant_id, descripcion, materia, organo_tipo, created_at)
VALUES
  ('APROBACION_CUENTAS', '00000000-0000-0000-0000-000000000001'::uuid, 'Aprobación de Cuentas Anuales', 'APROBACION_CUENTAS', 'JUNTA_GENERAL', now()),
  ('NOMBRAMIENTO_CONSEJERO', '00000000-0000-0000-0000-000000000001'::uuid, 'Nombramiento de Consejero', 'NOMBRAMIENTO', 'JUNTA_GENERAL', now()),
  ('DISTRIBUCION_DIVIDENDOS', '00000000-0000-0000-0000-000000000001'::uuid, 'Distribución de Dividendos', 'DISTRIBUCION_DIVIDENDOS', 'JUNTA_GENERAL', now())
ON CONFLICT (id) DO NOTHING;

-- Insert demo rule pack versions
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active, created_at)
VALUES
  (
    'APROBACION_CUENTAS',
    '1.0.0',
    jsonb_build_object(
      'id', 'APROBACION_CUENTAS',
      'version', '1.0.0',
      'materia', 'APROBACION_CUENTAS',
      'reglas', jsonb_build_array(
        jsonb_build_object('codigo', 'AC-001', 'descripcion', 'Quórum mínimo requerido'),
        jsonb_build_object('codigo', 'AC-002', 'descripcion', 'Mayoría simple requerida'),
        jsonb_build_object('codigo', 'AC-003', 'descripcion', 'Conflicto de interés exclusión voto')
      )
    ),
    true,
    now()
  )
ON CONFLICT (pack_id, version) DO NOTHING;

-- ============================================================================
-- 9. GRANTS — Ensure proper access
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON rule_packs TO authenticated;
GRANT SELECT ON rule_pack_versions TO authenticated;
GRANT SELECT, INSERT ON rule_param_overrides TO authenticated;
GRANT SELECT, INSERT ON rule_evaluation_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conflicto_interes TO authenticated;

-- ============================================================================
-- 10. COMMENTS — Documentation
-- ============================================================================

COMMENT ON TABLE rule_packs IS 'Registry of available corporate law rule packs (Motor de Reglas LSC)';
COMMENT ON TABLE rule_pack_versions IS 'Immutable semantic-versioned snapshots of rule packs';
COMMENT ON TABLE rule_param_overrides IS 'Tenant and entity-specific parameter overrides (LEY, ESTATUTOS, etc.)';
COMMENT ON TABLE rule_evaluation_results IS 'WORM audit trail of rule evaluations per agreement phase';
COMMENT ON TABLE conflicto_interes IS 'Conflict of interest declarations and resolutions';

COMMENT ON COLUMN rule_packs.materia IS 'Legal domain: APROBACION_CUENTAS, NOMBRAMIENTO, DISTRIBUCION_DIVIDENDOS, etc.';
COMMENT ON COLUMN rule_packs.organo_tipo IS 'Optional organ-specific scope: JUNTA_GENERAL, CONSEJO_ADMINISTRACION, etc.';
COMMENT ON COLUMN rule_pack_versions.payload IS 'Full RulePack JSON: { id, version, materia, reglas: [{ codigo, descripcion, ... }] }';
COMMENT ON COLUMN rule_evaluation_results.ok IS 'Compliance result: true = pass, false = fail/blocks';
COMMENT ON COLUMN rule_evaluation_results.explain IS 'Detailed findings: { passed: [...], failed: [...], warnings: [...] }';
COMMENT ON COLUMN conflicto_interes.tipo IS 'Exclusion type: EXCLUIR_QUORUM (no contar), EXCLUIR_VOTO (no votar), EXCLUIR_AMBOS';
COMMENT ON COLUMN entities.forma_administracion IS 'Admin structure per LSC: ADMINISTRADOR_UNICO, ADMINISTRADORES_SOLIDARIOS, MANCOMUNADOS, CONSEJO';
COMMENT ON COLUMN agreements.gate_hash IS 'Immutable hash of compliance_explain snapshot at adoption';
