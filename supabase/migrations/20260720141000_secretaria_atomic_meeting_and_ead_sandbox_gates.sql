-- Secretaría: programación transaccional de reunión + agenda y sandbox EAD.
--
-- 1. La reunión derivada de una convocatoria EMITIDA se crea o reutiliza y su
--    agenda se materializa dentro de una única transacción PostgreSQL.
-- 2. La fecha/hora es un hecho autoritativo: debe seguir en el futuro y ser
--    exactamente igual (timestamptz, no solo el día) a convocatorias.fecha_1.
-- 3. Una comunicación sandbox EAD de convocatoria solo puede persistirse como
--    BORRADOR sin programación, dispatcher, proveedor, entrega, ERDS ni firma.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_secretaria_create_or_reuse_meeting_from_convocation(
  p_convocatoria_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_convocatoria public.convocatorias%ROWTYPE;
  v_body public.governing_bodies%ROWTYPE;
  v_meeting public.meetings%ROWTYPE;
  v_meeting_id uuid;
  v_candidate_count integer := 0;
  v_reused boolean := false;
  v_president_id uuid;
  v_secretary_id uuid;
  v_meeting_type text;
  v_agenda_preview jsonb;
  v_quorum_data jsonb;
  v_materialization jsonb;
BEGIN
  IF p_convocatoria_id IS NULL THEN
    RAISE EXCEPTION 'meeting scheduling: convocatoria_id is required';
  END IF;

  SELECT * INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = p_convocatoria_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'meeting scheduling: convocatoria not found';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_convocatoria.tenant_id THEN
      RAISE EXCEPTION 'meeting scheduling: tenant access denied'
        USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_convocatoria.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'SECRETARIA:CONVOCATION:MEETING:' || v_convocatoria.tenant_id::text || ':' || p_convocatoria_id::text,
    0
  ));

  IF v_convocatoria.estado <> 'EMITIDA'
     OR v_convocatoria.immutable_at IS NULL
     OR v_convocatoria.body_id IS NULL
     OR v_convocatoria.fecha_1 IS NULL
     OR v_convocatoria.fecha_1 <= now()
     OR jsonb_typeof(v_convocatoria.agenda_items) <> 'array'
     OR jsonb_array_length(v_convocatoria.agenda_items) = 0 THEN
    RAISE EXCEPTION
      'meeting scheduling: convocatoria must be emitted, immutable, complete and scheduled in the future';
  END IF;

  SELECT * INTO v_body
    FROM public.governing_bodies body
   WHERE body.id = v_convocatoria.body_id
     AND body.tenant_id = v_convocatoria.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'meeting scheduling: governing body is outside convocatoria tenant';
  END IF;

  -- Primero se resuelve un vínculo autoritativo ya existente. Un mismo
  -- expediente nunca puede apuntar a dos reuniones distintas.
  SELECT count(DISTINCT meeting.id), min(meeting.id::text)::uuid
    INTO v_candidate_count, v_meeting_id
    FROM public.meetings meeting
   WHERE meeting.tenant_id = v_convocatoria.tenant_id
     AND meeting.body_id = v_convocatoria.body_id
     AND (
       EXISTS (
         SELECT 1
           FROM public.agenda_items item
          WHERE item.meeting_id = meeting.id
            AND item.tenant_id = meeting.tenant_id
            AND item.source_convocatoria_id = p_convocatoria_id
       )
       OR meeting.quorum_data #>> '{agenda_binding,convocatoria_id}' = p_convocatoria_id::text
       OR meeting.quorum_data #>> '{source_links,convocatoria_id}' = p_convocatoria_id::text
       OR meeting.quorum_data #>> '{scheduled_from,convocatoria_id}' = p_convocatoria_id::text
       OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements_text(
             CASE
               WHEN jsonb_typeof(meeting.quorum_data #> '{source_links,convocatoria_ids}') = 'array'
                 THEN meeting.quorum_data #> '{source_links,convocatoria_ids}'
               ELSE '[]'::jsonb
             END
           ) linked(value)
          WHERE linked.value = p_convocatoria_id::text
       )
     );

  IF v_candidate_count > 1 THEN
    RAISE EXCEPTION 'meeting scheduling: convocatoria is linked to more than one meeting';
  END IF;

  -- Compatibilidad conservadora con reuniones legacy: solo se reutiliza un
  -- candidato unívoco en la fecha/hora exacta y sin ningún vínculo previo.
  IF v_candidate_count = 0 THEN
    SELECT count(*), min(meeting.id::text)::uuid
      INTO v_candidate_count, v_meeting_id
      FROM public.meetings meeting
     WHERE meeting.tenant_id = v_convocatoria.tenant_id
       AND meeting.body_id = v_convocatoria.body_id
       AND meeting.status IN ('DRAFT', 'CONVOCADA')
       AND meeting.scheduled_start IS NOT DISTINCT FROM v_convocatoria.fecha_1
       AND NULLIF(meeting.quorum_data #>> '{agenda_binding,convocatoria_id}', '') IS NULL
       AND NULLIF(meeting.quorum_data #>> '{source_links,convocatoria_id}', '') IS NULL
       AND NULLIF(meeting.quorum_data #>> '{scheduled_from,convocatoria_id}', '') IS NULL
       AND NOT EXISTS (
         SELECT 1
           FROM public.agenda_items item
          WHERE item.meeting_id = meeting.id
            AND item.source_convocatoria_id IS NOT NULL
       );
    IF v_candidate_count > 1 THEN
      RAISE EXCEPTION
        'meeting scheduling: more than one unbound meeting exists at the exact convocatoria timestamp';
    END IF;
  END IF;

  v_reused := v_candidate_count = 1;

  SELECT authority.person_id
    INTO v_president_id
    FROM public.authority_evidence authority
   WHERE authority.tenant_id = v_convocatoria.tenant_id
     AND authority.body_id = v_convocatoria.body_id
     AND authority.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
     AND authority.fecha_inicio <= (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
     AND (
       authority.fecha_fin IS NULL
       OR authority.fecha_fin >= (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
     )
     AND authority.estado IN ('VIGENTE', 'PROGRAMADO')
   ORDER BY
     CASE authority.cargo WHEN 'PRESIDENTE' THEN 1 ELSE 2 END,
     authority.fecha_inicio DESC,
     authority.id
   LIMIT 1;

  SELECT authority.person_id
    INTO v_secretary_id
    FROM public.authority_evidence authority
   WHERE authority.tenant_id = v_convocatoria.tenant_id
     AND authority.body_id = v_convocatoria.body_id
     AND authority.cargo IN ('SECRETARIO', 'VICESECRETARIO')
     AND authority.fecha_inicio <= (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
     AND (
       authority.fecha_fin IS NULL
       OR authority.fecha_fin >= (v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid')::date
     )
     AND authority.estado IN ('VIGENTE', 'PROGRAMADO')
   ORDER BY
     CASE authority.cargo WHEN 'SECRETARIO' THEN 1 ELSE 2 END,
     authority.fecha_inicio DESC,
     authority.id
   LIMIT 1;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'index', agenda.ordinality,
               'titulo', COALESCE(NULLIF(btrim(agenda.value ->> 'titulo'), ''), 'Punto del orden del día'),
               'materia', NULLIF(btrim(agenda.value ->> 'materia'), ''),
               'tipo', NULLIF(btrim(agenda.value ->> 'tipo'), ''),
               'inscribible', lower(COALESCE(agenda.value ->> 'inscribible', 'false')) IN ('true', 't', '1')
             )
             ORDER BY agenda.ordinality
           ),
           '[]'::jsonb
         )
    INTO v_agenda_preview
    FROM jsonb_array_elements(v_convocatoria.agenda_items)
      WITH ORDINALITY AS agenda(value, ordinality);

  v_meeting_type := CASE v_body.body_type
    WHEN 'CDA' THEN 'CONSEJO_ADMINISTRACION'
    WHEN 'JUNTA' THEN 'JUNTA_GENERAL'
    ELSE COALESCE(NULLIF(v_convocatoria.tipo_convocatoria, ''), 'REUNION_ORGANO')
  END;

  IF NOT v_reused THEN
    v_quorum_data := jsonb_build_object(
      'is_universal', v_convocatoria.junta_universal IS TRUE,
      'scheduled_from', jsonb_build_object(
        'source', 'convocatoria',
        'convocatoria_id', p_convocatoria_id,
        'estado_convocatoria', v_convocatoria.estado,
        'statutory_basis', v_convocatoria.statutory_basis,
        'junta_universal', v_convocatoria.junta_universal IS TRUE
      ),
      'source_links', jsonb_build_object(
        'convocatoria_id', p_convocatoria_id,
        'convocatoria_ids', jsonb_build_array(p_convocatoria_id),
        'source', 'explicit'
      ),
      'agenda_preview', v_agenda_preview,
      'trace', jsonb_build_object(
        'rule_trace_present', v_convocatoria.rule_trace IS NOT NULL,
        'reminders_trace_present', v_convocatoria.reminders_trace IS NOT NULL
      )
    );

    INSERT INTO public.meetings (
      slug,
      tenant_id,
      body_id,
      meeting_type,
      scheduled_start,
      scheduled_end,
      status,
      president_id,
      secretary_id,
      quorum_data,
      location,
      confidentiality_level
    ) VALUES (
      'convocatoria-' || replace(p_convocatoria_id::text, '-', ''),
      v_convocatoria.tenant_id,
      v_convocatoria.body_id,
      v_meeting_type,
      v_convocatoria.fecha_1,
      v_convocatoria.fecha_1 + interval '2 hours',
      'CONVOCADA',
      v_president_id,
      v_secretary_id,
      v_quorum_data,
      COALESCE(v_convocatoria.lugar, v_convocatoria.modalidad),
      'NORMAL'
    )
    RETURNING id INTO v_meeting_id;
  ELSE
    SELECT * INTO v_meeting
      FROM public.meetings meeting
     WHERE meeting.id = v_meeting_id
     FOR UPDATE;

    IF v_meeting.status NOT IN ('DRAFT', 'CONVOCADA')
       OR v_meeting.scheduled_start IS NULL
       OR v_meeting.scheduled_start <= now()
       OR v_meeting.scheduled_start IS DISTINCT FROM v_convocatoria.fecha_1 THEN
      RAISE EXCEPTION
        'meeting scheduling: reused meeting must be open, future and exactly match convocatorias.fecha_1';
    END IF;

    UPDATE public.meetings
       SET status = 'CONVOCADA',
           scheduled_end = COALESCE(scheduled_end, v_convocatoria.fecha_1 + interval '2 hours'),
           president_id = COALESCE(president_id, v_president_id),
           secretary_id = COALESCE(secretary_id, v_secretary_id),
           meeting_type = COALESCE(NULLIF(meeting_type, ''), v_meeting_type),
           location = COALESCE(location, v_convocatoria.lugar, v_convocatoria.modalidad)
     WHERE id = v_meeting_id
       AND tenant_id = v_convocatoria.tenant_id;
  END IF;

  -- Esta llamada comparte la misma transacción y cualquier fallo revierte
  -- también el INSERT/UPDATE de meetings.
  v_materialization := public.fn_secretaria_materialize_convocation_agenda(
    v_meeting_id,
    p_convocatoria_id
  );

  SELECT * INTO v_meeting
    FROM public.meetings meeting
   WHERE meeting.id = v_meeting_id
     AND meeting.tenant_id = v_convocatoria.tenant_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_meeting.status <> 'CONVOCADA'
     OR v_meeting.scheduled_start <= now()
     OR v_meeting.scheduled_start IS DISTINCT FROM v_convocatoria.fecha_1 THEN
    RAISE EXCEPTION
      'meeting scheduling: final authoritative schedule diverges from future convocatorias.fecha_1';
  END IF;

  RETURN jsonb_build_object(
    'id', v_meeting_id,
    'meeting_id', v_meeting_id,
    'reused', v_reused,
    'scheduled_start', v_meeting.scheduled_start,
    'materialized_items', v_materialization -> 'materialized_items',
    'changed_items', v_materialization -> 'changed_items',
    'canonical_agenda_hash_sha256', v_materialization -> 'canonical_agenda_hash_sha256'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_create_or_reuse_meeting_from_convocation(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_create_or_reuse_meeting_from_convocation(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_secretaria_create_or_reuse_meeting_from_convocation(uuid) IS
  'Crea o reutiliza una reunión futura y materializa/reconcilia su agenda desde una convocatoria EMITIDA en una única transacción; exige igualdad timestamptz exacta con fecha_1.';

-- La operación de bajo nivel deja de ser una segunda RPC de cliente. Sigue
-- disponible para service_role y para la llamada interna del owner desde la
-- RPC transaccional anterior.
REVOKE ALL ON FUNCTION public.fn_secretaria_materialize_convocation_agenda(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_materialize_convocation_agenda(uuid, uuid)
  TO service_role;

-- Sustituye la versión de 20260720135000. El comportamiento ordinario se
-- conserva; el caso EAD_INTERPOSITION + SANDBOX de una convocatoria se
-- reconoce y normaliza exclusivamente en servidor.
CREATE OR REPLACE FUNCTION public.fn_create_communication_atomic(
  p_comm jsonb,
  p_attachments jsonb,
  p_recipients jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_comm_id uuid;
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_convocatoria_id uuid := NULLIF(p_comm ->> 'convocatoria_id', '')::uuid;
  v_meeting_id uuid := NULLIF(p_comm ->> 'meeting_id', '')::uuid;
  v_linked_meeting_count integer := 0;
  v_requested_state text := upper(COALESCE(NULLIF(p_comm ->> 'estado', ''), 'BORRADOR'));
  v_input_metadata jsonb := COALESCE(p_comm -> 'metadata', '{}'::jsonb);
  v_metadata jsonb;
  v_ead_service jsonb;
  v_policy_scope jsonb;
  v_has_ead_marker boolean := false;
  v_is_ead_sandbox boolean := false;
  v_has_ead_recipient boolean := false;
BEGIN
  IF v_requested_state NOT IN ('BORRADOR','PROGRAMADA') THEN
    RAISE EXCEPTION 'new communication state must be BORRADOR or PROGRAMADA';
  END IF;
  IF jsonb_typeof(v_input_metadata) <> 'object' THEN
    RAISE EXCEPTION 'communication metadata must be a JSON object';
  END IF;

  v_tenant_id := COALESCE(
    NULLIF(p_comm ->> 'tenant_id', '')::uuid,
    public.fn_current_tenant_id()
  );
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id required';
  END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(v_tenant_id);

  IF p_comm ->> 'tipo_comunicacion' = 'CONVOCATORIA' THEN
    IF v_convocatoria_id IS NULL THEN
      RAISE EXCEPTION 'convocatoria_id required for CONVOCATORIA communication';
    END IF;
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'COMMUNICATION:CONVOCATORIA:' || v_tenant_id::text || ':' || v_convocatoria_id::text,
        0
      )
    );
    SELECT count(DISTINCT item.meeting_id), max(item.meeting_id::text)::uuid
      INTO v_linked_meeting_count, v_meeting_id
      FROM public.agenda_items item
     WHERE item.tenant_id = v_tenant_id
       AND item.source_convocatoria_id = v_convocatoria_id;
    IF v_linked_meeting_count <> 1 THEN
      RAISE EXCEPTION 'convocatoria requires exactly one materialized meeting before communication';
    END IF;
    IF NULLIF(p_comm ->> 'meeting_id', '') IS NOT NULL
       AND v_meeting_id IS DISTINCT FROM (p_comm ->> 'meeting_id')::uuid THEN
      RAISE EXCEPTION 'meeting_id does not match the authoritative agenda binding';
    END IF;
  END IF;

  v_ead_service := v_input_metadata -> 'ead_service';
  v_policy_scope := v_ead_service -> 'policy_scope';
  SELECT
    COALESCE(v_ead_service ->> 'mode' = 'EAD_INTERPOSITION', false)
    OR COALESCE(v_input_metadata #>> '{channel_semantics,requested_minimum}' = 'EAD_INTERPOSITION', false)
    OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(v_input_metadata #> '{channel_semantics,recipients}') = 'array'
              THEN v_input_metadata #> '{channel_semantics,recipients}'
            ELSE '[]'::jsonb
          END
        ) recipient
       WHERE recipient ->> 'canal_primario' = 'EAD_INTERPOSITION'
          OR recipient ->> 'canal_fallback' = 'EAD_INTERPOSITION'
    )
    INTO v_has_ead_marker;

  v_is_ead_sandbox :=
    p_comm ->> 'tipo_comunicacion' = 'CONVOCATORIA'
    AND v_input_metadata -> 'sandbox_only' = 'true'::jsonb
    AND v_has_ead_marker;

  IF p_comm ->> 'tipo_comunicacion' = 'CONVOCATORIA'
     AND v_has_ead_marker
     AND NOT v_is_ead_sandbox THEN
    RAISE EXCEPTION 'EAD_INTERPOSITION convocatoria is allowed only as sandbox draft';
  END IF;

  IF v_is_ead_sandbox THEN
    IF v_requested_state <> 'BORRADOR'
       OR NULLIF(p_comm ->> 'fecha_programada', '') IS NOT NULL
       OR v_input_metadata -> 'delivery_disabled' IS DISTINCT FROM 'true'::jsonb
       OR (
         v_input_metadata ? 'delivery_allowed'
         AND v_input_metadata -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb
       )
       OR (
         v_input_metadata ? 'provider_interaction'
         AND v_input_metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb
       )
       OR (
         v_input_metadata ? 'dispatcher_triggered'
         AND v_input_metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb
       )
       OR (
         v_input_metadata ? 'dispatch_allowed'
         AND v_input_metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb
       )
       OR v_input_metadata -> 'ead_delivery_mode' IS DISTINCT FROM 'null'::jsonb
       OR jsonb_typeof(v_ead_service) <> 'object'
       OR v_ead_service ->> 'mode' <> 'EAD_INTERPOSITION'
       OR v_ead_service ->> 'environment' <> 'SANDBOX'
       OR v_ead_service -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb
       OR v_ead_service -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb
       OR v_ead_service -> 'signature_claim' IS DISTINCT FROM 'false'::jsonb
       OR v_ead_service -> 'erds_claim' IS DISTINCT FROM 'false'::jsonb
       OR v_ead_service -> 'provider_contract_evidence' IS DISTINCT FROM 'null'::jsonb
       OR jsonb_typeof(v_policy_scope) <> 'array'
       OR jsonb_array_length(v_policy_scope) <> 3
       OR NOT v_policy_scope @> '["BASIC_MESSAGING","CUSTODY","EARCHIVING"]'::jsonb
       OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(v_input_metadata) IS TRUE
       OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements(COALESCE(p_recipients, '[]'::jsonb)) recipient
          WHERE recipient ->> 'canal_primario' = 'BUROFAX_ERDS'
             OR recipient ->> 'canal_fallback' = 'BUROFAX_ERDS'
       ) THEN
      RAISE EXCEPTION
        'EAD sandbox metadata contradicts BORRADOR/no-dispatch/interposition policy';
    END IF;

    -- Aunque el cliente ya envíe estos valores, el servidor es la fuente de
    -- verdad y vuelve a imponer el conjunto canónico completo.
    v_metadata := v_input_metadata || jsonb_build_object(
      'sandbox_only', true,
      'delivery_disabled', true,
      'delivery_allowed', false,
      'dispatch_allowed', false,
      'dispatcher_triggered', false,
      'provider_interaction', false,
      'ead_delivery_mode', NULL,
      'channel_semantics', COALESCE(v_input_metadata -> 'channel_semantics', '{}'::jsonb)
        || jsonb_build_object('requested_minimum', 'EAD_INTERPOSITION'),
      'ead_service', jsonb_build_object(
        'mode', 'EAD_INTERPOSITION',
        'policy_scope', jsonb_build_array('BASIC_MESSAGING', 'CUSTODY', 'EARCHIVING'),
        'environment', 'SANDBOX',
        'delivery_allowed', false,
        'provider_interaction', false,
        'provider_contract_evidence', NULL,
        'signature_claim', false,
        'erds_claim', false
      )
    );
  ELSE
    IF v_requested_state = 'PROGRAMADA'
       AND NULLIF(p_comm ->> 'fecha_programada', '') IS NULL THEN
      RAISE EXCEPTION 'fecha_programada required for PROGRAMADA';
    END IF;
    v_metadata := v_input_metadata;
  END IF;

  v_metadata := v_metadata || jsonb_build_object(
    'created_via', CASE
      WHEN public.fn_secretaria_is_service_role() IS TRUE THEN 'service_role'
      ELSE 'authenticated_user'
    END
  );

  INSERT INTO public.communications (
    tenant_id, entity_id, body_id, organo_tipo, agreement_id, meeting_id,
    convocatoria_id, template_id, tipo_comunicacion, tipo_respuesta_esperada,
    nivel_certificacion_minimo, asunto, cuerpo_render, cuerpo_hash_sha512,
    estado, fecha_programada, comunicacion_libre, metadata, created_by,
    package_revision
  ) VALUES (
    v_tenant_id,
    (p_comm ->> 'entity_id')::uuid,
    NULLIF(p_comm ->> 'body_id', '')::uuid,
    p_comm ->> 'organo_tipo',
    NULLIF(p_comm ->> 'agreement_id', '')::uuid,
    v_meeting_id,
    v_convocatoria_id,
    NULLIF(p_comm ->> 'template_id', '')::uuid,
    p_comm ->> 'tipo_comunicacion',
    p_comm ->> 'tipo_respuesta_esperada',
    CASE
      WHEN v_is_ead_sandbox THEN 'EMAIL_NORMAL'
      ELSE p_comm ->> 'nivel_certificacion_minimo'
    END,
    p_comm ->> 'asunto',
    p_comm ->> 'cuerpo_render',
    lower(p_comm ->> 'cuerpo_hash_sha512'),
    'BORRADOR',
    CASE
      WHEN v_is_ead_sandbox THEN NULL
      ELSE NULLIF(p_comm ->> 'fecha_programada', '')::timestamptz
    END,
    COALESCE((p_comm ->> 'comunicacion_libre')::boolean, false),
    v_metadata,
    v_user_id,
    1
  ) RETURNING id INTO v_comm_id;

  IF jsonb_typeof(COALESCE(p_recipients, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_recipients, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'at least one recipient is required';
  END IF;
  SELECT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_recipients) recipient
     WHERE recipient ->> 'canal_primario' = 'BUROFAX_ERDS'
        OR recipient ->> 'canal_fallback' = 'BUROFAX_ERDS'
  ) INTO v_has_ead_recipient;

  IF jsonb_typeof(COALESCE(p_attachments, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'communication attachments must be a JSON array';
  END IF;
  IF jsonb_array_length(COALESCE(p_attachments, '[]'::jsonb)) = 0
     AND NOT (
       p_comm ->> 'tipo_comunicacion' <> 'CONVOCATORIA'
       AND v_has_ead_recipient
       AND v_metadata ->> 'ead_delivery_mode' = 'BASIC_MESSAGE'
     ) THEN
    RAISE EXCEPTION 'zero attachments are allowed only for explicit EAD BASIC_MESSAGE mode';
  END IF;
  IF v_has_ead_recipient
     AND jsonb_array_length(COALESCE(p_attachments, '[]'::jsonb)) > 0
     AND v_metadata ->> 'ead_delivery_mode' <> 'PACKAGE_WITH_ATTACHMENTS' THEN
    RAISE EXCEPTION 'EAD attachments require explicit PACKAGE_WITH_ATTACHMENTS mode';
  END IF;
  IF v_metadata ->> 'ead_delivery_mode' = 'BASIC_MESSAGE'
     AND jsonb_array_length(COALESCE(p_attachments, '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'EAD BASIC_MESSAGE cannot carry attachments';
  END IF;

  INSERT INTO public.communication_attachments (
    communication_id, tipo, label, evidence_bundle_id, source_attachment_id,
    storage_uri, hash_sha256, hash_sha512, size_bytes, mime_type, orden,
    modo_entrega, signed_url_expiry_hours
  )
  SELECT
    v_comm_id,
    attachment ->> 'tipo',
    attachment ->> 'label',
    NULLIF(attachment ->> 'evidence_bundle_id', '')::uuid,
    NULLIF(attachment ->> 'source_attachment_id', '')::uuid,
    attachment ->> 'storage_uri',
    lower(NULLIF(attachment ->> 'hash_sha256', '')),
    lower(attachment ->> 'hash_sha512'),
    NULLIF(attachment ->> 'size_bytes', '')::bigint,
    attachment ->> 'mime_type',
    COALESCE((attachment ->> 'orden')::integer, 0),
    COALESCE(attachment ->> 'modo_entrega', 'ADJUNTO'),
    COALESCE((attachment ->> 'signed_url_expiry_hours')::integer, 168)
  FROM jsonb_array_elements(p_attachments) attachment;

  INSERT INTO public.communication_recipients (
    communication_id, person_id, cargo_en_organo,
    canal_original, canal_primario, canal_fallback,
    destino_primario, destino_fallback, delivery_alternative
  )
  SELECT
    v_comm_id,
    (recipient ->> 'person_id')::uuid,
    recipient ->> 'cargo_en_organo',
    recipient ->> 'canal_primario',
    recipient ->> 'canal_primario',
    NULLIF(recipient ->> 'canal_fallback', ''),
    recipient ->> 'destino_primario',
    NULLIF(recipient ->> 'destino_fallback', ''),
    CASE
      WHEN jsonb_typeof(recipient -> 'delivery_alternative') = 'object'
        THEN recipient -> 'delivery_alternative'
      ELSE NULL
    END
  FROM jsonb_array_elements(p_recipients) recipient;

  IF p_comm ->> 'tipo_comunicacion' = 'CONVOCATORIA' THEN
    PERFORM public.fn_communication_prepare_census(v_comm_id);
  ELSIF lower(p_comm ->> 'cuerpo_hash_sha512') IS DISTINCT FROM encode(
    extensions.digest(convert_to(p_comm ->> 'cuerpo_render', 'UTF8'), 'sha512'), 'hex'
  ) THEN
    RAISE EXCEPTION 'communication body SHA-512 mismatch';
  END IF;

  UPDATE public.communications
     SET package_hash_sha512 = public.fn_communication_compute_package_hash(v_comm_id),
         updated_at = now()
   WHERE id = v_comm_id;

  IF v_requested_state = 'PROGRAMADA' AND NOT v_is_ead_sandbox THEN
    PERFORM public.fn_communication_assert_authoritative_binding(v_comm_id);
    UPDATE public.communications
       SET estado = 'PROGRAMADA', updated_at = now()
     WHERE id = v_comm_id;
  END IF;

  RETURN v_comm_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_create_communication_atomic(jsonb, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_communication_atomic(jsonb, jsonb, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_create_communication_atomic(jsonb, jsonb, jsonb) IS
  'Crea comunicación, adjuntos y destinatarios atómicamente. EAD_INTERPOSITION sandbox de convocatoria queda forzado a BORRADOR sin fechas, dispatch, entrega, proveedor, ERDS ni firma.';

-- El invariante no termina al crear el agregado: impide que una RPC legacy,
-- el dispatcher o un UPDATE directo promocionen después el borrador sandbox.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.tipo_comunicacion = 'CONVOCATORIA'
     AND NEW.metadata -> 'sandbox_only' = 'true'::jsonb
     AND NEW.metadata #>> '{ead_service,mode}' = 'EAD_INTERPOSITION' THEN
    IF NEW.estado <> 'BORRADOR'
       OR NEW.fecha_programada IS NOT NULL
       OR NEW.fecha_envio_efectiva IS NOT NULL
       OR NEW.fecha_limite_respuesta IS NOT NULL
       OR NEW.tiene_rebotes IS TRUE
       OR NEW.metadata -> 'delivery_disabled' IS DISTINCT FROM 'true'::jsonb
       OR NEW.metadata -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'ead_delivery_mode' IS DISTINCT FROM 'null'::jsonb
       OR NEW.metadata #> '{ead_service,delivery_allowed}' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata #> '{ead_service,provider_interaction}' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata #> '{ead_service,signature_claim}' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata #> '{ead_service,erds_claim}' IS DISTINCT FROM 'false'::jsonb THEN
      RAISE EXCEPTION
        'EAD sandbox communication is immutable as BORRADOR without dates, dispatch, delivery or provider claims'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_sandbox_communication
  ON public.communications;
CREATE TRIGGER trg_secretaria_guard_ead_sandbox_communication
  BEFORE INSERT OR UPDATE ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_ead_sandbox_communication();

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
