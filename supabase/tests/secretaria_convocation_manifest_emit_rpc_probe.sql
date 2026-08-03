-- Probe transaccional post-migración para 136000 + 137000 + 138000.
-- No envía comunicaciones ni conserva convocatorias: todo termina en ROLLBACK.

BEGIN;

CREATE FUNCTION public.fn_secretaria_convocation_manifest_probe_assert(
  p_condition boolean,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'convocation manifest probe assertion failed: %', p_message
      USING ERRCODE = 'P0001';
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_convocation_manifest_probe_assert(boolean, text)
  FROM PUBLIC;

DO $probe$
DECLARE
  v_tenant_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_entity_id constant uuid := '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid;
  v_body_id constant uuid := 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'::uuid;
  v_target_id constant uuid := 'f653c44c-15ce-4428-b3d3-f4ed17efe93b'::uuid;
  v_delegation_id constant uuid := '3b8da713-8353-4fa9-91c8-917cf0bcb9b3'::uuid;
  v_draft_id constant uuid := '38000000-0000-4000-8000-000000000001'::uuid;
  v_entity_name text;
  v_body_name text;
  v_target_name text;
  v_president_name text;
  v_user_id uuid;
  v_representative_id uuid;
  v_representative_name text;
  v_fecha_1 timestamptz;
  v_place text := 'Sede social, Madrid';
  v_agenda jsonb;
  v_valid_text text;
  v_payload jsonb;
  v_result jsonb;
  v_lifecycle_result jsonb;
  v_convocatoria_id uuid;
  v_manifest_id uuid;
  v_attachment_id uuid;
  v_attachment_retry_id uuid;
  v_meeting_id uuid;
  v_snapshot_id uuid;
  v_communication_id uuid;
  v_package_attachments jsonb;
  v_package_recipients jsonb;
  v_manifest public.convocation_manifests%ROWTYPE;
  v_act public.convocation_acts%ROWTYPE;
  v_original_fecha_emision date;
  v_original_authority_id uuid;
  v_direct_insert_blocked boolean := false;
  v_direct_transition_blocked boolean := false;
  v_direct_lifecycle_blocked boolean := false;
  v_event_mutation_blocked boolean := false;
  v_service_emit_blocked boolean := false;
  v_legacy_alias_blocked boolean := false;
  v_outside_claim_blocked boolean := false;
  v_arbitrary_text_blocked boolean := false;
  v_isabel_blocked boolean := false;
  v_mixed_data_blocked boolean := false;
  v_months constant text[] := ARRAY[
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
BEGIN
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    current_setting('server_version_num')::integer >= 170000,
    'el probe debe ejecutarse en PostgreSQL 17'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    to_regprocedure('public.fn_emit_convocatoria(jsonb)') IS NOT NULL,
    'falta fn_emit_convocatoria(jsonb)'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    to_regprocedure('public.fn_get_convocation_manifest_canonical_source(uuid)') IS NOT NULL,
    'falta la fuente canónica para Edge'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    to_regprocedure(
      'public.fn_register_server_rendered_convocation_attachment(uuid,uuid,text,text,text,text,text,bigint,text)'
    ) IS NOT NULL,
    'falta el registro server-side del DOCX final'
  );

  SELECT entity.legal_name INTO STRICT v_entity_name
    FROM public.entities entity
   WHERE entity.id = v_entity_id
     AND entity.tenant_id = v_tenant_id
     AND entity.entity_status = 'Active'
     AND upper(entity.jurisdiction) = 'ES'
     AND entity.data_class = 'DEMO';
  SELECT body.name INTO STRICT v_body_name
    FROM public.governing_bodies body
   WHERE body.id = v_body_id
     AND body.entity_id = v_entity_id
     AND body.tenant_id = v_tenant_id
     AND body.body_type = 'CDA';
  SELECT person.full_name INTO STRICT v_president_name
    FROM public.authority_evidence evidence
    JOIN public.persons person
      ON person.id = evidence.person_id
     AND person.tenant_id = evidence.tenant_id
   WHERE evidence.tenant_id = v_tenant_id
     AND evidence.entity_id = v_entity_id
     AND evidence.body_id = v_body_id
     AND evidence.cargo = 'PRESIDENTE'
     AND evidence.estado = 'VIGENTE';
  SELECT auth_user.id INTO STRICT v_user_id
    FROM auth.users auth_user
   WHERE auth_user.email = 'demo@arga-seguros.com'
   LIMIT 1;
  SELECT target.legal_name INTO STRICT v_target_name
    FROM public.entities target
   WHERE target.id = v_target_id
     AND target.tenant_id = v_tenant_id
     AND target.entity_status = 'Active'
     AND upper(target.jurisdiction) = 'ES'
     AND target.data_class = 'DEMO';
  SELECT delegation.delegate_id, person.full_name
    INTO STRICT v_representative_id, v_representative_name
    FROM public.delegations delegation
    JOIN public.persons person
      ON person.id = delegation.delegate_id
     AND person.tenant_id = delegation.tenant_id
   WHERE delegation.id = v_delegation_id
     AND delegation.code = 'DEMO-REP-183-CARMEN-001'
     AND delegation.entity_id = v_entity_id
     AND delegation.tenant_id = v_tenant_id
     AND person.full_name = 'Dña. Carmen Delgado Ortiz'
     AND person.data_class = 'DEMO';

  v_fecha_1 := (
    (current_date + 20)::timestamp + time '10:00'
  ) AT TIME ZONE 'Europe/Madrid';
  v_agenda := jsonb_build_array(
    jsonb_build_object(
      'titulo', 'Informe del Director General sobre la marcha de la Sociedad',
      'materia', 'INFORME_MARCHA_SOCIEDAD',
      'tipo', 'ORDINARIA',
      'kind', 'INFORMATIVO',
      'inscribible', false
    ),
    jsonb_build_object(
      'titulo', 'Información sobre gobierno corporativo y cumplimiento',
      'materia', 'INFORME_GOBIERNO_CUMPLIMIENTO',
      'tipo', 'ORDINARIA',
      'kind', 'INFORMATIVO',
      'inscribible', false
    ),
    jsonb_build_object(
      'titulo', 'Formulación de las cuentas anuales de la Sociedad',
      'materia', 'FORMULACION_CUENTAS',
      'tipo', 'ORDINARIA',
      'kind', 'DECISORIO',
      'inscribible', false,
      'requires_attachments', true,
      'propuesta_acuerdo', 'Formular las cuentas anuales de la Sociedad correspondientes al último ejercicio cerrado.'
    ),
    jsonb_build_object(
      'titulo', 'Designación de representante de la socia única en la filial',
      'materia', 'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL',
      'tipo', 'ORDINARIA',
      'kind', 'DECISORIO',
      'inscribible', false,
      'target_entity_id', v_target_id,
      'representative_person_id', v_representative_id,
      'representation_delegation_id', v_delegation_id,
      'propuesta_acuerdo', format(
        'Designar a %s como representante de %s, socia única de %s.',
        v_representative_name,
        v_entity_name,
        v_target_name
      )
    ),
    jsonb_build_object(
      'titulo', 'Otorgamiento de poderes generales al Director Financiero',
      'materia', 'OTORGAMIENTO_PODERES',
      'tipo', 'ORDINARIA',
      'kind', 'DECISORIO',
      'inscribible', true,
      'propuesta_acuerdo', 'Otorgar poderes generales al Director Financiero con los límites detallados en la propuesta.'
    )
  );

  -- Equivalente visible del render real de Paso 7: template 1.1.0,
  -- normalizeVisibleDocumentText y DOCUMENT_DEMO_NOTICE.
  v_valid_text := format(
    $text$DEMO / NO OFICIAL · No constituye evidencia final productiva

SIMULACIÓN DEMO / SIN EFECTO JURÍDICO

BORRADOR OPERATIVO DE CONVOCATORIA DE SESIÓN DEL CONSEJO DE ADMINISTRACIÓN DE %s

A efectos exclusivos de simulación DEMO, se registra un borrador operativo referido al cargo vigente de Presidente, ocupado según el censo autoritativo por %s. Esta referencia acredita únicamente la titularidad del cargo y no afirma que dicha persona haya ordenado, consentido, emitido o firmado esta convocatoria.

El borrador documenta una propuesta de sesión del Consejo de Administración de %s (la «Sociedad»), al amparo de los artículos 245.2 y 246 de la Ley de Sociedades de Capital, de los Estatutos Sociales y del Reglamento del Consejo, para el día %s a las %s en %s, en modalidad Presencial.

ORDEN DEL DÍA

1. Informe del Director General sobre la marcha de la Sociedad
2. Información sobre gobierno corporativo y cumplimiento
3. Formulación de las cuentas anuales de la Sociedad (Acuerdo · Formulación de cuentas)
4. Designación de representante de la socia única en la filial — Filial: %s; representante propuesta: %s (Acuerdo · Designación de representante de la socia única en la filial)
5. Otorgamiento de poderes generales al Director Financiero (Acuerdo · Otorgamiento o modificación de poderes de representación)

PLAZO Y FORMA DE LA CONVOCATORIA

El borrador prevé que una eventual convocatoria jurídica se remita individualmente a cada consejero por Notificación ERDS (EAD Trust), con la antelación y por el procedimiento previstos en los Estatutos Sociales y en el Reglamento del Consejo. Esta simulación no produce remisión ni comunicación real.

DOCUMENTACIÓN DE SOPORTE

El borrador prevé que la documentación asociada al orden del día se ponga a disposición de los consejeros mediante repositorio documental privado de TGMS, identificada en el expediente mediante el índice expediente de convocatoria. Esta simulación no produce puesta a disposición real ni acredita que los consejeros hayan recibido documentación.

SOCIEDAD COTIZADA

Una eventual preparación y celebración jurídica de la sesión deberá sujetarse asimismo a las especialidades legales aplicables a las sociedades cotizadas y al Reglamento del Consejo de la Sociedad.

En %s, a %s.

Registro técnico realizado por la Secretaría Societaria en el entorno DEMO. Referencia de competencia: cargo de Presidente ocupado por %s, sin atribuirle actuación personal.

Documento demo/operativo sin efecto jurídico. No constituye una convocatoria emitida ni evidencia final productiva. La eventual interposición, mensajería o custodia electrónica por EAD Trust se registra separadamente en el expediente y no constituye ni sustituye la actuación, el consentimiento o la firma jurídica del convocante.$text$,
    v_entity_name,
    v_president_name,
    v_entity_name,
    concat(
      extract(day FROM (v_fecha_1 AT TIME ZONE 'Europe/Madrid'))::integer,
      ' de ',
      v_months[extract(month FROM (v_fecha_1 AT TIME ZONE 'Europe/Madrid'))::integer],
      ' de ',
      extract(year FROM (v_fecha_1 AT TIME ZONE 'Europe/Madrid'))::integer
    ),
    to_char(v_fecha_1 AT TIME ZONE 'Europe/Madrid', 'HH24:MI'),
    v_place,
    v_target_name,
    v_representative_name,
    v_place,
    concat(
      extract(day FROM current_date)::integer,
      ' de ',
      v_months[extract(month FROM current_date)::integer],
      ' de ',
      extract(year FROM current_date)::integer
    ),
    v_president_name
  );
  v_payload := jsonb_build_object(
    'body_id', v_body_id,
    'tipo_convocatoria', 'ORDINARIA',
    'fecha_1', v_fecha_1,
    'modalidad', 'PRESENCIAL',
    'lugar', v_place,
    'junta_universal', false,
    'is_second_call', false,
    'publication_channels', jsonb_build_array('ERDS'),
    'agenda_items', v_agenda,
    'statutory_basis', 'Artículos 245.2 y 246.1 LSC; Estatutos; Reglamento del Consejo',
    'convocatoria_text', v_valid_text,
    'accepted_warnings', '[]'::jsonb
  );

  INSERT INTO public.convocatorias (
    id, tenant_id, body_id, tipo_convocatoria, estado, agenda_items
  ) VALUES (
    v_draft_id, v_tenant_id, NULL, 'ORDINARIA', 'BORRADOR', '[]'::jsonb
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    EXISTS (
      SELECT 1 FROM public.convocatorias draft
       WHERE draft.id = v_draft_id
         AND draft.body_id IS NULL
         AND draft.fecha_emision IS NULL
    ),
    'un borrador sin órgano no se pudo conservar'
  );

  BEGIN
    INSERT INTO public.convocatorias (
      tenant_id, body_id, tipo_convocatoria, estado, fecha_1,
      modalidad, lugar, publication_channels, agenda_items, convocatoria_text
    ) VALUES (
      v_tenant_id, v_body_id, 'ORDINARIA', 'EMITIDA', v_fecha_1,
      'PRESENCIAL', v_place, ARRAY['ERDS'], v_agenda, v_valid_text
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_direct_insert_blocked := SQLERRM LIKE '%CONVOCATION_EMISSION_REQUIRES_GOVERNED_RPC%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_direct_insert_blocked,
    'una emisión directa por INSERT no quedó bloqueada'
  );

  BEGIN
    UPDATE public.convocatorias SET estado = 'EMITIDA' WHERE id = v_draft_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_direct_transition_blocked := SQLERRM LIKE '%CONVOCATION_EMISSION_REQUIRES_GOVERNED_RPC%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_direct_transition_blocked,
    'una transición directa BORRADOR -> EMITIDA no quedó bloqueada'
  );

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );

  BEGIN
    PERFORM public.fn_emit_convocatoria(v_payload);
  EXCEPTION WHEN insufficient_privilege THEN
    v_service_emit_blocked := SQLERRM LIKE '%AUTHENTICATED_USER_REQUIRED_TO_RECORD_DEMO_CONVOCATION_ACT%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_service_emit_blocked,
    'service_role pudo inventar un acto DEMO sin registrador humano'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    NOT has_function_privilege('service_role', 'public.fn_emit_convocatoria(jsonb)', 'EXECUTE')
    AND NOT has_table_privilege('service_role', 'public.convocation_acts', 'INSERT')
    AND NOT has_table_privilege('service_role', 'public.convocation_manifests', 'INSERT')
    AND NOT has_table_privilege('service_role', 'public.convocation_lifecycle_events', 'INSERT'),
    'service_role conserva una ruta DML funcional directa al WORM'
  );

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'authenticated',
      'sub', v_user_id,
      'tenant_id', v_tenant_id,
      'app_metadata', jsonb_build_object('tenant_id', v_tenant_id)
    )::text,
    true
  );

  BEGIN
    PERFORM public.fn_emit_convocatoria(
      v_payload || jsonb_build_object('convocatoria_text', 'texto arbitrario')
    );
  EXCEPTION WHEN check_violation THEN
    v_arbitrary_text_blocked := SQLERRM LIKE 'CONVOCATION_TEXT_CANONICAL_STRUCTURE_TOO_SHORT%'
      OR SQLERRM LIKE 'CONVOCATION_TEXT_CANONICAL_DEMO_PREFIX_MISMATCH%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_arbitrary_text_blocked,
    'un texto arbitrario superó el gate semántico'
  );

  BEGIN
    PERFORM public.fn_emit_convocatoria(
      v_payload || jsonb_build_object(
        'convocatoria_text',
        replace(
          v_valid_text,
          E'ORDEN DEL DÍA\n\n',
          E'ORDEN DEL DÍA\n\nDña. Isabel Moreno Castro.\n'
        )
      )
    );
  EXCEPTION WHEN check_violation THEN
    v_isabel_blocked := SQLERRM LIKE 'CONVOCATION_TEXT_LEGACY_ISABEL_CONTRADICTION%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_isabel_blocked,
    'la contradicción legacy de Isabel superó el gate semántico'
  );

  BEGIN
    PERFORM public.fn_emit_convocatoria(
      v_payload || jsonb_build_object(
        'agenda_items',
        jsonb_set(
          v_agenda,
          '{3,materia}',
          to_jsonb('NOMBRAMIENTO_REPRESENTANTE_FILIAL'::text)
        )
      )
    );
  EXCEPTION WHEN check_violation THEN
    v_legacy_alias_blocked := SQLERRM LIKE 'REPRESENTATION_LEGACY_MATTER_FORBIDDEN%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_legacy_alias_blocked,
    'el alias legacy NOMBRAMIENTO_REPRESENTANTE_FILIAL superó el servidor'
  );

  BEGIN
    PERFORM public.fn_emit_convocatoria(
      v_payload || jsonb_build_object(
        'agenda_items',
        jsonb_set(
          v_agenda,
          '{0,target_entity_id}',
          to_jsonb('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::text)
        )
      )
    );
  EXCEPTION WHEN check_violation THEN
    v_outside_claim_blocked := SQLERRM LIKE 'REPRESENTATION_CLAIMS_FORBIDDEN_OUTSIDE_CANONICAL_MATTER%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_outside_claim_blocked,
    'un claim representativo fuera de la materia canónica superó el servidor'
  );

  v_result := public.fn_emit_convocatoria(v_payload);
  v_convocatoria_id := (v_result -> 'convocatoria' ->> 'id')::uuid;
  v_manifest_id := (v_result -> 'manifest' ->> 'id')::uuid;
  SELECT manifest.* INTO STRICT v_manifest
    FROM public.convocation_manifests manifest
   WHERE manifest.id = v_manifest_id
     AND manifest.convocatoria_id = v_convocatoria_id;
  SELECT act.* INTO STRICT v_act
    FROM public.convocation_acts act
   WHERE act.id = v_manifest.act_id
     AND act.convocatoria_id = v_convocatoria_id
     AND act.tenant_id = v_tenant_id;
  SELECT convocatoria.fecha_emision,
         convocatoria.convocante_authority_evidence_id
    INTO STRICT v_original_fecha_emision, v_original_authority_id
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = v_convocatoria_id
     AND convocatoria.tenant_id = v_tenant_id;
  SET CONSTRAINTS trg_convocatoria_manifest_required IMMEDIATE;
  SET CONSTRAINTS trg_convocatoria_manifest_required DEFERRED;

  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_manifest.manifest_hash_sha512 = encode(
      extensions.digest(convert_to(v_manifest.manifest_json::text, 'UTF8'), 'sha512'),
      'hex'
    ),
    'el hash SHA-512 del manifiesto no coincide con sus bytes canónicos'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_manifest.manifest_json ->> 'schema_version' = 'secretaria.convocation-manifest.v2'
    AND v_manifest.manifest_json ->> 'record_status' = 'DEMO_OPERATIONAL_DRAFT_RECORDED'
    AND v_manifest.manifest_json ->> 'database_state' = 'EMITIDA'
    AND v_manifest.manifest_json -> 'not_a_legal_convocation' = 'true'::jsonb
    AND v_manifest.manifest_json -> 'president_action_not_asserted' = 'true'::jsonb
    AND v_manifest.manifest_json ->> 'reviewed_demo_draft_text' = v_valid_text
    AND v_manifest.manifest_json ->> 'reviewed_demo_draft_text_hash_sha256' = encode(
      extensions.digest(convert_to(v_valid_text, 'UTF8'), 'sha256'),
      'hex'
    )
    AND (v_manifest.manifest_json ->> 'recorded_by_user_id')::uuid = v_user_id,
    'el manifiesto v2 no congeló el borrador DEMO y su registrador'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_manifest.manifest_json #>> '{publication,delivery_mode}' = 'SANDBOX_ONLY'
    AND v_manifest.manifest_json #>> '{authority,legal_signature_status}' = 'NOT_ASSERTED'
    AND v_manifest.manifest_json #>> '{authority,ead_signature_service_required}' = 'false'
    AND v_manifest.manifest_json #> '{authority,actor_role_reference_only}' = 'true'::jsonb
    AND v_manifest.manifest_json #> '{authority,president_action_not_asserted}' = 'true'::jsonb
    AND (v_manifest.manifest_json #>> '{authority,act_id}')::uuid = v_act.id
    AND v_manifest.manifest_json #>> '{authority,act_hash_sha512}' = v_act.act_hash_sha512,
    'el manifiesto no declara sandbox, ausencia de firma y referencia presidencial no atributiva'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_manifest.act_id = v_act.id
    AND v_manifest.act_hash_sha512 = v_act.act_hash_sha512
    AND v_act.act_type = 'DEMO_CONVOCATION_RECORD'
    AND v_act.authority_route = 'PRESIDENTE_ART_246_1'
    AND v_act.recorded_by = v_user_id
    AND v_act.recorded_at IS NOT NULL
    AND v_act.immutable_at = v_act.recorded_at
    AND v_act.data_class = 'DEMO'
    AND v_act.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
    AND v_act.act_payload -> 'actor_role_reference_only' = 'true'::jsonb
    AND v_act.act_payload -> 'president_action_not_asserted' = 'true'::jsonb
    AND v_act.act_payload ->> 'signature_status' = 'NOT_ASSERTED'
    AND v_act.act_hash_sha512 = encode(
      extensions.digest(convert_to(v_act.act_payload::text, 'UTF8'), 'sha512'),
      'hex'
    )
    AND 1 = (
      SELECT count(*)
        FROM public.convocation_acts exact_act
       WHERE exact_act.convocatoria_id = v_convocatoria_id
    ),
    'el acto WORM DEMO no quedó ligado 1:1, hasheado o registrado por el usuario humano'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    EXISTS (
      SELECT 1
        FROM public.convocatorias convocatoria
       WHERE convocatoria.id = v_convocatoria_id
         AND v_act.actor_person_id = convocatoria.convocante_person_id
         AND v_act.actor_authority_evidence_id = convocatoria.convocante_authority_evidence_id
         AND v_act.approved_text_hash_sha256 = encode(
           extensions.digest(convert_to(convocatoria.convocatoria_text, 'UTF8'), 'sha256'),
           'hex'
         )
         AND v_act.agenda_hash_sha256 = encode(
           extensions.digest(convert_to(convocatoria.agenda_items::text, 'UTF8'), 'sha256'),
           'hex'
         )
    ),
    'el acto WORM no conserva los hashes exactos del texto y agenda autoritativos'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    EXISTS (
      SELECT 1
        FROM jsonb_array_elements(v_manifest.manifest_json -> 'agenda') item
       WHERE item ->> 'matter_code' = 'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'
         AND item ->> 'target_entity_name' = v_target_name
         AND item ->> 'representative_name' = v_representative_name
         AND (item ->> 'representation_delegation_id')::uuid = v_delegation_id
         AND item ->> 'representation_evidence_status' = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
    ),
    'la agenda canónica perdió target, Carmen o su título DEMO'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    EXISTS (
      SELECT 1 FROM public.convocatorias convocatoria
       WHERE convocatoria.id = v_convocatoria_id
         AND convocatoria.estado = 'EMITIDA'
         AND convocatoria.body_id = v_body_id
         AND convocatoria.fecha_emision = (clock_timestamp() AT TIME ZONE 'Europe/Madrid')::date
         AND convocatoria.publication_channels = ARRAY['SANDBOX_ERDS']
         AND convocatoria.convocante_authority_evidence_id IS NOT NULL
         AND convocatoria.convocation_authority_route = 'PRESIDENTE_ART_246_1'
    ),
    'la convocatoria emitida no conserva las derivaciones server-side'
  );

  -- El renderer/archiver corre con service_role, pero ese rol no puede crear
  -- el acto ni el manifiesto. Se cambia de identidad solo después de congelar
  -- y comprobar el registro humano anterior.
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );

  v_attachment_id := public.fn_register_server_rendered_convocation_attachment(
    v_tenant_id,
    v_convocatoria_id,
    v_manifest.manifest_hash_sha512,
    'convocatoria-final.docx',
    'evidence-bundle://convocatorias/' || v_convocatoria_id::text || '/convocatoria-final.docx',
    repeat('a', 64),
    repeat('b', 128),
    4096,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  v_attachment_retry_id := public.fn_register_server_rendered_convocation_attachment(
    v_tenant_id,
    v_convocatoria_id,
    v_manifest.manifest_hash_sha512,
    'convocatoria-final.docx',
    'evidence-bundle://convocatorias/' || v_convocatoria_id::text || '/convocatoria-final.docx',
    repeat('a', 64),
    repeat('b', 128),
    4096,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_attachment_retry_id = v_attachment_id
    AND EXISTS (
      SELECT 1
        FROM public.attachments attachment
       WHERE attachment.id = v_attachment_id
         AND attachment.convocatoria_id = v_convocatoria_id
         AND attachment.artifact_kind = 'CONVOCATORIA_FINAL'
         AND attachment.artifact_candidate_id IS NULL
         AND attachment.convocation_manifest_hash_sha512 = v_manifest.manifest_hash_sha512
         AND attachment.artifact_verified_by_service IS TRUE
    ),
    'el registro server-side del DOCX final no fue exacto o idempotente'
  );

  -- Paquete completo: el artefacto final server-rendered, todos los soportes
  -- verificados, el censo WORM y los hashes del agregado deben coexistir. El
  -- probe permanece en BORRADOR porque una convocatoria DEMO nunca se entrega.
  SELECT max(item.meeting_id::text)::uuid INTO STRICT v_meeting_id
    FROM public.agenda_items item
   WHERE item.tenant_id = v_tenant_id
     AND item.source_convocatoria_id = v_convocatoria_id;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_meeting_id IS NOT NULL,
    'la convocatoria emitida no materializó su reunión autoritativa'
  );
  v_snapshot_id := public.fn_crear_censo_snapshot(
    v_meeting_id,
    'MEETING',
    v_entity_id,
    v_body_id,
    'POLITICO'
  );
  SELECT jsonb_agg(
           jsonb_build_object(
             'person_id', member.value ->> 'person_id',
             'cargo_en_organo', COALESCE(member.value ->> 'seat_role', 'CONSEJERO'),
             'canal_primario', CASE
               WHEN length(btrim(COALESCE(person.email, ''))) > 0
                 THEN 'EMAIL_NORMAL'
               ELSE 'PORTAL_PUSH'
             END,
             'destino_primario', CASE
               WHEN length(btrim(COALESCE(person.email, ''))) > 0
                 THEN lower(btrim(person.email))
               ELSE 'portal://person/' || person.id::text
             END,
             'delivery_alternative', CASE
               WHEN length(btrim(COALESCE(person.email, ''))) > 0 THEN NULL
               ELSE jsonb_build_object(
                 'method', 'PORTAL_VERIFIED',
                 'destination', 'portal://person/' || person.id::text,
                 'reason', 'Probe transaccional sin entrega externa',
                 'evidence_reference', 'probe:censo:' || v_snapshot_id::text
               )
             END
           )
           ORDER BY member.value ->> 'person_id'
         )
    INTO v_package_recipients
    FROM public.censo_snapshot snapshot
    CROSS JOIN LATERAL jsonb_array_elements(snapshot.payload) member(value)
    JOIN public.persons person
      ON person.id = (member.value ->> 'person_id')::uuid
     AND person.tenant_id = snapshot.tenant_id
   WHERE snapshot.id = v_snapshot_id;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    jsonb_typeof(v_package_recipients) = 'array'
    AND jsonb_array_length(v_package_recipients) = (
      SELECT snapshot.total_partes
        FROM public.censo_snapshot snapshot
       WHERE snapshot.id = v_snapshot_id
    ),
    'el fixture no pudo reconstruir todos los destinatarios del censo WORM'
  );

  SELECT jsonb_agg(
           jsonb_build_object(
             'tipo', CASE
               WHEN fixture.artifact_kind = 'CONVOCATORIA_FINAL'
                 THEN 'DOCUMENTO_GENERADO'
               ELSE 'OTRO'
             END,
             'label', CASE
               WHEN fixture.artifact_kind = 'CONVOCATORIA_FINAL'
                 THEN 'Convocatoria final server-rendered'
               ELSE fixture.file_name
             END,
             'source_attachment_id', fixture.id,
             'storage_uri', fixture.file_url,
             'hash_sha256', fixture.file_hash,
             'hash_sha512', fixture.file_hash_sha512,
             'size_bytes', fixture.artifact_verified_size_bytes,
             'mime_type', fixture.artifact_verified_mime_type,
             'orden', fixture.package_order,
             'modo_entrega', 'ADJUNTO',
             'signed_url_expiry_hours', 168
           )
           ORDER BY fixture.package_order
         )
    INTO v_package_attachments
    FROM (
      SELECT attachment.*,
             row_number() OVER (
               ORDER BY
                 CASE WHEN attachment.artifact_kind = 'CONVOCATORIA_FINAL' THEN 0 ELSE 1 END,
                 attachment.agenda_item_index NULLS FIRST,
                 attachment.id
             ) - 1 AS package_order
        FROM public.attachments attachment
       WHERE attachment.tenant_id = v_tenant_id
         AND attachment.convocatoria_id = v_convocatoria_id
         AND attachment.artifact_kind IN ('CONVOCATORIA_FINAL', 'SUPPORTING_DOCUMENT')
    ) fixture;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    jsonb_typeof(v_package_attachments) = 'array'
    AND jsonb_array_length(v_package_attachments) >= 1,
    'el fixture no pudo ensamblar el artefacto final y sus soportes'
  );

  v_communication_id := public.fn_create_communication_atomic(
    jsonb_build_object(
      'tenant_id', v_tenant_id,
      'entity_id', v_entity_id,
      'body_id', v_body_id,
      'meeting_id', v_meeting_id,
      'convocatoria_id', v_convocatoria_id,
      'organo_tipo', 'CONSEJO_ADMIN',
      'tipo_comunicacion', 'CONVOCATORIA',
      'tipo_respuesta_esperada', 'INFORMATIVA',
      'nivel_certificacion_minimo', 'EMAIL_NORMAL',
      'asunto', 'Probe paquete completo de convocatoria',
      'cuerpo_render', v_valid_text,
      'cuerpo_hash_sha512', encode(
        extensions.digest(convert_to(v_valid_text, 'UTF8'), 'sha512'),
        'hex'
      ),
      'estado', 'BORRADOR',
      'fecha_programada', clock_timestamp() + interval '1 hour',
      'comunicacion_libre', false,
      'metadata', jsonb_build_object(
        'probe', true,
        'dispatch_forbidden', true,
        'server_rendered_manifest_hash_sha512', v_manifest.manifest_hash_sha512
      )
    ),
    v_package_attachments,
    v_package_recipients
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    public.fn_communication_authoritative_binding_valid(v_communication_id) IS TRUE
    AND EXISTS (
      SELECT 1
        FROM public.communications communication
       WHERE communication.id = v_communication_id
         AND communication.estado = 'BORRADOR'
         AND communication.package_hash_sha512 =
             public.fn_communication_compute_package_hash(communication.id)
    )
    AND EXISTS (
      SELECT 1
        FROM public.communication_attachments package_attachment
        JOIN public.attachments source_attachment
          ON source_attachment.id = package_attachment.source_attachment_id
       WHERE package_attachment.communication_id = v_communication_id
         AND package_attachment.tipo = 'DOCUMENTO_GENERADO'
         AND source_attachment.id = v_attachment_id
         AND source_attachment.artifact_candidate_id IS NULL
         AND source_attachment.convocation_manifest_hash_sha512 =
             v_manifest.manifest_hash_sha512
    ),
    'el paquete completo rechazó el final server-rendered o perdió su binding exacto'
  );

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'authenticated',
      'sub', v_user_id,
      'tenant_id', v_tenant_id,
      'app_metadata', jsonb_build_object('tenant_id', v_tenant_id)
    )::text,
    true
  );

  UPDATE public.persons
     SET data_class = 'TEST'
   WHERE id = v_representative_id;
  BEGIN
    PERFORM public.fn_emit_convocatoria(v_payload);
  EXCEPTION WHEN raise_exception THEN
    v_mixed_data_blocked := SQLERRM LIKE '%NON_DEMO_OR_MIXED_FAIL_CLOSED%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_mixed_data_blocked,
    'una mezcla DEMO/TEST superó el gate fail-closed'
  );

  UPDATE public.persons
     SET data_class = 'DEMO'
   WHERE id = v_representative_id;

  BEGIN
    UPDATE public.convocatorias
       SET estado = 'CANCELADA'
     WHERE id = v_convocatoria_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_direct_lifecycle_blocked :=
      SQLERRM LIKE '%CONVOCATION_LIFECYCLE_TRANSITION_REQUIRES_GOVERNED_RPC%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_direct_lifecycle_blocked,
    'una transición directa EMITIDA -> CANCELADA evitó la RPC gobernada'
  );

  v_lifecycle_result := public.fn_transition_convocatoria_lifecycle(
    v_convocatoria_id,
    'CANCELADA',
    'Cancelación DEMO para verificar conservación íntegra del registro fuente.'
  );
  SET CONSTRAINTS trg_convocatoria_lifecycle_event_required IMMEDIATE;
  SET CONSTRAINTS trg_convocatoria_lifecycle_event_required DEFERRED;

  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_lifecycle_result #>> '{convocatoria,estado}' = 'CANCELADA'
    AND EXISTS (
      SELECT 1
        FROM public.convocatorias convocatoria
       WHERE convocatoria.id = v_convocatoria_id
         AND convocatoria.estado = 'CANCELADA'
         AND convocatoria.fecha_emision = v_original_fecha_emision
         AND convocatoria.convocante_authority_evidence_id = v_original_authority_id
    )
    AND EXISTS (
      SELECT 1
        FROM public.convocation_manifests manifest
       WHERE manifest.id = v_manifest.id
         AND manifest.convocatoria_id = v_convocatoria_id
         AND manifest.manifest_hash_sha512 = v_manifest.manifest_hash_sha512
         AND manifest.act_id = v_act.id
         AND manifest.act_hash_sha512 = v_act.act_hash_sha512
    )
    AND EXISTS (
      SELECT 1
        FROM public.convocation_acts act
       WHERE act.id = v_act.id
         AND act.convocatoria_id = v_convocatoria_id
         AND act.act_hash_sha512 = v_act.act_hash_sha512
    ),
    'la cancelación DEMO no conservó fecha, autoridad, manifiesto o acto fuente'
  );
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    1 = (
      SELECT count(*)
        FROM public.convocation_lifecycle_events event
       WHERE event.convocatoria_id = v_convocatoria_id
         AND event.manifest_id = v_manifest.id
         AND event.act_id = v_act.id
         AND event.from_state = 'EMITIDA'
         AND event.to_state = 'CANCELADA'
         AND event.recorded_by = v_user_id
         AND event.data_class = 'DEMO'
         AND event.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
         AND event.event_payload ->> 'manifest_hash_sha512' = v_manifest.manifest_hash_sha512
         AND event.event_payload ->> 'act_hash_sha512' = v_act.act_hash_sha512
         AND event.event_hash_sha512 = encode(
           extensions.digest(convert_to(event.event_payload::text, 'UTF8'), 'sha512'),
           'hex'
         )
    ),
    'la transición no dejó exactamente un evento WORM con los hashes fuente'
  );

  BEGIN
    UPDATE public.convocation_lifecycle_events
       SET reason = 'Intento de mutación de prueba sobre el historial inmutable.'
     WHERE convocatoria_id = v_convocatoria_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_event_mutation_blocked :=
      SQLERRM LIKE '%CONVOCATION_LIFECYCLE_EVENT_WORM_MUTATION_FORBIDDEN%';
  END;
  PERFORM public.fn_secretaria_convocation_manifest_probe_assert(
    v_event_mutation_blocked,
    'el evento de ciclo WORM pudo modificarse después de registrarse'
  );
END
$probe$;

ROLLBACK;
