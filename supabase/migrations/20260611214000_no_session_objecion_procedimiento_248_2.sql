-- ITEM-047 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- Art. 248.2 LSC (BOE): la votación por escrito y sin sesión del consejo solo
-- es admisible "cuando ningún consejero se oponga a este procedimiento". La
-- RPC contaba OBJECION_PROCEDIMIENTO como un voto en contra más: en el camino
-- mayoritario (default del stepper) el acuerdo podía APROBARSE con favor >
-- contra pese a existir oposición al procedimiento. Esta migración añade la
-- rama prioritaria: UNA oposición al procedimiento en CIRCULACION_CONSEJO
-- cierra el expediente como RECHAZADO/CERRADO_FAIL con motivo
-- 'procedure_objected'. La UI expone la opción en el mismo commit.
-- Resto del cuerpo idéntico al vigente en Cloud. Forward-only, idempotente.

CREATE OR REPLACE FUNCTION public.fn_no_session_cast_response(p_tenant_id uuid, p_resolution_id uuid, p_person_id uuid, p_sentido text, p_texto_respuesta text DEFAULT NULL::text, p_firma_qes_ref text DEFAULT NULL::text, p_notificacion_certificada_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_resolution no_session_resolutions%ROWTYPE;
  v_body record;
  v_expediente_id uuid;
  v_response_id uuid;
  v_existing_response_id uuid;
  v_sentido text;
  v_capital_participacion numeric;
  v_porcentaje_capital numeric;
  v_es_consejero boolean;
  v_votes_for integer;
  v_votes_against integer;
  v_abstentions integer;
  v_total_required integer;
  v_next_status text;
  v_tipo_proceso text;
  v_condicion_adopcion text;
  v_current_person_id uuid;
  v_is_proxy boolean := false;
  v_objeciones_procedimiento integer := 0;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_capability(p_tenant_id, 'VOTE_EMISSION');
  IF p_resolution_id IS NULL THEN
    RAISE EXCEPTION 'p_resolution_id is required';
  END IF;
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'p_person_id is required';
  END IF;

  PERFORM fn_secretaria_assert_person_tenant(p_tenant_id, p_person_id);
  IF NOT fn_secretaria_is_service_role() THEN
    v_current_person_id := fn_secretaria_current_person_id();
    IF v_current_person_id IS NULL OR v_current_person_id <> p_person_id THEN
      PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);
      v_is_proxy := true;
    END IF;
  END IF;

  v_sentido := upper(trim(p_sentido));
  IF v_sentido NOT IN ('CONSENTIMIENTO', 'OBJECION', 'OBJECION_PROCEDIMIENTO', 'SILENCIO') THEN
    RAISE EXCEPTION 'sentido invalido: %', p_sentido;
  END IF;

  SELECT *
    INTO v_resolution
    FROM no_session_resolutions
   WHERE id = p_resolution_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_session_resolution not found: %', p_resolution_id;
  END IF;

  IF v_resolution.status NOT IN ('VOTING_OPEN', 'ABIERTO', 'NOTIFICADO') THEN
    SELECT r.id INTO v_existing_response_id
      FROM no_session_expedientes e
      JOIN no_session_respuestas r ON r.expediente_id = e.id
     WHERE e.tenant_id = p_tenant_id
       AND e.no_session_resolution_id = p_resolution_id
       AND r.person_id = p_person_id
     LIMIT 1;

    IF v_existing_response_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', v_resolution.status,
        'resolution_id', p_resolution_id,
        'response_id', v_existing_response_id,
        'idempotent', true,
        'recorded_by_proxy', v_is_proxy,
        'message', 'response_already_recorded'
      );
    END IF;

    RAISE EXCEPTION 'votacion no activa: %', v_resolution.status;
  END IF;

  IF v_resolution.voting_deadline IS NOT NULL AND v_resolution.voting_deadline < now() THEN
    UPDATE no_session_resolutions
       SET status = 'RECHAZADO',
           closed_at = COALESCE(closed_at, now())
     WHERE id = p_resolution_id
       AND tenant_id = p_tenant_id;

    UPDATE no_session_expedientes
       SET estado = 'CERRADO_FAIL',
           fecha_cierre = COALESCE(fecha_cierre, now()),
           motivo_cierre = COALESCE(motivo_cierre, 'voting_deadline_expired')
     WHERE tenant_id = p_tenant_id
       AND no_session_resolution_id = p_resolution_id;

    RAISE EXCEPTION 'voting window expired for no_session_resolution %', p_resolution_id;
  END IF;

  SELECT gb.id, gb.entity_id, gb.body_type, gb.name
    INTO v_body
    FROM governing_bodies gb
   WHERE gb.id = v_resolution.body_id
     AND gb.tenant_id = p_tenant_id;
  IF v_body.id IS NULL OR v_body.entity_id IS NULL THEN
    RAISE EXCEPTION 'governing body/entity not found for no_session_resolution %', p_resolution_id;
  END IF;

  v_tipo_proceso := CASE
    WHEN upper(coalesce(v_body.body_type, '')) LIKE '%CONSEJO%'
      OR upper(coalesce(v_body.body_type, '')) IN ('CDA', 'CONSEJO_ADMIN')
      THEN 'CIRCULACION_CONSEJO'
    ELSE 'UNANIMIDAD_ESCRITA_SL'
  END;

  v_condicion_adopcion := CASE
    WHEN v_resolution.requires_unanimity IS TRUE AND v_tipo_proceso = 'CIRCULACION_CONSEJO'
      THEN 'UNANIMIDAD_CONSEJEROS'
    WHEN v_resolution.requires_unanimity IS TRUE
      THEN 'UNANIMIDAD_CAPITAL'
    ELSE 'MAYORIA_CONSEJEROS_ESCRITA'
  END;

  INSERT INTO no_session_expedientes (
    tenant_id, agreement_id, no_session_resolution_id, selected_template_id,
    entity_id, body_id, tipo_proceso, propuesta_texto, propuesta_fecha,
    ventana_inicio, ventana_fin, estado, condicion_adopcion, snapshot_hash
  ) VALUES (
    p_tenant_id, NULL, p_resolution_id, v_resolution.selected_template_id,
    v_body.entity_id, v_body.id, v_tipo_proceso, v_resolution.proposal_text, current_date,
    COALESCE(v_resolution.opened_at, now()), v_resolution.voting_deadline,
    'ABIERTO', v_condicion_adopcion,
    encode(digest(
      coalesce(v_resolution.title, '') || '|' ||
      coalesce(v_resolution.proposal_text, '') || '|' ||
      p_resolution_id::text,
      'sha256'
    ), 'hex')
  )
  ON CONFLICT (tenant_id, no_session_resolution_id)
  WHERE no_session_resolution_id IS NOT NULL
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_expediente_id;

  SELECT
    COALESCE(SUM(numero_titulos), 0),
    COALESCE(SUM(porcentaje_capital), 0)
    INTO v_capital_participacion, v_porcentaje_capital
    FROM capital_holdings
   WHERE tenant_id = p_tenant_id
     AND entity_id = v_body.entity_id
     AND holder_person_id = p_person_id
     AND effective_to IS NULL;

  SELECT EXISTS (
    SELECT 1
      FROM condiciones_persona
     WHERE tenant_id = p_tenant_id
       AND person_id = p_person_id
       AND entity_id = v_body.entity_id
       AND estado = 'VIGENTE'
       AND (
         body_id = v_body.id
         OR tipo_condicion IN ('CONSEJERO', 'PRESIDENTE', 'SECRETARIO', 'VICEPRESIDENTE', 'CONSEJERO_COORDINADOR')
       )
  ) INTO v_es_consejero;

  INSERT INTO no_session_respuestas (
    tenant_id, expediente_id, person_id,
    capital_participacion, porcentaje_capital, es_consejero,
    sentido, texto_respuesta, fecha_respuesta,
    firma_qes_ref, firma_qes_timestamp, ocsp_status,
    notificacion_certificada_ref
  ) VALUES (
    p_tenant_id, v_expediente_id, p_person_id,
    v_capital_participacion, v_porcentaje_capital, v_es_consejero,
    v_sentido,
    COALESCE(
      p_texto_respuesta,
      CASE WHEN v_is_proxy THEN 'Respuesta documentada por Secretaria para el expediente sin sesion.' ELSE NULL END
    ),
    now(),
    p_firma_qes_ref,
    CASE WHEN p_firma_qes_ref IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN p_firma_qes_ref IS NOT NULL THEN 'GOOD' ELSE NULL END,
    p_notificacion_certificada_ref
  )
  ON CONFLICT (expediente_id, person_id) DO NOTHING
  RETURNING id INTO v_response_id;

  IF v_response_id IS NULL THEN
    SELECT id INTO v_response_id
      FROM no_session_respuestas
     WHERE expediente_id = v_expediente_id
       AND person_id = p_person_id;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE sentido = 'CONSENTIMIENTO')::integer,
    COUNT(*) FILTER (WHERE sentido IN ('OBJECION', 'OBJECION_PROCEDIMIENTO'))::integer,
    COUNT(*) FILTER (WHERE sentido = 'SILENCIO')::integer,
    COUNT(*) FILTER (WHERE sentido = 'OBJECION_PROCEDIMIENTO')::integer
    INTO v_votes_for, v_votes_against, v_abstentions, v_objeciones_procedimiento
    FROM no_session_respuestas
   WHERE expediente_id = v_expediente_id;

  v_total_required := COALESCE(NULLIF(v_resolution.total_members, 0), 0);
  IF v_total_required = 0 THEN
    SELECT COUNT(*)::integer INTO v_total_required
      FROM condiciones_persona
     WHERE tenant_id = p_tenant_id
       AND entity_id = v_body.entity_id
       AND estado = 'VIGENTE'
       AND (
         body_id = v_body.id
         OR (v_tipo_proceso <> 'CIRCULACION_CONSEJO' AND tipo_condicion = 'SOCIO')
       );
  END IF;
  IF v_total_required = 0 THEN
    v_total_required := v_votes_for + v_votes_against + v_abstentions;
  END IF;

  v_next_status := v_resolution.status;
  -- ITEM-047 / art. 248.2 LSC: la votacion por escrito y sin sesion del
  -- consejo solo es admisible "cuando ningun consejero se oponga a este
  -- procedimiento". Una sola oposicion al procedimiento cierra el expediente,
  -- con independencia del recuento de fondo.
  IF v_tipo_proceso = 'CIRCULACION_CONSEJO' AND v_objeciones_procedimiento > 0 THEN
    v_next_status := 'RECHAZADO';
  ELSIF v_resolution.requires_unanimity IS TRUE AND v_votes_against > 0 THEN
    v_next_status := 'RECHAZADO';
  ELSIF v_resolution.requires_unanimity IS TRUE AND v_total_required > 0 AND v_votes_for >= v_total_required THEN
    v_next_status := 'APROBADO';
  ELSIF v_resolution.requires_unanimity IS NOT TRUE
        AND v_total_required > 0
        AND (v_votes_for + v_votes_against + v_abstentions) >= v_total_required THEN
    v_next_status := CASE WHEN v_votes_for > v_votes_against THEN 'APROBADO' ELSE 'RECHAZADO' END;
  ELSE
    v_next_status := 'VOTING_OPEN';
  END IF;

  UPDATE no_session_resolutions
     SET votes_for = v_votes_for,
         votes_against = v_votes_against,
         abstentions = v_abstentions,
         total_members = COALESCE(NULLIF(total_members, 0), v_total_required),
         status = v_next_status,
         closed_at = CASE
           WHEN v_next_status IN ('APROBADO', 'RECHAZADO') THEN COALESCE(closed_at, now())
           ELSE closed_at
         END
   WHERE id = p_resolution_id
     AND tenant_id = p_tenant_id;

  UPDATE no_session_expedientes
     SET estado = CASE
           WHEN v_next_status = 'APROBADO' THEN 'CERRADO_OK'
           WHEN v_next_status = 'RECHAZADO' THEN 'CERRADO_FAIL'
           ELSE 'ABIERTO'
         END,
         fecha_cierre = CASE
           WHEN v_next_status IN ('APROBADO', 'RECHAZADO') THEN COALESCE(fecha_cierre, now())
           ELSE fecha_cierre
         END,
         motivo_cierre = CASE
           WHEN v_next_status = 'APROBADO' THEN 'condition_met'
           WHEN v_next_status = 'RECHAZADO' AND v_tipo_proceso = 'CIRCULACION_CONSEJO' AND v_objeciones_procedimiento > 0 THEN 'procedure_objected'
           WHEN v_next_status = 'RECHAZADO' THEN 'condition_failed'
           ELSE motivo_cierre
         END
   WHERE id = v_expediente_id;

  RETURN jsonb_build_object(
    'resolution_id', p_resolution_id,
    'expediente_id', v_expediente_id,
    'response_id', v_response_id,
    'idempotent', false,
    'status', v_next_status,
    'votes_for', v_votes_for,
    'votes_against', v_votes_against,
    'abstentions', v_abstentions,
    'total_members', v_total_required,
    'recorded_by_proxy', v_is_proxy
  );
END;
$function$;
