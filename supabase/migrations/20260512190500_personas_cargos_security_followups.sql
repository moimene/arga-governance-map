-- 20260513_000069_personas_cargos_security_followups.sql
-- Sprint 2 Personas/Cargos adversarial follow-up:
--   * tenant-scoped representaciones unique conflict target
--   * no backdated singleton auto-cese that creates invalid historical ranges
--   * legal identity immutability once a person has societary/evidentiary refs
--   * fn_consolidate_person restricted to service_role execution only
--   * SECURITY DEFINER RPCs explicitly revoke PUBLIC execute

BEGIN;

DROP INDEX IF EXISTS ux_representaciones_vigente;

CREATE UNIQUE INDEX ux_representaciones_vigente
  ON representaciones(
    tenant_id,
    entity_id,
    represented_person_id,
    scope,
    (COALESCE(meeting_id, '00000000-0000-0000-0000-000000000000'::uuid))
  )
  WHERE effective_to IS NULL;

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
    IF p_cesar_singleton_previo AND EXISTS (
      SELECT 1
        FROM condiciones_persona cp
       WHERE cp.tenant_id = p_tenant_id
         AND cp.entity_id = p_entity_id
         AND cp.body_id = p_body_id
         AND cp.tipo_condicion = p_tipo_condicion
         AND cp.estado = 'VIGENTE'
         AND cp.person_id <> p_person_id
         AND cp.fecha_inicio > p_fecha_inicio - 1
    ) THEN
      RAISE EXCEPTION 'replacement fecha_inicio % would close existing singleton cargo before its fecha_inicio', p_fecha_inicio;
    END IF;
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
    IF p_cesar_singleton_previo AND EXISTS (
      SELECT 1
        FROM condiciones_persona cp
       WHERE cp.tenant_id = p_tenant_id
         AND cp.entity_id = p_entity_id
         AND cp.tipo_condicion = 'ADMIN_UNICO'
         AND cp.estado = 'VIGENTE'
         AND cp.person_id <> p_person_id
         AND cp.fecha_inicio > p_fecha_inicio - 1
    ) THEN
      RAISE EXCEPTION 'replacement fecha_inicio % would close existing ADMIN_UNICO before its fecha_inicio', p_fecha_inicio;
    END IF;
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
      tenant_id,
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

REVOKE ALL ON FUNCTION fn_designar_cargo(uuid, uuid, uuid, uuid, text, date, text, text, date, uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_designar_cargo(uuid, uuid, uuid, uuid, text, date, text, text, date, uuid, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION fn_designar_cargo(uuid, uuid, uuid, uuid, text, date, text, text, date, uuid, boolean, text) TO authenticated, service_role;

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
  v_legal_identity_changed boolean;
  v_has_evidentiary_refs boolean;
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


  v_legal_identity_changed :=
    btrim(p_full_name) IS DISTINCT FROM v_person.full_name
    OR NULLIF(btrim(COALESCE(p_tax_id, '')), '') IS DISTINCT FROM v_person.tax_id
    OR NULLIF(btrim(COALESCE(p_denomination, '')), '') IS DISTINCT FROM v_person.denomination;

  IF v_legal_identity_changed THEN
    SELECT EXISTS (
      SELECT 1 FROM entities e
       WHERE e.tenant_id = p_tenant_id AND e.person_id = p_person_id
      UNION ALL
      SELECT 1 FROM condiciones_persona cp
       WHERE cp.tenant_id = p_tenant_id
         AND (cp.person_id = p_person_id OR cp.representative_person_id = p_person_id)
      UNION ALL
      SELECT 1 FROM authority_evidence ae
       WHERE ae.tenant_id = p_tenant_id AND ae.person_id = p_person_id
      UNION ALL
      SELECT 1 FROM capital_holdings ch
       WHERE ch.tenant_id = p_tenant_id AND ch.holder_person_id = p_person_id
      UNION ALL
      SELECT 1 FROM representaciones r
       WHERE r.tenant_id = p_tenant_id
         AND (r.represented_person_id = p_person_id OR r.representative_person_id = p_person_id)
      UNION ALL
      SELECT 1 FROM no_session_respuestas nsr
       WHERE nsr.tenant_id = p_tenant_id AND nsr.person_id = p_person_id
      UNION ALL
      SELECT 1 FROM no_session_notificaciones nsn
       WHERE nsn.tenant_id = p_tenant_id AND nsn.person_id = p_person_id
    ) INTO v_has_evidentiary_refs;

    IF v_has_evidentiary_refs THEN
      RAISE EXCEPTION 'legal identity fields are immutable once the person has societary/evidentiary references; use consolidation or a versioned correction flow';
    END IF;
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

REVOKE ALL ON FUNCTION fn_update_persona(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_update_persona(uuid, uuid, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION fn_update_persona(uuid, uuid, text, text, text, text, text) TO authenticated, service_role;

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
    tenant_id,
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

REVOKE ALL ON FUNCTION fn_upsert_representante_admin_pj(uuid, uuid, uuid, uuid, date, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_upsert_representante_admin_pj(uuid, uuid, uuid, uuid, date, text, date, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION fn_upsert_representante_admin_pj(uuid, uuid, uuid, uuid, date, text, date, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION fn_consolidate_person(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_consolidate_person(uuid, uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION fn_consolidate_person(uuid, uuid, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION fn_scan_vacancias_presidencia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_scan_vacancias_presidencia(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION fn_secretaria_assert_caller_authority_rm(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_secretaria_assert_caller_authority_rm(uuid, uuid, uuid)
  TO authenticated, service_role;

COMMIT;
