-- ITEM-048 — Adopción sin sesión: la mayoría no puede resolverse siempre por
-- pluralidad de cabezas (paquete legal Comité Legal + Garrigues, firmado).
--
-- La RPC resolvía la rama NO-unánime con `votes_for > votes_against` (mayoría
-- ordinaria de concurrentes, art. 248.1 LSC) para TODA materia de consejo. Pero
-- la delegación PERMANENTE de facultades (nombramiento de consejero delegado o
-- comisión ejecutiva) exige el voto favorable de las DOS TERCERAS PARTES de los
-- componentes del consejo (art. 249.3 LSC, verificado BOE). Se respeta ese umbral
-- reforzado cuando la materia lo requiere; el resto conserva la mayoría ordinaria.
--
-- Self-contained: usa v_resolution.agreement_kind (campo ya existente). La rama
-- de unanimidad (junta SL escrita / consejo unánime) y el resto del cuerpo se
-- mantienen idénticos. Forward-only.

CREATE OR REPLACE FUNCTION fn_no_session_close_and_materialize_agreement(
  p_tenant_id uuid,
  p_resolution_id uuid,
  p_resultado text DEFAULT NULL,
  p_selected_template_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_resolution no_session_resolutions%ROWTYPE;
  v_body record;
  v_expediente no_session_expedientes%ROWTYPE;
  v_existing_agreement_id uuid;
  v_agreement_id uuid;
  v_resultado text;
  v_requested_resultado text;
  v_votes_for integer;
  v_votes_against integer;
  v_abstentions integer;
  v_votes_cast integer;
  v_total_required integer;
  v_decision_text text;
  v_template_id uuid;
  v_tipo_proceso text;
  v_condicion_adopcion text;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);
  PERFORM fn_secretaria_assert_template_tenant(p_tenant_id, p_selected_template_id);
  IF p_resolution_id IS NULL THEN
    RAISE EXCEPTION 'p_resolution_id is required';
  END IF;

  v_requested_resultado := upper(trim(COALESCE(p_resultado, '')));
  IF v_requested_resultado <> '' AND v_requested_resultado NOT IN ('APROBADO', 'RECHAZADO') THEN
    RAISE EXCEPTION 'resultado invalido: %', p_resultado;
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

  SELECT id INTO v_existing_agreement_id
    FROM agreements
   WHERE tenant_id = p_tenant_id
     AND no_session_resolution_id = p_resolution_id
   LIMIT 1;
  IF v_existing_agreement_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'REUSED',
      'agreement_id', v_existing_agreement_id,
      'resolution_id', p_resolution_id,
      'idempotent', true
    );
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

  SELECT * INTO v_expediente
    FROM no_session_expedientes
   WHERE tenant_id = p_tenant_id
     AND no_session_resolution_id = p_resolution_id
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO no_session_expedientes (
      tenant_id, agreement_id, no_session_resolution_id, selected_template_id,
      entity_id, body_id, tipo_proceso, propuesta_texto, propuesta_fecha,
      ventana_inicio, ventana_fin, estado, condicion_adopcion, snapshot_hash
    ) VALUES (
      p_tenant_id, NULL, p_resolution_id,
      COALESCE(p_selected_template_id, v_resolution.selected_template_id),
      v_body.entity_id, v_body.id,
      v_tipo_proceso,
      v_resolution.proposal_text, current_date,
      COALESCE(v_resolution.opened_at, now()), v_resolution.voting_deadline,
      'ABIERTO',
      v_condicion_adopcion,
      encode(digest(
        coalesce(v_resolution.title, '') || '|' ||
        coalesce(v_resolution.proposal_text, '') || '|' ||
        p_resolution_id::text,
        'sha256'
      ), 'hex')
    )
    RETURNING * INTO v_expediente;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE sentido = 'CONSENTIMIENTO')::integer,
    COUNT(*) FILTER (WHERE sentido IN ('OBJECION', 'OBJECION_PROCEDIMIENTO'))::integer,
    COUNT(*) FILTER (WHERE sentido = 'SILENCIO')::integer
    INTO v_votes_for, v_votes_against, v_abstentions
    FROM no_session_respuestas
   WHERE expediente_id = v_expediente.id;

  v_votes_cast := v_votes_for + v_votes_against + v_abstentions;
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
    v_total_required := v_votes_cast;
  END IF;

  v_resultado := NULL;
  IF v_resolution.requires_unanimity IS TRUE AND v_votes_against > 0 THEN
    v_resultado := 'RECHAZADO';
  ELSIF v_resolution.requires_unanimity IS TRUE
        AND v_total_required > 0
        AND v_votes_for >= v_total_required THEN
    v_resultado := 'APROBADO';
  ELSIF v_resolution.requires_unanimity IS TRUE
        AND v_total_required > 0
        AND v_votes_cast >= v_total_required THEN
    v_resultado := 'RECHAZADO';
  ELSIF v_resolution.requires_unanimity IS NOT TRUE
        AND v_total_required > 0
        AND v_votes_cast >= v_total_required THEN
    -- ITEM-048: mayoría reforzada del consejo. La delegación permanente de
    -- facultades exige 2/3 de los COMPONENTES del consejo (art. 249.3 LSC); el
    -- resto, mayoría ordinaria de concurrentes (art. 248.1 LSC).
    IF v_tipo_proceso = 'CIRCULACION_CONSEJO'
       AND upper(coalesce(v_resolution.agreement_kind, '')) IN (
         'DELEGACION_FACULTADES', 'DELEGACION_PERMANENTE', 'NOMBRAMIENTO_CONSEJERO_DELEGADO'
       ) THEN
      v_resultado := CASE WHEN v_votes_for * 3 >= v_total_required * 2 THEN 'APROBADO' ELSE 'RECHAZADO' END;
    ELSE
      v_resultado := CASE WHEN v_votes_for > v_votes_against THEN 'APROBADO' ELSE 'RECHAZADO' END;
    END IF;
  ELSIF v_requested_resultado = 'RECHAZADO' OR v_resolution.status = 'RECHAZADO' THEN
    v_resultado := 'RECHAZADO';
  END IF;

  IF v_requested_resultado = 'APROBADO' AND v_resultado <> 'APROBADO' THEN
    RAISE EXCEPTION
      'no_session_resolution % cannot be approved from client result; source votes are for %, against %, abstentions %, total_required %',
      p_resolution_id, v_votes_for, v_votes_against, v_abstentions, v_total_required;
  END IF;

  IF v_resultado IS NULL THEN
    RAISE EXCEPTION
      'no_session_resolution % is not decided by WORM responses; votes_for %, votes_against %, abstentions %, total_required %',
      p_resolution_id, v_votes_for, v_votes_against, v_abstentions, v_total_required;
  END IF;

  UPDATE no_session_resolutions
     SET status = v_resultado,
         votes_for = v_votes_for,
         votes_against = v_votes_against,
         abstentions = v_abstentions,
         total_members = COALESCE(NULLIF(total_members, 0), v_total_required),
         closed_at = COALESCE(closed_at, now()),
         selected_template_id = COALESCE(p_selected_template_id, selected_template_id)
   WHERE id = p_resolution_id
     AND tenant_id = p_tenant_id;

  UPDATE no_session_expedientes
     SET estado = CASE WHEN v_resultado = 'APROBADO' THEN 'CERRADO_OK' ELSE 'CERRADO_FAIL' END,
         fecha_cierre = COALESCE(fecha_cierre, now()),
         motivo_cierre = CASE WHEN v_resultado = 'APROBADO' THEN 'materialized_from_worm_votes' ELSE 'rejected' END,
         selected_template_id = COALESCE(p_selected_template_id, selected_template_id)
   WHERE id = v_expediente.id;

  IF v_resultado = 'RECHAZADO' THEN
    RETURN jsonb_build_object(
      'status', 'REJECTED',
      'agreement_id', NULL,
      'resolution_id', p_resolution_id,
      'expediente_id', v_expediente.id,
      'idempotent', false,
      'source_of_truth', 'no_session_respuestas',
      'votes_for', v_votes_for,
      'votes_against', v_votes_against,
      'abstentions', v_abstentions,
      'total_members', v_total_required
    );
  END IF;

  v_decision_text := COALESCE(NULLIF(trim(v_resolution.proposal_text), ''), v_resolution.title, 'Acuerdo sin sesion');
  v_template_id := COALESCE(p_selected_template_id, v_resolution.selected_template_id, v_expediente.selected_template_id);
  PERFORM fn_secretaria_assert_template_tenant(p_tenant_id, v_template_id);

  INSERT INTO agreements (
    tenant_id, entity_id, body_id,
    agreement_kind, matter_class, adoption_mode, status,
    no_session_resolution_id, proposal_text, decision_text,
    decision_date, effective_date, execution_mode, compliance_snapshot
  ) VALUES (
    p_tenant_id, v_body.entity_id, v_body.id,
    COALESCE(NULLIF(v_resolution.agreement_kind, ''), 'ACUERDO_SIN_SESION'),
    COALESCE(NULLIF(v_resolution.matter_class, ''), COALESCE(NULLIF(v_resolution.agreement_kind, ''), 'ACUERDO_SIN_SESION')),
    'NO_SESSION', 'ADOPTED',
    p_resolution_id, v_decision_text, v_decision_text,
    current_date, current_date,
    jsonb_build_object(
      'mode', 'NO_SESSION',
      'source', 'no_session_resolutions',
      'source_id', p_resolution_id,
      'no_session_resolution_id', p_resolution_id,
      'selected_template_id', v_template_id,
      'source_of_truth', 'no_session_respuestas',
      'agreement_360', jsonb_build_object(
        'version', 'agreement-360.v1',
        'origin', 'NO_SESSION',
        'source', 'no_session_resolutions',
        'no_session_resolution_id', p_resolution_id,
        'selected_template_id', v_template_id,
        'materialized_at', now(),
        'materialized', true
      )
    ),
    jsonb_build_object(
      'schema_version', 'no-session-idempotency.v2',
      'resolution_id', p_resolution_id,
      'expediente_id', v_expediente.id,
      'votes_for', v_votes_for,
      'votes_against', v_votes_against,
      'abstentions', v_abstentions,
      'total_members', v_total_required,
      'resultado', v_resultado,
      'source_of_truth', 'no_session_respuestas'
    )
  )
  RETURNING id INTO v_agreement_id;

  UPDATE no_session_expedientes
     SET agreement_id = v_agreement_id,
         estado = 'PROCLAMADO'
   WHERE id = v_expediente.id;

  RETURN jsonb_build_object(
    'status', 'CREATED',
    'agreement_id', v_agreement_id,
    'resolution_id', p_resolution_id,
    'expediente_id', v_expediente.id,
    'idempotent', false,
    'source_of_truth', 'no_session_respuestas',
    'votes_for', v_votes_for,
    'votes_against', v_votes_against,
    'abstentions', v_abstentions,
    'total_members', v_total_required
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_no_session_close_and_materialize_agreement(uuid, uuid, text, uuid)
  TO authenticated, service_role;
