-- Migración: 20260925110000_secretaria_template_transition_approval_guard.sql
-- Descripción: Refuerza la validación server-side en fn_secretaria_transition_template_state
-- para exigir que al promover a APROBADA/ACTIVA el campo aprobada_por no sea nulo, vacío ni
-- comience por 'falta' o 'pendiente' (MOI-137). Mantiene la tolerancia a marcadores demo en
-- servidor para no bloquear transiciones de seeds ni tests de MOI-139/141, dejando la no-atribución
-- nominativa («Vigente sin aprobación nominativa») como regla formal en el motor de revisión legal.

CREATE OR REPLACE FUNCTION public.fn_secretaria_transition_template_state(
  p_template_id uuid,
  p_expected_from text,
  p_to_state text,
  p_motivo text,
  p_operation_id uuid,
  p_expected_predecessor_id uuid DEFAULT NULL::uuid,
  p_aprobada_por text DEFAULT NULL::text,
  p_fecha_aprobacion timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_ack_warnings boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  -- El helper legacy devuelve NULL cuando no existe claim de rol. La RPC debe
  -- interpretar cualquier valor distinto de TRUE como sesión humana/no service.
  v_is_service boolean := COALESCE(public.fn_secretaria_is_service_role(), false);
  v_tenant_id uuid;
  v_actor_id uuid := auth.uid();
  v_actor text;
  v_from text := upper(btrim(COALESCE(p_expected_from, '')));
  v_to text := upper(btrim(COALESCE(p_to_state, '')));
  v_target_initial public.plantillas_protegidas%ROWTYPE;
  v_target public.plantillas_protegidas%ROWTYPE;
  v_predecessor public.plantillas_protegidas%ROWTYPE;
  v_candidate public.plantillas_protegidas%ROWTYPE;
  v_initial_key text;
  v_key text;
  v_request_hash text;
  v_existing_operation public.secretaria_template_transition_operations%ROWTYPE;
  v_next_aprobada_por text;
  v_next_fecha_aprobacion timestamptz;
  v_predecessor_count integer := 0;
  v_bindings_moved integer := 0;
  v_target_log_id uuid;
  v_archived_log_id uuid;
  v_result jsonb;
  v_target_event_version text;
  v_archived_event_version text;
BEGIN
  IF p_template_id IS NULL
     OR p_operation_id IS NULL
     OR v_from = ''
     OR v_to = ''
     OR length(btrim(COALESCE(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'template, states, operation_id and motivo (>=10 chars) are required'
      USING ERRCODE = '22023';
  END IF;

  IF v_from NOT IN ('BORRADOR', 'REVISADA', 'APROBADA', 'ACTIVA', 'ARCHIVADA')
     OR v_to NOT IN ('BORRADOR', 'REVISADA', 'APROBADA', 'ACTIVA', 'ARCHIVADA') THEN
    RAISE EXCEPTION 'invalid template state % -> %', v_from, v_to
      USING ERRCODE = '22023';
  END IF;

  -- Para usuarios humanos, la autorización se resuelve antes de consultar el
  -- UUID objetivo: evita filtrar si una plantilla cruzada existe o no.
  IF NOT v_is_service THEN
    v_tenant_id := public.fn_current_tenant_id();
    PERFORM public.fn_secretaria_assert_active_template_admin(v_tenant_id);
    SELECT *
      INTO v_target_initial
      FROM public.plantillas_protegidas
     WHERE id = p_template_id
       AND tenant_id = v_tenant_id;
  ELSE
    SELECT *
      INTO v_target_initial
      FROM public.plantillas_protegidas
     WHERE id = p_template_id;
    IF FOUND THEN
      v_tenant_id := v_target_initial.tenant_id;
    END IF;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'template % not found in caller tenant', p_template_id
      USING ERRCODE = 'P0002';
  END IF;

  v_actor := COALESCE(
    NULLIF(auth.jwt() ->> 'email', ''),
    v_actor_id::text,
    CASE WHEN v_is_service THEN 'service_role' ELSE NULL END,
    'authenticated-user'
  );

  v_initial_key := public.fn_secretaria_template_functional_key(
    v_target_initial.tipo,
    v_target_initial.jurisdiccion,
    COALESCE(NULLIF(btrim(v_target_initial.materia_acuerdo), ''), v_target_initial.materia),
    v_target_initial.organo_tipo,
    v_target_initial.adoption_mode,
    v_target_initial.tipo_social
  );

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_array(
          v_tenant_id::text,
          p_template_id::text,
          v_from,
          v_to,
          btrim(p_motivo),
          COALESCE(p_expected_predecessor_id::text, ''),
          COALESCE(p_aprobada_por, ''),
          COALESCE(
            to_char(
              p_fecha_aprobacion AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ),
            ''
          ),
          COALESCE(p_ack_warnings, false)::text
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended('template-transition-operation:' || p_operation_id::text, 0)
  );

  SELECT *
    INTO v_existing_operation
    FROM public.secretaria_template_transition_operations
   WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_operation.tenant_id IS DISTINCT FROM v_tenant_id
       OR v_existing_operation.template_id IS DISTINCT FROM p_template_id
       OR v_existing_operation.request_hash_sha256 IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION 'operation_id reuse with a different request'
        USING ERRCODE = '22023';
    END IF;
    RETURN v_existing_operation.result || jsonb_build_object('replayed', true);
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('template-functional-identity:' || v_tenant_id::text || ':' || v_initial_key, 0)
  );

  SELECT *
    INTO v_target
    FROM public.plantillas_protegidas
   WHERE id = p_template_id
     AND tenant_id = v_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'template % disappeared during transition', p_template_id
      USING ERRCODE = '40001';
  END IF;

  v_key := public.fn_secretaria_template_functional_key(
    v_target.tipo,
    v_target.jurisdiccion,
    COALESCE(NULLIF(btrim(v_target.materia_acuerdo), ''), v_target.materia),
    v_target.organo_tipo,
    v_target.adoption_mode,
    v_target.tipo_social
  );
  IF v_key IS DISTINCT FROM v_initial_key THEN
    RAISE EXCEPTION 'template identity changed during transition'
      USING ERRCODE = '40001';
  END IF;
  IF v_target.estado IS DISTINCT FROM v_from THEN
    RAISE EXCEPTION 'STALE_STATE expected %, found %', v_from, v_target.estado
      USING ERRCODE = '40001';
  END IF;

  IF NOT (
    (v_from = 'BORRADOR' AND v_to IN ('REVISADA', 'ARCHIVADA'))
    OR (v_from = 'REVISADA' AND v_to IN ('APROBADA', 'BORRADOR', 'ARCHIVADA'))
    OR (v_from = 'APROBADA' AND v_to IN ('ACTIVA', 'BORRADOR', 'ARCHIVADA'))
    OR (v_from = 'ACTIVA' AND v_to = 'ARCHIVADA')
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION % -> %', v_from, v_to
      USING ERRCODE = '23514';
  END IF;

  IF v_from = 'ACTIVA'
     AND v_to = 'ARCHIVADA'
     AND EXISTS (
       SELECT 1
         FROM public.materia_template_binding b
        WHERE b.tenant_id = v_tenant_id
          AND b.template_id = p_template_id
          AND b.active = true
     ) THEN
    RAISE EXCEPTION 'ACTIVE_BINDINGS_REQUIRE_REPLACEMENT: active bindings must move through atomic replacement'
      USING ERRCODE = '23514';
  END IF;

  v_next_aprobada_por := COALESCE(NULLIF(btrim(p_aprobada_por), ''), v_target.aprobada_por);
  v_next_fecha_aprobacion := COALESCE(p_fecha_aprobacion, v_target.fecha_aprobacion);
  IF v_to = 'APROBADA'
     AND (
       NULLIF(btrim(p_aprobada_por), '') IS NULL
       OR p_fecha_aprobacion IS NULL
       OR btrim(p_aprobada_por) ~* '^(falta|pendiente)'
     ) THEN
    RAISE EXCEPTION 'MISSING_APPROVAL_DATA: nueva aprobación formal requerida'
      USING ERRCODE = '23514';
  END IF;
  IF v_to IN ('APROBADA', 'ACTIVA')
     AND (
       v_next_aprobada_por IS NULL
       OR v_next_fecha_aprobacion IS NULL
       OR v_next_aprobada_por ~* '^(falta|pendiente)'
     ) THEN
    RAISE EXCEPTION 'MISSING_APPROVAL_DATA: aprobación formal requerida'
      USING ERRCODE = '23514';
  END IF;

  IF v_to <> 'ACTIVA' AND p_expected_predecessor_id IS NOT NULL THEN
    RAISE EXCEPTION 'predecessor is only valid for activation'
      USING ERRCODE = '22023';
  END IF;

  IF v_to = 'ACTIVA' THEN
    FOR v_candidate IN
      SELECT p.*
        FROM public.plantillas_protegidas p
       WHERE p.tenant_id = v_tenant_id
         AND p.estado = 'ACTIVA'
         AND p.id <> p_template_id
         AND public.fn_secretaria_template_functional_key(
           p.tipo,
           p.jurisdiccion,
           COALESCE(NULLIF(btrim(p.materia_acuerdo), ''), p.materia),
           p.organo_tipo,
           p.adoption_mode,
           p.tipo_social
         ) = v_key
       FOR UPDATE
    LOOP
      v_predecessor_count := v_predecessor_count + 1;
      v_predecessor := v_candidate;
    END LOOP;

    IF v_predecessor_count > 1 THEN
      RAISE EXCEPTION 'multiple active predecessors for functional identity'
        USING ERRCODE = '23505';
    END IF;
    IF v_predecessor_count = 0 AND p_expected_predecessor_id IS NOT NULL THEN
      RAISE EXCEPTION 'STALE_PREDECESSOR expected %, found none', p_expected_predecessor_id
        USING ERRCODE = '40001';
    END IF;
    IF v_predecessor_count = 1
       AND p_expected_predecessor_id IS DISTINCT FROM v_predecessor.id THEN
      RAISE EXCEPTION 'STALE_PREDECESSOR expected %, found %', p_expected_predecessor_id, v_predecessor.id
        USING ERRCODE = '40001';
    END IF;
    IF v_predecessor_count = 1 AND NOT COALESCE(p_ack_warnings, false) THEN
      RAISE EXCEPTION 'atomic replacement warning must be acknowledged'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  PERFORM set_config('app.secretaria_template_state_transition', p_operation_id::text, true);

  IF v_predecessor_count = 1 THEN
    UPDATE public.plantillas_protegidas
       SET estado = 'ARCHIVADA'
     WHERE id = v_predecessor.id
       AND tenant_id = v_tenant_id
       AND estado = 'ACTIVA';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'STALE_PREDECESSOR changed before archive'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  UPDATE public.plantillas_protegidas
     SET estado = v_to,
         aprobada_por = CASE
           WHEN v_to IN ('APROBADA', 'ACTIVA') THEN v_next_aprobada_por
           WHEN v_to = 'BORRADOR' THEN NULL
           ELSE aprobada_por
         END,
         fecha_aprobacion = CASE
           WHEN v_to IN ('APROBADA', 'ACTIVA') THEN v_next_fecha_aprobacion
           WHEN v_to = 'BORRADOR' THEN NULL
           ELSE fecha_aprobacion
         END,
         approved_by_role = CASE WHEN v_to = 'BORRADOR' THEN NULL ELSE approved_by_role END,
         approval_checklist = CASE WHEN v_to = 'BORRADOR' THEN '[]'::jsonb ELSE approval_checklist END,
         content_hash_sha256 = CASE WHEN v_to = 'BORRADOR' THEN NULL ELSE content_hash_sha256 END
   WHERE id = p_template_id
     AND tenant_id = v_tenant_id
     AND estado = v_from;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STALE_STATE changed before update'
      USING ERRCODE = '40001';
  END IF;

  IF v_predecessor_count = 1 THEN
    UPDATE public.materia_template_binding
       SET template_id = p_template_id,
           selection_reason = concat(
             selection_reason,
             ' Sustituida atómicamente por plantilla ',
             p_template_id,
             ' (operación ',
             p_operation_id,
             ').'
           )
     WHERE tenant_id = v_tenant_id
       AND template_id = v_predecessor.id
       AND active = true;
    GET DIAGNOSTICS v_bindings_moved = ROW_COUNT;

    v_archived_event_version := concat(
      v_predecessor.version,
      '#op:',
      p_operation_id,
      ':archive'
    );
    INSERT INTO public.plantilla_changelog (
      tenant_id,
      plantilla_id,
      from_version,
      to_version,
      bump_type,
      motivo,
      autor,
      diff_summary
    ) VALUES (
      v_tenant_id,
      v_predecessor.id,
      v_predecessor.version,
      v_archived_event_version,
      'PATCH',
      concat(
        'STATE:ACTIVA->ARCHIVADA | Sustitución atómica: ',
        btrim(p_motivo),
        ' [op:',
        p_operation_id,
        ']'
      ),
      v_actor,
      jsonb_build_object(
        'action', 'STATE_CHANGE',
        'from_state', 'ACTIVA',
        'to_state', 'ARCHIVADA',
        'logical_to_version', v_predecessor.version,
        'operation_id', p_operation_id,
        'request_hash_sha256', v_request_hash,
        'replacement_template_id', p_template_id,
        'bindings_moved', v_bindings_moved,
        'reconstructed', false
      )::text
    ) RETURNING id INTO v_archived_log_id;
  END IF;

  v_target_event_version := concat(v_target.version, '#op:', p_operation_id, ':state');
  INSERT INTO public.plantilla_changelog (
    tenant_id,
    plantilla_id,
    from_version,
    to_version,
    bump_type,
    motivo,
    autor,
    diff_summary
  ) VALUES (
    v_tenant_id,
    p_template_id,
    v_target.version,
    v_target_event_version,
    'PATCH',
    concat('STATE:', v_from, '->', v_to, ' | ', btrim(p_motivo), ' [op:', p_operation_id, ']'),
    v_actor,
    jsonb_build_object(
      'action', 'STATE_CHANGE',
      'from_state', v_from,
      'to_state', v_to,
      'logical_to_version', v_target.version,
      'operation_id', p_operation_id,
      'request_hash_sha256', v_request_hash,
      'ack_warnings', COALESCE(p_ack_warnings, false),
      'archived_template_id', CASE WHEN v_predecessor_count = 1 THEN v_predecessor.id END,
      'bindings_moved', v_bindings_moved,
      'reconstructed', false
    )::text
  ) RETURNING id INTO v_target_log_id;

  v_result := jsonb_build_object(
    'ok', true,
    'plantilla_id', p_template_id,
    'from', v_from,
    'to', v_to,
    'changelog_id', v_target_log_id,
    'archived_template_id', CASE WHEN v_predecessor_count = 1 THEN v_predecessor.id END,
    'archived_changelog_id', v_archived_log_id,
    'operation_id', p_operation_id,
    'replayed', false,
    'bindings_moved', v_bindings_moved
  );

  INSERT INTO public.secretaria_template_transition_operations (
    operation_id,
    tenant_id,
    template_id,
    request_hash_sha256,
    result,
    created_by
  ) VALUES (
    p_operation_id,
    v_tenant_id,
    p_template_id,
    v_request_hash,
    v_result,
    v_actor_id
  );

  RETURN v_result;
END;
$function$;
