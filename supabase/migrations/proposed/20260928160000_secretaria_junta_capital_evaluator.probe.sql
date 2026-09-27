-- MOI-143 — ensayo revertido (NO ejecutar fuera del orquestador autorizado).
--
-- Corre DENTRO de la transacción BEGIN…ROLLBACK del ejecutor seguro, DESPUÉS
-- de aplicar 20260928160000_secretaria_junta_capital_evaluator.sql (el
-- ejecutor concatena ambos ficheros). Nada de lo que sigue persiste.
--
-- Qué hace, en orden:
--   1) Fabrica un espécimen EQUIVALENTE de Junta en el tenant del grupo
--      nuevo (…0003), reutilizando la entidad/persona/órgano/capital REALES
--      de Corporación Nueva, S.A. (2 socios, 60 %/40 %, sin autocartera,
--      una acción un voto — D-29): la Junta REAL de MOI-142 está fechada en
--      noviembre de 2026 y su guardia de apertura exige scheduled_start <=
--      now(), así que aquí se crea una reunión equivalente con fecha
--      PASADA, convocatoria propia (misma fórmula, con el guard de emisión
--      abierto explícitamente en vez de pasar por el RPC con preaviso
--      estatutario, que exige FUTURO) y se deshace entera al terminar.
--   2) Genera su acta por la vía OFICIAL del servidor:
--      fn_secretaria_close_meeting_and_generate_minute → fn_generar_acta →
--      fn_secretaria_build_minute_legal_manifest, que ahora invoca
--      fn_secretaria_server_junta_resolution_evaluation vía el despachador.
--   3) Intenta una SEGUNDA Junta, idéntica salvo por una base_votos
--      DECLARADA que NO coincide con lo que el propio censo ECONOMICO
--      congelado computa — la resolución incoherente con el censo que el
--      issue pide probar — y comprueba que se RECHAZA.
--   4) Comprueba los recuentos de ARGA antes/después (deben coincidir: nada
--      de esto toca el tenant …0001).

create temporary table probe_moi143_results (etiqueta text, valor jsonb) on commit drop;
grant all on probe_moi143_results to authenticated;

do $probe_moi143$
DECLARE
  v_tenant_nuevo uuid := '00000000-0000-0000-0000-000000000003';
  v_entity_nuevo uuid := '45c8df67-64c9-42a3-abff-8047dd23748b'; -- Corporación Nueva, S.A.
  v_junta_body uuid := 'ceee9767-0bbf-4bf7-a2a9-6a812414e4bb'; -- Junta General de Accionistas
  v_socio_60 uuid := '608f8eaf-6335-4102-96f4-a412974d5079'; -- 36.000 títulos / 60 %
  v_socio_40 uuid := '0ed63079-0422-4cb1-b50a-bb38fa5da725'; -- 24.000 títulos / 40 %
  v_secretario_nuevo uuid := '6452252f-3214-4c9a-857b-b439626d215e'; -- SECRETARIO activo de …0003
  v_arga_tenant uuid := '00000000-0000-0000-0000-000000000001';

  v_fecha_1 timestamptz := (now() - interval '4 hours');
  v_lugar text := 'Sede social de Corporación Nueva, S.A., Madrid (ensayo MOI-143)';
  v_titulo text := 'Nombramiento de un nuevo consejero (ensayo MOI-143)';
  v_texto text;
  v_agenda_json jsonb;

  v_arga_minutes_antes integer;
  v_arga_agreements_antes integer;
  v_arga_minutes_despues integer;
  v_arga_agreements_despues integer;

  -- Espécimen A: golden path (base declarada = base real del censo).
  v_meeting_a uuid;
  v_convocatoria_a uuid;
  v_agenda_item_a uuid;
  v_agreement_a uuid;
  v_resolution_a uuid;
  v_attendee_a1 uuid;
  v_attendee_a2 uuid;
  v_minute_a uuid;
  v_minute_row record;
  v_manifest jsonb;
  v_resolution_eval jsonb;

  -- Espécimen B: mismo montaje, base_votos DECLARADA incoherente.
  v_meeting_b uuid;
  v_convocatoria_b uuid;
  v_agenda_item_b uuid;
  v_agreement_b uuid;
  v_resolution_b uuid;
  v_attendee_b1 uuid;
  v_attendee_b2 uuid;
  v_rejected boolean := false;
  v_rejection_message text;
BEGIN
  SELECT count(*) INTO v_arga_minutes_antes FROM public.minutes WHERE tenant_id = v_arga_tenant;
  SELECT count(*) INTO v_arga_agreements_antes FROM public.agreements WHERE tenant_id = v_arga_tenant;

  -- ---------------------------------------------------------------------
  -- 0) Autoridad del espécimen: PRESIDENTE/SECRETARIO de la Junta. La Junta
  --    de Corporación Nueva no tenía authority_evidence propia (medido en
  --    Cloud: 0 filas para este body_id) — se designa aquí, vía la RPC
  --    autoritativa (nunca UPDATE/INSERT directo sobre authority_evidence,
  --    que un trigger rechaza), a los mismos socios que ya presiden/
  --    secretarían su Consejo: coherente con el dato real, no inventado.
  -- ---------------------------------------------------------------------
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_secretario_nuevo, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  PERFORM public.fn_designar_cargo(
    v_tenant_nuevo, v_socio_60, v_entity_nuevo, v_junta_body,
    'PRESIDENTE', (current_date - 3), 'ESCRITURA'
  );
  PERFORM public.fn_designar_cargo(
    v_tenant_nuevo, v_socio_40, v_entity_nuevo, v_junta_body,
    'SECRETARIO', (current_date - 3), 'ESCRITURA'
  );

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT EXISTS (
    SELECT 1 FROM public.authority_evidence
     WHERE tenant_id = v_tenant_nuevo AND body_id = v_junta_body
       AND person_id = v_socio_60 AND cargo = 'PRESIDENTE' AND estado = 'VIGENTE'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.authority_evidence
     WHERE tenant_id = v_tenant_nuevo AND body_id = v_junta_body
       AND person_id = v_socio_40 AND cargo = 'SECRETARIO' AND estado = 'VIGENTE'
  ) THEN
    RAISE EXCEPTION 'ENSAYO MOI-143: fn_designar_cargo no dejó autoridad acreditada para la Junta de prueba';
  END IF;

  -- ---------------------------------------------------------------------
  -- ESPÉCIMEN A — golden path
  -- ---------------------------------------------------------------------
  v_texto := concat(
    'CONVOCATORIA DE JUNTA GENERAL DE Corporación Nueva, S.A. (ENSAYO MOI-143 — NO PERSISTE)', E'\n\n',
    'ORDEN DEL DÍA', E'\n', '1. ', v_titulo, E'\n\n',
    'Documento de ensayo. Se deshace al terminar la transacción.'
  );
  v_agenda_json := jsonb_build_array(
    jsonb_build_object(
      'titulo', v_titulo, 'kind', 'DECISORIO',
      'materia', 'NOMBRAMIENTO_CONSEJERO', 'propuesta_acuerdo', v_titulo,
      'requires_attachments', false
    )
  );

  PERFORM set_config('app.secretaria_emit_convocatoria_rpc', 'on', true);
  INSERT INTO public.convocatorias (
    tenant_id, body_id, estado, fecha_emision, fecha_1, modalidad,
    tipo_convocatoria, agenda_items, lugar, convocatoria_text,
    statutory_basis, immutable_at
  ) VALUES (
    v_tenant_nuevo, v_junta_body, 'EMITIDA', current_date, v_fecha_1, 'PRESENCIAL',
    'ORDINARIA', v_agenda_json, v_lugar, v_texto,
    'Arts. 166, 173 y 176.1 LSC (ensayo)', now()
  ) RETURNING id INTO v_convocatoria_a;
  PERFORM set_config('app.secretaria_emit_convocatoria_rpc', '', true);

  v_meeting_a := gen_random_uuid();
  -- La reunión nace en DRAFT (guardia fn_secretaria_guard_meeting_open_transition:
  -- «una reunión nueva debe comenzar en DRAFT») con el vínculo EXACTO a su
  -- convocatoria que esa misma guardia exige para abrir después; se abre por
  -- la RPC acreditada fn_secretaria_open_meeting, no por UPDATE directo.
  INSERT INTO public.meetings (
    id, slug, tenant_id, body_id, meeting_type, scheduled_start, scheduled_end,
    status, president_id, secretary_id, location, quorum_data
  ) VALUES (
    v_meeting_a, 'convocatoria-' || replace(v_convocatoria_a::text, '-', ''),
    v_tenant_nuevo, v_junta_body,
    'JUNTA_GENERAL', v_fecha_1, v_fecha_1 + interval '2 hours',
    'DRAFT', v_socio_60, v_socio_40, v_lugar,
    jsonb_build_object(
      'base_computo', 'TODAS_LAS_CLASES_CON_VOTO_SIN_AUTOCARTERA',
      'base_votos', 60000,
      'scheduled_from', jsonb_build_object(
        'source', 'convocatoria', 'convocatoria_id', v_convocatoria_a,
        'estado_convocatoria', 'EMITIDA'
      ),
      'source_links', jsonb_build_object(
        'source', 'explicit', 'convocatoria_id', v_convocatoria_a,
        'convocatoria_ids', jsonb_build_array(v_convocatoria_a)
      )
    )
  );

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_secretario_nuevo, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;
  PERFORM public.fn_secretaria_open_meeting(v_meeting_a);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO public.agenda_items (
    meeting_id, tenant_id, order_number, title, kind, matter_code, proposal_text, requires_attachments
  ) VALUES (
    v_meeting_a, v_tenant_nuevo, 1, v_titulo, 'DECISORIO', 'NOMBRAMIENTO_CONSEJERO', v_titulo, false
  ) RETURNING id INTO v_agenda_item_a;

  INSERT INTO public.agreements (
    tenant_id, entity_id, body_id, agenda_item_id, parent_meeting_id,
    agreement_kind, matter_class, adoption_mode, status,
    proposal_text, decision_text
  ) VALUES (
    v_tenant_nuevo, v_entity_nuevo, v_junta_body, v_agenda_item_a, v_meeting_a,
    'NOMBRAMIENTO_CONSEJERO', 'ORDINARIA', 'MEETING', 'ADOPTED',
    v_titulo, v_titulo
  ) RETURNING id INTO v_agreement_a;

  INSERT INTO public.meeting_resolutions (
    tenant_id, meeting_id, agenda_item_index, resolution_text, status, agreement_id, kind_resolution
  ) VALUES (
    v_tenant_nuevo, v_meeting_a, 1, v_titulo, 'ADOPTED', v_agreement_a, 'DECISION'
  ) RETURNING id INTO v_resolution_a;

  INSERT INTO public.meeting_attendees (meeting_id, tenant_id, person_id, attendance_type)
    VALUES (v_meeting_a, v_tenant_nuevo, v_socio_60, 'PRESENCIAL') RETURNING id INTO v_attendee_a1;
  INSERT INTO public.meeting_attendees (meeting_id, tenant_id, person_id, attendance_type)
    VALUES (v_meeting_a, v_tenant_nuevo, v_socio_40, 'PRESENCIAL') RETURNING id INTO v_attendee_a2;

  INSERT INTO public.meeting_votes (resolution_id, attendee_id, tenant_id, vote_value)
    VALUES (v_resolution_a, v_attendee_a1, v_tenant_nuevo, 'FAVOR');
  INSERT INTO public.meeting_votes (resolution_id, attendee_id, tenant_id, vote_value)
    VALUES (v_resolution_a, v_attendee_a2, v_tenant_nuevo, 'FAVOR');

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_secretario_nuevo, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  v_minute_a := public.fn_secretaria_close_meeting_and_generate_minute(
    v_meeting_a, '<p>Acta de ensayo MOI-143</p>', NULL
  );

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT * INTO v_minute_row FROM public.minutes WHERE id = v_minute_a;
  IF v_minute_row.id IS NULL
     OR v_minute_row.legal_gate_status <> 'MANIFEST_READY'
     OR v_minute_row.authoritative_manifest_hash !~ '^[0-9a-f]{64}$'
     OR v_minute_row.authoritative_manifest IS NULL THEN
    RAISE EXCEPTION 'ENSAYO MOI-143: el acta de la Junta (espécimen A) no salió con manifiesto legal válido';
  END IF;

  v_manifest := v_minute_row.authoritative_manifest;
  SELECT r -> 'server_evaluation' INTO v_resolution_eval
    FROM jsonb_array_elements(v_manifest -> 'resolutions') r
   WHERE (r ->> 'resolution_id')::uuid = v_resolution_a;

  IF v_resolution_eval IS NULL
     OR v_resolution_eval ->> 'source' <> 'SERVER_AUTHORITATIVE'
     OR v_resolution_eval ->> 'schema_version' <> 'secretaria.server-junta-resolution-evaluation.v1'
     OR lower(coalesce(v_resolution_eval #>> '{quorum,reached}', 'false')) <> 'true'
     OR lower(coalesce(v_resolution_eval #>> '{majority,reached}', 'false')) <> 'true'
     OR v_resolution_eval ->> 'status_expected' <> 'ADOPTED' THEN
    RAISE EXCEPTION
      'ENSAYO MOI-143: el acta se generó pero la evaluación de capital de su resolución no es la esperada: %',
      v_resolution_eval;
  END IF;

  INSERT INTO probe_moi143_results VALUES ('ESPECIMEN_A_ACTA_OK', jsonb_build_object(
    'minute_id', v_minute_a,
    'legal_gate_status', v_minute_row.legal_gate_status,
    'server_evaluation', v_resolution_eval
  ));

  -- ---------------------------------------------------------------------
  -- ESPÉCIMEN B — resolución incoherente con el censo: la base declarada
  -- (12.345) NO es lo que el censo ECONOMICO congelado computa (60.000) —
  -- debe rechazarse, sin dejar acta.
  -- ---------------------------------------------------------------------
  PERFORM set_config('app.secretaria_emit_convocatoria_rpc', 'on', true);
  INSERT INTO public.convocatorias (
    tenant_id, body_id, estado, fecha_emision, fecha_1, modalidad,
    tipo_convocatoria, agenda_items, lugar, convocatoria_text,
    statutory_basis, immutable_at
  ) VALUES (
    v_tenant_nuevo, v_junta_body, 'EMITIDA', current_date, v_fecha_1, 'PRESENCIAL',
    'ORDINARIA', v_agenda_json, v_lugar, v_texto,
    'Arts. 166, 173 y 176.1 LSC (ensayo)', now()
  ) RETURNING id INTO v_convocatoria_b;
  PERFORM set_config('app.secretaria_emit_convocatoria_rpc', '', true);

  v_meeting_b := gen_random_uuid();
  INSERT INTO public.meetings (
    id, slug, tenant_id, body_id, meeting_type, scheduled_start, scheduled_end,
    status, president_id, secretary_id, location, quorum_data
  ) VALUES (
    v_meeting_b, 'convocatoria-' || replace(v_convocatoria_b::text, '-', ''),
    v_tenant_nuevo, v_junta_body,
    'JUNTA_GENERAL', v_fecha_1, v_fecha_1 + interval '2 hours',
    'DRAFT', v_socio_60, v_socio_40, v_lugar,
    jsonb_build_object(
      'base_computo', 'TODAS_LAS_CLASES_CON_VOTO_SIN_AUTOCARTERA',
      -- INCOHERENTE A PROPÓSITO: el censo económico de esta misma entidad
      -- computa 60.000 (36.000 + 24.000, sin autocartera); 12.345 no sale
      -- de ninguna lectura del censo.
      'base_votos', 12345,
      'scheduled_from', jsonb_build_object(
        'source', 'convocatoria', 'convocatoria_id', v_convocatoria_b,
        'estado_convocatoria', 'EMITIDA'
      ),
      'source_links', jsonb_build_object(
        'source', 'explicit', 'convocatoria_id', v_convocatoria_b,
        'convocatoria_ids', jsonb_build_array(v_convocatoria_b)
      )
    )
  );

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_secretario_nuevo, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;
  PERFORM public.fn_secretaria_open_meeting(v_meeting_b);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO public.agenda_items (
    meeting_id, tenant_id, order_number, title, kind, matter_code, proposal_text, requires_attachments
  ) VALUES (
    v_meeting_b, v_tenant_nuevo, 1, v_titulo, 'DECISORIO', 'NOMBRAMIENTO_CONSEJERO', v_titulo, false
  ) RETURNING id INTO v_agenda_item_b;

  INSERT INTO public.agreements (
    tenant_id, entity_id, body_id, agenda_item_id, parent_meeting_id,
    agreement_kind, matter_class, adoption_mode, status,
    proposal_text, decision_text
  ) VALUES (
    v_tenant_nuevo, v_entity_nuevo, v_junta_body, v_agenda_item_b, v_meeting_b,
    'NOMBRAMIENTO_CONSEJERO', 'ORDINARIA', 'MEETING', 'ADOPTED',
    v_titulo, v_titulo
  ) RETURNING id INTO v_agreement_b;

  INSERT INTO public.meeting_resolutions (
    tenant_id, meeting_id, agenda_item_index, resolution_text, status, agreement_id, kind_resolution
  ) VALUES (
    v_tenant_nuevo, v_meeting_b, 1, v_titulo, 'ADOPTED', v_agreement_b, 'DECISION'
  ) RETURNING id INTO v_resolution_b;

  INSERT INTO public.meeting_attendees (meeting_id, tenant_id, person_id, attendance_type)
    VALUES (v_meeting_b, v_tenant_nuevo, v_socio_60, 'PRESENCIAL') RETURNING id INTO v_attendee_b1;
  INSERT INTO public.meeting_attendees (meeting_id, tenant_id, person_id, attendance_type)
    VALUES (v_meeting_b, v_tenant_nuevo, v_socio_40, 'PRESENCIAL') RETURNING id INTO v_attendee_b2;

  INSERT INTO public.meeting_votes (resolution_id, attendee_id, tenant_id, vote_value)
    VALUES (v_resolution_b, v_attendee_b1, v_tenant_nuevo, 'FAVOR');
  INSERT INTO public.meeting_votes (resolution_id, attendee_id, tenant_id, vote_value)
    VALUES (v_resolution_b, v_attendee_b2, v_tenant_nuevo, 'FAVOR');

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_secretario_nuevo, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM public.fn_secretaria_close_meeting_and_generate_minute(
      v_meeting_b, '<p>Acta de ensayo MOI-143 (incoherente)</p>', NULL
    );
    v_rejected := false;
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
    v_rejection_message := SQLERRM;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'ENSAYO MOI-143: la Junta con base_votos incoherente NO fue rechazada';
  END IF;
  IF v_rejection_message !~ 'SERVER_JUNTA_VOTE_BASE_VOTOS_MISMATCH' THEN
    RAISE EXCEPTION
      'ENSAYO MOI-143: la Junta incoherente se rechazó, pero no por el motivo esperado: %',
      v_rejection_message;
  END IF;
  IF EXISTS (SELECT 1 FROM public.minutes WHERE meeting_id = v_meeting_b) THEN
    RAISE EXCEPTION 'ENSAYO MOI-143: pese al rechazo quedó un acta para la Junta incoherente (residuo)';
  END IF;
  IF (SELECT status FROM public.meetings WHERE id = v_meeting_b) = 'CELEBRADA' THEN
    RAISE EXCEPTION 'ENSAYO MOI-143: la reunión incoherente quedó CELEBRADA pese al rechazo (estado parcial)';
  END IF;

  INSERT INTO probe_moi143_results VALUES ('ESPECIMEN_B_RECHAZADO_OK', jsonb_build_object(
    'meeting_id', v_meeting_b,
    'rejection_message', v_rejection_message
  ));

  -- ---------------------------------------------------------------------
  -- Recuentos de ARGA: nada de lo anterior debe haberlos movido.
  -- ---------------------------------------------------------------------
  SELECT count(*) INTO v_arga_minutes_despues FROM public.minutes WHERE tenant_id = v_arga_tenant;
  SELECT count(*) INTO v_arga_agreements_despues FROM public.agreements WHERE tenant_id = v_arga_tenant;
  IF v_arga_minutes_antes <> v_arga_minutes_despues
     OR v_arga_agreements_antes <> v_arga_agreements_despues THEN
    RAISE EXCEPTION
      'ENSAYO MOI-143: los recuentos de ARGA cambiaron (minutes % -> %, agreements % -> %)',
      v_arga_minutes_antes, v_arga_minutes_despues, v_arga_agreements_antes, v_arga_agreements_despues;
  END IF;

  INSERT INTO probe_moi143_results VALUES ('ARGA_RECUENTOS_SIN_CAMBIOS', jsonb_build_object(
    'minutes_antes', v_arga_minutes_antes, 'minutes_despues', v_arga_minutes_despues,
    'agreements_antes', v_arga_agreements_antes, 'agreements_despues', v_arga_agreements_despues
  ));

  RAISE NOTICE 'ENSAYO MOI-143 OK: acta de Junta (espécimen A) generada por la vía oficial con evaluación de capital SERVER_AUTHORITATIVE; espécimen B (base_votos incoherente con el censo) rechazado con SERVER_JUNTA_VOTE_BASE_VOTOS_MISMATCH y sin residuo; ARGA sin cambios (minutes=% agreements=%).',
    v_arga_minutes_antes, v_arga_agreements_antes;
END;
$probe_moi143$;

select etiqueta, valor from probe_moi143_results order by etiqueta;
