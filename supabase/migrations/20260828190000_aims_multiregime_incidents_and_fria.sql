-- ============================================================
-- Migration 20260828_190000 — AIMS 360 Multiregime Incidents & FRIA
-- ============================================================
-- Implements:
-- 1. Multiregime Incident Subcases (incident_regime_case) with Closure Isolation
-- 2. Regulatory Clocks (RIA 15d/2d/10d, GDPR 72h, DORA 4h/24h/72h/1m)
-- 3. Incident Notification Reports and Authority Acknowledgments
-- 4. Fundamental Rights Impact Assessment (FRIA - Art. 27 RIA) 6 components
-- 5. FRIA - DPIA Cross References with hash binding (Art. 27.4 RIA & Art. 35 GDPR)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Multiregime Incident Cases & Clocks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aims_incident_regimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES ai_incidents(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  regime_code text NOT NULL, -- 'RIA', 'GDPR', 'DORA'
  status text NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'IN_INVESTIGATION', 'NOTIFIED', 'NOT_APPLICABLE_JUSTIFIED', 'CLOSED'
  applicability_rationale text,
  target_authority text NOT NULL, -- 'AESIA', 'AEPD', 'DGSFP_BCE', 'CSIRT'
  lead_role text NOT NULL, -- 'AI_OFFICER', 'DPO', 'CISO', 'LEGAL'
  closed_at timestamptz,
  closure_reason text,
  evidence_bundle_id uuid REFERENCES evidence_bundles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, incident_id, regime_code)
);

COMMENT ON TABLE aims_incident_regimes IS 'Independent subcases per regulatory regime for an incident (Closure Isolation principle).';

CREATE TABLE IF NOT EXISTS aims_regulatory_clocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_regime_id uuid NOT NULL REFERENCES aims_incident_regimes(id) ON DELETE CASCADE,
  clock_type text NOT NULL, -- 'RIA_ORDINARY_15D', 'RIA_URGENT_2D', 'RIA_DEATH_10D', 'GDPR_72H', 'GDPR_SUBJECT_NOTICE', 'DORA_INITIAL_4H', 'DORA_INTERMEDIATE_72H', 'DORA_FINAL_30D'
  trigger_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING', -- 'RUNNING', 'SATISFIED', 'EXPIRED', 'PAUSED_JUSTIFIED'
  delay_justification text,
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE aims_regulatory_clocks IS 'Calculated per-regime deadlines and alerts for incident notification compliance.';

CREATE TABLE IF NOT EXISTS aims_incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_regime_id uuid NOT NULL REFERENCES aims_incident_regimes(id) ON DELETE CASCADE,
  report_type text NOT NULL, -- 'INITIAL', 'INTERMEDIATE', 'FINAL', 'DELAY_JUSTIFICATION', 'NON_APPLICABILITY'
  authority text NOT NULL,
  sent_at timestamptz,
  submission_channel text, -- 'AESIA_SEDE', 'AEPD_SEDE', 'DGSFP_SEDE', 'ERDS_EADTRUST'
  acknowledgment_ref text,
  is_complete boolean NOT NULL DEFAULT true,
  content_summary text,
  manifest_hash text,
  qseal_token text,
  tsq_token text,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE aims_incident_reports IS 'Formal regulatory notification reports and submissions per regime with proof of delivery.';

-- ---------------------------------------------------------------------------
-- 2. Fundamental Rights Impact Assessment (FRIA - Art. 27 RIA)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aims_fria_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
  version_id uuid REFERENCES aims_system_versions(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED'
  version_number int NOT NULL DEFAULT 1,
  assessed_by text,
  approved_by_dpo text,
  approved_by_ai_officer text,
  fria_summary text,
  market_surveillance_notified boolean NOT NULL DEFAULT false,
  notification_date timestamptz,
  qseal_token text,
  tsq_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE aims_fria_assessments IS 'Header for Art. 27 RIA Fundamental Rights Impact Assessments.';

-- Art. 27.1(a): Process Map
CREATE TABLE IF NOT EXISTS aims_fria_process_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fria_id uuid NOT NULL REFERENCES aims_fria_assessments(id) ON DELETE CASCADE,
  business_process text NOT NULL,
  intended_purpose text NOT NULL,
  decision_point text NOT NULL,
  human_role text,
  integration_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Art. 27.1(b): Use Profile & Frequency
CREATE TABLE IF NOT EXISTS aims_fria_use_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fria_id uuid NOT NULL REFERENCES aims_fria_assessments(id) ON DELETE CASCADE,
  planned_start_date date,
  planned_end_date date,
  usage_frequency text NOT NULL, -- 'CONTINUOUS', 'BATCH_DAILY', 'ON_DEMAND', 'SEASONAL'
  estimated_volume text,
  review_periodicity text DEFAULT 'ANNUAL',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Art. 27.1(c): Affected Categories & Vulnerable Groups
CREATE TABLE IF NOT EXISTS aims_fria_affected_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fria_id uuid NOT NULL REFERENCES aims_fria_assessments(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  group_description text,
  impact_type text NOT NULL DEFAULT 'DIRECT', -- 'DIRECT', 'INDIRECT'
  is_vulnerable_group boolean NOT NULL DEFAULT false,
  vulnerability_factors text,
  is_data_subject_only boolean NOT NULL DEFAULT false, -- true if only GDPR data subjects; false if broader affected non-subjects
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Art. 27.1(d): Specific Fundamental Rights Harm Scenarios
CREATE TABLE IF NOT EXISTS aims_fria_fundamental_rights_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fria_id uuid NOT NULL REFERENCES aims_fria_assessments(id) ON DELETE CASCADE,
  fundamental_right text NOT NULL, -- 'NON_DISCRIMINATION', 'HUMAN_DIGNITY', 'PRIVACY', 'FAIR_TRIAL', 'FREEDOM_EXPRESSION', 'CONSUMER_PROTECTION'
  harm_scenario text NOT NULL,
  provider_info_ref text,
  likelihood text NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
  severity text NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  mitigation_measures text,
  residual_risk text NOT NULL DEFAULT 'LOW',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Art. 27.1(f): Remediation Governance, Complaints & Redress
CREATE TABLE IF NOT EXISTS aims_fria_remediation_governance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fria_id uuid NOT NULL REFERENCES aims_fria_assessments(id) ON DELETE CASCADE,
  trigger_event text NOT NULL,
  governance_body text NOT NULL DEFAULT 'COMITE_RIESGOS',
  complaint_channel text NOT NULL,
  redress_procedure text NOT NULL,
  rollback_strategy text,
  board_escalation_threshold text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. FRIA - DPIA Cross Reference Bridge (Art. 27.4 RIA & Art. 35 GDPR)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aims_fria_dpia_cross_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fria_id uuid NOT NULL REFERENCES aims_fria_assessments(id) ON DELETE CASCADE,
  dpia_ref_id text NOT NULL, -- Reference ID to GRC / Privacy DPIA document
  ria_obligation_point text NOT NULL, -- 'ART_27_1_A', 'ART_27_1_C', 'ART_27_1_D', 'ART_27_1_F'
  dpia_section text NOT NULL,
  coverage_type text NOT NULL DEFAULT 'PARTIAL', -- 'FULL', 'PARTIAL'
  source_hash text,
  validation_status text NOT NULL DEFAULT 'VALID', -- 'VALID', 'IN_REVIEW', 'REVOKED'
  dpo_signoff_by text,
  ai_officer_signoff_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE aims_fria_dpia_cross_references IS 'Versioned cross-reference bindings between Art. 27 FRIA and Art. 35 GDPR DPIA.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_aims_incident_regimes_incident ON aims_incident_regimes (incident_id);
CREATE INDEX IF NOT EXISTS idx_aims_regulatory_clocks_regime ON aims_regulatory_clocks (incident_regime_id);
CREATE INDEX IF NOT EXISTS idx_aims_incident_reports_regime ON aims_incident_reports (incident_regime_id);
CREATE INDEX IF NOT EXISTS idx_aims_fria_assessments_system ON aims_fria_assessments (system_id);
CREATE INDEX IF NOT EXISTS idx_aims_fria_xref_fria ON aims_fria_dpia_cross_references (fria_id);

-- ---------------------------------------------------------------------------
-- RLS Tenant Isolation (00000000-0000-0000-0000-000000000001)
-- ---------------------------------------------------------------------------

ALTER TABLE aims_incident_regimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aims_regulatory_clocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE aims_incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE aims_fria_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE aims_fria_process_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE aims_fria_use_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE aims_fria_affected_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE aims_fria_fundamental_rights_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE aims_fria_remediation_governance ENABLE ROW LEVEL SECURITY;
ALTER TABLE aims_fria_dpia_cross_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY aims_incident_regimes_tenant_isolation ON aims_incident_regimes
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY aims_regulatory_clocks_tenant_isolation ON aims_regulatory_clocks
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY aims_incident_reports_tenant_isolation ON aims_incident_reports
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY aims_fria_assessments_tenant_isolation ON aims_fria_assessments
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY aims_fria_process_map_tenant_isolation ON aims_fria_process_map
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY aims_fria_use_profile_tenant_isolation ON aims_fria_use_profile
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY aims_fria_affected_groups_tenant_isolation ON aims_fria_affected_groups
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY aims_fria_fundamental_rights_risks_tenant_isolation ON aims_fria_fundamental_rights_risks
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY aims_fria_remediation_governance_tenant_isolation ON aims_fria_remediation_governance
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY aims_fria_dpia_cross_references_tenant_isolation ON aims_fria_dpia_cross_references
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
