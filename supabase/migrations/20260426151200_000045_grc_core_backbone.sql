-- ============================================================
-- Migration 20260426_000045 — GRC Core persistent backbone
-- ============================================================
-- Release 1 base: persistent GRC domain tables plus cross-module contracts.
-- GRC is the transversal ledger for obligation -> risk -> control -> evidence
-- -> finding/action/reporting. Secretaria and AIMS remain source-of-record for
-- their own objects and only link through governed events and evidence bundles.

CREATE EXTENSION IF NOT EXISTS pgcrypto

-- Keep the shared WORM ledger usable by Secretaria, AIMS and GRC. Migration
-- 000043 adds these too; repeating them here keeps this migration safe if the
-- GRC backbone is reviewed independently in a fresh local database.
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

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_reference_code
  ON evidence_bundles (tenant_id, reference_code)
  WHERE reference_code IS NOT NULL

-- ---------------------------------------------------------------------------
-- GRC master data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS grc_modules (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  state text NOT NULL DEFAULT 'Planificado',
  route text,
  regulations jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner text NOT NULL,
  open_issues integer NOT NULL DEFAULT 0,
  critical_risks integer NOT NULL DEFAULT 0,
  control_coverage integer NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  next_milestone text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
)

CREATE TABLE IF NOT EXISTS grc_obligations (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  module_id text NOT NULL,
  framework text NOT NULL,
  reference text NOT NULL,
  obligation text NOT NULL,
  owner text NOT NULL,
  status text NOT NULL DEFAULT 'Pendiente',
  severity text NOT NULL DEFAULT 'Medio',
  authority text,
  legal_basis jsonb NOT NULL DEFAULT '{}'::jsonb,
  retention_policy_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, module_id) REFERENCES grc_modules(tenant_id, id) ON DELETE CASCADE
)

CREATE TABLE IF NOT EXISTS grc_risks (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  module_id text NOT NULL,
  obligation_id text,
  title text NOT NULL,
  description text,
  inherent_severity text NOT NULL DEFAULT 'Medio',
  residual_severity text NOT NULL DEFAULT 'Medio',
  owner text NOT NULL,
  status text NOT NULL DEFAULT 'Pendiente',
  appetite_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, module_id) REFERENCES grc_modules(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, obligation_id) REFERENCES grc_obligations(tenant_id, id) ON DELETE SET NULL
)

CREATE TABLE IF NOT EXISTS grc_controls (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  module_id text NOT NULL,
  obligation_id text,
  risk_id text,
  name text NOT NULL,
  description text,
  owner text NOT NULL,
  frequency text,
  status text NOT NULL DEFAULT 'Pendiente',
  evidence_required jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, module_id) REFERENCES grc_modules(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, obligation_id) REFERENCES grc_obligations(tenant_id, id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, risk_id) REFERENCES grc_risks(tenant_id, id) ON DELETE SET NULL
)

CREATE TABLE IF NOT EXISTS grc_control_tests (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  control_id text NOT NULL,
  module_id text NOT NULL,
  status text NOT NULL DEFAULT 'Pendiente',
  result text,
  executed_by text,
  executed_at timestamptz,
  next_test_at timestamptz,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  legal_hold boolean NOT NULL DEFAULT false,
  retention_until date,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, control_id) REFERENCES grc_controls(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, module_id) REFERENCES grc_modules(tenant_id, id) ON DELETE CASCADE
)

CREATE TABLE IF NOT EXISTS grc_evidence_links (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  module_id text NOT NULL,
  evidence_bundle_id uuid REFERENCES evidence_bundles(id) ON DELETE SET NULL,
  title text NOT NULL,
  object_type text NOT NULL,
  linked_object text NOT NULL,
  hash_sha512 text,
  retention text NOT NULL,
  legal_hold boolean NOT NULL DEFAULT false,
  owner text NOT NULL,
  status text NOT NULL DEFAULT 'Pendiente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, module_id) REFERENCES grc_modules(tenant_id, id) ON DELETE CASCADE
)

CREATE TABLE IF NOT EXISTS grc_access_controls (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  role text NOT NULL,
  scope text NOT NULL,
  permissions text NOT NULL,
  incompatible_with text NOT NULL,
  evidence text NOT NULL,
  status text NOT NULL DEFAULT 'Pendiente',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
)

CREATE TABLE IF NOT EXISTS grc_retention_policies (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  object_type text NOT NULL,
  regulatory_basis text NOT NULL,
  retention text NOT NULL,
  legal_hold_rule text NOT NULL,
  purge_mode text NOT NULL DEFAULT 'Dry-run',
  next_run date,
  status text NOT NULL DEFAULT 'Pendiente',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
)

CREATE TABLE IF NOT EXISTS grc_workflows (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  module_id text NOT NULL,
  title text NOT NULL,
  legal_basis text NOT NULL,
  "trigger" text NOT NULL,
  clock text NOT NULL,
  due_at timestamptz,
  owner text NOT NULL,
  decision_gate text NOT NULL,
  legal_hold_trigger text NOT NULL,
  evidence_required jsonb NOT NULL DEFAULT '[]'::jsonb,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  progress integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'Medio',
  status text NOT NULL DEFAULT 'Pendiente',
  secretary_output text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, module_id) REFERENCES grc_modules(tenant_id, id) ON DELETE CASCADE
)

CREATE TABLE IF NOT EXISTS grc_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id text NOT NULL,
  module_id text NOT NULL,
  event_type text NOT NULL,
  event_status text NOT NULL DEFAULT 'OPEN',
  actor text,
  due_at timestamptz,
  evidence_bundle_id uuid REFERENCES evidence_bundles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, workflow_id) REFERENCES grc_workflows(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, module_id) REFERENCES grc_modules(tenant_id, id) ON DELETE CASCADE
)

CREATE TABLE IF NOT EXISTS grc_third_parties (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  provider text NOT NULL,
  service text NOT NULL,
  criticality text NOT NULL,
  cloud_exposure text NOT NULL,
  regulatory_basis text NOT NULL,
  due_diligence text NOT NULL DEFAULT 'Pendiente',
  contract_clauses text NOT NULL DEFAULT 'Pendiente',
  exit_plan text NOT NULL DEFAULT 'Pendiente',
  next_review date,
  legal_hold boolean NOT NULL DEFAULT false,
  owner text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
)

CREATE TABLE IF NOT EXISTS grc_audit_standards (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  domain text NOT NULL,
  principle text NOT NULL,
  standard_ref text NOT NULL,
  evidence text NOT NULL,
  mapping_2017 text NOT NULL,
  owner text NOT NULL,
  status text NOT NULL DEFAULT 'Pendiente',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
)

CREATE TABLE IF NOT EXISTS grc_risk_appetite (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  risk_category text NOT NULL,
  appetite text NOT NULL,
  metric text NOT NULL,
  threshold text NOT NULL,
  approval text NOT NULL,
  linked_committee text NOT NULL,
  status text NOT NULL DEFAULT 'Pendiente',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
)

CREATE TABLE IF NOT EXISTS grc_alerts (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  module_id text NOT NULL,
  title text NOT NULL,
  "trigger" text NOT NULL,
  due_at date,
  severity text NOT NULL DEFAULT 'Medio',
  status text NOT NULL DEFAULT 'Pendiente',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, module_id) REFERENCES grc_modules(tenant_id, id) ON DELETE CASCADE
)

CREATE TABLE IF NOT EXISTS grc_work_items (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id text NOT NULL,
  module_id text NOT NULL,
  title text NOT NULL,
  assignee text NOT NULL,
  due_at date,
  status text NOT NULL DEFAULT 'Pendiente',
  severity text NOT NULL DEFAULT 'Medio',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, module_id) REFERENCES grc_modules(tenant_id, id) ON DELETE CASCADE
)

-- ---------------------------------------------------------------------------
-- Cross-module contracts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS governance_module_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_module text NOT NULL,
  source_object_type text NOT NULL,
  source_object_id text NOT NULL,
  target_module text NOT NULL,
  target_object_type text,
  target_object_id text,
  relation_type text NOT NULL,
  status text NOT NULL DEFAULT 'PROPOSED',
  evidence_bundle_id uuid REFERENCES evidence_bundles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_module, source_object_type, source_object_id, target_module, relation_type)
)

CREATE TABLE IF NOT EXISTS governance_module_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_module text NOT NULL,
  event_type text NOT NULL,
  event_status text NOT NULL DEFAULT 'OPEN',
  target_module text,
  source_object_type text,
  source_object_id text,
  target_object_type text,
  target_object_id text,
  evidence_bundle_id uuid REFERENCES evidence_bundles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
)

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_grc_obligations_module_status ON grc_obligations (tenant_id, module_id, status)

CREATE INDEX IF NOT EXISTS idx_grc_risks_module_status ON grc_risks (tenant_id, module_id, status)

CREATE INDEX IF NOT EXISTS idx_grc_controls_module_status ON grc_controls (tenant_id, module_id, status)

CREATE INDEX IF NOT EXISTS idx_grc_control_tests_control_status ON grc_control_tests (tenant_id, control_id, status)

CREATE INDEX IF NOT EXISTS idx_grc_evidence_links_module_status ON grc_evidence_links (tenant_id, module_id, status)

CREATE INDEX IF NOT EXISTS idx_grc_workflows_module_status ON grc_workflows (tenant_id, module_id, status)

CREATE INDEX IF NOT EXISTS idx_grc_workflow_events_due ON grc_workflow_events (tenant_id, due_at, event_status)

CREATE INDEX IF NOT EXISTS idx_grc_third_parties_criticality ON grc_third_parties (tenant_id, criticality)

CREATE INDEX IF NOT EXISTS idx_governance_module_links_source ON governance_module_links (tenant_id, source_module, source_object_type, source_object_id)

CREATE INDEX IF NOT EXISTS idx_governance_module_links_target ON governance_module_links (tenant_id, target_module, target_object_type, target_object_id)

CREATE INDEX IF NOT EXISTS idx_governance_module_events_source ON governance_module_events (tenant_id, source_module, event_type, event_status)

CREATE UNIQUE INDEX IF NOT EXISTS ux_governance_module_events_natural_key
  ON governance_module_events (
    tenant_id,
    source_module,
    event_type,
    COALESCE(source_object_type, ''),
    COALESCE(source_object_id, ''),
    COALESCE(target_module, '')
  )

-- ---------------------------------------------------------------------------
-- RLS: demo tenant isolation. This mirrors the current project pattern while
-- keeping the schema ready for real auth policies later.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'grc_modules',
    'grc_obligations',
    'grc_risks',
    'grc_controls',
    'grc_control_tests',
    'grc_evidence_links',
    'grc_access_controls',
    'grc_retention_policies',
    'grc_workflows',
    'grc_workflow_events',
    'grc_third_parties',
    'grc_audit_standards',
    'grc_risk_appetite',
    'grc_alerts',
    'grc_work_items',
    'governance_module_links',
    'governance_module_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_tenant_isolation', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (tenant_id = %L::uuid) WITH CHECK (tenant_id = %L::uuid)',
      tbl || '_tenant_isolation',
      tbl,
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    );
  END LOOP;
END $$

GRANT SELECT, INSERT, UPDATE ON
  grc_modules,
  grc_obligations,
  grc_risks,
  grc_controls,
  grc_control_tests,
  grc_evidence_links,
  grc_access_controls,
  grc_retention_policies,
  grc_workflows,
  grc_workflow_events,
  grc_third_parties,
  grc_audit_standards,
  grc_risk_appetite,
  grc_alerts,
  grc_work_items,
  governance_module_links,
  governance_module_events
TO authenticated

-- ---------------------------------------------------------------------------
-- RPC: create a shared governance evidence bundle from any module.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_create_governance_evidence_bundle(
  p_tenant_id uuid,
  p_source_module text,
  p_source_object_type text,
  p_source_object_id text,
  p_reference_code text,
  p_manifest jsonb,
  p_document_url text DEFAULT NULL,
  p_legal_hold boolean DEFAULT false,
  p_status text DEFAULT 'SEALED',
  p_signed_by text DEFAULT 'EAD Trust Digital Trust API'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bundle_id uuid;
  v_manifest jsonb;
  v_manifest_hash text;
  v_hash_sha512 text;
BEGIN
  IF p_status NOT IN ('OPEN', 'SEALED', 'VERIFIED') THEN
    RAISE EXCEPTION 'Unsupported evidence bundle status: %', p_status;
  END IF;

  v_manifest := jsonb_build_object(
    'sourceModule', p_source_module,
    'sourceObjectType', p_source_object_type,
    'sourceObjectId', p_source_object_id,
    'referenceCode', p_reference_code,
    'payload', COALESCE(p_manifest, '{}'::jsonb),
    'createdAt', now(),
    'qtsp', jsonb_build_object('provider', 'EAD Trust')
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
    status,
    document_url,
    signed_by,
    signature_date,
    chain_of_custody,
    legal_hold
  ) VALUES (
    p_tenant_id,
    NULL,
    p_source_module,
    p_source_object_type,
    p_source_object_id,
    p_reference_code,
    v_manifest,
    v_manifest_hash,
    v_hash_sha512,
    p_status,
    p_document_url,
    p_signed_by,
    CASE WHEN p_status IN ('SEALED', 'VERIFIED') THEN now() ELSE NULL END,
    jsonb_build_array(jsonb_build_object(
      'event', 'GOVERNANCE_EVIDENCE_BUNDLE_CREATED',
      'ts', now(),
      'actor', p_signed_by,
      'sourceModule', p_source_module,
      'manifestHash', v_manifest_hash
    )),
    p_legal_hold
  )
  RETURNING id INTO v_bundle_id;

  RETURN jsonb_build_object(
    'evidence_bundle_id', v_bundle_id,
    'manifest_hash', v_manifest_hash,
    'hash_sha512', v_hash_sha512,
    'status', p_status
  );
END;
$$

GRANT EXECUTE ON FUNCTION fn_create_governance_evidence_bundle(uuid, text, text, text, text, jsonb, text, boolean, text, text)
  TO authenticated, service_role
