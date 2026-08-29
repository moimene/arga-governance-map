-- ============================================================
-- Migration 20260828_190000 — AIMS 360 Multiregime Incidents & FRIA
-- ============================================================
-- REESCRITA EL 2026-08-29 (carril C2, fase B) ANTES DE SU PRIMERA APLICACIÓN.
-- La versión anterior estaba commiteada pero nunca aplicada, así que se corrige
-- en su sitio en vez de encadenar una migración de arreglo: dejar dos ficheros,
-- uno de los cuales no debe aplicarse jamás, es una trampa para quien ejecute
-- `db push`. Lo corregido:
--
--   * P0 — las diez políticas RLS HARDCODEABAN el tenant de ARGA
--     (`tenant_id = '00000000-…-0001'`). Aplicada así, el tenant Garrigues
--     habría quedado FUERA de sus propias tablas: la migración que debía
--     habilitar el módulo era la que se lo impedía. Ahora usan
--     `public.fn_current_tenant_id()`, que es el patrón del repo, y se crean
--     `TO authenticated` en vez de contra `PUBLIC`.
--   * Se retiran `qseal_token` y `tsq_token` de los informes y de la FRIA, y el
--     canal `ERDS_EADTRUST`: el módulo AIMS no llama a ningún prestador de
--     confianza (0 imports de cliente, 0 fetch, 0 functions.invoke, medido), y
--     la política del proyecto prohíbe afirmar firma, sello, ERDS, envío o
--     entrega en capturas nuevas. Hornearlo en el schema lo daba por hecho.
--   * `governance_body_id` pasa a ser FK real contra `governing_bodies`. Antes
--     era `text NOT NULL DEFAULT 'COMITE_RIESGOS'`: un ownership en texto libre
--     con un valor por defecto de otro tenant. Es el mismo defecto que la
--     review de G4 marcó como P0 — el propietario pintado como rótulo en vez de
--     como arista.
--
-- Contenido:
-- 1. Subexpedientes por régimen con aislamiento de cierres
-- 2. Relojes regulatorios (RIA 15d/2d/10d, RGPD 72h, DORA 4h/24h/72h/1 mes)
-- 3. Informes de notificación a la autoridad
-- 4. Evaluación de impacto en derechos fundamentales (art. 27 RIA)
-- 5. Referencias cruzadas FRIA ⟷ EIPD (art. 27.4 RIA y art. 35 RGPD)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Multiregime Incident Cases & Clocks
-- ---------------------------------------------------------------------------

-- Claves compuestas en los padres preexistentes de la superficie AIMS. `id` ya
-- es clave primaria en las tres, así que estas restricciones no pueden violarse:
-- su único cometido es permitir FK con coherencia de tenant desde las tablas
-- nuevas. Sin ellas, un tenant puede colgar sus filas del padre de otro.
ALTER TABLE ai_incidents
  ADD CONSTRAINT ai_incidents_tenant_id_key UNIQUE (tenant_id, id);
ALTER TABLE ai_systems
  ADD CONSTRAINT ai_systems_tenant_id_key UNIQUE (tenant_id, id);
ALTER TABLE aims_system_versions
  ADD CONSTRAINT aims_system_versions_tenant_id_key UNIQUE (tenant_id, id);

CREATE TABLE IF NOT EXISTS aims_incident_regimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, incident_id)
    REFERENCES ai_incidents(tenant_id, id) ON DELETE CASCADE,
  -- DEUDA DECLARADA: FK de una sola columna. `entities` no tiene
  -- UNIQUE(tenant_id, id) y es superficie compartida (G1), así que la coherencia
  -- de tenant no puede cerrarse desde aquí sin autorización.
  entity_id uuid REFERENCES entities(id) ON DELETE CASCADE,
  -- 'RIA' | 'GDPR' | 'DORA'. El enum se deja abierto a propósito: para el
  -- perfil despacho, DORA queda FUERA DEL ALCANCE DECLARADO y no se siembra
  -- (`branding.modules` ya lo oculta en ese tenant, y el análisis de G6
  -- concluyó que el sujeto obligado no es el despacho). No se retira del
  -- modelo porque otros tenants sí pueden serlo.
  regime_code text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'IN_INVESTIGATION', 'NOTIFIED', 'NOT_APPLICABLE_JUSTIFIED', 'CLOSED'
  applicability_rationale text,
  target_authority text NOT NULL, -- 'AESIA', 'AEPD', 'DGSFP_BCE', 'CSIRT'
  lead_role text NOT NULL, -- 'AI_OFFICER', 'DPO', 'CISO', 'LEGAL'
  closed_at timestamptz,
  closure_reason text,
  -- DEUDA DECLARADA: igual que `entity_id`. `evidence_bundles` es la espina
  -- dorsal compartida de Secretaría.
  evidence_bundle_id uuid REFERENCES evidence_bundles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, incident_id, regime_code),
  -- Habilita la FK compuesta de las hijas. `id` ya es único por PK, así que
  -- esta restricción no puede violarse: su único cometido es permitir que
  -- `(tenant_id, id)` sea referenciable.
  UNIQUE (tenant_id, id)
);

COMMENT ON TABLE aims_incident_regimes IS 'Independent subcases per regulatory regime for an incident (Closure Isolation principle).';

CREATE TABLE IF NOT EXISTS aims_regulatory_clocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_regime_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, incident_regime_id)
    REFERENCES aims_incident_regimes(tenant_id, id) ON DELETE CASCADE,
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
  incident_regime_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, incident_regime_id)
    REFERENCES aims_incident_regimes(tenant_id, id) ON DELETE CASCADE,
  report_type text NOT NULL, -- 'INITIAL', 'INTERMEDIATE', 'FINAL', 'DELAY_JUSTIFICATION', 'NON_APPLICABILITY'
  authority text NOT NULL,
  sent_at timestamptz,
  submission_channel text, -- 'AESIA_SEDE', 'AEPD_SEDE', 'DGSFP_SEDE'
  acknowledgment_ref text,
  is_complete boolean NOT NULL DEFAULT true,
  content_summary text,
  manifest_hash text,
  -- Sin `qseal_token`/`tsq_token`: este módulo no interviene ningún prestador
  -- de confianza. La integridad la da el hash del manifiesto, y nada más.
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
  system_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, system_id)
    REFERENCES ai_systems(tenant_id, id) ON DELETE CASCADE,
  version_id uuid,
  FOREIGN KEY (tenant_id, version_id)
    REFERENCES aims_system_versions(tenant_id, id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED'
  version_number int NOT NULL DEFAULT 1,
  assessed_by text,
  approved_by_dpo text,
  approved_by_ai_officer text,
  fria_summary text,
  market_surveillance_notified boolean NOT NULL DEFAULT false,
  notification_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Ver la nota de `aims_incident_regimes`: habilita la FK compuesta.
  UNIQUE (tenant_id, id)
);

COMMENT ON TABLE aims_fria_assessments IS 'Header for Art. 27 RIA Fundamental Rights Impact Assessments.';

-- Art. 27.1(a): Process Map
CREATE TABLE IF NOT EXISTS aims_fria_process_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fria_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, fria_id)
    REFERENCES aims_fria_assessments(tenant_id, id) ON DELETE CASCADE,
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
  fria_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, fria_id)
    REFERENCES aims_fria_assessments(tenant_id, id) ON DELETE CASCADE,
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
  fria_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, fria_id)
    REFERENCES aims_fria_assessments(tenant_id, id) ON DELETE CASCADE,
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
  fria_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, fria_id)
    REFERENCES aims_fria_assessments(tenant_id, id) ON DELETE CASCADE,
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
  fria_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, fria_id)
    REFERENCES aims_fria_assessments(tenant_id, id) ON DELETE CASCADE,
  trigger_event text NOT NULL,
  -- Arista real. Antes era texto libre con un default de otro tenant, que es
  -- el P0 de ownership que la review de G4 identificó: el propietario pintado
  -- como rótulo nunca demuestra la relación.
  -- DEUDA DECLARADA, y es la más incómoda: esta FK se introdujo para que el
  -- ownership fuera una ARISTA y no un rótulo, pero puede apuntar al órgano de
  -- otro tenant. `governing_bodies` es superficie compartida (G2) y no tiene
  -- UNIQUE(tenant_id, id); cerrarlo exige autorización sobre esa tabla.
  governance_body_id uuid REFERENCES governing_bodies(id) ON DELETE SET NULL,
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
  fria_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, fria_id)
    REFERENCES aims_fria_assessments(tenant_id, id) ON DELETE CASCADE,
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
-- Aislamiento por tenant.
--
-- P0 CORREGIDO: estas diez políticas hardcodeaban el UUID de ARGA, de modo que
-- el tenant Garrigues no habría podido leer NI escribir en ninguna de sus
-- propias tablas. Además se creaban sin cláusula `TO`, es decir contra
-- `PUBLIC`. Ahora resuelven el tenant de la sesión y se limitan a
-- `authenticated`, que es el patrón del resto del repo.
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

DROP POLICY IF EXISTS aims_incident_regimes_tenant_isolation ON aims_incident_regimes;
CREATE POLICY aims_incident_regimes_tenant_isolation ON aims_incident_regimes
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS aims_regulatory_clocks_tenant_isolation ON aims_regulatory_clocks;
CREATE POLICY aims_regulatory_clocks_tenant_isolation ON aims_regulatory_clocks
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS aims_incident_reports_tenant_isolation ON aims_incident_reports;
CREATE POLICY aims_incident_reports_tenant_isolation ON aims_incident_reports
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS aims_fria_assessments_tenant_isolation ON aims_fria_assessments;
CREATE POLICY aims_fria_assessments_tenant_isolation ON aims_fria_assessments
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS aims_fria_process_map_tenant_isolation ON aims_fria_process_map;
CREATE POLICY aims_fria_process_map_tenant_isolation ON aims_fria_process_map
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS aims_fria_use_profile_tenant_isolation ON aims_fria_use_profile;
CREATE POLICY aims_fria_use_profile_tenant_isolation ON aims_fria_use_profile
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS aims_fria_affected_groups_tenant_isolation ON aims_fria_affected_groups;
CREATE POLICY aims_fria_affected_groups_tenant_isolation ON aims_fria_affected_groups
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS aims_fria_fundamental_rights_risks_tenant_isolation ON aims_fria_fundamental_rights_risks;
CREATE POLICY aims_fria_fundamental_rights_risks_tenant_isolation ON aims_fria_fundamental_rights_risks
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS aims_fria_remediation_governance_tenant_isolation ON aims_fria_remediation_governance;
CREATE POLICY aims_fria_remediation_governance_tenant_isolation ON aims_fria_remediation_governance
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS aims_fria_dpia_cross_references_tenant_isolation ON aims_fria_dpia_cross_references;
CREATE POLICY aims_fria_dpia_cross_references_tenant_isolation ON aims_fria_dpia_cross_references
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());
