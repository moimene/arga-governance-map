-- ============================================================
-- Secretaría 360 P1 — normativa operativa en Cloud
--
-- Objetivo:
--   1. Persistir el diagnóstico/backfill del marco normativo de sociedades
--      existentes.
--   2. Registrar eventos de auditoría/telemetría del mantenimiento normativo
--      contra el backbone compartido `audit_log`.
--
-- No crea un ledger paralelo: `audit_log` sigue siendo la fuente WORM común.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- T1. Estado materializado del marco normativo por sociedad
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS secretaria_normative_framework_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (
    status IN ('OK', 'INCOMPLETO', 'REQUIERE_REVISION', 'CONFLICTO_JURISDICCIONAL')
  ),
  jurisdiction text,
  company_form text,
  rule_set_company_form text,
  has_rule_set boolean NOT NULL DEFAULT false,
  has_organs boolean NOT NULL DEFAULT false,
  has_statutes boolean NOT NULL DEFAULT false,
  has_pactos boolean NOT NULL DEFAULT false,
  has_minimum_templates boolean NOT NULL DEFAULT false,
  has_conflict_of_laws boolean NOT NULL DEFAULT false,
  source_coverage_pct numeric(5, 2) NOT NULL DEFAULT 0,
  missing_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_hash text,
  last_backfill_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT secretaria_normative_framework_status_entity_unique UNIQUE (entity_id)
);

COMMENT ON TABLE secretaria_normative_framework_status IS
  'Estado materializado del marco normativo de cada sociedad para Secretaría 360.';

CREATE INDEX IF NOT EXISTS idx_secretaria_normative_framework_status_tenant
  ON secretaria_normative_framework_status(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_secretaria_normative_framework_status_entity
  ON secretaria_normative_framework_status(entity_id);

ALTER TABLE secretaria_normative_framework_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_normative_framework_status_select ON secretaria_normative_framework_status;
CREATE POLICY secretaria_normative_framework_status_select
  ON secretaria_normative_framework_status FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_normative_framework_status_write ON secretaria_normative_framework_status;
CREATE POLICY secretaria_normative_framework_status_write
  ON secretaria_normative_framework_status FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT ON secretaria_normative_framework_status TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- T2. Eventos operativos de auditoría/telemetría del mantenimiento normativo
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS secretaria_normative_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entities(id) ON DELETE SET NULL,
  matter text,
  event_name text NOT NULL CHECK (
    event_name IN (
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
    )
  ),
  user_role text NOT NULL CHECK (user_role IN ('viewer', 'editor', 'admin', 'legal_ops', 'system')),
  event_channel text NOT NULL DEFAULT 'AUDIT_AND_TELEMETRY'
    CHECK (event_channel IN ('AUDIT', 'TELEMETRY', 'AUDIT_AND_TELEMETRY')),
  before_state jsonb NOT NULL DEFAULT 'null'::jsonb,
  after_state jsonb NOT NULL DEFAULT 'null'::jsonb,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_log_id uuid REFERENCES audit_log(id),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE secretaria_normative_event_log IS
  'Eventos append-only de mantenimiento normativo. Cada evento relevante enlaza con audit_log.';

CREATE INDEX IF NOT EXISTS idx_secretaria_normative_event_log_tenant_created
  ON secretaria_normative_event_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secretaria_normative_event_log_entity
  ON secretaria_normative_event_log(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secretaria_normative_event_log_event
  ON secretaria_normative_event_log(event_name, created_at DESC);

DROP TRIGGER IF EXISTS trg_secretaria_normative_event_log_worm_update ON secretaria_normative_event_log;
CREATE TRIGGER trg_secretaria_normative_event_log_worm_update
  BEFORE UPDATE ON secretaria_normative_event_log
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

DROP TRIGGER IF EXISTS trg_secretaria_normative_event_log_worm_delete ON secretaria_normative_event_log;
CREATE TRIGGER trg_secretaria_normative_event_log_worm_delete
  BEFORE DELETE ON secretaria_normative_event_log
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

ALTER TABLE secretaria_normative_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_normative_event_log_select ON secretaria_normative_event_log;
CREATE POLICY secretaria_normative_event_log_select
  ON secretaria_normative_event_log FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_normative_event_log_insert ON secretaria_normative_event_log;
CREATE POLICY secretaria_normative_event_log_insert
  ON secretaria_normative_event_log FOR INSERT
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT ON secretaria_normative_event_log TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- T3. Ejecuciones de backfill
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS secretaria_normative_backfill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_mode text NOT NULL CHECK (run_mode IN ('DRY_RUN', 'APPLY')),
  entities_scanned integer NOT NULL DEFAULT 0,
  entities_updated integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_hash text,
  audit_log_id uuid REFERENCES audit_log(id),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE secretaria_normative_backfill_runs IS
  'Histórico append-only de simulaciones/aplicaciones de backfill de marco normativo.';

CREATE INDEX IF NOT EXISTS idx_secretaria_normative_backfill_runs_tenant_created
  ON secretaria_normative_backfill_runs(tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_secretaria_normative_backfill_runs_worm_update ON secretaria_normative_backfill_runs;
CREATE TRIGGER trg_secretaria_normative_backfill_runs_worm_update
  BEFORE UPDATE ON secretaria_normative_backfill_runs
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

DROP TRIGGER IF EXISTS trg_secretaria_normative_backfill_runs_worm_delete ON secretaria_normative_backfill_runs;
CREATE TRIGGER trg_secretaria_normative_backfill_runs_worm_delete
  BEFORE DELETE ON secretaria_normative_backfill_runs
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

ALTER TABLE secretaria_normative_backfill_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_normative_backfill_runs_select ON secretaria_normative_backfill_runs;
CREATE POLICY secretaria_normative_backfill_runs_select
  ON secretaria_normative_backfill_runs FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS secretaria_normative_backfill_runs_insert ON secretaria_normative_backfill_runs;
CREATE POLICY secretaria_normative_backfill_runs_insert
  ON secretaria_normative_backfill_runs FOR INSERT
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT ON secretaria_normative_backfill_runs TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: registrar evento de mantenimiento normativo
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_secretaria_record_normative_event(p_event jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event_id uuid := gen_random_uuid();
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
BEGIN
  IF p_event IS NULL OR jsonb_typeof(p_event) <> 'object' THEN
    RAISE EXCEPTION 'p_event must be a JSON object' USING ERRCODE = 'P0001';
  END IF;

  v_tenant_id := COALESCE(
    NULLIF(p_event ->> 'tenant_id', '')::uuid,
    fn_secretaria_current_tenant_id()
  );
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
    SELECT tenant_id INTO v_entity_tenant_id
      FROM entities
     WHERE id = v_entity_id;

    IF v_entity_tenant_id IS NULL THEN
      RAISE EXCEPTION 'entity % not found', v_entity_id USING ERRCODE = 'P0001';
    END IF;
    IF v_entity_tenant_id <> v_tenant_id THEN
      RAISE EXCEPTION 'entity % does not belong to tenant %', v_entity_id, v_tenant_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_matter := NULLIF(p_event ->> 'matter', '');
  v_before := COALESCE(p_event -> 'before_state', p_event -> 'before', 'null'::jsonb);
  v_after := COALESCE(p_event -> 'after_state', p_event -> 'after', 'null'::jsonb);
  v_attributes := COALESCE(p_event -> 'attributes', '{}'::jsonb);
  v_duration_ms := NULLIF(COALESCE(p_event ->> 'duration_ms', p_event ->> 'durationMs'), '')::integer;

  INSERT INTO audit_log (
    tenant_id, action, object_type, object_id, delta
  ) VALUES (
    v_tenant_id,
    'SECRETARIA_NORMATIVE_' || upper(v_event_name),
    'secretaria_normative_framework',
    COALESCE(v_entity_id, v_event_id),
    jsonb_build_object(
      'event_id', v_event_id,
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
    id, tenant_id, entity_id, matter, event_name, user_role,
    before_state, after_state, duration_ms, attributes, audit_log_id
  ) VALUES (
    v_event_id, v_tenant_id, v_entity_id, v_matter, v_event_name, v_user_role,
    v_before, v_after, v_duration_ms, v_attributes, v_audit_id
  );

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_record_normative_event(jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: simular/aplicar backfill de marco normativo para sociedades existentes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_secretaria_backfill_normative_framework(
  p_tenant_id uuid DEFAULT NULL,
  p_apply boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(p_tenant_id, fn_secretaria_current_tenant_id());
  v_run_id uuid := gen_random_uuid();
  v_audit_id uuid;
  v_run_mode text := CASE WHEN COALESCE(p_apply, false) THEN 'APPLY' ELSE 'DRY_RUN' END;
  v_entity record;
  v_company_form text;
  v_rule_form text;
  v_has_rule_set boolean;
  v_has_organs boolean;
  v_has_statutes boolean;
  v_has_pactos boolean;
  v_has_minimum_templates boolean;
  v_has_conflict boolean;
  v_missing jsonb;
  v_status text;
  v_coverage numeric(5, 2);
  v_entities_scanned integer := 0;
  v_entities_updated integer := 0;
  v_details jsonb := '[]'::jsonb;
  v_summary jsonb;
  v_profile_hash text;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(v_tenant_id);

  FOR v_entity IN
    SELECT
      id,
      tenant_id,
      legal_name,
      common_name,
      jurisdiction,
      legal_form,
      tipo_social,
      es_cotizada,
      person_id
    FROM entities
    WHERE tenant_id = v_tenant_id
      AND person_id IS NOT NULL
    ORDER BY COALESCE(common_name, legal_name), id
  LOOP
    v_entities_scanned := v_entities_scanned + 1;
    v_company_form := upper(COALESCE(NULLIF(v_entity.tipo_social, ''), NULLIF(v_entity.legal_form, ''), ''));
    v_rule_form := CASE
      WHEN v_company_form IN ('SAU', 'S.A.U.') THEN 'SA'
      WHEN v_company_form IN ('SLU', 'S.L.U.') THEN 'SL'
      ELSE v_company_form
    END;

    SELECT EXISTS (
      SELECT 1
        FROM jurisdiction_rule_sets jrs
       WHERE jrs.tenant_id = v_tenant_id
         AND upper(jrs.jurisdiction) = upper(COALESCE(v_entity.jurisdiction, ''))
         AND upper(jrs.company_form) = v_rule_form
         AND jrs.is_active = true
    ) INTO v_has_rule_set;

    SELECT EXISTS (
      SELECT 1
        FROM governing_bodies gb
       WHERE gb.tenant_id = v_tenant_id
         AND gb.entity_id = v_entity.id
    ) INTO v_has_organs;

    SELECT EXISTS (
      SELECT 1
        FROM rule_param_overrides rpo
       WHERE rpo.tenant_id = v_tenant_id
         AND rpo.entity_id = v_entity.id
         AND upper(rpo.fuente) = 'ESTATUTOS'
    ) INTO v_has_statutes;

    SELECT EXISTS (
      SELECT 1
        FROM pactos_parasociales pp
       WHERE pp.tenant_id = v_tenant_id
         AND pp.entity_id = v_entity.id
         AND pp.estado = 'VIGENTE'
    ) INTO v_has_pactos;

    SELECT (
      EXISTS (
        SELECT 1 FROM plantillas_protegidas p
         WHERE p.tenant_id = v_tenant_id
           AND p.estado = 'ACTIVA'
           AND p.tipo IN ('ACTA_SESION', 'ACTA_ACUERDO_ESCRITO', 'ACTA_CONSIGNACION')
           AND upper(p.jurisdiccion) = upper(COALESCE(v_entity.jurisdiction, p.jurisdiccion))
      )
      AND EXISTS (
        SELECT 1 FROM plantillas_protegidas p
         WHERE p.tenant_id = v_tenant_id
           AND p.estado = 'ACTIVA'
           AND p.tipo = 'CERTIFICACION'
           AND upper(p.jurisdiccion) = upper(COALESCE(v_entity.jurisdiction, p.jurisdiccion))
      )
      AND EXISTS (
        SELECT 1 FROM plantillas_protegidas p
         WHERE p.tenant_id = v_tenant_id
           AND p.estado = 'ACTIVA'
           AND p.tipo IN ('CONVOCATORIA', 'CONVOCATORIA_SL_NOTIFICACION')
           AND upper(p.jurisdiccion) = upper(COALESCE(v_entity.jurisdiction, p.jurisdiccion))
      )
    ) INTO v_has_minimum_templates;

    SELECT (
      (
        upper(COALESCE(v_entity.jurisdiction, '')) <> 'ES'
        AND v_company_form IN ('SA', 'SL', 'SAU', 'SLU')
      )
      OR EXISTS (
        SELECT 1
          FROM jurisdiction_rule_sets jrs
         WHERE jrs.tenant_id = v_tenant_id
           AND upper(jrs.jurisdiction) = upper(COALESCE(v_entity.jurisdiction, ''))
           AND upper(jrs.company_form) = v_rule_form
           AND jrs.is_active = true
           AND upper(COALESCE(jrs.legal_reference, '')) LIKE '%LSC%'
           AND upper(COALESCE(v_entity.jurisdiction, '')) <> 'ES'
      )
    ) INTO v_has_conflict;

    v_missing := '[]'::jsonb;
    IF NOT v_has_rule_set THEN
      v_missing := v_missing || jsonb_build_array('regla_legal_base');
    END IF;
    IF NOT v_has_organs THEN
      v_missing := v_missing || jsonb_build_array('organo_competente');
    END IF;
    IF NOT v_has_minimum_templates THEN
      v_missing := v_missing || jsonb_build_array('plantillas_minimas');
    END IF;
    IF NOT v_has_statutes THEN
      v_missing := v_missing || jsonb_build_array('estatutos_no_modelados');
    END IF;
    IF v_has_conflict THEN
      v_missing := v_missing || jsonb_build_array('conflicto_jurisdiccional');
    END IF;

    v_status := CASE
      WHEN v_has_conflict THEN 'CONFLICTO_JURISDICCIONAL'
      WHEN NOT v_has_rule_set OR NOT v_has_organs OR NOT v_has_minimum_templates THEN 'INCOMPLETO'
      WHEN NOT v_has_statutes THEN 'REQUIERE_REVISION'
      ELSE 'OK'
    END;

    v_coverage := round((
      (
        CASE WHEN v_has_rule_set THEN 1 ELSE 0 END
        + CASE WHEN v_has_organs THEN 1 ELSE 0 END
        + CASE WHEN v_has_minimum_templates THEN 1 ELSE 0 END
        + CASE WHEN v_has_statutes THEN 1 ELSE 0 END
        + CASE WHEN NOT v_has_conflict THEN 1 ELSE 0 END
      )::numeric / 5
    ) * 100, 2);

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'entity_id', v_entity.id,
      'entity_name', COALESCE(v_entity.common_name, v_entity.legal_name),
      'status', v_status,
      'jurisdiction', v_entity.jurisdiction,
      'company_form', v_company_form,
      'rule_set_company_form', v_rule_form,
      'missing_items', v_missing,
      'source_coverage_pct', v_coverage,
      'has_rule_set', v_has_rule_set,
      'has_organs', v_has_organs,
      'has_statutes', v_has_statutes,
      'has_pactos', v_has_pactos,
      'has_minimum_templates', v_has_minimum_templates,
      'has_conflict_of_laws', v_has_conflict
    ));

    IF p_apply THEN
      INSERT INTO secretaria_normative_framework_status (
        tenant_id,
        entity_id,
        status,
        jurisdiction,
        company_form,
        rule_set_company_form,
        has_rule_set,
        has_organs,
        has_statutes,
        has_pactos,
        has_minimum_templates,
        has_conflict_of_laws,
        source_coverage_pct,
        missing_items,
        diagnostics,
        profile_hash,
        last_backfill_run_id,
        updated_at,
        updated_by
      ) VALUES (
        v_tenant_id,
        v_entity.id,
        v_status,
        v_entity.jurisdiction,
        v_company_form,
        v_rule_form,
        v_has_rule_set,
        v_has_organs,
        v_has_statutes,
        v_has_pactos,
        v_has_minimum_templates,
        v_has_conflict,
        v_coverage,
        v_missing,
        jsonb_build_object(
          'entity_name', COALESCE(v_entity.common_name, v_entity.legal_name),
          'evaluated_at', now(),
          'mode', v_run_mode
        ),
        encode(digest(v_details::text, 'sha256'), 'hex'),
        v_run_id,
        now(),
        auth.uid()
      )
      ON CONFLICT (entity_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        jurisdiction = EXCLUDED.jurisdiction,
        company_form = EXCLUDED.company_form,
        rule_set_company_form = EXCLUDED.rule_set_company_form,
        has_rule_set = EXCLUDED.has_rule_set,
        has_organs = EXCLUDED.has_organs,
        has_statutes = EXCLUDED.has_statutes,
        has_pactos = EXCLUDED.has_pactos,
        has_minimum_templates = EXCLUDED.has_minimum_templates,
        has_conflict_of_laws = EXCLUDED.has_conflict_of_laws,
        source_coverage_pct = EXCLUDED.source_coverage_pct,
        missing_items = EXCLUDED.missing_items,
        diagnostics = EXCLUDED.diagnostics,
        profile_hash = EXCLUDED.profile_hash,
        last_backfill_run_id = EXCLUDED.last_backfill_run_id,
        updated_at = now(),
        updated_by = auth.uid();

      v_entities_updated := v_entities_updated + 1;
    END IF;
  END LOOP;

  v_profile_hash := encode(digest(v_details::text, 'sha256'), 'hex');

  v_summary := jsonb_build_object(
    'run_id', v_run_id,
    'mode', v_run_mode,
    'tenant_id', v_tenant_id,
    'profile_hash', v_profile_hash,
    'entities_scanned', v_entities_scanned,
    'entities_updated', v_entities_updated,
    'counts_by_status', (
      SELECT jsonb_object_agg(status_key, status_count)
      FROM (
        SELECT value ->> 'status' AS status_key, count(*) AS status_count
        FROM jsonb_array_elements(v_details)
        GROUP BY value ->> 'status'
      ) s
    ),
    'details', v_details
  );

  INSERT INTO audit_log (
    tenant_id, action, object_type, object_id, delta
  ) VALUES (
    v_tenant_id,
    CASE WHEN p_apply THEN 'SECRETARIA_NORMATIVE_BACKFILL_APPLIED' ELSE 'SECRETARIA_NORMATIVE_BACKFILL_DRY_RUN' END,
    'secretaria_normative_framework',
    v_run_id,
    v_summary
  )
  RETURNING id INTO v_audit_id;

  INSERT INTO secretaria_normative_backfill_runs (
    id,
    tenant_id,
    run_mode,
    entities_scanned,
    entities_updated,
    summary,
    profile_hash,
    audit_log_id
  ) VALUES (
    v_run_id,
    v_tenant_id,
    v_run_mode,
    v_entities_scanned,
    v_entities_updated,
    v_summary,
    v_profile_hash,
    v_audit_id
  );

  INSERT INTO secretaria_normative_event_log (
    tenant_id,
    event_name,
    user_role,
    attributes,
    audit_log_id
  ) VALUES (
    v_tenant_id,
    CASE WHEN p_apply THEN 'normative_backfill_applied' ELSE 'normative_backfill_dry_run' END,
    'system',
    v_summary - 'details',
    v_audit_id
  );

  RETURN v_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_backfill_normative_framework(uuid, boolean)
  TO authenticated, service_role;

COMMIT;
