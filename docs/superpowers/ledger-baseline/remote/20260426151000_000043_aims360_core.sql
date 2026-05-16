-- ============================================================
-- Migration 20260426_000043 — AIMS 360 core persistence
-- ============================================================
-- Minimal persistent schema for AIMS 360. The existing ai_systems table remains
-- the system-of-record for the AI system header; AIMS tables add versioned
-- inventory, requirements, controls, monitoring and evidence packs.

CREATE EXTENSION IF NOT EXISTS pgcrypto

-- Existing TGMS AI table is kept as the system header. This reference code
-- preserves the product-facing AIMS identifier (AIS-ARGA-001) while the
-- database keeps `ai_systems.id` as UUID.
ALTER TABLE ai_systems
  ADD COLUMN IF NOT EXISTS aims_reference_code text

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_systems_tenant_aims_reference_code
  ON ai_systems (tenant_id, aims_reference_code)
  WHERE aims_reference_code IS NOT NULL

-- Evidence bundles started as agreement-centric. AIMS/GRC use the same WORM
-- ledger as a transversal ledger, so agreement_id must be optional while new
-- source columns identify the governed object.
ALTER TABLE evidence_bundles
  ALTER COLUMN agreement_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS source_module text,
  ADD COLUMN IF NOT EXISTS source_object_type text,
  ADD COLUMN IF NOT EXISTS source_object_id text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS hash_sha512 text,
  ADD COLUMN IF NOT EXISTS signed_by text,
  ADD COLUMN IF NOT EXISTS signature_date timestamptz,
  ADD COLUMN IF NOT EXISTS chain_of_custody jsonb,
  ADD COLUMN IF NOT EXISTS legal_hold boolean DEFAULT false

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_source
  ON evidence_bundles (tenant_id, source_module, source_object_type, source_object_id)

-- ---------------------------------------------------------------------------
-- System inventory and technical baseline
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aims_system_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  release_stage text NOT NULL DEFAULT 'DRAFT',
  status text NOT NULL DEFAULT 'ACTIVE',
  effective_from date,
  effective_to date,
  change_summary text,
  model_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  dataset_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  control_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  technical_file_status text NOT NULL DEFAULT 'PENDING',
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, system_id, version_label)
)

COMMENT ON TABLE aims_system_versions IS 'Versioned AIMS releases for each AI system.'

CREATE TABLE IF NOT EXISTS aims_component_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  component_name text NOT NULL,
  component_type text NOT NULL,
  supplier text,
  owner_role text,
  criticality text,
  status text NOT NULL DEFAULT 'ACTIVE',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

COMMENT ON TABLE aims_component_inventory IS 'AIMS components, guardrails, services and integrations per system/version.'

CREATE TABLE IF NOT EXISTS aims_dataset_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  dataset_name text NOT NULL,
  dataset_type text,
  source_system text,
  lawful_basis text,
  data_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  lineage jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

COMMENT ON TABLE aims_dataset_registry IS 'Datasets used to train, validate, test or operate AIMS systems.'

CREATE TABLE IF NOT EXISTS aims_model_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  model_name text NOT NULL,
  model_type text,
  provider text,
  model_version text,
  intended_use text,
  performance_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

COMMENT ON TABLE aims_model_registry IS 'Model registry for AIMS technical file reconstruction.'

-- ---------------------------------------------------------------------------
-- Requirements, controls and tests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aims_requirement_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  framework text NOT NULL,
  requirement_code text NOT NULL,
  article_ref text,
  title text NOT NULL,
  description text,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, framework, requirement_code)
)

COMMENT ON TABLE aims_requirement_catalog IS 'Operational AI Act and ISO/IEC 42001 requirement catalog.'

CREATE TABLE IF NOT EXISTS aims_requirement_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  requirement_id uuid NOT NULL REFERENCES aims_requirement_catalog(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING',
  result text,
  assessed_by_id uuid REFERENCES persons(id),
  checked_at timestamptz,
  due_at timestamptz,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

CREATE UNIQUE INDEX IF NOT EXISTS ux_aims_requirement_checks_scope
  ON aims_requirement_checks (tenant_id, system_id, COALESCE(version_id, '00000000-0000-0000-0000-000000000000'::uuid), requirement_id)

COMMENT ON TABLE aims_requirement_checks IS 'Per-system evidence-backed requirement checks.'

CREATE TABLE IF NOT EXISTS aims_control_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  control_code text NOT NULL,
  name text NOT NULL,
  domain text,
  description text,
  owner_role text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, control_code)
)

COMMENT ON TABLE aims_control_catalog IS 'Reusable AIMS control catalog for AI-specific safeguards.'

CREATE TABLE IF NOT EXISTS aims_control_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  control_id uuid NOT NULL REFERENCES aims_control_catalog(id) ON DELETE CASCADE,
  requirement_check_id uuid REFERENCES aims_requirement_checks(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING',
  result text,
  executed_by_id uuid REFERENCES persons(id),
  executed_at timestamptz,
  next_test_at timestamptz,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

CREATE UNIQUE INDEX IF NOT EXISTS ux_aims_control_tests_scope
  ON aims_control_tests (tenant_id, system_id, COALESCE(version_id, '00000000-0000-0000-0000-000000000000'::uuid), control_id)

COMMENT ON TABLE aims_control_tests IS 'Control test executions and evidence references for AIMS.'

-- ---------------------------------------------------------------------------
-- Post-market monitoring and change management
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aims_post_market_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  plan_name text NOT NULL,
  cadence text,
  monitoring_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT',
  approved_by_id uuid REFERENCES persons(id),
  approved_at timestamptz,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

COMMENT ON TABLE aims_post_market_plans IS 'Post-market monitoring plans for production AI systems.'

CREATE TABLE IF NOT EXISTS aims_monitoring_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES aims_post_market_plans(id) ON DELETE SET NULL,
  indicator_name text NOT NULL,
  metric_key text,
  threshold_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'OK',
  last_observed_at timestamptz,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

COMMENT ON TABLE aims_monitoring_indicators IS 'Operational and compliance indicators for AIMS post-market surveillance.'

CREATE TABLE IF NOT EXISTS aims_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  source_version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  target_version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  title text NOT NULL,
  change_type text,
  status text NOT NULL DEFAULT 'OPEN',
  impact_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_by_id uuid REFERENCES persons(id),
  approved_by_id uuid REFERENCES persons(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

COMMENT ON TABLE aims_change_requests IS 'AIMS change control for model, dataset, component and control changes.'

-- ---------------------------------------------------------------------------
-- Technical file and evidence packs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aims_technical_file_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  section_code text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by_id uuid REFERENCES persons(id),
  reviewed_at timestamptz,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, system_id, version_id, section_code)
)

COMMENT ON TABLE aims_technical_file_sections IS 'Living technical file sections per AIMS system/version.'

CREATE TABLE IF NOT EXISTS aims_evidence_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  evidence_bundle_id uuid REFERENCES evidence_bundles(id) ON DELETE SET NULL,
  pack_type text NOT NULL DEFAULT 'TECHNICAL_FILE',
  title text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest_hash text,
  qseal_token text,
  tsq_token text,
  sealed_at timestamptz,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

COMMENT ON TABLE aims_evidence_packs IS 'AIMS evidence packs linked optionally to the TGMS evidence bundle ledger.'

CREATE TABLE IF NOT EXISTS aims_incident_evidence_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES ai_incidents(id) ON DELETE SET NULL,
  evidence_pack_id uuid REFERENCES aims_evidence_packs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN',
  severity text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  chain_of_custody jsonb NOT NULL DEFAULT '[]'::jsonb,
  manifest_hash text,
  reported_at timestamptz,
  closed_at timestamptz,
  legal_hold boolean NOT NULL DEFAULT true,
  retention_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

COMMENT ON TABLE aims_incident_evidence_packs IS 'Incident-specific AIMS evidence packs and chain-of-custody snapshots.'

-- ---------------------------------------------------------------------------
-- Indexes optimized for tenant, system and status filtering
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_aims_system_versions_tenant_system_status ON aims_system_versions (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_component_inventory_tenant_system_status ON aims_component_inventory (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_component_inventory_version ON aims_component_inventory (version_id)

CREATE INDEX IF NOT EXISTS idx_aims_dataset_registry_tenant_system_status ON aims_dataset_registry (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_dataset_registry_version ON aims_dataset_registry (version_id)

CREATE INDEX IF NOT EXISTS idx_aims_model_registry_tenant_system_status ON aims_model_registry (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_model_registry_version ON aims_model_registry (version_id)

CREATE INDEX IF NOT EXISTS idx_aims_requirement_catalog_tenant_framework_status ON aims_requirement_catalog (tenant_id, framework, status)

CREATE INDEX IF NOT EXISTS idx_aims_requirement_checks_tenant_system_status ON aims_requirement_checks (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_requirement_checks_requirement ON aims_requirement_checks (requirement_id)

CREATE INDEX IF NOT EXISTS idx_aims_control_catalog_tenant_domain_status ON aims_control_catalog (tenant_id, domain, status)

CREATE INDEX IF NOT EXISTS idx_aims_control_tests_tenant_system_status ON aims_control_tests (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_control_tests_control ON aims_control_tests (control_id)

CREATE INDEX IF NOT EXISTS idx_aims_post_market_plans_tenant_system_status ON aims_post_market_plans (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_monitoring_indicators_tenant_system_status ON aims_monitoring_indicators (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_monitoring_indicators_plan ON aims_monitoring_indicators (plan_id)

CREATE INDEX IF NOT EXISTS idx_aims_change_requests_tenant_system_status ON aims_change_requests (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_technical_file_sections_tenant_system_status ON aims_technical_file_sections (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_evidence_packs_tenant_system_status ON aims_evidence_packs (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_evidence_packs_bundle ON aims_evidence_packs (evidence_bundle_id)

CREATE INDEX IF NOT EXISTS idx_aims_incident_evidence_packs_tenant_system_status ON aims_incident_evidence_packs (tenant_id, system_id, status)

CREATE INDEX IF NOT EXISTS idx_aims_incident_evidence_packs_incident ON aims_incident_evidence_packs (incident_id)

-- ---------------------------------------------------------------------------
-- RLS: demo tenant isolation, matching the dominant domain-table pattern.
-- ---------------------------------------------------------------------------

ALTER TABLE aims_system_versions ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_component_inventory ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_dataset_registry ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_model_registry ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_requirement_catalog ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_requirement_checks ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_control_catalog ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_control_tests ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_post_market_plans ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_monitoring_indicators ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_change_requests ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_technical_file_sections ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_evidence_packs ENABLE ROW LEVEL SECURITY

ALTER TABLE aims_incident_evidence_packs ENABLE ROW LEVEL SECURITY

DROP POLICY IF EXISTS aims_system_versions_tenant_isolation ON aims_system_versions

CREATE POLICY aims_system_versions_tenant_isolation ON aims_system_versions
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_component_inventory_tenant_isolation ON aims_component_inventory

CREATE POLICY aims_component_inventory_tenant_isolation ON aims_component_inventory
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_dataset_registry_tenant_isolation ON aims_dataset_registry

CREATE POLICY aims_dataset_registry_tenant_isolation ON aims_dataset_registry
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_model_registry_tenant_isolation ON aims_model_registry

CREATE POLICY aims_model_registry_tenant_isolation ON aims_model_registry
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_requirement_catalog_tenant_isolation ON aims_requirement_catalog

CREATE POLICY aims_requirement_catalog_tenant_isolation ON aims_requirement_catalog
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_requirement_checks_tenant_isolation ON aims_requirement_checks

CREATE POLICY aims_requirement_checks_tenant_isolation ON aims_requirement_checks
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_control_catalog_tenant_isolation ON aims_control_catalog

CREATE POLICY aims_control_catalog_tenant_isolation ON aims_control_catalog
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_control_tests_tenant_isolation ON aims_control_tests

CREATE POLICY aims_control_tests_tenant_isolation ON aims_control_tests
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_post_market_plans_tenant_isolation ON aims_post_market_plans

CREATE POLICY aims_post_market_plans_tenant_isolation ON aims_post_market_plans
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_monitoring_indicators_tenant_isolation ON aims_monitoring_indicators

CREATE POLICY aims_monitoring_indicators_tenant_isolation ON aims_monitoring_indicators
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_change_requests_tenant_isolation ON aims_change_requests

CREATE POLICY aims_change_requests_tenant_isolation ON aims_change_requests
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_technical_file_sections_tenant_isolation ON aims_technical_file_sections

CREATE POLICY aims_technical_file_sections_tenant_isolation ON aims_technical_file_sections
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_evidence_packs_tenant_isolation ON aims_evidence_packs

CREATE POLICY aims_evidence_packs_tenant_isolation ON aims_evidence_packs
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

DROP POLICY IF EXISTS aims_incident_evidence_packs_tenant_isolation ON aims_incident_evidence_packs

CREATE POLICY aims_incident_evidence_packs_tenant_isolation ON aims_incident_evidence_packs
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)

-- ---------------------------------------------------------------------------
-- RPC: close an AIMS technical file into the shared WORM/QTSP evidence ledger.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_aims_close_technical_file(
  p_version_id uuid,
  p_qseal_token text DEFAULT NULL,
  p_tsq_token text DEFAULT NULL,
  p_signed_by text DEFAULT 'EAD Trust Digital Trust API'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version aims_system_versions%ROWTYPE;
  v_system ai_systems%ROWTYPE;
  v_pending_count integer;
  v_manifest jsonb;
  v_manifest_hash text;
  v_hash_sha512 text;
  v_bundle_id uuid;
  v_pack_id uuid;
  v_audit_id uuid;
BEGIN
  SELECT * INTO v_version
  FROM aims_system_versions
  WHERE id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AIMS version not found: %', p_version_id;
  END IF;

  SELECT * INTO v_system
  FROM ai_systems
  WHERE id = v_version.system_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AIMS system not found for version: %', p_version_id;
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM aims_technical_file_sections
  WHERE tenant_id = v_version.tenant_id
    AND version_id = v_version.id
    AND status IN ('PENDING', 'Pendiente', 'No conforme');

  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'technical file has % pending/non-conforming sections', v_pending_count;
  END IF;

  v_manifest := jsonb_build_object(
    'source', 'AIMS',
    'system', jsonb_build_object(
      'id', v_system.id,
      'referenceCode', v_system.aims_reference_code,
      'name', v_system.name,
      'riskLevel', v_system.risk_level,
      'status', v_system.status
    ),
    'version', jsonb_build_object(
      'id', v_version.id,
      'label', v_version.version_label,
      'releaseStage', v_version.release_stage,
      'modelSnapshot', v_version.model_snapshot,
      'datasetSnapshot', v_version.dataset_snapshot,
      'controlSnapshot', v_version.control_snapshot
    ),
    'technicalFileSections', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'code', section_code,
          'title', title,
          'status', status,
          'evidenceRefs', evidence_refs,
          'reviewedAt', reviewed_at
        )
        ORDER BY section_code
      ), '[]'::jsonb)
      FROM aims_technical_file_sections
      WHERE tenant_id = v_version.tenant_id
        AND version_id = v_version.id
    ),
    'requirementChecks', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'requirement', rc.requirement_code,
          'framework', rc.framework,
          'status', chk.status,
          'result', chk.result,
          'checkedAt', chk.checked_at,
          'evidenceRefs', chk.evidence_refs
        )
        ORDER BY rc.framework, rc.requirement_code
      ), '[]'::jsonb)
      FROM aims_requirement_checks chk
      JOIN aims_requirement_catalog rc ON rc.id = chk.requirement_id
      WHERE chk.tenant_id = v_version.tenant_id
        AND chk.version_id = v_version.id
    ),
    'closedAt', now(),
    'qtsp', jsonb_build_object(
      'provider', 'EAD Trust',
      'qsealToken', COALESCE(p_qseal_token, 'QSEAL-AIMS-' || substring(v_version.id::text, 1, 8)),
      'tsqToken', COALESCE(p_tsq_token, 'TSQ-AIMS-' || substring(v_version.id::text, 1, 8)),
      'signedBy', p_signed_by
    )
  );

  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');
  v_hash_sha512 := encode(digest(v_manifest::text, 'sha512'), 'hex');

  INSERT INTO evidence_bundles (
    tenant_id,
    agreement_id,
    source_module,
    source_object_type,
    source_object_id,
    reference_code,
    manifest,
    manifest_hash,
    hash_sha512,
    qseal_token,
    tsq_token,
    status,
    document_url,
    signed_by,
    signature_date,
    chain_of_custody,
    legal_hold
  ) VALUES (
    v_version.tenant_id,
    NULL,
    'AIMS',
    'aims_system_versions',
    v_version.id::text,
    COALESCE(v_system.aims_reference_code, v_system.id::text) || '-' || v_version.version_label,
    v_manifest,
    v_manifest_hash,
    v_hash_sha512,
    COALESCE(p_qseal_token, 'QSEAL-AIMS-' || substring(v_version.id::text, 1, 8)),
    COALESCE(p_tsq_token, 'TSQ-AIMS-' || substring(v_version.id::text, 1, 8)),
    'SEALED',
    'aims://technical-file/' || v_system.id::text || '/' || v_version.id::text,
    p_signed_by,
    now(),
    jsonb_build_array(jsonb_build_object(
      'event', 'AIMS_TECHNICAL_FILE_SEALED',
      'ts', now(),
      'actor', p_signed_by,
      'manifestHash', v_manifest_hash
    )),
    false
  )
  RETURNING id INTO v_bundle_id;

  INSERT INTO aims_evidence_packs (
    tenant_id,
    system_id,
    version_id,
    evidence_bundle_id,
    pack_type,
    title,
    status,
    manifest,
    manifest_hash,
    qseal_token,
    tsq_token,
    sealed_at,
    legal_hold,
    retention_until
  ) VALUES (
    v_version.tenant_id,
    v_version.system_id,
    v_version.id,
    v_bundle_id,
    'TECHNICAL_FILE',
    'Expediente tecnico AIMS ' || COALESCE(v_system.aims_reference_code, v_system.id::text) || ' ' || v_version.version_label,
    'SEALED',
    v_manifest,
    v_manifest_hash,
    COALESCE(p_qseal_token, 'QSEAL-AIMS-' || substring(v_version.id::text, 1, 8)),
    COALESCE(p_tsq_token, 'TSQ-AIMS-' || substring(v_version.id::text, 1, 8)),
    now(),
    false,
    (now() + interval '10 years')::date
  )
  RETURNING id INTO v_pack_id;

  UPDATE aims_system_versions
     SET technical_file_status = 'SEALED',
         updated_at = now()
   WHERE id = v_version.id;

  INSERT INTO audit_log (
    tenant_id, action, object_type, object_id, delta, legal_hold, retention_until
  ) VALUES (
    v_version.tenant_id,
    'AIMS_TECHNICAL_FILE_SEALED',
    'aims_system_versions',
    v_version.id,
    jsonb_build_object(
      'evidence_bundle_id', v_bundle_id,
      'aims_evidence_pack_id', v_pack_id,
      'manifest_hash', v_manifest_hash,
      'hash_sha512', v_hash_sha512,
      'source', 'AIMS'
    ),
    false,
    (now() + interval '10 years')::date
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'evidence_bundle_id', v_bundle_id,
    'aims_evidence_pack_id', v_pack_id,
    'audit_log_id', v_audit_id,
    'manifest_hash', v_manifest_hash,
    'hash_sha512', v_hash_sha512,
    'document_url', 'aims://technical-file/' || v_system.id::text || '/' || v_version.id::text,
    'status', 'SEALED'
  );
END;
$$

GRANT EXECUTE ON FUNCTION fn_aims_close_technical_file(uuid, text, text, text)
  TO authenticated, service_role
