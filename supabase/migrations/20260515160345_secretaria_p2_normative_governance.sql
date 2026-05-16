-- ============================================================
-- Secretaría 360 P2 — mantenimiento normativo gobernado
--
-- Objetivo:
--   Persistir la edición operativa del marco normativo:
--   órganos, estatutos, overrides, pactos, binding de plantillas y
--   matriz materializada de regla efectiva.
--
-- Notas:
--   - Depende de 20260515153057_secretaria_normative_maintenance_cloud.sql.
--   - No borra ni actualiza registros WORM; solo añade contratos nuevos.
--   - Todas las tablas nuevas quedan tenant-scoped con RLS.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- P2.0 Idempotencia lógica de eventos normativos P1
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS secretaria_normative_event_log
  ADD COLUMN IF NOT EXISTS event_dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_secretaria_normative_event_log_dedupe
  ON secretaria_normative_event_log(tenant_id, event_dedupe_key)
  WHERE event_dedupe_key IS NOT NULL;

ALTER TABLE IF EXISTS secretaria_normative_backfill_runs
  ADD COLUMN IF NOT EXISTS profile_hash text;

ALTER TABLE IF EXISTS secretaria_normative_framework_status
  ADD COLUMN IF NOT EXISTS profile_hash text;

-- ---------------------------------------------------------------------------
-- P2.1 Reglas persistidas de órganos societarios
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS secretaria_organ_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  body_id uuid NOT NULL REFERENCES governing_bodies(id) ON DELETE CASCADE,
  matter_code text NOT NULL,
  competence_type text NOT NULL DEFAULT 'DECISION'
    CHECK (competence_type IN ('DECISION', 'INFORMACION', 'SUPERVISION', 'PROPUESTA')),
  quorum_rule text NOT NULL,
  majority_rule text NOT NULL,
  source_type text NOT NULL
    CHECK (source_type IN ('LEY', 'ESTATUTOS', 'REGLAMENTO', 'PACTO_PARASOCIAL')),
  source_ref text NOT NULL,
  source_version_id uuid,
  status text NOT NULL DEFAULT 'ACTIVA'
    CHECK (status IN ('BORRADOR', 'ACTIVA', 'ARCHIVADA')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT secretaria_organ_rules_source_ref_not_blank CHECK (length(trim(source_ref)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_secretaria_organ_rules_active
  ON secretaria_organ_rules(tenant_id, entity_id, body_id, matter_code)
  WHERE status = 'ACTIVA';
CREATE INDEX IF NOT EXISTS idx_secretaria_organ_rules_entity_matter
  ON secretaria_organ_rules(tenant_id, entity_id, matter_code);
CREATE INDEX IF NOT EXISTS idx_secretaria_organ_rules_body
  ON secretaria_organ_rules(body_id);

ALTER TABLE secretaria_organ_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_organ_rules_select ON secretaria_organ_rules;
CREATE POLICY secretaria_organ_rules_select
  ON secretaria_organ_rules FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_organ_rules_write ON secretaria_organ_rules;
CREATE POLICY secretaria_organ_rules_write
  ON secretaria_organ_rules FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON secretaria_organ_rules TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS secretaria_organ_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organ_rule_id uuid NOT NULL REFERENCES secretaria_organ_rules(id) ON DELETE CASCADE,
  source_type text NOT NULL
    CHECK (source_type IN ('LEY', 'ESTATUTOS', 'REGLAMENTO', 'PACTO_PARASOCIAL')),
  source_ref text NOT NULL,
  document_uri text,
  source_excerpt text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT secretaria_organ_source_links_ref_not_blank CHECK (length(trim(source_ref)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_secretaria_organ_source_links_rule
  ON secretaria_organ_source_links(organ_rule_id);

ALTER TABLE secretaria_organ_source_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_organ_source_links_select ON secretaria_organ_source_links;
CREATE POLICY secretaria_organ_source_links_select
  ON secretaria_organ_source_links FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_organ_source_links_write ON secretaria_organ_source_links;
CREATE POLICY secretaria_organ_source_links_write
  ON secretaria_organ_source_links FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON secretaria_organ_source_links TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- P2.2 Versionado real de estatutos y mapeo de cláusulas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS secretaria_statute_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  status text NOT NULL DEFAULT 'BORRADOR'
    CHECK (status IN ('BORRADOR', 'PUBLICADA', 'ARCHIVADA')),
  document_uri text,
  document_hash text,
  mapping_coverage numeric(5, 2) NOT NULL DEFAULT 0
    CHECK (mapping_coverage >= 0 AND mapping_coverage <= 100),
  critical_mappings_complete boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  published_by uuid,
  locked_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT secretaria_statute_versions_version_not_blank CHECK (length(trim(version_label)) > 0),
  CONSTRAINT secretaria_statute_versions_unique_entity_version UNIQUE (entity_id, version_label),
  CONSTRAINT secretaria_statute_versions_publish_guard CHECK (
    status <> 'PUBLICADA'
    OR (published_at IS NOT NULL AND locked_at IS NOT NULL AND mapping_coverage >= 80)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_secretaria_statute_versions_one_published
  ON secretaria_statute_versions(tenant_id, entity_id)
  WHERE status = 'PUBLICADA';
CREATE INDEX IF NOT EXISTS idx_secretaria_statute_versions_entity
  ON secretaria_statute_versions(tenant_id, entity_id, status);

ALTER TABLE secretaria_statute_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_statute_versions_select ON secretaria_statute_versions;
CREATE POLICY secretaria_statute_versions_select
  ON secretaria_statute_versions FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_statute_versions_write ON secretaria_statute_versions;
CREATE POLICY secretaria_statute_versions_write
  ON secretaria_statute_versions FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON secretaria_statute_versions TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS secretaria_statute_clause_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  statute_version_id uuid NOT NULL REFERENCES secretaria_statute_versions(id) ON DELETE CASCADE,
  clause_ref text NOT NULL,
  matter_code text NOT NULL,
  requirement_key text NOT NULL,
  requirement_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_excerpt text,
  confidence text NOT NULL DEFAULT 'PENDIENTE_REVISION'
    CHECK (confidence IN ('VALIDADO', 'PENDIENTE_REVISION', 'INFERIDO', 'INCOMPLETO')),
  status text NOT NULL DEFAULT 'ACTIVA'
    CHECK (status IN ('BORRADOR', 'ACTIVA', 'ARCHIVADA')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT secretaria_statute_clause_mappings_ref_not_blank CHECK (length(trim(clause_ref)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_secretaria_statute_clause_mappings_version
  ON secretaria_statute_clause_mappings(statute_version_id);
CREATE INDEX IF NOT EXISTS idx_secretaria_statute_clause_mappings_matter
  ON secretaria_statute_clause_mappings(tenant_id, entity_id, matter_code);

ALTER TABLE secretaria_statute_clause_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_statute_clause_mappings_select ON secretaria_statute_clause_mappings;
CREATE POLICY secretaria_statute_clause_mappings_select
  ON secretaria_statute_clause_mappings FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_statute_clause_mappings_write ON secretaria_statute_clause_mappings;
CREATE POLICY secretaria_statute_clause_mappings_write
  ON secretaria_statute_clause_mappings FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON secretaria_statute_clause_mappings TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- P2.3 Overrides gobernados y pactos mapeados a materias
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS secretaria_normative_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  matter_code text NOT NULL,
  requirement_key text NOT NULL,
  requirement_value jsonb NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('ESTATUTOS', 'REGLAMENTO')),
  source_ref text NOT NULL,
  justification text NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  status text NOT NULL DEFAULT 'BORRADOR'
    CHECK (status IN ('BORRADOR', 'PUBLICADA', 'CERRADA')),
  rule_param_override_id uuid REFERENCES rule_param_overrides(id),
  created_by uuid DEFAULT auth.uid(),
  published_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT secretaria_normative_overrides_source_ref_not_blank CHECK (length(trim(source_ref)) > 0),
  CONSTRAINT secretaria_normative_overrides_justification_not_blank CHECK (length(trim(justification)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_secretaria_normative_overrides_published
  ON secretaria_normative_overrides(tenant_id, entity_id, matter_code, requirement_key)
  WHERE status = 'PUBLICADA';
CREATE INDEX IF NOT EXISTS idx_secretaria_normative_overrides_entity
  ON secretaria_normative_overrides(tenant_id, entity_id, matter_code, status);

ALTER TABLE secretaria_normative_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_normative_overrides_select ON secretaria_normative_overrides;
CREATE POLICY secretaria_normative_overrides_select
  ON secretaria_normative_overrides FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_normative_overrides_write ON secretaria_normative_overrides;
CREATE POLICY secretaria_normative_overrides_write
  ON secretaria_normative_overrides FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON secretaria_normative_overrides TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS secretaria_pacto_clause_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  pacto_id uuid REFERENCES pactos_parasociales(id) ON DELETE CASCADE,
  clause_ref text NOT NULL,
  matter_code text NOT NULL,
  legal_effect text NOT NULL
    CHECK (legal_effect IN ('CONTRACTUAL', 'ESTATUTARIZADO', 'VETO', 'CONSENTIMIENTO', 'MAYORIA_REFORZADA')),
  status text NOT NULL DEFAULT 'ACTIVA'
    CHECK (status IN ('BORRADOR', 'ACTIVA', 'ARCHIVADA')),
  waiver_status text NOT NULL DEFAULT 'NO_APLICA'
    CHECK (waiver_status IN ('NO_APLICA', 'PENDIENTE', 'OTORGADO', 'INCUMPLIDO')),
  source_ref text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT secretaria_pacto_clause_mappings_clause_not_blank CHECK (length(trim(clause_ref)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_secretaria_pacto_clause_mappings_entity
  ON secretaria_pacto_clause_mappings(tenant_id, entity_id, matter_code, status);
CREATE INDEX IF NOT EXISTS idx_secretaria_pacto_clause_mappings_pacto
  ON secretaria_pacto_clause_mappings(pacto_id);

ALTER TABLE secretaria_pacto_clause_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_pacto_clause_mappings_select ON secretaria_pacto_clause_mappings;
CREATE POLICY secretaria_pacto_clause_mappings_select
  ON secretaria_pacto_clause_mappings FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_pacto_clause_mappings_write ON secretaria_pacto_clause_mappings;
CREATE POLICY secretaria_pacto_clause_mappings_write
  ON secretaria_pacto_clause_mappings FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON secretaria_pacto_clause_mappings TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- P2.4 Binding determinista materia -> plantilla
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS materia_template_binding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  materia text NOT NULL,
  organo_tipo text NOT NULL DEFAULT 'ANY',
  tipo_social text NOT NULL DEFAULT 'ANY',
  jurisdiccion text NOT NULL DEFAULT 'ES',
  adoption_mode text NOT NULL DEFAULT 'ANY',
  doc_type text NOT NULL,
  template_id uuid NOT NULL REFERENCES plantillas_protegidas(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  active boolean NOT NULL DEFAULT true,
  selection_reason text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materia_template_binding_reason_not_blank CHECK (length(trim(selection_reason)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_materia_template_binding_lookup
  ON materia_template_binding(
    tenant_id,
    materia,
    jurisdiccion,
    tipo_social,
    organo_tipo,
    adoption_mode,
    doc_type,
    active,
    priority
  );
CREATE UNIQUE INDEX IF NOT EXISTS ux_materia_template_binding_active_priority
  ON materia_template_binding(
    tenant_id,
    materia,
    jurisdiccion,
    tipo_social,
    organo_tipo,
    adoption_mode,
    doc_type,
    priority
  )
  WHERE active = true;

ALTER TABLE materia_template_binding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS materia_template_binding_select ON materia_template_binding;
CREATE POLICY materia_template_binding_select
  ON materia_template_binding FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS materia_template_binding_write ON materia_template_binding;
CREATE POLICY materia_template_binding_write
  ON materia_template_binding FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON materia_template_binding TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- P2.5 Matriz materializada de regla efectiva sociedad x materia
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS secretaria_effective_rule_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  matter_code text NOT NULL,
  organo_tipo text NOT NULL,
  majority_rule text NOT NULL,
  quorum_rule text NOT NULL,
  documents_required jsonb NOT NULL DEFAULT '[]'::jsonb,
  formalization jsonb NOT NULL DEFAULT '{}'::jsonb,
  deadlines jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_layers jsonb NOT NULL DEFAULT '[]'::jsonb,
  operational_status text NOT NULL DEFAULT 'INCOMPLETO'
    CHECK (operational_status IN ('OK', 'INCOMPLETO', 'REQUIERE_REVISION', 'CONFLICTO_JURISDICCIONAL')),
  confidence text NOT NULL DEFAULT 'INCOMPLETO'
    CHECK (confidence IN ('VALIDADO', 'PENDIENTE_REVISION', 'INFERIDO', 'INCOMPLETO')),
  profile_hash text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid DEFAULT auth.uid(),
  CONSTRAINT secretaria_effective_rule_matrix_unique UNIQUE (entity_id, matter_code)
);

CREATE INDEX IF NOT EXISTS idx_secretaria_effective_rule_matrix_entity
  ON secretaria_effective_rule_matrix(tenant_id, entity_id, operational_status);

ALTER TABLE secretaria_effective_rule_matrix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_effective_rule_matrix_select ON secretaria_effective_rule_matrix;
CREATE POLICY secretaria_effective_rule_matrix_select
  ON secretaria_effective_rule_matrix FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_effective_rule_matrix_write ON secretaria_effective_rule_matrix;
CREATE POLICY secretaria_effective_rule_matrix_write
  ON secretaria_effective_rule_matrix FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON secretaria_effective_rule_matrix TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- P2.6 RPCs de publicación gobernada
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_secretaria_record_normative_event(p_event jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event_id uuid := gen_random_uuid();
  v_existing_event_id uuid;
  v_audit_id uuid;
  v_tenant_id uuid;
  v_entity_id uuid;
  v_entity_tenant_id uuid;
  v_event_name text;
  v_user_role text;
  v_matter text;
  v_before jsonb;
  v_after jsonb;
  v_attributes jsonb;
  v_duration_ms integer;
  v_dedupe_key text;
BEGIN
  IF p_event IS NULL OR jsonb_typeof(p_event) <> 'object' THEN
    RAISE EXCEPTION 'p_event must be a JSON object' USING ERRCODE = 'P0001';
  END IF;

  v_tenant_id := COALESCE(NULLIF(p_event ->> 'tenant_id', '')::uuid, fn_secretaria_current_tenant_id());
  PERFORM fn_secretaria_assert_tenant_access(v_tenant_id);

  v_event_name := COALESCE(NULLIF(p_event ->> 'event_name', ''), NULLIF(p_event ->> 'action', ''));
  IF v_event_name NOT IN (
    'ruleset_activated',
    'statute_version_published',
    'clause_mapped',
    'organ_changed',
    'template_assigned',
    'expediente_blocked',
    'conflict_of_laws_flagged',
    'effective_rule_viewed',
    'normative_backfill_dry_run',
    'normative_backfill_applied'
  ) THEN
    RAISE EXCEPTION 'unsupported normative event=%', v_event_name USING ERRCODE = 'P0001';
  END IF;

  v_user_role := COALESCE(NULLIF(p_event ->> 'user_role', ''), NULLIF(p_event ->> 'userRole', ''), 'viewer');
  IF v_user_role NOT IN ('viewer', 'editor', 'admin', 'legal_ops', 'system') THEN
    RAISE EXCEPTION 'unsupported normative user_role=%', v_user_role USING ERRCODE = 'P0001';
  END IF;

  v_entity_id := NULLIF(COALESCE(p_event ->> 'entity_id', p_event ->> 'societyId'), '')::uuid;
  IF v_entity_id IS NOT NULL THEN
    SELECT tenant_id INTO v_entity_tenant_id FROM entities WHERE id = v_entity_id;
    IF v_entity_tenant_id IS NULL THEN
      RAISE EXCEPTION 'entity % not found', v_entity_id USING ERRCODE = 'P0001';
    END IF;
    IF v_entity_tenant_id <> v_tenant_id THEN
      RAISE EXCEPTION 'entity % does not belong to tenant %', v_entity_id, v_tenant_id USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_matter := NULLIF(p_event ->> 'matter', '');
  v_before := COALESCE(p_event -> 'before_state', p_event -> 'before', 'null'::jsonb);
  v_after := COALESCE(p_event -> 'after_state', p_event -> 'after', 'null'::jsonb);
  v_attributes := COALESCE(p_event -> 'attributes', '{}'::jsonb);
  v_duration_ms := NULLIF(COALESCE(p_event ->> 'duration_ms', p_event ->> 'durationMs'), '')::integer;
  v_dedupe_key := NULLIF(COALESCE(
    p_event ->> 'event_dedupe_key',
    p_event ->> 'idempotency_key',
    p_event ->> 'eventIdempotencyKey'
  ), '');

  IF v_dedupe_key IS NULL AND v_event_name = 'effective_rule_viewed' THEN
    v_dedupe_key := concat_ws(
      ':',
      v_event_name,
      COALESCE(v_entity_id::text, 'no-entity'),
      COALESCE(v_matter, 'no-matter'),
      COALESCE(v_attributes ->> 'profile_hash', v_after ->> 'profile_hash', 'no-profile')
    );
  END IF;

  IF v_dedupe_key IS NOT NULL THEN
    SELECT id INTO v_existing_event_id
      FROM secretaria_normative_event_log
     WHERE tenant_id = v_tenant_id
       AND event_dedupe_key = v_dedupe_key
     LIMIT 1;
    IF v_existing_event_id IS NOT NULL THEN
      RETURN v_existing_event_id;
    END IF;
  END IF;

  INSERT INTO audit_log (tenant_id, action, object_type, object_id, delta)
  VALUES (
    v_tenant_id,
    'SECRETARIA_NORMATIVE_' || upper(v_event_name),
    'secretaria_normative_framework',
    COALESCE(v_entity_id, v_event_id),
    jsonb_build_object(
      'event_id', v_event_id,
      'event_dedupe_key', v_dedupe_key,
      'entity_id', v_entity_id,
      'matter', v_matter,
      'user_role', v_user_role,
      'before', v_before,
      'after', v_after,
      'attributes', v_attributes,
      'duration_ms', v_duration_ms,
      'ts', now()
    )
  )
  RETURNING id INTO v_audit_id;

  INSERT INTO secretaria_normative_event_log (
    id,
    tenant_id,
    entity_id,
    matter,
    event_name,
    user_role,
    before_state,
    after_state,
    duration_ms,
    attributes,
    audit_log_id,
    event_dedupe_key
  )
  VALUES (
    v_event_id,
    v_tenant_id,
    v_entity_id,
    v_matter,
    v_event_name,
    v_user_role,
    v_before,
    v_after,
    v_duration_ms,
    v_attributes,
    v_audit_id,
    v_dedupe_key
  );

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_record_normative_event(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION fn_secretaria_upsert_organ_rule(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(NULLIF(p_payload ->> 'tenant_id', '')::uuid, fn_secretaria_current_tenant_id());
  v_entity_id uuid := NULLIF(p_payload ->> 'entity_id', '')::uuid;
  v_body_id uuid := NULLIF(p_payload ->> 'body_id', '')::uuid;
  v_matter text := NULLIF(p_payload ->> 'matter_code', '');
  v_rule_id uuid;
  v_body_tenant uuid;
  v_body_entity uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(v_tenant_id);

  IF v_entity_id IS NULL OR v_body_id IS NULL OR v_matter IS NULL THEN
    RAISE EXCEPTION 'entity_id, body_id and matter_code are required' USING ERRCODE = 'P0001';
  END IF;

  SELECT tenant_id, entity_id INTO v_body_tenant, v_body_entity
    FROM governing_bodies
   WHERE id = v_body_id;

  IF v_body_tenant IS NULL OR v_body_tenant <> v_tenant_id OR v_body_entity <> v_entity_id THEN
    RAISE EXCEPTION 'body % does not belong to the requested society/tenant', v_body_id USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO secretaria_organ_rules (
    tenant_id,
    entity_id,
    body_id,
    matter_code,
    competence_type,
    quorum_rule,
    majority_rule,
    source_type,
    source_ref,
    source_version_id,
    status,
    updated_by
  )
  VALUES (
    v_tenant_id,
    v_entity_id,
    v_body_id,
    v_matter,
    COALESCE(NULLIF(p_payload ->> 'competence_type', ''), 'DECISION'),
    COALESCE(NULLIF(p_payload ->> 'quorum_rule', ''), 'Según fuente documental vigente'),
    COALESCE(NULLIF(p_payload ->> 'majority_rule', ''), 'Según fuente documental vigente'),
    COALESCE(NULLIF(p_payload ->> 'source_type', ''), 'REGLAMENTO'),
    COALESCE(NULLIF(p_payload ->> 'source_ref', ''), ''),
    NULLIF(p_payload ->> 'source_version_id', '')::uuid,
    COALESCE(NULLIF(p_payload ->> 'status', ''), 'ACTIVA'),
    auth.uid()
  )
  ON CONFLICT (tenant_id, entity_id, body_id, matter_code)
  WHERE status = 'ACTIVA'
  DO UPDATE SET
    competence_type = EXCLUDED.competence_type,
    quorum_rule = EXCLUDED.quorum_rule,
    majority_rule = EXCLUDED.majority_rule,
    source_type = EXCLUDED.source_type,
    source_ref = EXCLUDED.source_ref,
    source_version_id = EXCLUDED.source_version_id,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_rule_id;

  PERFORM fn_secretaria_record_normative_event(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', v_entity_id,
    'event_name', 'organ_changed',
    'matter', v_matter,
    'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
    'after_state', p_payload,
    'event_dedupe_key', concat('organ:', v_rule_id, ':', now()::date)
  ));

  RETURN v_rule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_upsert_organ_rule(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION fn_secretaria_publish_statute_version(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(NULLIF(p_payload ->> 'tenant_id', '')::uuid, fn_secretaria_current_tenant_id());
  v_entity_id uuid := NULLIF(p_payload ->> 'entity_id', '')::uuid;
  v_entity_tenant uuid;
  v_version_id uuid := COALESCE(NULLIF(p_payload ->> 'id', '')::uuid, gen_random_uuid());
  v_status text := COALESCE(NULLIF(p_payload ->> 'status', ''), 'PUBLICADA');
  v_mapping_coverage numeric(5, 2) := COALESCE(NULLIF(p_payload ->> 'mapping_coverage', '')::numeric, 0);
  v_mappings jsonb := COALESCE(p_payload -> 'mappings', '[]'::jsonb);
  v_mapping jsonb;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(v_tenant_id);

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'entity_id is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT tenant_id INTO v_entity_tenant FROM entities WHERE id = v_entity_id;
  IF v_entity_tenant IS NULL OR v_entity_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'entity % does not belong to tenant %', v_entity_id, v_tenant_id USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'PUBLICADA' AND v_mapping_coverage < 80 THEN
    RAISE EXCEPTION 'La publicación de estatutos exige cobertura mínima del 80%%.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE secretaria_statute_versions
     SET status = 'ARCHIVADA'
   WHERE tenant_id = v_tenant_id
     AND entity_id = v_entity_id
     AND status = 'PUBLICADA'
     AND id <> v_version_id;

  INSERT INTO secretaria_statute_versions (
    id,
    tenant_id,
    entity_id,
    version_label,
    status,
    document_uri,
    document_hash,
    mapping_coverage,
    critical_mappings_complete,
    published_at,
    published_by,
    locked_at,
    created_by
  )
  VALUES (
    v_version_id,
    v_tenant_id,
    v_entity_id,
    COALESCE(NULLIF(p_payload ->> 'version_label', ''), 'v1'),
    v_status,
    NULLIF(p_payload ->> 'document_uri', ''),
    NULLIF(p_payload ->> 'document_hash', ''),
    v_mapping_coverage,
    COALESCE((p_payload ->> 'critical_mappings_complete')::boolean, v_mapping_coverage >= 80),
    CASE WHEN v_status = 'PUBLICADA' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'PUBLICADA' THEN auth.uid() ELSE NULL END,
    CASE WHEN v_status = 'PUBLICADA' THEN now() ELSE NULL END,
    auth.uid()
  )
  ON CONFLICT (entity_id, version_label)
  DO UPDATE SET
    status = EXCLUDED.status,
    document_uri = EXCLUDED.document_uri,
    document_hash = EXCLUDED.document_hash,
    mapping_coverage = EXCLUDED.mapping_coverage,
    critical_mappings_complete = EXCLUDED.critical_mappings_complete,
    published_at = EXCLUDED.published_at,
    published_by = EXCLUDED.published_by,
    locked_at = EXCLUDED.locked_at
  RETURNING id INTO v_version_id;

  IF jsonb_typeof(v_mappings) = 'array' THEN
    FOR v_mapping IN SELECT value FROM jsonb_array_elements(v_mappings) LOOP
      INSERT INTO secretaria_statute_clause_mappings (
        tenant_id,
        entity_id,
        statute_version_id,
        clause_ref,
        matter_code,
        requirement_key,
        requirement_value,
        source_excerpt,
        confidence,
        status,
        created_by
      )
      VALUES (
        v_tenant_id,
        v_entity_id,
        v_version_id,
        COALESCE(NULLIF(v_mapping ->> 'clause_ref', ''), 'sin referencia'),
        COALESCE(NULLIF(v_mapping ->> 'matter_code', ''), 'GENERAL'),
        COALESCE(NULLIF(v_mapping ->> 'requirement_key', ''), 'referencia'),
        COALESCE(v_mapping -> 'requirement_value', '{}'::jsonb),
        NULLIF(v_mapping ->> 'source_excerpt', ''),
        COALESCE(NULLIF(v_mapping ->> 'confidence', ''), 'PENDIENTE_REVISION'),
        'ACTIVA',
        auth.uid()
      );
    END LOOP;
  END IF;

  PERFORM fn_secretaria_record_normative_event(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', v_entity_id,
    'event_name', 'statute_version_published',
    'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
    'after_state', jsonb_build_object(
      'statute_version_id', v_version_id,
      'version_label', p_payload ->> 'version_label',
      'mapping_coverage', v_mapping_coverage,
      'status', v_status
    ),
    'event_dedupe_key', concat('statutes:', v_entity_id, ':', COALESCE(NULLIF(p_payload ->> 'version_label', ''), 'v1'))
  ));

  RETURN v_version_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_publish_statute_version(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION fn_secretaria_publish_normative_override(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(NULLIF(p_payload ->> 'tenant_id', '')::uuid, fn_secretaria_current_tenant_id());
  v_entity_id uuid := NULLIF(p_payload ->> 'entity_id', '')::uuid;
  v_entity_tenant uuid;
  v_entity_form text;
  v_matter text := NULLIF(p_payload ->> 'matter_code', '');
  v_requirement_key text := NULLIF(p_payload ->> 'requirement_key', '');
  v_requirement_value jsonb := COALESCE(p_payload -> 'requirement_value', '{}'::jsonb);
  v_source_type text := COALESCE(NULLIF(p_payload ->> 'source_type', ''), 'ESTATUTOS');
  v_majority_code text;
  v_override_id uuid;
  v_rule_param_id uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(v_tenant_id);

  IF v_entity_id IS NULL OR v_matter IS NULL OR v_requirement_key IS NULL THEN
    RAISE EXCEPTION 'entity_id, matter_code and requirement_key are required' USING ERRCODE = 'P0001';
  END IF;

  SELECT tenant_id, COALESCE(tipo_social, legal_form, 'SA')
    INTO v_entity_tenant, v_entity_form
    FROM entities
   WHERE id = v_entity_id;

  IF v_entity_tenant IS NULL OR v_entity_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'entity % does not belong to tenant %', v_entity_id, v_tenant_id USING ERRCODE = 'P0001';
  END IF;

  IF length(trim(COALESCE(p_payload ->> 'source_ref', ''))) = 0
     OR length(trim(COALESCE(p_payload ->> 'justification', ''))) = 0 THEN
    RAISE EXCEPTION 'Cada override exige referencia documental y justificación.' USING ERRCODE = 'P0001';
  END IF;

  v_majority_code := COALESCE(v_requirement_value ->> 'majority_code', v_requirement_value ->> 'mayoria', NULL);
  IF v_requirement_key IN ('votacion.mayoria', 'majority', 'mayoria') AND v_majority_code IS NOT NULL THEN
    IF NOT fn_validar_no_rebaja_ley(v_majority_code, v_matter, v_entity_form) THEN
      RAISE EXCEPTION 'Este requisito no puede rebajar el mínimo legal para %.', v_matter USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO rule_param_overrides (
    tenant_id,
    entity_id,
    materia,
    clave,
    valor,
    fuente,
    referencia
  )
  VALUES (
    v_tenant_id,
    v_entity_id,
    v_matter,
    v_requirement_key,
    v_requirement_value,
    v_source_type,
    p_payload ->> 'source_ref'
  )
  ON CONFLICT (entity_id, materia, clave)
  DO UPDATE SET
    valor = EXCLUDED.valor,
    fuente = EXCLUDED.fuente,
    referencia = EXCLUDED.referencia
  RETURNING id INTO v_rule_param_id;

  INSERT INTO secretaria_normative_overrides (
    tenant_id,
    entity_id,
    matter_code,
    requirement_key,
    requirement_value,
    source_type,
    source_ref,
    justification,
    effective_from,
    effective_until,
    status,
    rule_param_override_id,
    published_by,
    published_at
  )
  VALUES (
    v_tenant_id,
    v_entity_id,
    v_matter,
    v_requirement_key,
    v_requirement_value,
    v_source_type,
    p_payload ->> 'source_ref',
    p_payload ->> 'justification',
    COALESCE(NULLIF(p_payload ->> 'effective_from', '')::date, CURRENT_DATE),
    NULLIF(p_payload ->> 'effective_until', '')::date,
    'PUBLICADA',
    v_rule_param_id,
    auth.uid(),
    now()
  )
  ON CONFLICT (tenant_id, entity_id, matter_code, requirement_key)
  WHERE status = 'PUBLICADA'
  DO UPDATE SET
    requirement_value = EXCLUDED.requirement_value,
    source_type = EXCLUDED.source_type,
    source_ref = EXCLUDED.source_ref,
    justification = EXCLUDED.justification,
    effective_from = EXCLUDED.effective_from,
    effective_until = EXCLUDED.effective_until,
    rule_param_override_id = EXCLUDED.rule_param_override_id,
    published_by = auth.uid(),
    published_at = now()
  RETURNING id INTO v_override_id;

  PERFORM fn_secretaria_record_normative_event(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', v_entity_id,
    'event_name', 'clause_mapped',
    'matter', v_matter,
    'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
    'after_state', jsonb_build_object(
      'override_id', v_override_id,
      'rule_param_override_id', v_rule_param_id,
      'requirement_key', v_requirement_key,
      'source_ref', p_payload ->> 'source_ref'
    ),
    'event_dedupe_key', concat('override:', v_entity_id, ':', v_matter, ':', v_requirement_key)
  ));

  RETURN v_override_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_publish_normative_override(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION fn_secretaria_assign_template_binding(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(NULLIF(p_payload ->> 'tenant_id', '')::uuid, fn_secretaria_current_tenant_id());
  v_template_id uuid := NULLIF(p_payload ->> 'template_id', '')::uuid;
  v_template_tenant uuid;
  v_binding_id uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(v_tenant_id);

  SELECT tenant_id INTO v_template_tenant FROM plantillas_protegidas WHERE id = v_template_id;
  IF v_template_tenant IS NULL OR v_template_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'template % does not belong to tenant %', v_template_id, v_tenant_id USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO materia_template_binding (
    tenant_id,
    materia,
    organo_tipo,
    tipo_social,
    jurisdiccion,
    adoption_mode,
    doc_type,
    template_id,
    priority,
    active,
    selection_reason
  )
  VALUES (
    v_tenant_id,
    COALESCE(NULLIF(p_payload ->> 'materia', ''), 'GENERAL'),
    COALESCE(NULLIF(p_payload ->> 'organo_tipo', ''), 'ANY'),
    COALESCE(NULLIF(p_payload ->> 'tipo_social', ''), 'ANY'),
    COALESCE(NULLIF(p_payload ->> 'jurisdiccion', ''), 'ES'),
    COALESCE(NULLIF(p_payload ->> 'adoption_mode', ''), 'ANY'),
    COALESCE(NULLIF(p_payload ->> 'doc_type', ''), 'MODELO_ACUERDO'),
    v_template_id,
    COALESCE(NULLIF(p_payload ->> 'priority', '')::integer, 100),
    COALESCE((p_payload ->> 'active')::boolean, true),
    COALESCE(NULLIF(p_payload ->> 'selection_reason', ''), 'Selección automática por materia y documento')
  )
  ON CONFLICT (
    tenant_id,
    materia,
    jurisdiccion,
    tipo_social,
    organo_tipo,
    adoption_mode,
    doc_type,
    priority
  )
  WHERE active = true
  DO UPDATE SET
    template_id = EXCLUDED.template_id,
    active = EXCLUDED.active,
    selection_reason = EXCLUDED.selection_reason
  RETURNING id INTO v_binding_id;

  PERFORM fn_secretaria_record_normative_event(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'event_name', 'template_assigned',
    'matter', COALESCE(NULLIF(p_payload ->> 'materia', ''), 'GENERAL'),
    'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
    'after_state', jsonb_build_object(
      'binding_id', v_binding_id,
      'template_id', v_template_id,
      'doc_type', p_payload ->> 'doc_type'
    ),
    'event_dedupe_key', concat('template:', v_binding_id)
  ));

  RETURN v_binding_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_assign_template_binding(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION fn_secretaria_materialize_effective_rule_matrix(
  p_tenant_id uuid DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(p_tenant_id, fn_secretaria_current_tenant_id());
  v_entity record;
  v_materia record;
  v_org_rule record;
  v_status text;
  v_confidence text;
  v_profile_hash text;
  v_rows integer := 0;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(v_tenant_id);

  FOR v_entity IN
    SELECT id, jurisdiction, tipo_social, legal_form
      FROM entities
     WHERE tenant_id = v_tenant_id
       AND person_id IS NOT NULL
       AND (p_entity_id IS NULL OR id = p_entity_id)
  LOOP
    FOR v_materia IN
      SELECT materia, materia_label_es, min_majority_code, requires_notary, requires_registry,
             inscribable, publication_required, plazo_inscripcion_dias
        FROM materia_catalog
       ORDER BY materia
    LOOP
      SELECT *
        INTO v_org_rule
        FROM secretaria_organ_rules r
       WHERE r.tenant_id = v_tenant_id
         AND r.entity_id = v_entity.id
         AND r.matter_code = v_materia.materia
         AND r.status = 'ACTIVA'
       ORDER BY r.updated_at DESC
       LIMIT 1;

      v_status := CASE WHEN v_org_rule.id IS NULL THEN 'REQUIERE_REVISION' ELSE 'OK' END;
      v_confidence := CASE WHEN v_org_rule.id IS NULL THEN 'INFERIDO' ELSE 'VALIDADO' END;
      v_profile_hash := encode(digest(concat_ws(
        '|',
        v_entity.id,
        v_materia.materia,
        COALESCE(v_org_rule.id::text, 'no-organ-rule'),
        COALESCE(v_org_rule.source_ref, 'ley')
      ), 'sha256'), 'hex');

      INSERT INTO secretaria_effective_rule_matrix (
        tenant_id,
        entity_id,
        matter_code,
        organo_tipo,
        majority_rule,
        quorum_rule,
        documents_required,
        formalization,
        deadlines,
        source_layers,
        operational_status,
        confidence,
        profile_hash,
        generated_at,
        generated_by
      )
      VALUES (
        v_tenant_id,
        v_entity.id,
        v_materia.materia,
        COALESCE(v_org_rule.body_id::text, 'Órgano competente por ley'),
        COALESCE(v_org_rule.majority_rule, COALESCE(v_materia.min_majority_code, 'No requiere mayoría societaria')),
        COALESCE(v_org_rule.quorum_rule, 'Según ley aplicable y estatutos'),
        jsonb_build_array('Acta') ||
          CASE WHEN COALESCE(v_materia.requires_notary, false) THEN jsonb_build_array('Escritura pública') ELSE '[]'::jsonb END ||
          CASE WHEN COALESCE(v_materia.requires_registry, false) OR COALESCE(v_materia.inscribable, false) THEN jsonb_build_array('Certificación registral') ELSE '[]'::jsonb END,
        jsonb_build_object(
          'notary_required', COALESCE(v_materia.requires_notary, false),
          'registry_required', COALESCE(v_materia.requires_registry, false) OR COALESCE(v_materia.inscribable, false),
          'publication_required', COALESCE(v_materia.publication_required, false)
        ),
        jsonb_build_object('registry_days', v_materia.plazo_inscripcion_dias),
        CASE
          WHEN v_org_rule.id IS NULL THEN jsonb_build_array(jsonb_build_object('type', 'LEY', 'reference', 'Regla legal base'))
          ELSE jsonb_build_array(jsonb_build_object('type', v_org_rule.source_type, 'reference', v_org_rule.source_ref))
        END,
        v_status,
        v_confidence,
        v_profile_hash,
        now(),
        auth.uid()
      )
      ON CONFLICT (entity_id, matter_code)
      DO UPDATE SET
        organo_tipo = EXCLUDED.organo_tipo,
        majority_rule = EXCLUDED.majority_rule,
        quorum_rule = EXCLUDED.quorum_rule,
        documents_required = EXCLUDED.documents_required,
        formalization = EXCLUDED.formalization,
        deadlines = EXCLUDED.deadlines,
        source_layers = EXCLUDED.source_layers,
        operational_status = EXCLUDED.operational_status,
        confidence = EXCLUDED.confidence,
        profile_hash = EXCLUDED.profile_hash,
        generated_at = now(),
        generated_by = auth.uid();

      v_rows := v_rows + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', p_entity_id,
    'rows_materialized', v_rows,
    'mode', 'P2_EFFECTIVE_RULE_MATRIX'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_materialize_effective_rule_matrix(uuid, uuid)
  TO authenticated, service_role;

COMMENT ON TABLE secretaria_organ_rules IS 'Reglas persistidas de competencia, quórum y mayoría por órgano y materia.';
COMMENT ON TABLE secretaria_statute_versions IS 'Versiones gobernadas de estatutos por sociedad.';
COMMENT ON TABLE secretaria_statute_clause_mappings IS 'Mapeo cláusula estatutaria -> materia -> requisito.';
COMMENT ON TABLE secretaria_normative_overrides IS 'Overrides estatutarios/reglamentarios publicados con referencia y justificación.';
COMMENT ON TABLE secretaria_pacto_clause_mappings IS 'Mapeo de cláusulas de pactos a materias y efecto jurídico.';
COMMENT ON TABLE materia_template_binding IS 'Binding determinista materia + órgano + tipo social + jurisdicción + forma de adopción -> plantilla activa.';
COMMENT ON TABLE secretaria_effective_rule_matrix IS 'Read model materializado sociedad x materia con regla efectiva, fuentes y estado operativo.';

COMMIT;
