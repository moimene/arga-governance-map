-- 20260513_000066_personas_cargos_sprint2_core.sql
-- Sprint 2 Personas y Cargos: L12-C singleton hardening, transactional
-- cargo designation, person consolidation, and presidential vacancy notices.
--
-- LOCAL MIGRATION ONLY until explicitly applied to Supabase Cloud.
--
-- Legal decisions signed 2026-05-12:
--   L12-C: hard singleton only for PRESIDENTE, SECRETARIO,
--          CONSEJERO_COORDINADOR, ADMIN_UNICO. VICESECRETARIO and
--          VICEPRESIDENTE stay outside the hard unique indexes.
--   L13-B: internal notifications for presidential vacancy at D+0/D+60/D+90,
--          owner = Secretario/Vicesecretario, no operational blocking.
--   L20-A: legal succession is post-pilot and intentionally not implemented.

BEGIN;

-- ---------------------------------------------------------------------
-- Capability matrix extension for server-side RPC authorization.
-- Existing helper fn_secretaria_assert_capability(role, action) reads this
-- table, so the CHECK must accept new Secretaria actions before seeding.
-- ---------------------------------------------------------------------

ALTER TABLE capability_matrix
  DROP CONSTRAINT IF EXISTS capability_matrix_action_check;

ALTER TABLE capability_matrix
  ADD CONSTRAINT capability_matrix_action_check
  CHECK (action IN (
    'SNAPSHOT_CREATION',
    'VOTE_EMISSION',
    'CERTIFICATION',
    'CARGO_MANAGEMENT',
    'PERSON_WRITE',
    'PERSON_CONSOLIDATE',
    'REPRESENTATION_MANAGEMENT'
  ));

INSERT INTO capability_matrix (role, action, enabled, reason) VALUES
  ('SECRETARIO', 'CARGO_MANAGEMENT', true,
   'Secretario gestiona altas, ceses y distribución de cargos societarios'),
  ('SECRETARIO', 'PERSON_WRITE', true,
   'Secretario mantiene datos identificativos básicos de personas del libro societario'),
  ('SECRETARIO', 'PERSON_CONSOLIDATE', true,
   'Secretario puede consolidar duplicados de personas tras revisión legal-operativa'),
  ('SECRETARIO', 'REPRESENTATION_MANAGEMENT', true,
   'Secretario gestiona representantes persona jurídica y delegaciones societarias'),

  ('ADMIN_TENANT', 'CARGO_MANAGEMENT', true,
   'Admin tenant puede gestionar cargos en soporte/demo con trazabilidad'),
  ('ADMIN_TENANT', 'PERSON_WRITE', true,
   'Admin tenant puede mantener personas en soporte/demo con trazabilidad'),
  ('ADMIN_TENANT', 'PERSON_CONSOLIDATE', true,
   'Admin tenant puede consolidar duplicados en soporte/demo con trazabilidad'),
  ('ADMIN_TENANT', 'REPRESENTATION_MANAGEMENT', true,
   'Admin tenant puede gestionar representaciones en soporte/demo con trazabilidad'),

  ('CONSEJERO', 'CARGO_MANAGEMENT', false,
   'Consejero no gestiona cargos; corresponde a Secretaría'),
  ('CONSEJERO', 'PERSON_WRITE', false,
   'Consejero no modifica datos maestros de personas; corresponde a Secretaría'),
  ('CONSEJERO', 'PERSON_CONSOLIDATE', false,
   'Consejero no consolida personas; corresponde a Secretaría'),
  ('CONSEJERO', 'REPRESENTATION_MANAGEMENT', false,
   'Consejero no gestiona representaciones salvo flujo específico de delegación'),

  ('COMPLIANCE', 'CARGO_MANAGEMENT', false,
   'Compliance supervisa; no modifica cargos societarios'),
  ('COMPLIANCE', 'PERSON_WRITE', false,
   'Compliance supervisa; no modifica datos maestros de personas'),
  ('COMPLIANCE', 'PERSON_CONSOLIDATE', false,
   'Compliance supervisa; no consolida personas'),
  ('COMPLIANCE', 'REPRESENTATION_MANAGEMENT', false,
   'Compliance supervisa; no modifica representaciones'),

  ('AUDITOR', 'CARGO_MANAGEMENT', false,
   'Auditor audita; no modifica cargos societarios'),
  ('AUDITOR', 'PERSON_WRITE', false,
   'Auditor audita; no modifica datos maestros de personas'),
  ('AUDITOR', 'PERSON_CONSOLIDATE', false,
   'Auditor audita; no consolida personas'),
  ('AUDITOR', 'REPRESENTATION_MANAGEMENT', false,
   'Auditor audita; no modifica representaciones')
ON CONFLICT (role, action) DO UPDATE
SET enabled = EXCLUDED.enabled,
    reason = EXCLUDED.reason;

COMMENT ON COLUMN persons.representative_person_id IS
  'DEPRECATED Sprint 2 Personas/Cargos: use representaciones(scope=ADMIN_PJ_REPRESENTANTE) as canonical source. Kept temporarily for legacy reads only.';

-- ---------------------------------------------------------------------
-- Preflight duplicates before adding hard singleton indexes. If this fails
-- on Cloud, stop and remediate data explicitly before applying the index.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_conflict text;
BEGIN
  SELECT string_agg(
           format(
             '%s/%s/%s/%s count=%s',
             tenant_id,
             entity_id,
             body_id,
             tipo_condicion,
             n
           ),
           '; '
         )
    INTO v_conflict
    FROM (
      SELECT tenant_id, entity_id, body_id, tipo_condicion, count(*) AS n
        FROM condiciones_persona
       WHERE estado = 'VIGENTE'
         AND tipo_condicion IN ('PRESIDENTE', 'SECRETARIO', 'CONSEJERO_COORDINADOR')
       GROUP BY tenant_id, entity_id, body_id, tipo_condicion
      HAVING count(*) > 1
    ) d;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'L12-C singleton body conflicts before index: %', v_conflict;
  END IF;

  SELECT string_agg(
           format('%s/%s/%s count=%s', tenant_id, entity_id, tipo_condicion, n),
           '; '
         )
    INTO v_conflict
    FROM (
      SELECT tenant_id, entity_id, tipo_condicion, count(*) AS n
        FROM condiciones_persona
       WHERE estado = 'VIGENTE'
         AND tipo_condicion = 'ADMIN_UNICO'
       GROUP BY tenant_id, entity_id, tipo_condicion
      HAVING count(*) > 1
    ) d;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'L12-C singleton ADMIN_UNICO conflicts before index: %', v_conflict;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_condicion_singleton_body_vigente_l12c
  ON condiciones_persona(tenant_id, entity_id, body_id, tipo_condicion)
  WHERE estado = 'VIGENTE'
    AND tipo_condicion IN ('PRESIDENTE', 'SECRETARIO', 'CONSEJERO_COORDINADOR');

CREATE UNIQUE INDEX IF NOT EXISTS ux_condicion_admin_unico_entity_vigente_l12c
  ON condiciones_persona(tenant_id, entity_id, tipo_condicion)
  WHERE estado = 'VIGENTE'
    AND tipo_condicion = 'ADMIN_UNICO';

-- ---------------------------------------------------------------------
-- Authority assertions for SECURITY DEFINER RPCs.
-- These complement tenant/capability checks with L21-L23: a caller that
-- creates an inscribable societary act must have vigente authority_evidence
-- with Registro Mercantil reference. service_role and ADMIN_TENANT are kept
-- for backend/support jobs, but normal users must be mapped to a person.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_secretaria_assert_caller_authority_rm(
  p_tenant_id uuid,
  p_entity_id uuid DEFAULT NULL,
  p_body_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role text;
  v_actor_person_id uuid;
  v_authority_evidence_id uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);

  IF fn_secretaria_is_service_role() THEN
    RETURN NULL;
  END IF;

  v_role := fn_secretaria_current_role_code();
  IF v_role = 'ADMIN_TENANT' THEN
    RETURN NULL;
  END IF;

  v_actor_person_id := fn_secretaria_current_person_id();
  IF v_actor_person_id IS NULL THEN
    RAISE EXCEPTION 'authority person required for Secretaria RPC';
  END IF;

  SELECT ae.id
    INTO v_authority_evidence_id
    FROM authority_evidence ae
   WHERE ae.tenant_id = p_tenant_id
     AND ae.person_id = v_actor_person_id
     AND ae.estado = 'VIGENTE'
     AND (
       (
         p_body_id IS NOT NULL
         AND ae.body_id = p_body_id
         AND ae.cargo IN ('SECRETARIO', 'VICESECRETARIO')
       )
       OR (
         p_body_id IS NULL
         AND ae.cargo IN (
           'ADMIN_UNICO',
           'ADMIN_SOLIDARIO',
           'ADMIN_MANCOMUNADO',
           'PRESIDENTE',
           'VICEPRESIDENTE',
           'SECRETARIO',
           'VICESECRETARIO'
         )
       )
     )
     AND ae.inscripcion_rm_referencia IS NOT NULL
     AND btrim(ae.inscripcion_rm_referencia) <> ''
     AND (p_entity_id IS NULL OR ae.entity_id = p_entity_id)
   ORDER BY ae.created_at DESC
   LIMIT 1;

  IF v_authority_evidence_id IS NULL THEN
    RAISE EXCEPTION 'vigente authority_evidence with RM reference required for Secretaria RPC';
  END IF;

  RETURN v_authority_evidence_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_assert_caller_authority_rm(uuid, uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- fn_designar_cargo
--
-- Transactional designation:
--   * tenant + capability + authority checks
--   * person/entity/body tenant validation
--   * L12-C singleton locks and previous cese in the same transaction
--   * PJ administrator representative validation and canonical
--     representaciones persistence
--   * idempotency through condiciones_persona.metadata.idempotency_key
--
-- WORM semantics: this function does not UPDATE audit_log, censo_snapshot,
-- no_session_*, capital_movements, or capital_movements_audit. Cargos are
-- historified by UPDATE estado='CESADO' and never deleted.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_designar_cargo(
  p_tenant_id uuid,
  p_person_id uuid,
  p_entity_id uuid,
  p_body_id uuid,
  p_tipo_condicion text,
  p_fecha_inicio date,
  p_fuente_designacion text,
  p_inscripcion_rm_referencia text DEFAULT NULL,
  p_inscripcion_rm_fecha date DEFAULT NULL,
  p_representative_person_id uuid DEFAULT NULL,
  p_cesar_singleton_previo boolean DEFAULT true,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_person persons%ROWTYPE;
  v_entity entities%ROWTYPE;
  v_body governing_bodies%ROWTYPE;
  v_existing_id uuid;
  v_new_id uuid;
  v_metadata jsonb := '{}'::jsonb;
  v_requires_body boolean;
  v_is_singleton_body boolean;
  v_is_admin_unico boolean;
  v_requires_representative boolean;
  v_closed_count integer := 0;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'CARGO_MANAGEMENT');
  PERFORM fn_secretaria_assert_caller_authority_rm(p_tenant_id, p_entity_id, p_body_id);

  IF p_person_id IS NULL OR p_entity_id IS NULL OR p_tipo_condicion IS NULL OR p_fecha_inicio IS NULL THEN
    RAISE EXCEPTION 'person_id, entity_id, tipo_condicion and fecha_inicio are required';
  END IF;

  SELECT *
    INTO v_person
    FROM persons
   WHERE id = p_person_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'person % does not belong to tenant %', p_person_id, p_tenant_id;
  END IF;

  SELECT *
    INTO v_entity
    FROM entities
   WHERE id = p_entity_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity % does not belong to tenant %', p_entity_id, p_tenant_id;
  END IF;

  v_requires_body := p_tipo_condicion IN (
    'CONSEJERO',
    'PRESIDENTE',
    'SECRETARIO',
    'VICEPRESIDENTE',
    'VICESECRETARIO',
    'CONSEJERO_COORDINADOR'
  );
  v_is_singleton_body := p_tipo_condicion IN (
    'PRESIDENTE',
    'SECRETARIO',
    'CONSEJERO_COORDINADOR'
  );
  v_is_admin_unico := p_tipo_condicion = 'ADMIN_UNICO';
  v_requires_representative :=
    v_person.person_type = 'PJ'
    AND p_tipo_condicion IN (
      'ADMIN_UNICO',
      'ADMIN_SOLIDARIO',
      'ADMIN_MANCOMUNADO',
      'ADMIN_PJ',
      'CONSEJERO'
    );

  IF v_requires_body AND p_body_id IS NULL THEN
    RAISE EXCEPTION 'body_id is required for cargo %', p_tipo_condicion;
  END IF;
  IF NOT v_requires_body AND p_body_id IS NOT NULL THEN
    RAISE EXCEPTION 'body_id must be NULL for cargo %', p_tipo_condicion;
  END IF;

  IF p_body_id IS NOT NULL THEN
    SELECT *
      INTO v_body
      FROM governing_bodies
     WHERE id = p_body_id
       AND tenant_id = p_tenant_id
       AND entity_id = p_entity_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'body % does not belong to entity % / tenant %', p_body_id, p_entity_id, p_tenant_id;
    END IF;
  END IF;

  IF p_tipo_condicion = 'CONSEJERO_COORDINADOR'
     AND COALESCE(v_entity.es_cotizada, false) IS NOT TRUE THEN
    v_metadata := v_metadata || jsonb_build_object(
      'warnings',
      jsonb_build_array('CONSEJERO_COORDINADOR_NON_LISTED_ENTITY_REVIEW_STATUTES')
    );
  END IF;

  IF p_tipo_condicion = 'VICESECRETARIO'
     AND EXISTS (
       SELECT 1
         FROM condiciones_persona cp
        WHERE cp.tenant_id = p_tenant_id
          AND cp.entity_id = p_entity_id
          AND cp.body_id = p_body_id
          AND cp.tipo_condicion = 'VICESECRETARIO'
          AND cp.estado = 'VIGENTE'
     ) THEN
    v_metadata := v_metadata || jsonb_build_object(
      'warnings',
      COALESCE(v_metadata -> 'warnings', '[]'::jsonb)
        || jsonb_build_array('MULTIPLE_VICESECRETARIO_REVIEW_STATUTES')
    );
  END IF;

  IF v_requires_representative AND p_representative_person_id IS NULL THEN
    RAISE EXCEPTION 'PJ administrator/consejero requires permanent PF representative (LSC art. 212 bis)';
  END IF;

  IF p_representative_person_id IS NOT NULL AND NOT v_requires_representative THEN
    RAISE EXCEPTION 'representative_person_id is only valid for PJ administrators/consejeros requiring LSC art. 212 bis representation';
  END IF;

  IF p_representative_person_id IS NOT NULL THEN
    PERFORM fn_secretaria_assert_person_tenant(p_tenant_id, p_representative_person_id);
    IF NOT EXISTS (
      SELECT 1
        FROM persons rp
       WHERE rp.id = p_representative_person_id
         AND rp.tenant_id = p_tenant_id
         AND rp.person_type = 'PF'
    ) THEN
      RAISE EXCEPTION 'representative_person_id must reference a PF person in the same tenant';
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT cp.id
      INTO v_existing_id
      FROM condiciones_persona cp
     WHERE cp.tenant_id = p_tenant_id
       AND cp.metadata ->> 'idempotency_key' = p_idempotency_key
     LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
    v_metadata := v_metadata || jsonb_build_object('idempotency_key', p_idempotency_key);
  END IF;

  IF v_is_singleton_body THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        concat_ws(':', 'condiciones_singleton_body', p_tenant_id, p_entity_id, p_body_id, p_tipo_condicion),
        0
      )
    );
    IF p_cesar_singleton_previo THEN
      UPDATE condiciones_persona
         SET estado = 'CESADO',
             fecha_fin = LEAST(p_fecha_inicio - 1, COALESCE(fecha_fin, p_fecha_inicio - 1)),
             metadata = metadata || jsonb_build_object(
               'cesado_por_fn_designar_cargo', true,
               'cesado_por_nuevo_person_id', p_person_id,
               'cesado_at', now()
             )
       WHERE tenant_id = p_tenant_id
         AND entity_id = p_entity_id
         AND body_id = p_body_id
         AND tipo_condicion = p_tipo_condicion
         AND estado = 'VIGENTE'
         AND person_id <> p_person_id;
      GET DIAGNOSTICS v_closed_count = ROW_COUNT;
    ELSIF EXISTS (
      SELECT 1
        FROM condiciones_persona cp
       WHERE cp.tenant_id = p_tenant_id
         AND cp.entity_id = p_entity_id
         AND cp.body_id = p_body_id
         AND cp.tipo_condicion = p_tipo_condicion
         AND cp.estado = 'VIGENTE'
         AND cp.person_id <> p_person_id
    ) THEN
      RAISE EXCEPTION 'singleton cargo % already has a vigente holder in body %', p_tipo_condicion, p_body_id;
    END IF;
  END IF;

  IF v_is_admin_unico THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        concat_ws(':', 'condiciones_admin_unico', p_tenant_id, p_entity_id, p_tipo_condicion),
        0
      )
    );
    IF p_cesar_singleton_previo THEN
      UPDATE condiciones_persona
         SET estado = 'CESADO',
             fecha_fin = LEAST(p_fecha_inicio - 1, COALESCE(fecha_fin, p_fecha_inicio - 1)),
             metadata = metadata || jsonb_build_object(
               'cesado_por_fn_designar_cargo', true,
               'cesado_por_nuevo_person_id', p_person_id,
               'cesado_at', now()
             )
       WHERE tenant_id = p_tenant_id
         AND entity_id = p_entity_id
         AND tipo_condicion = 'ADMIN_UNICO'
         AND estado = 'VIGENTE'
         AND person_id <> p_person_id;
      GET DIAGNOSTICS v_closed_count = ROW_COUNT;
    ELSIF EXISTS (
      SELECT 1
        FROM condiciones_persona cp
       WHERE cp.tenant_id = p_tenant_id
         AND cp.entity_id = p_entity_id
         AND cp.tipo_condicion = 'ADMIN_UNICO'
         AND cp.estado = 'VIGENTE'
         AND cp.person_id <> p_person_id
    ) THEN
      RAISE EXCEPTION 'ADMIN_UNICO already has a vigente holder in entity %', p_entity_id;
    END IF;
  END IF;

  v_metadata := v_metadata || jsonb_build_object(
    'source_rpc',
    'fn_designar_cargo',
    'closed_previous_singleton_count',
    v_closed_count
  );

  INSERT INTO condiciones_persona (
    tenant_id,
    person_id,
    entity_id,
    body_id,
    tipo_condicion,
    estado,
    fecha_inicio,
    fecha_fin,
    representative_person_id,
    fuente_designacion,
    inscripcion_rm_referencia,
    inscripcion_rm_fecha,
    metadata
  ) VALUES (
    p_tenant_id,
    p_person_id,
    p_entity_id,
    p_body_id,
    p_tipo_condicion,
    'VIGENTE',
    p_fecha_inicio,
    NULL,
    p_representative_person_id,
    p_fuente_designacion,
    NULLIF(btrim(COALESCE(p_inscripcion_rm_referencia, '')), ''),
    p_inscripcion_rm_fecha,
    v_metadata
  )
  RETURNING id INTO v_new_id;

  IF v_requires_representative AND p_representative_person_id IS NOT NULL THEN
    UPDATE representaciones
       SET effective_to = p_fecha_inicio - 1,
           evidence = evidence || jsonb_build_object(
             'closed_by_fn_designar_cargo', true,
             'closed_by_condicion_id', v_new_id,
             'closed_at', now()
           )
     WHERE tenant_id = p_tenant_id
       AND entity_id = p_entity_id
       AND represented_person_id = p_person_id
       AND scope = 'ADMIN_PJ_REPRESENTANTE'
       AND meeting_id IS NULL
       AND effective_to IS NULL
       AND representative_person_id <> p_representative_person_id;

    INSERT INTO representaciones (
      tenant_id,
      entity_id,
      represented_person_id,
      representative_person_id,
      scope,
      meeting_id,
      porcentaje_delegado,
      effective_from,
      effective_to,
      evidence
    ) VALUES (
      p_tenant_id,
      p_entity_id,
      p_person_id,
      p_representative_person_id,
      'ADMIN_PJ_REPRESENTANTE',
      NULL,
      100,
      p_fecha_inicio,
      NULL,
      jsonb_build_object(
        'source_rpc',
        'fn_designar_cargo',
        'condicion_id',
        v_new_id,
        'inscripcion_rm_referencia',
        NULLIF(btrim(COALESCE(p_inscripcion_rm_referencia, '')), ''),
        'inscripcion_rm_fecha',
        p_inscripcion_rm_fecha
      )
    )
    ON CONFLICT (
      entity_id,
      represented_person_id,
      scope,
      (COALESCE(meeting_id, '00000000-0000-0000-0000-000000000000'::uuid))
    ) WHERE effective_to IS NULL
    DO UPDATE
       SET representative_person_id = EXCLUDED.representative_person_id,
           effective_from = LEAST(representaciones.effective_from, EXCLUDED.effective_from),
           evidence = representaciones.evidence || EXCLUDED.evidence;
  END IF;

  IF p_body_id IS NOT NULL
     AND to_regprocedure('public.fn_refresh_parte_votante_body(uuid)') IS NOT NULL THEN
    PERFORM fn_refresh_parte_votante_body(p_body_id);
  END IF;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_designar_cargo(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  text,
  text,
  date,
  uuid,
  boolean,
  text
) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Generic idempotency ledger for small Personas/Cargos RPCs.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS personas_cargos_rpc_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  result_id uuid NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation, idempotency_key)
);

ALTER TABLE personas_cargos_rpc_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personas_cargos_rpc_operations_tenant_isolation
  ON personas_cargos_rpc_operations;
CREATE POLICY personas_cargos_rpc_operations_tenant_isolation
  ON personas_cargos_rpc_operations
  FOR SELECT
  USING (tenant_id = fn_secretaria_current_tenant_id());

-- ---------------------------------------------------------------------
-- fn_update_persona
--
-- Server-side update for post-alta persona editing. This replaces direct
-- client UPDATEs to persons so legal identity data stays behind tenant,
-- capability and authority checks.
--
-- WORM semantics: this function does not rewrite historical evidence. It
-- only updates the mutable persons master row; archived duplicate markers
-- are reserved for fn_consolidate_person and rejected here.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_update_persona(
  p_tenant_id uuid,
  p_person_id uuid,
  p_full_name text,
  p_tax_id text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_denomination text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_person persons%ROWTYPE;
  v_result_id uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'PERSON_WRITE');
  PERFORM fn_secretaria_assert_caller_authority_rm(p_tenant_id, NULL, NULL);

  IF p_person_id IS NULL OR p_full_name IS NULL OR btrim(p_full_name) = '' THEN
    RAISE EXCEPTION 'person_id and full_name are required';
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT result_id
      INTO v_result_id
      FROM personas_cargos_rpc_operations
     WHERE tenant_id = p_tenant_id
       AND operation = 'fn_update_persona'
       AND idempotency_key = p_idempotency_key;
    IF v_result_id IS NOT NULL THEN
      RETURN v_result_id;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(concat_ws(':', 'person_write', p_tenant_id, p_person_id), 0)
  );

  SELECT *
    INTO v_person
    FROM persons
   WHERE id = p_person_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'person % does not belong to tenant %', p_person_id, p_tenant_id;
  END IF;

  IF COALESCE(v_person.tax_id, '') LIKE 'ARCHIVED-%'
     OR COALESCE(v_person.full_name, '') LIKE '[ARCHIVED]%' THEN
    RAISE EXCEPTION 'archived person % cannot be edited from fn_update_persona', p_person_id;
  END IF;

  IF btrim(p_full_name) LIKE '[ARCHIVED]%'
     OR COALESCE(btrim(p_tax_id), '') LIKE 'ARCHIVED-%' THEN
    RAISE EXCEPTION 'ARCHIVED markers are reserved for fn_consolidate_person';
  END IF;

  UPDATE persons
     SET full_name = btrim(p_full_name),
         tax_id = NULLIF(btrim(COALESCE(p_tax_id, '')), ''),
         email = NULLIF(btrim(COALESCE(p_email, '')), ''),
         denomination = NULLIF(btrim(COALESCE(p_denomination, '')), '')
   WHERE id = p_person_id
     AND tenant_id = p_tenant_id;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    INSERT INTO personas_cargos_rpc_operations (
      tenant_id,
      operation,
      idempotency_key,
      result_id,
      result
    ) VALUES (
      p_tenant_id,
      'fn_update_persona',
      p_idempotency_key,
      p_person_id,
      jsonb_build_object('person_id', p_person_id)
    )
    ON CONFLICT (tenant_id, operation, idempotency_key) DO NOTHING;
  END IF;

  RETURN p_person_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_update_persona(uuid, uuid, text, text, text, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- fn_cesar_cargo
--
-- Server-side cese. Cese is as legally material as alta, so it uses the
-- same tenant/capability/authority boundary and locks the target condition.
-- Historical cargo rows are never deleted.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_cesar_cargo(
  p_tenant_id uuid,
  p_condicion_id uuid,
  p_fecha_fin date,
  p_razon text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_condicion condiciones_persona%ROWTYPE;
  v_result_id uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'CARGO_MANAGEMENT');

  IF p_condicion_id IS NULL OR p_fecha_fin IS NULL THEN
    RAISE EXCEPTION 'condicion_id and fecha_fin are required';
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT result_id
      INTO v_result_id
      FROM personas_cargos_rpc_operations
     WHERE tenant_id = p_tenant_id
       AND operation = 'fn_cesar_cargo'
       AND idempotency_key = p_idempotency_key;
    IF v_result_id IS NOT NULL THEN
      RETURN v_result_id;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(concat_ws(':', 'condicion_cese', p_tenant_id, p_condicion_id), 0)
  );

  SELECT *
    INTO v_condicion
    FROM condiciones_persona
   WHERE id = p_condicion_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'condicion % does not belong to tenant %', p_condicion_id, p_tenant_id;
  END IF;

  PERFORM fn_secretaria_assert_caller_authority_rm(
    p_tenant_id,
    v_condicion.entity_id,
    v_condicion.body_id
  );

  IF p_fecha_fin < v_condicion.fecha_inicio THEN
    RAISE EXCEPTION 'fecha_fin % cannot be before fecha_inicio %', p_fecha_fin, v_condicion.fecha_inicio;
  END IF;

  IF v_condicion.estado <> 'CESADO' THEN
    UPDATE condiciones_persona
       SET estado = 'CESADO',
           fecha_fin = p_fecha_fin,
           metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_strip_nulls(jsonb_build_object(
               'source_rpc', 'fn_cesar_cargo',
               'cese_razon', NULLIF(btrim(COALESCE(p_razon, '')), ''),
               'cesado_at', now(),
               'idempotency_key', NULLIF(btrim(COALESCE(p_idempotency_key, '')), '')
             ))
     WHERE id = p_condicion_id
       AND tenant_id = p_tenant_id;
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    INSERT INTO personas_cargos_rpc_operations (
      tenant_id,
      operation,
      idempotency_key,
      result_id,
      result
    ) VALUES (
      p_tenant_id,
      'fn_cesar_cargo',
      p_idempotency_key,
      p_condicion_id,
      jsonb_build_object('condicion_id', p_condicion_id)
    )
    ON CONFLICT (tenant_id, operation, idempotency_key) DO NOTHING;
  END IF;

  RETURN p_condicion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_cesar_cargo(uuid, uuid, date, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- fn_upsert_representante_admin_pj
--
-- Standalone management of permanent PF representatives for PJ
-- administrators. This replaces the previous client best-effort
-- close+insert path with one transactional RPC.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_upsert_representante_admin_pj(
  p_tenant_id uuid,
  p_represented_person_id uuid,
  p_representative_person_id uuid,
  p_entity_id uuid,
  p_effective_from date,
  p_inscripcion_rm_referencia text DEFAULT NULL,
  p_inscripcion_rm_fecha date DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_represented persons%ROWTYPE;
  v_representative persons%ROWTYPE;
  v_entity entities%ROWTYPE;
  v_result_id uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'REPRESENTATION_MANAGEMENT');
  PERFORM fn_secretaria_assert_caller_authority_rm(p_tenant_id, p_entity_id, NULL);

  IF p_represented_person_id IS NULL
     OR p_representative_person_id IS NULL
     OR p_entity_id IS NULL
     OR p_effective_from IS NULL THEN
    RAISE EXCEPTION 'represented_person_id, representative_person_id, entity_id and effective_from are required';
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT result_id
      INTO v_result_id
      FROM personas_cargos_rpc_operations
     WHERE tenant_id = p_tenant_id
       AND operation = 'fn_upsert_representante_admin_pj'
       AND idempotency_key = p_idempotency_key;
    IF v_result_id IS NOT NULL THEN
      RETURN v_result_id;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', 'admin_pj_representante', p_tenant_id, p_entity_id, p_represented_person_id),
      0
    )
  );

  SELECT *
    INTO v_entity
    FROM entities
   WHERE id = p_entity_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity % does not belong to tenant %', p_entity_id, p_tenant_id;
  END IF;

  SELECT *
    INTO v_represented
    FROM persons
   WHERE id = p_represented_person_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'represented person % does not belong to tenant %', p_represented_person_id, p_tenant_id;
  END IF;

  SELECT *
    INTO v_representative
    FROM persons
   WHERE id = p_representative_person_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'representative person % does not belong to tenant %', p_representative_person_id, p_tenant_id;
  END IF;

  IF v_represented.person_type <> 'PJ' THEN
    RAISE EXCEPTION 'represented person must be PJ for ADMIN_PJ_REPRESENTANTE';
  END IF;
  IF v_representative.person_type <> 'PF' THEN
    RAISE EXCEPTION 'representative person must be PF for ADMIN_PJ_REPRESENTANTE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM condiciones_persona cp
     WHERE cp.tenant_id = p_tenant_id
       AND cp.entity_id = p_entity_id
       AND cp.person_id = p_represented_person_id
       AND cp.estado = 'VIGENTE'
       AND cp.tipo_condicion IN (
         'ADMIN_UNICO',
         'ADMIN_SOLIDARIO',
         'ADMIN_MANCOMUNADO',
         'ADMIN_PJ',
         'CONSEJERO'
       )
  ) THEN
    RAISE EXCEPTION 'represented PJ has no vigente administrator/consejero condition in entity %', p_entity_id;
  END IF;

  UPDATE representaciones
     SET effective_to = p_effective_from - 1,
         evidence = evidence || jsonb_build_object(
           'closed_by_fn_upsert_representante_admin_pj', true,
           'closed_at', now()
         )
   WHERE tenant_id = p_tenant_id
     AND entity_id = p_entity_id
     AND represented_person_id = p_represented_person_id
     AND scope = 'ADMIN_PJ_REPRESENTANTE'
     AND meeting_id IS NULL
     AND effective_to IS NULL
     AND representative_person_id <> p_representative_person_id;

  INSERT INTO representaciones (
    tenant_id,
    entity_id,
    represented_person_id,
    representative_person_id,
    scope,
    meeting_id,
    porcentaje_delegado,
    effective_from,
    effective_to,
    evidence
  ) VALUES (
    p_tenant_id,
    p_entity_id,
    p_represented_person_id,
    p_representative_person_id,
    'ADMIN_PJ_REPRESENTANTE',
    NULL,
    100,
    p_effective_from,
    NULL,
    jsonb_strip_nulls(jsonb_build_object(
      'source_rpc', 'fn_upsert_representante_admin_pj',
      'inscripcion_rm_referencia', NULLIF(btrim(COALESCE(p_inscripcion_rm_referencia, '')), ''),
      'inscripcion_rm_fecha', p_inscripcion_rm_fecha,
      'idempotency_key', NULLIF(btrim(COALESCE(p_idempotency_key, '')), '')
    ))
  )
  ON CONFLICT (
    entity_id,
    represented_person_id,
    scope,
    (COALESCE(meeting_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ) WHERE effective_to IS NULL
  DO UPDATE
     SET representative_person_id = EXCLUDED.representative_person_id,
         effective_from = LEAST(representaciones.effective_from, EXCLUDED.effective_from),
         evidence = representaciones.evidence || EXCLUDED.evidence
  RETURNING id INTO v_result_id;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    INSERT INTO personas_cargos_rpc_operations (
      tenant_id,
      operation,
      idempotency_key,
      result_id,
      result
    ) VALUES (
      p_tenant_id,
      'fn_upsert_representante_admin_pj',
      p_idempotency_key,
      v_result_id,
      jsonb_build_object('representacion_id', v_result_id)
    )
    ON CONFLICT (tenant_id, operation, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_upsert_representante_admin_pj(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  text,
  date,
  text
) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- fn_validar_cardinalidad_administracion
--
-- L12-C: ADMIN_SOLIDARIO and ADMIN_MANCOMUNADO require >=2 at closing /
-- certification time, but the first individual alta can be a legitimate
-- transient state. This utility returns warnings and does not block writes.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validar_cardinalidad_administracion(
  p_tenant_id uuid,
  p_entity_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tipo_organo_admin text;
  v_solidarios integer;
  v_mancomunados integer;
  v_warnings jsonb := '[]'::jsonb;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'CARGO_MANAGEMENT');

  SELECT e.tipo_organo_admin
    INTO v_tipo_organo_admin
    FROM entities e
   WHERE e.id = p_entity_id
     AND e.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity % does not belong to tenant %', p_entity_id, p_tenant_id;
  END IF;

  SELECT count(*) INTO v_solidarios
    FROM condiciones_persona
   WHERE tenant_id = p_tenant_id
     AND entity_id = p_entity_id
     AND tipo_condicion = 'ADMIN_SOLIDARIO'
     AND estado = 'VIGENTE';

  SELECT count(*) INTO v_mancomunados
    FROM condiciones_persona
   WHERE tenant_id = p_tenant_id
     AND entity_id = p_entity_id
     AND tipo_condicion = 'ADMIN_MANCOMUNADO'
     AND estado = 'VIGENTE';

  IF (v_tipo_organo_admin = 'ADMIN_SOLIDARIOS' AND v_solidarios < 2)
     OR (v_tipo_organo_admin IS DISTINCT FROM 'ADMIN_SOLIDARIOS' AND v_solidarios = 1) THEN
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'ADMIN_SOLIDARIO_MIN_2',
        'severity', 'WARNING',
        'message', 'La administración solidaria requiere al menos 2 titulares vigentes al cerrar distribución/certificación.'
      )
    );
  END IF;

  IF (v_tipo_organo_admin = 'ADMIN_MANCOMUNADOS' AND v_mancomunados < 2)
     OR (v_tipo_organo_admin IS DISTINCT FROM 'ADMIN_MANCOMUNADOS' AND v_mancomunados = 1) THEN
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'ADMIN_MANCOMUNADO_MIN_2',
        'severity', 'WARNING',
        'message', 'La administración mancomunada requiere al menos 2 titulares vigentes al cerrar distribución/certificación.'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'entity_id', p_entity_id,
    'tipo_organo_admin', v_tipo_organo_admin,
    'admin_solidario_count', v_solidarios,
    'admin_mancomunado_count', v_mancomunados,
    'valid_for_closing', jsonb_array_length(v_warnings) = 0,
    'warnings', v_warnings
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_validar_cardinalidad_administracion(uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Idempotency ledger for person consolidation RPCs.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS person_consolidation_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  idempotency_key text NOT NULL,
  canonical_person_id uuid NOT NULL REFERENCES persons(id),
  duplicate_person_id uuid NOT NULL REFERENCES persons(id),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

ALTER TABLE person_consolidation_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_consolidation_operations_tenant_isolation
  ON person_consolidation_operations;
CREATE POLICY person_consolidation_operations_tenant_isolation
  ON person_consolidation_operations
  FOR SELECT
  USING (tenant_id = fn_secretaria_current_tenant_id());

-- ---------------------------------------------------------------------
-- fn_consolidate_person
--
-- Consolidates mutable FK references from duplicate -> canonical in a single
-- transaction and soft-archives the duplicate person. FK coverage is dynamic
-- through pg_constraint to avoid script drift as schema grows.
--
-- WORM semantics: FK references in audit_log, censo_snapshot,
-- no_session_notificaciones, no_session_respuestas, capital_movements and
-- capital_movements_audit are intentionally skipped. no_session_expedientes
-- is a mutable lifecycle table and is migrated. The duplicate person remains
-- as an archived row so historical WORM references stay resolvable.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_consolidate_person(
  p_tenant_id uuid,
  p_canonical_person_id uuid,
  p_duplicate_person_id uuid,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_canonical persons%ROWTYPE;
  v_duplicate persons%ROWTYPE;
  v_existing_op record;
  v_rec record;
  v_sql text;
  v_has_tenant boolean;
  v_count integer;
  v_updates jsonb := '{}'::jsonb;
  v_result jsonb;
  v_worm_ref_counts jsonb := '{}'::jsonb;
  v_remaining_refs jsonb := '{}'::jsonb;
  v_skipped_tables text[] := ARRAY[
    'audit_log',
    'censo_snapshot',
    'no_session_notificaciones',
    'no_session_respuestas',
    'capital_movements',
    'capital_movements_audit',
    'person_consolidation_operations'
  ];
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'PERSON_CONSOLIDATE');
  PERFORM fn_secretaria_assert_caller_authority_rm(p_tenant_id, NULL, NULL);

  IF p_canonical_person_id IS NULL OR p_duplicate_person_id IS NULL THEN
    RAISE EXCEPTION 'canonical and duplicate person ids are required';
  END IF;
  IF p_canonical_person_id = p_duplicate_person_id THEN
    RAISE EXCEPTION 'canonical and duplicate person ids must differ';
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT canonical_person_id, duplicate_person_id, result
      INTO v_existing_op
      FROM person_consolidation_operations
     WHERE tenant_id = p_tenant_id
       AND idempotency_key = p_idempotency_key;
    IF v_existing_op.result IS NOT NULL THEN
      IF v_existing_op.canonical_person_id <> p_canonical_person_id
         OR v_existing_op.duplicate_person_id <> p_duplicate_person_id THEN
        RAISE EXCEPTION 'idempotency_key % already used for a different person consolidation pair', p_idempotency_key;
      END IF;
      RETURN v_existing_op.result;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(concat_ws(':', 'person_consolidation', p_tenant_id, p_canonical_person_id), 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended(concat_ws(':', 'person_consolidation', p_tenant_id, p_duplicate_person_id), 0)
  );

  SELECT *
    INTO v_canonical
    FROM persons
   WHERE id = p_canonical_person_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'canonical person % does not belong to tenant %', p_canonical_person_id, p_tenant_id;
  END IF;

  SELECT *
    INTO v_duplicate
    FROM persons
   WHERE id = p_duplicate_person_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'duplicate person % does not belong to tenant %', p_duplicate_person_id, p_tenant_id;
  END IF;

  IF COALESCE(v_duplicate.tax_id, '') LIKE 'ARCHIVED-%'
     OR COALESCE(v_duplicate.full_name, '') LIKE '[ARCHIVED]%' THEN
    v_result := jsonb_build_object(
      'status', 'already_archived',
      'canonical_person_id', p_canonical_person_id,
      'duplicate_person_id', p_duplicate_person_id,
      'reason', p_reason,
      'updates', '{}'::jsonb,
      'worm_skipped_tables', v_skipped_tables
    );
    IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
      INSERT INTO person_consolidation_operations (
        tenant_id,
        idempotency_key,
        canonical_person_id,
        duplicate_person_id,
        result
      ) VALUES (
        p_tenant_id,
        p_idempotency_key,
        p_canonical_person_id,
        p_duplicate_person_id,
        v_result
      )
      ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
    END IF;
    RETURN v_result;
  END IF;

  IF COALESCE(v_canonical.tax_id, '') LIKE 'ARCHIVED-%'
     OR COALESCE(v_canonical.full_name, '') LIKE '[ARCHIVED]%' THEN
    RAISE EXCEPTION 'canonical person % is archived and cannot receive consolidation', p_canonical_person_id;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM entities canonical_entity
      JOIN entities duplicate_entity
        ON duplicate_entity.tenant_id = canonical_entity.tenant_id
     WHERE canonical_entity.tenant_id = p_tenant_id
       AND canonical_entity.person_id = p_canonical_person_id
       AND duplicate_entity.person_id = p_duplicate_person_id
  ) THEN
    RAISE EXCEPTION 'person consolidation conflict: both persons are linked to entities.person_id';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM condiciones_persona duplicate_cp
      JOIN condiciones_persona canonical_cp
        ON canonical_cp.tenant_id = duplicate_cp.tenant_id
       AND canonical_cp.entity_id = duplicate_cp.entity_id
       AND COALESCE(canonical_cp.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(duplicate_cp.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND canonical_cp.tipo_condicion = duplicate_cp.tipo_condicion
       AND canonical_cp.estado = 'VIGENTE'
       AND canonical_cp.person_id = p_canonical_person_id
     WHERE duplicate_cp.tenant_id = p_tenant_id
       AND duplicate_cp.person_id = p_duplicate_person_id
       AND duplicate_cp.estado = 'VIGENTE'
  ) THEN
    RAISE EXCEPTION 'person consolidation conflict: duplicate has active condiciones_persona colliding with canonical';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM capital_holdings duplicate_holding
      JOIN capital_holdings canonical_holding
        ON canonical_holding.tenant_id = duplicate_holding.tenant_id
       AND canonical_holding.entity_id = duplicate_holding.entity_id
       AND canonical_holding.effective_to IS NULL
       AND canonical_holding.holder_person_id = p_canonical_person_id
     WHERE duplicate_holding.tenant_id = p_tenant_id
       AND duplicate_holding.holder_person_id = p_duplicate_person_id
       AND duplicate_holding.effective_to IS NULL
  ) THEN
    RAISE EXCEPTION 'person consolidation conflict: both persons have active capital_holdings in the same entity';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM representaciones duplicate_rep
      JOIN representaciones canonical_rep
        ON canonical_rep.tenant_id = duplicate_rep.tenant_id
       AND canonical_rep.entity_id = duplicate_rep.entity_id
       AND canonical_rep.scope = duplicate_rep.scope
       AND COALESCE(canonical_rep.meeting_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(duplicate_rep.meeting_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND canonical_rep.effective_to IS NULL
       AND canonical_rep.represented_person_id = p_canonical_person_id
     WHERE duplicate_rep.tenant_id = p_tenant_id
       AND duplicate_rep.represented_person_id = p_duplicate_person_id
       AND duplicate_rep.effective_to IS NULL
  ) THEN
    RAISE EXCEPTION 'person consolidation conflict: active representaciones.represented_person_id collision';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM authority_evidence duplicate_ae
      JOIN authority_evidence canonical_ae
        ON canonical_ae.tenant_id = duplicate_ae.tenant_id
       AND canonical_ae.entity_id = duplicate_ae.entity_id
       AND COALESCE(canonical_ae.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(duplicate_ae.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND canonical_ae.cargo = duplicate_ae.cargo
       AND canonical_ae.estado = 'VIGENTE'
       AND canonical_ae.person_id = p_canonical_person_id
     WHERE duplicate_ae.tenant_id = p_tenant_id
       AND duplicate_ae.person_id = p_duplicate_person_id
       AND duplicate_ae.estado = 'VIGENTE'
  ) THEN
    RAISE EXCEPTION 'person consolidation conflict: active authority_evidence collision';
  END IF;

  FOR v_rec IN
    SELECT
      ns.nspname,
      cl.relname,
      format('%I.%I', ns.nspname, cl.relname) AS qualified_table,
      att.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cl
      ON cl.oid = con.conrelid
    JOIN pg_namespace ns
      ON ns.oid = cl.relnamespace
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.persons'::regclass
      AND array_length(con.conkey, 1) = 1
      AND ns.nspname = 'public'
      AND cl.relkind IN ('r', 'p')
    ORDER BY cl.relname, att.attname
  LOOP
    SELECT EXISTS (
      SELECT 1
        FROM pg_attribute a
       WHERE a.attrelid = (v_rec.qualified_table)::regclass
         AND a.attname = 'tenant_id'
         AND a.attnum > 0
         AND NOT a.attisdropped
    )
      INTO v_has_tenant;

    IF v_rec.relname = ANY(v_skipped_tables) THEN
      IF v_has_tenant THEN
        v_sql := format(
          'SELECT count(*) FROM %s WHERE %I = $1 AND tenant_id = $2',
          v_rec.qualified_table,
          v_rec.column_name
        );
        EXECUTE v_sql INTO v_count USING p_duplicate_person_id, p_tenant_id;
      ELSE
        v_sql := format(
          'SELECT count(*) FROM %s WHERE %I = $1',
          v_rec.qualified_table,
          v_rec.column_name
        );
        EXECUTE v_sql INTO v_count USING p_duplicate_person_id;
      END IF;
      IF v_count > 0 THEN
        v_worm_ref_counts := v_worm_ref_counts || jsonb_build_object(
          v_rec.relname || '.' || v_rec.column_name,
          v_count
        );
      END IF;
      v_updates := v_updates || jsonb_build_object(
        v_rec.relname || '.' || v_rec.column_name,
        jsonb_build_object(
          'skipped',
          true,
          'reason',
          CASE
            WHEN v_rec.relname = 'person_consolidation_operations'
              THEN 'historical idempotency ledger FK preserved'
            ELSE 'WORM historical FK preserved'
          END
        )
      );
      CONTINUE;
    END IF;

    IF v_has_tenant THEN
      v_sql := format(
        'UPDATE %s SET %I = $1 WHERE %I = $2 AND tenant_id = $3',
        v_rec.qualified_table,
        v_rec.column_name,
        v_rec.column_name
      );
      BEGIN
        EXECUTE v_sql USING p_canonical_person_id, p_duplicate_person_id, p_tenant_id;
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'person consolidation unique collision on %.%', v_rec.relname, v_rec.column_name;
      END;
    ELSE
      v_sql := format(
        'UPDATE %s SET %I = $1 WHERE %I = $2',
        v_rec.qualified_table,
        v_rec.column_name,
        v_rec.column_name
      );
      BEGIN
        EXECUTE v_sql USING p_canonical_person_id, p_duplicate_person_id;
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'person consolidation unique collision on %.%', v_rec.relname, v_rec.column_name;
      END;
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_updates := v_updates || jsonb_build_object(v_rec.relname || '.' || v_rec.column_name, v_count);
    END IF;
  END LOOP;

  FOR v_rec IN
    SELECT
      ns.nspname,
      cl.relname,
      format('%I.%I', ns.nspname, cl.relname) AS qualified_table,
      att.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cl
      ON cl.oid = con.conrelid
    JOIN pg_namespace ns
      ON ns.oid = cl.relnamespace
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.persons'::regclass
      AND array_length(con.conkey, 1) = 1
      AND ns.nspname = 'public'
      AND cl.relkind IN ('r', 'p')
      AND NOT (cl.relname = ANY(v_skipped_tables))
    ORDER BY cl.relname, att.attname
  LOOP
    SELECT EXISTS (
      SELECT 1
        FROM pg_attribute a
       WHERE a.attrelid = (v_rec.qualified_table)::regclass
         AND a.attname = 'tenant_id'
         AND a.attnum > 0
         AND NOT a.attisdropped
    )
      INTO v_has_tenant;

    IF v_has_tenant THEN
      v_sql := format(
        'SELECT count(*) FROM %s WHERE %I = $1 AND tenant_id = $2',
        v_rec.qualified_table,
        v_rec.column_name
      );
      EXECUTE v_sql INTO v_count USING p_duplicate_person_id, p_tenant_id;
    ELSE
      v_sql := format(
        'SELECT count(*) FROM %s WHERE %I = $1',
        v_rec.qualified_table,
        v_rec.column_name
      );
      EXECUTE v_sql INTO v_count USING p_duplicate_person_id;
    END IF;

    IF v_count > 0 THEN
      v_remaining_refs := v_remaining_refs || jsonb_build_object(
        v_rec.relname || '.' || v_rec.column_name,
        v_count
      );
    END IF;
  END LOOP;

  IF v_remaining_refs <> '{}'::jsonb THEN
    RAISE EXCEPTION 'person consolidation left non-WORM references to duplicate: %', v_remaining_refs;
  END IF;

  UPDATE persons
     SET tax_id = 'ARCHIVED-' || replace(p_duplicate_person_id::text, '-', '') || '-' || left(COALESCE(v_duplicate.tax_id, 'NO-TAX'), 64),
         full_name = '[ARCHIVED] duplicate of ' || p_canonical_person_id::text || ' - ' || v_duplicate.full_name,
         denomination = CASE
           WHEN v_duplicate.denomination IS NULL THEN NULL
           ELSE '[ARCHIVED] ' || v_duplicate.denomination
         END,
         email = NULL,
         representative_person_id = NULL
   WHERE id = p_duplicate_person_id
     AND tenant_id = p_tenant_id;

  v_result := jsonb_build_object(
    'status', 'consolidated',
    'canonical_person_id', p_canonical_person_id,
    'duplicate_person_id', p_duplicate_person_id,
    'reason', p_reason,
    'updates', v_updates,
    'worm_reference_counts', v_worm_ref_counts,
    'worm_skipped_tables', v_skipped_tables
  );

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    INSERT INTO person_consolidation_operations (
      tenant_id,
      idempotency_key,
      canonical_person_id,
      duplicate_person_id,
      result
    ) VALUES (
      p_tenant_id,
      p_idempotency_key,
      p_canonical_person_id,
      p_duplicate_person_id,
      v_result
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_consolidate_person(uuid, uuid, uuid, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- fn_scan_vacancias_presidencia
--
-- L13-B persistent internal notifications. Inserts one notification per
-- threshold crossed. It never blocks operations.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_scan_vacancias_presidencia(
  p_tenant_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_inserted integer;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);

  WITH vacant_bodies AS (
    SELECT
      gb.id AS body_id,
      gb.entity_id,
      gb.name AS body_name,
      e.legal_name AS entity_name,
      COALESCE(
        (
          SELECT max(cp.fecha_fin)
            FROM condiciones_persona cp
           WHERE cp.tenant_id = p_tenant_id
             AND cp.entity_id = gb.entity_id
             AND cp.body_id = gb.id
             AND cp.tipo_condicion = 'PRESIDENTE'
             AND cp.estado = 'CESADO'
        ),
        (
          SELECT min(n.created_at::date)
            FROM notifications n
           WHERE n.tenant_id = p_tenant_id
             AND n.type = 'VACANCIA_PRESIDENCIA_D0'
             AND n.route = '/secretaria/organos/' || gb.id::text
        ),
        gb.created_at::date,
        CURRENT_DATE
      ) AS vacancy_start
    FROM governing_bodies gb
    JOIN entities e
      ON e.id = gb.entity_id
     AND e.tenant_id = gb.tenant_id
    WHERE gb.tenant_id = p_tenant_id
      AND (
        upper(coalesce(gb.body_type, '')) IN ('CDA', 'CONSEJO_ADMIN', 'CONSEJO_ADMINISTRACION')
        OR upper(coalesce(gb.body_type, '')) LIKE '%CONSEJO%'
      )
      AND NOT EXISTS (
        SELECT 1
          FROM condiciones_persona cp
         WHERE cp.tenant_id = p_tenant_id
           AND cp.entity_id = gb.entity_id
           AND cp.body_id = gb.id
           AND cp.tipo_condicion = 'PRESIDENTE'
           AND cp.estado = 'VIGENTE'
      )
  ),
  thresholds AS (
    SELECT 0 AS day_threshold, 'VACANCIA_PRESIDENCIA_D0' AS notice_type,
           'Vacancia de Presidencia' AS title_prefix,
           'Vacancia de Presidencia del CdA. Preside el Vicepresidente o suplente estatutario.' AS body_text
    UNION ALL
    SELECT 60, 'VACANCIA_PRESIDENCIA_D60',
           'Aviso de vacancia de Presidencia',
           'Han transcurrido 60 días sin Presidente del CdA. Se recomienda convocar distribución de cargos.'
    UNION ALL
    SELECT 90, 'VACANCIA_PRESIDENCIA_D90',
           'Alerta crítica de vacancia de Presidencia',
           'Vacancia presidencial excede los 90 días razonables. Riesgo de cuestionamiento registral o societario.'
  ),
  pending AS (
    SELECT
      p_tenant_id AS tenant_id,
      t.notice_type AS type,
      t.title_prefix || ' - ' || vb.entity_name AS title,
      t.body_text || ' Owner operativo: Secretario del CdA o Vicesecretario en suplencia.' AS body,
      '/secretaria/organos/' || vb.body_id::text AS route
    FROM vacant_bodies vb
    CROSS JOIN thresholds t
    WHERE (CURRENT_DATE - vb.vacancy_start) >= t.day_threshold
      AND NOT EXISTS (
        SELECT 1
          FROM notifications n
         WHERE n.tenant_id = p_tenant_id
           AND n.type = t.notice_type
           AND n.route = '/secretaria/organos/' || vb.body_id::text
      )
  )
  INSERT INTO notifications (tenant_id, type, title, body, route, is_read)
  SELECT tenant_id, type, title, body, route, false
    FROM pending;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'inserted_notifications', v_inserted,
    'blocking', false,
    'thresholds', jsonb_build_array('D+0', 'D+60', 'D+90'),
    'owner', 'SECRETARIO_OR_VICESECRETARIO'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_scan_vacancias_presidencia(uuid)
  TO authenticated, service_role;

COMMIT;
