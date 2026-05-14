-- Secretaria production closeout: Sprint 1/Sprint 3 hardening.
-- Scope:
-- - close effective EXECUTE grants leaked to anon on SECURITY DEFINER RPCs;
-- - add transactional RPCs for one-off LSC representations tied to meetings.

BEGIN;

-- ---------------------------------------------------------------------
-- 1) RPC surface hardening
-- ---------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.fn_designar_cargo(
  uuid, uuid, uuid, uuid, text, date, text, text, date, uuid, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_designar_cargo(
  uuid, uuid, uuid, uuid, text, date, text, text, date, uuid, boolean, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_update_persona(
  uuid, uuid, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_persona(
  uuid, uuid, text, text, text, text, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_cesar_cargo(
  uuid, uuid, date, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cesar_cargo(
  uuid, uuid, date, text, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_upsert_representante_admin_pj(
  uuid, uuid, uuid, uuid, date, text, date, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_upsert_representante_admin_pj(
  uuid, uuid, uuid, uuid, date, text, date, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_scan_vacancias_presidencia(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_scan_vacancias_presidencia(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_secretaria_assert_caller_authority_rm(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_assert_caller_authority_rm(uuid, uuid, uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_consolidate_person(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_consolidate_person(uuid, uuid, uuid, text, text)
  TO service_role;

-- ---------------------------------------------------------------------
-- 2) Personas import support
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_import_persona_row(
  p_tenant_id uuid,
  p_full_name text,
  p_person_type text,
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
  v_existing persons%ROWTYPE;
  v_result_id uuid;
  v_tax_id text := NULLIF(btrim(COALESCE(p_tax_id, '')), '');
  v_email text := NULLIF(btrim(COALESCE(p_email, '')), '');
  v_denomination text := NULLIF(btrim(COALESCE(p_denomination, '')), '');
  v_full_name text := NULLIF(btrim(COALESCE(p_full_name, '')), '');
  v_matched_existing boolean := false;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'PERSON_WRITE');
  PERFORM fn_secretaria_assert_caller_authority_rm(p_tenant_id, NULL, NULL);

  IF v_full_name IS NULL THEN
    RAISE EXCEPTION 'full_name is required';
  END IF;

  IF p_person_type NOT IN ('PF', 'PJ') THEN
    RAISE EXCEPTION 'person_type must be PF or PJ';
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT result_id
      INTO v_result_id
      FROM personas_cargos_rpc_operations
     WHERE tenant_id = p_tenant_id
       AND operation = 'fn_import_persona_row'
       AND idempotency_key = p_idempotency_key;
    IF v_result_id IS NOT NULL THEN
      RETURN v_result_id;
    END IF;
  END IF;

  IF v_tax_id IS NOT NULL THEN
    SELECT *
      INTO v_existing
      FROM persons
     WHERE tenant_id = p_tenant_id
       AND tax_id = v_tax_id
     FOR UPDATE;
  END IF;

  IF FOUND THEN
    v_matched_existing := true;
    UPDATE persons
       SET email = COALESCE(v_email, email),
           denomination = CASE WHEN p_person_type = 'PJ' THEN COALESCE(v_denomination, denomination) ELSE denomination END
     WHERE id = v_existing.id
     RETURNING id INTO v_result_id;
  ELSE
    INSERT INTO persons (
      tenant_id,
      full_name,
      tax_id,
      email,
      person_type,
      denomination
    ) VALUES (
      p_tenant_id,
      v_full_name,
      v_tax_id,
      v_email,
      p_person_type,
      CASE WHEN p_person_type = 'PJ' THEN COALESCE(v_denomination, v_full_name) ELSE v_denomination END
    )
    RETURNING id INTO v_result_id;
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
      'fn_import_persona_row',
      p_idempotency_key,
      v_result_id,
      jsonb_build_object('person_id', v_result_id, 'matched_existing', v_matched_existing)
    )
    ON CONFLICT (tenant_id, operation, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_import_persona_row(
  uuid, text, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_import_persona_row(
  uuid, text, text, text, text, text, text
) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) Meeting-scoped representations
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_upsert_representacion_puntual(
  p_tenant_id uuid,
  p_entity_id uuid,
  p_meeting_id uuid,
  p_represented_person_id uuid,
  p_representative_person_id uuid,
  p_scope text,
  p_porcentaje_delegado numeric DEFAULT 100,
  p_effective_from date DEFAULT CURRENT_DATE,
  p_evidence jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_entity entities%ROWTYPE;
  v_meeting meetings%ROWTYPE;
  v_body governing_bodies%ROWTYPE;
  v_represented persons%ROWTYPE;
  v_representative persons%ROWTYPE;
  v_effective_from date := COALESCE(p_effective_from, CURRENT_DATE);
  v_result_id uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'REPRESENTATION_MANAGEMENT');
  PERFORM fn_secretaria_assert_caller_authority_rm(p_tenant_id, p_entity_id, NULL);

  IF p_entity_id IS NULL
     OR p_meeting_id IS NULL
     OR p_represented_person_id IS NULL
     OR p_representative_person_id IS NULL
     OR NULLIF(btrim(COALESCE(p_scope, '')), '') IS NULL THEN
    RAISE EXCEPTION 'entity_id, meeting_id, represented_person_id, representative_person_id and scope are required';
  END IF;

  IF p_scope NOT IN ('JUNTA_PROXY', 'CONSEJO_DELEGACION') THEN
    RAISE EXCEPTION 'scope % is not a meeting-scoped representation', p_scope;
  END IF;

  IF p_represented_person_id = p_representative_person_id THEN
    RAISE EXCEPTION 'represented and representative persons must be different';
  END IF;

  IF COALESCE(p_porcentaje_delegado, 100) <= 0 OR COALESCE(p_porcentaje_delegado, 100) > 100 THEN
    RAISE EXCEPTION 'porcentaje_delegado must be in (0, 100]';
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT result_id
      INTO v_result_id
      FROM personas_cargos_rpc_operations
     WHERE tenant_id = p_tenant_id
       AND operation = 'fn_upsert_representacion_puntual'
       AND idempotency_key = p_idempotency_key;
    IF v_result_id IS NOT NULL THEN
      RETURN v_result_id;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', 'representacion_puntual', p_tenant_id, p_entity_id, p_meeting_id, p_scope, p_represented_person_id),
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
    INTO v_meeting
    FROM meetings
   WHERE id = p_meeting_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'meeting % does not belong to tenant %', p_meeting_id, p_tenant_id;
  END IF;

  SELECT *
    INTO v_body
    FROM governing_bodies
   WHERE id = v_meeting.body_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND OR v_body.entity_id IS DISTINCT FROM p_entity_id THEN
    RAISE EXCEPTION 'meeting % does not belong to entity %', p_meeting_id, p_entity_id;
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

  IF p_scope = 'JUNTA_PROXY' THEN
    IF NOT EXISTS (
      SELECT 1
        FROM capital_holdings ch
       WHERE ch.tenant_id = p_tenant_id
         AND ch.entity_id = p_entity_id
         AND ch.holder_person_id = p_represented_person_id
         AND ch.effective_to IS NULL
    ) AND NOT EXISTS (
      SELECT 1
        FROM condiciones_persona cp
       WHERE cp.tenant_id = p_tenant_id
         AND cp.entity_id = p_entity_id
         AND cp.person_id = p_represented_person_id
         AND cp.tipo_condicion = 'SOCIO'
         AND cp.estado = 'VIGENTE'
    ) THEN
      RAISE EXCEPTION 'represented person must be a vigente shareholder/socio for JUNTA_PROXY';
    END IF;
  END IF;

  IF p_scope = 'CONSEJO_DELEGACION' THEN
    IF NOT EXISTS (
      SELECT 1
        FROM condiciones_persona cp
       WHERE cp.tenant_id = p_tenant_id
         AND cp.entity_id = p_entity_id
         AND cp.body_id = v_body.id
         AND cp.person_id = p_represented_person_id
         AND cp.estado = 'VIGENTE'
         AND cp.tipo_condicion IN ('CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR')
    ) THEN
      RAISE EXCEPTION 'represented person must be a vigente board member for CONSEJO_DELEGACION';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM condiciones_persona cp
       WHERE cp.tenant_id = p_tenant_id
         AND cp.entity_id = p_entity_id
         AND cp.body_id = v_body.id
         AND cp.person_id = p_representative_person_id
         AND cp.estado = 'VIGENTE'
         AND cp.tipo_condicion IN ('CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR')
    ) THEN
      RAISE EXCEPTION 'representative person must be a vigente board member for CONSEJO_DELEGACION';
    END IF;
  END IF;

  UPDATE representaciones
     SET effective_to = v_effective_from - 1,
         evidence = evidence || jsonb_build_object(
           'closed_by_fn_upsert_representacion_puntual', true,
           'closed_at', now()
         )
   WHERE tenant_id = p_tenant_id
     AND entity_id = p_entity_id
     AND meeting_id = p_meeting_id
     AND represented_person_id = p_represented_person_id
     AND scope = p_scope
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
    p_scope,
    p_meeting_id,
    COALESCE(p_porcentaje_delegado, 100),
    v_effective_from,
    NULL,
    COALESCE(p_evidence, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'source_rpc', 'fn_upsert_representacion_puntual',
      'body_id', v_body.id,
      'body_type', v_body.body_type,
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
         porcentaje_delegado = EXCLUDED.porcentaje_delegado,
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
      'fn_upsert_representacion_puntual',
      p_idempotency_key,
      v_result_id,
      jsonb_build_object('representacion_id', v_result_id)
    )
    ON CONFLICT (tenant_id, operation, idempotency_key) DO NOTHING;
  END IF;

  IF p_scope = 'CONSEJO_DELEGACION'
     AND to_regprocedure('public.fn_refresh_parte_votante_body(uuid)') IS NOT NULL THEN
    PERFORM fn_refresh_parte_votante_body(v_body.id);
  END IF;

  RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_upsert_representacion_puntual(
  uuid, uuid, uuid, uuid, uuid, text, numeric, date, jsonb, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_upsert_representacion_puntual(
  uuid, uuid, uuid, uuid, uuid, text, numeric, date, jsonb, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_close_representacion_puntual(
  p_tenant_id uuid,
  p_representacion_id uuid,
  p_effective_to date DEFAULT CURRENT_DATE,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rep representaciones%ROWTYPE;
  v_effective_to date := COALESCE(p_effective_to, CURRENT_DATE);
  v_result_id uuid;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'REPRESENTATION_MANAGEMENT');

  IF p_representacion_id IS NULL THEN
    RAISE EXCEPTION 'representacion_id is required';
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT result_id
      INTO v_result_id
      FROM personas_cargos_rpc_operations
     WHERE tenant_id = p_tenant_id
       AND operation = 'fn_close_representacion_puntual'
       AND idempotency_key = p_idempotency_key;
    IF v_result_id IS NOT NULL THEN
      RETURN v_result_id;
    END IF;
  END IF;

  SELECT *
    INTO v_rep
    FROM representaciones
   WHERE id = p_representacion_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'representacion % does not belong to tenant %', p_representacion_id, p_tenant_id;
  END IF;

  IF v_rep.scope NOT IN ('JUNTA_PROXY', 'CONSEJO_DELEGACION') THEN
    RAISE EXCEPTION 'only meeting-scoped representations can be closed by this RPC';
  END IF;

  PERFORM fn_secretaria_assert_caller_authority_rm(p_tenant_id, v_rep.entity_id, NULL);

  IF v_effective_to < v_rep.effective_from THEN
    RAISE EXCEPTION 'effective_to cannot be before effective_from';
  END IF;

  UPDATE representaciones
     SET effective_to = v_effective_to,
         evidence = evidence || jsonb_strip_nulls(jsonb_build_object(
           'closed_by_fn_close_representacion_puntual', true,
           'closed_at', now(),
           'close_reason', NULLIF(btrim(COALESCE(p_reason, '')), ''),
           'idempotency_key', NULLIF(btrim(COALESCE(p_idempotency_key, '')), '')
         ))
   WHERE id = p_representacion_id
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
      'fn_close_representacion_puntual',
      p_idempotency_key,
      v_result_id,
      jsonb_build_object('representacion_id', v_result_id)
    )
    ON CONFLICT (tenant_id, operation, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_close_representacion_puntual(
  uuid, uuid, date, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_close_representacion_puntual(
  uuid, uuid, date, text, text
) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4) Plantillas P0 closeout
-- ---------------------------------------------------------------------

UPDATE plantillas_protegidas
   SET capa1_inmutable = CASE
         WHEN position('{{#if requiere_experto}}' in coalesce(capa1_inmutable, '')) > 0
           THEN capa1_inmutable
         ELSE coalesce(capa1_inmutable, '') || E'\n\n{{#if requiere_experto}}La relación de canje y las menciones económicas de la operación han sido verificadas mediante informe de experto independiente, en los términos previstos en los artículos 28 a 30 del RDL 5/2023, cuando dicho informe sea legalmente exigible.{{else}}De conformidad con el régimen simplificado aplicable y, en particular, con el artículo 53 del RDL 5/2023 cuando proceda, se deja constancia de que no resulta exigible informe de experto independiente, sin perjuicio de las menciones y documentos que deban incorporarse al expediente.{{/if}}'
       END,
       capa3_editables = CASE
         WHEN EXISTS (
           SELECT 1
             FROM jsonb_array_elements(coalesce(capa3_editables, '[]'::jsonb)) item
            WHERE item->>'campo' = 'requiere_experto'
         ) THEN capa3_editables
         ELSE coalesce(capa3_editables, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'campo', 'requiere_experto',
           'tipo', 'boolean',
           'label', 'Informe de experto independiente exigible',
           'descripcion', 'Activa el bloque de informe de experto cuando proceda por RDL 5/2023.',
           'obligatoriedad', 'OBLIGATORIO'
         ))
       END,
       review_notes = concat_ws(
         E'\n',
         nullif(review_notes, ''),
         '2026-05-14 closeout: añadido condicional requiere_experto para cerrar P0 SEM_FUSION_EXPERTO_CONDICIONAL.'
       ),
       review_date = now()
 WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
   AND id = 'e3697ad9-e0c2-4baf-9144-c80a11808c07';

COMMIT;
