-- Probe transaccional post-despliegue para
-- 20260720135000_secretaria_convocation_dispatch_hardening.sql y
-- 20260720139000_secretaria_server_package_and_ead_callback_identity.sql.
--
-- Verifica el protocolo de claim/fencing/lease/idempotencia sin enviar nada a
-- proveedor alguno. Todos los fixtures y helpers desaparecen con ROLLBACK.

BEGIN;

CREATE FUNCTION public.fn_secretaria_dispatch_probe_assert(
  p_condition boolean,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'dispatch hardening probe assertion failed: %', p_message
      USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_dispatch_probe_assert(boolean, text)
  FROM PUBLIC;

DO $probe$
DECLARE
  v_tenant_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_entity_id constant uuid := '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid;
  v_person_id constant uuid := '35000000-0000-4000-8000-000000000001'::uuid;
  v_communication_id constant uuid := '35000000-0000-4000-8000-000000000002'::uuid;
  v_recipient_id constant uuid := '35000000-0000-4000-8000-000000000003'::uuid;
  v_ead_communication_id constant uuid := '35000000-0000-4000-8000-000000000004'::uuid;
  v_ead_recipient_id constant uuid := '35000000-0000-4000-8000-000000000005'::uuid;
  v_ead_attempt_id constant uuid := '35000000-0000-4000-8000-000000000006'::uuid;
  v_ead_foreign_communication_id constant uuid := '35000000-0000-4000-8000-000000000007'::uuid;
  v_ead_foreign_recipient_id constant uuid := '35000000-0000-4000-8000-000000000008'::uuid;
  v_user_id uuid;
  v_role_id uuid;
  v_convocatoria_id uuid;
  v_candidate_id uuid;
  v_basic_atomic_communication_id uuid;
  v_source_hash text;
  v_body text := '<p>Probe transaccional de mensajería básica.</p>';
  v_body_hash text;
  v_first_claim public.communication_recipients%ROWTYPE;
  v_second_claim public.communication_recipients%ROWTYPE;
  v_claimed_after_expiry integer;
  v_ok boolean;
  v_tamper_blocked boolean := false;
  v_expired_role_blocked boolean := false;
  v_substitution_blocked boolean := false;
  v_archive_hash_blocked boolean := false;
  v_callback_archive_hash_blocked boolean := false;
  v_callback_collision_blocked boolean := false;
  v_callback_occurred_at timestamptz;
  v_callback_result jsonb;
BEGIN
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    to_regprocedure('public.fn_claim_recipients_for_dispatch(integer,uuid)') IS NOT NULL,
    'falta la RPC de claim tenant-scoped'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    to_regprocedure(
      'public.fn_revalidate_recipient_dispatch_attempt(uuid,uuid,uuid,text,bigint,text,jsonb)'
    ) IS NOT NULL,
    'falta la revalidación con fencing token y revisión de paquete'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    to_regprocedure('public.fn_recipient_handle_error_attempt(uuid,uuid,text,boolean)') IS NOT NULL,
    'falta el cierre CAS de errores'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    to_regprocedure(
      'public.fn_recipient_mark_sent_attempt(uuid,uuid,text,text,text,text,text)'
    ) IS NOT NULL,
    'falta el cierre CAS de envío'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    to_regprocedure(
      'public.fn_recipient_record_resend_callback(text,text,text,timestamp with time zone,jsonb)'
    ) IS NOT NULL,
    'falta la reconciliación gobernada de callbacks Resend'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    to_regprocedure(
      'public.fn_recipient_record_ead_notice_callback(text,text,text,timestamp with time zone,timestamp with time zone,text,text,timestamp with time zone,text,jsonb)'
    ) IS NOT NULL,
    'falta la reconciliación gobernada de callbacks EAD'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    to_regprocedure(
      'public.fn_precommit_convocation_final_candidate(uuid,uuid,text,text,text,text,text,jsonb)'
    ) IS NOT NULL,
    'falta el precompromiso autoritativo del DOCX final'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id),
    'falta el tenant ARGA canónico'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    EXISTS (
      SELECT 1 FROM public.entities
       WHERE id = v_entity_id AND tenant_id = v_tenant_id
    ),
    'falta la entidad ARGA Seguros canónica'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    NOT EXISTS (SELECT 1 FROM public.persons WHERE id = v_person_id)
    AND NOT EXISTS (SELECT 1 FROM public.communications WHERE id = v_communication_id)
    AND NOT EXISTS (SELECT 1 FROM public.communication_recipients WHERE id = v_recipient_id)
    AND NOT EXISTS (SELECT 1 FROM public.communications WHERE id = v_ead_communication_id)
    AND NOT EXISTS (SELECT 1 FROM public.communication_recipients WHERE id = v_ead_recipient_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.communications WHERE id = v_ead_foreign_communication_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.communication_recipients WHERE id = v_ead_foreign_recipient_id
    ),
    'colisión con UUIDs reservados para el probe'
  );

  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_user_id IS NOT NULL,
    'el probe necesita al menos un auth.users existente para created_by'
  );

  SELECT convocatoria.id,
         encode(
           extensions.digest(convert_to(convocatoria.convocatoria_text, 'UTF8'), 'sha256'),
           'hex'
         )
    INTO v_convocatoria_id, v_source_hash
    FROM public.convocatorias convocatoria
   WHERE convocatoria.tenant_id = v_tenant_id
     AND convocatoria.estado = 'EMITIDA'
     AND convocatoria.immutable_at IS NOT NULL
     AND length(btrim(COALESCE(convocatoria.convocatoria_text, ''))) > 0
   ORDER BY convocatoria.created_at
   LIMIT 1;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_convocatoria_id IS NOT NULL AND v_source_hash ~ '^[0-9a-f]{64}$',
    'el probe necesita una convocatoria emitida, inmutable y con texto revisado'
  );

  SELECT role.id INTO v_role_id
    FROM public.rbac_roles role
   WHERE role.role_code = 'SECRETARIO'
   LIMIT 1;
  IF v_role_id IS NULL THEN
    INSERT INTO public.rbac_roles (role_code)
    VALUES ('SECRETARIO')
    RETURNING id INTO v_role_id;
  END IF;
  INSERT INTO public.rbac_user_roles (
    tenant_id, user_id, role_id, is_active, expires_at
  ) VALUES (
    v_tenant_id, v_user_id, v_role_id, true, clock_timestamp() - interval '1 minute'
  )
  ON CONFLICT (tenant_id, user_id, role_id) DO UPDATE
    SET is_active = true,
        expires_at = EXCLUDED.expires_at;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'authenticated',
      'sub', v_user_id,
      'tenant_id', v_tenant_id
    )::text,
    true
  );
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);
  BEGIN
    PERFORM public.fn_precommit_convocation_final_candidate(
      v_tenant_id,
      v_convocatoria_id,
      'convocatoria_probe.docx',
      v_source_hash,
      repeat('a', 64),
      repeat('b', 128),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      jsonb_build_object(
        'renderer', 'PROCESS_DOCUMENTS_V1',
        'source', 'convocatorias.convocatoria_text',
        'content_hash_sha256', v_source_hash,
        'probe', true
      )
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_expired_role_blocked := true;
  END;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_expired_role_blocked,
    'un rol SECRETARIO expirado pudo precomprometer un artefacto'
  );

  UPDATE public.rbac_user_roles
     SET expires_at = clock_timestamp() + interval '5 minutes'
   WHERE tenant_id = v_tenant_id
     AND user_id = v_user_id
     AND role_id = v_role_id;
  SELECT public.fn_precommit_convocation_final_candidate(
    v_tenant_id,
    v_convocatoria_id,
    'convocatoria_probe.docx',
    v_source_hash,
    repeat('a', 64),
    repeat('b', 128),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jsonb_build_object(
      'renderer', 'PROCESS_DOCUMENTS_V1',
      'source', 'convocatorias.convocatoria_text',
      'content_hash_sha256', v_source_hash,
      'probe', true
    )
  ) INTO v_candidate_id;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_candidate_id IS NOT NULL,
    'el candidato exacto no pudo precomprometerse con rol vigente'
  );

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  BEGIN
    PERFORM public.fn_register_verified_convocation_attachment(
      v_tenant_id,
      v_convocatoria_id,
      'CONVOCATORIA_FINAL',
      NULL,
      'convocatoria_probe.docx',
      'evidence-bundle://convocatorias/' || v_convocatoria_id::text || '/substitute.docx',
      repeat('c', 64),
      repeat('b', 128),
      1024,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      NULL,
      v_candidate_id
    );
  EXCEPTION WHEN check_violation THEN
    v_substitution_blocked := true;
  END;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_substitution_blocked,
    'un DOCX sustituto con SHA-256 distinto consumió el candidato revisado'
  );

  v_body_hash := encode(
    extensions.digest(convert_to(v_body, 'UTF8'), 'sha512'),
    'hex'
  );

  INSERT INTO public.persons (id, tenant_id, full_name, email, person_type)
  VALUES (
    v_person_id,
    v_tenant_id,
    'Persona probe dispatch',
    'dispatch-probe@arga-seguros.com',
    'PF'
  );

  SELECT public.fn_create_communication_atomic(
    jsonb_build_object(
      'tenant_id', v_tenant_id,
      'entity_id', v_entity_id,
      'organo_tipo', 'CONSEJO_ADMIN',
      'tipo_comunicacion', 'CIRCULAR_SIN_SESION',
      'tipo_respuesta_esperada', 'VOTO',
      'nivel_certificacion_minimo', 'BUROFAX_ERDS',
      'asunto', 'Probe EAD basic atomic',
      'cuerpo_render', v_body,
      'cuerpo_hash_sha512', v_body_hash,
      'estado', 'PROGRAMADA',
      'fecha_programada', clock_timestamp(),
      'comunicacion_libre', false,
      'metadata', jsonb_build_object(
        'probe', true,
        'ead_delivery_mode', 'BASIC_MESSAGE'
      )
    ),
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'person_id', v_person_id,
      'cargo_en_organo', 'CONSEJERO',
      'canal_primario', 'BUROFAX_ERDS',
      'destino_primario', 'dispatch-probe@arga-seguros.com'
    ))
  ) INTO v_basic_atomic_communication_id;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_basic_atomic_communication_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.communications communication
       WHERE communication.id = v_basic_atomic_communication_id
         AND communication.estado = 'PROGRAMADA'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.communication_attachments attachment
       WHERE attachment.communication_id = v_basic_atomic_communication_id
    )
    AND EXISTS (
      SELECT 1 FROM public.communication_recipients recipient
       WHERE recipient.communication_id = v_basic_atomic_communication_id
         AND recipient.canal_primario = 'BUROFAX_ERDS'
    ),
    'la RPC atómica no admitió mensajería EAD BASIC_MESSAGE sin adjuntos'
  );

  INSERT INTO public.communications (
    id, tenant_id, entity_id, organo_tipo, tipo_comunicacion,
    tipo_respuesta_esperada, nivel_certificacion_minimo, asunto,
    cuerpo_render, cuerpo_hash_sha512, estado, fecha_programada,
    comunicacion_libre, metadata, created_by, package_revision
  ) VALUES (
    v_ead_communication_id,
    v_tenant_id,
    v_entity_id,
    'CONSEJO_ADMIN',
    'COMUNICACION_LIBRE',
    'INFORMATIVA',
    'BUROFAX_ERDS',
    'Probe EAD basic message',
    v_body,
    v_body_hash,
    'BORRADOR',
    now() - interval '1 minute',
    true,
    '{"probe":true,"ead_delivery_mode":"BASIC_MESSAGE"}'::jsonb,
    v_user_id,
    1
  );
  INSERT INTO public.communication_recipients (
    id, communication_id, person_id, cargo_en_organo,
    canal_original, canal_primario, destino_primario,
    estado_entrega, dispatch_attempt_id, dispatch_lease_expires_at,
    provider_idempotency_key, intento_reenvio_n
  ) VALUES (
    v_ead_recipient_id,
    v_ead_communication_id,
    v_person_id,
    'CONSEJERO',
    'BUROFAX_ERDS',
    'BUROFAX_ERDS',
    'dispatch-probe@arga-seguros.com',
    'ENVIANDO',
    v_ead_attempt_id,
    now() + interval '5 minutes',
    repeat('d', 64),
    1
  );
  UPDATE public.communications
     SET package_hash_sha512 =
       public.fn_communication_compute_package_hash(v_ead_communication_id)
   WHERE id = v_ead_communication_id;
  UPDATE public.communications
     SET estado = 'PROGRAMADA'
   WHERE id = v_ead_communication_id;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  BEGIN
    PERFORM public.fn_recipient_mark_ead_notice_result_attempt(
      v_ead_recipient_id,
      v_ead_attempt_id,
      repeat('d', 64),
      'ead-probe-request',
      NULL,
      'REQUESTED',
      clock_timestamp(),
      NULL,
      'COMPLETED',
      'ead-archive-evidence',
      clock_timestamp(),
      repeat('e', 128)
    );
  EXCEPTION WHEN check_violation THEN
    v_archive_hash_blocked := true;
  END;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_archive_hash_blocked,
    'EAD e-archive COMPLETED aceptó un hash distinto del cuerpo básico'
  );

  INSERT INTO public.communication_delivery_events (
    recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id,
    payload, hash_self
  ) VALUES (
    v_ead_recipient_id,
    'SENT',
    clock_timestamp() - interval '10 seconds',
    'EAD_TRUST',
    'ead-probe-callback-request',
    '{"probe":true}'::jsonb,
    ''
  );
  BEGIN
    PERFORM public.fn_recipient_record_ead_notice_callback(
      'ead-probe-callback-request',
      'ead-probe-callback-event',
      'DELIVERED',
      clock_timestamp(),
      clock_timestamp(),
      'COMPLETED',
      'ead-callback-archive-evidence',
      clock_timestamp(),
      repeat('e', 128),
      '{"probe":true}'::jsonb
    );
  EXCEPTION WHEN check_violation THEN
    v_callback_archive_hash_blocked := true;
  END;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_callback_archive_hash_blocked,
    'un callback EAD COMPLETED aceptó un hash distinto del cuerpo básico'
  );

  -- Idempotencia exacta: un replay idéntico reutiliza la única fila WORM. El
  -- mismo provider_event_id desde otra request/recipient falla antes de mutar.
  INSERT INTO public.communications (
    id, tenant_id, entity_id, organo_tipo, tipo_comunicacion,
    tipo_respuesta_esperada, nivel_certificacion_minimo, asunto,
    cuerpo_render, cuerpo_hash_sha512, estado, fecha_programada,
    comunicacion_libre, metadata, created_by, package_revision
  ) VALUES (
    v_ead_foreign_communication_id,
    v_tenant_id,
    v_entity_id,
    'CONSEJO_ADMIN',
    'COMUNICACION_LIBRE',
    'INFORMATIVA',
    'BUROFAX_ERDS',
    'Probe EAD callback foreign source',
    v_body,
    v_body_hash,
    'BORRADOR',
    now() - interval '1 minute',
    true,
    '{"probe":true,"ead_delivery_mode":"BASIC_MESSAGE"}'::jsonb,
    v_user_id,
    1
  );
  INSERT INTO public.communication_recipients (
    id, communication_id, person_id, cargo_en_organo,
    canal_original, canal_primario, destino_primario, estado_entrega
  ) VALUES (
    v_ead_foreign_recipient_id,
    v_ead_foreign_communication_id,
    v_person_id,
    'CONSEJERO',
    'BUROFAX_ERDS',
    'BUROFAX_ERDS',
    'dispatch-probe@arga-seguros.com',
    'ENVIADO'
  );
  UPDATE public.communications
     SET package_hash_sha512 =
       public.fn_communication_compute_package_hash(v_ead_foreign_communication_id)
   WHERE id = v_ead_foreign_communication_id;
  UPDATE public.communications
     SET estado = 'PROGRAMADA'
   WHERE id = v_ead_foreign_communication_id;
  INSERT INTO public.communication_delivery_events (
    recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id,
    payload, hash_self
  ) VALUES (
    v_ead_foreign_recipient_id,
    'SENT',
    clock_timestamp() - interval '10 seconds',
    'EAD_TRUST',
    'ead-probe-callback-request-foreign',
    '{"probe":true,"source":"foreign"}'::jsonb,
    ''
  );

  v_callback_occurred_at := clock_timestamp();
  SELECT public.fn_recipient_record_ead_notice_callback(
    'ead-probe-callback-request-foreign',
    'ead-probe-callback-event-shared',
    'ERROR',
    v_callback_occurred_at,
    NULL,
    'PENDING',
    NULL,
    NULL,
    NULL,
    '{"probe":true,"source":"foreign"}'::jsonb
  ) INTO v_callback_result;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_callback_result ->> 'already_recorded' = 'false',
    'el primer callback source-bound no creó su única fila WORM'
  );
  SELECT public.fn_recipient_record_ead_notice_callback(
    'ead-probe-callback-request-foreign',
    'ead-probe-callback-event-shared',
    'ERROR',
    v_callback_occurred_at,
    NULL,
    'PENDING',
    NULL,
    NULL,
    NULL,
    '{"probe":true,"source":"foreign"}'::jsonb
  ) INTO v_callback_result;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_callback_result ->> 'already_recorded' = 'true'
    AND (
      SELECT count(*)
        FROM public.communication_delivery_events event
       WHERE event.proveedor = 'EAD_TRUST'
         AND event.evento IN ('DELIVERED', 'ERROR')
         AND btrim(event.proveedor_evento_id) = 'ead-probe-callback-event-shared'
    ) = 1,
    'el replay idéntico duplicó o no reconoció la fila WORM'
  );

  BEGIN
    PERFORM public.fn_recipient_record_ead_notice_callback(
      'ead-probe-callback-request',
      'ead-probe-callback-event-shared',
      'ERROR',
      v_callback_occurred_at,
      NULL,
      'PENDING',
      NULL,
      NULL,
      NULL,
      '{"probe":true,"source":"foreign"}'::jsonb
    );
  EXCEPTION WHEN unique_violation THEN
    v_callback_collision_blocked := true;
  END;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_callback_collision_blocked
    AND (
      SELECT estado_entrega
        FROM public.communication_recipients
       WHERE id = v_ead_recipient_id
    ) = 'ENVIANDO'
    AND (
      SELECT count(*)
        FROM public.communication_delivery_events event
       WHERE event.proveedor = 'EAD_TRUST'
         AND event.evento IN ('DELIVERED', 'ERROR')
         AND btrim(event.proveedor_evento_id) = 'ead-probe-callback-event-shared'
    ) = 1,
    'un provider_event_id ajeno se aceptó o mutó al destinatario equivocado'
  );

  INSERT INTO public.communications (
    id, tenant_id, entity_id, organo_tipo, tipo_comunicacion,
    tipo_respuesta_esperada, nivel_certificacion_minimo, asunto,
    cuerpo_render, cuerpo_hash_sha512, estado, fecha_programada,
    comunicacion_libre, metadata, created_by, package_revision
  ) VALUES (
    v_communication_id,
    v_tenant_id,
    v_entity_id,
    'CONSEJO_ADMIN',
    'COMUNICACION_LIBRE',
    'INFORMATIVA',
    'EMAIL_NORMAL',
    'Probe dispatch',
    v_body,
    v_body_hash,
    'BORRADOR',
    now() - interval '1 minute',
    true,
    '{"probe":true}'::jsonb,
    v_user_id,
    1
  );

  INSERT INTO public.communication_recipients (
    id, communication_id, person_id, cargo_en_organo,
    canal_original, canal_primario, destino_primario
  ) VALUES (
    v_recipient_id,
    v_communication_id,
    v_person_id,
    'CONSEJERO',
    'EMAIL_NORMAL',
    'EMAIL_NORMAL',
    'dispatch-probe@arga-seguros.com'
  );

  UPDATE public.communications
     SET package_hash_sha512 =
       public.fn_communication_compute_package_hash(v_communication_id)
   WHERE id = v_communication_id;
  UPDATE public.communications
     SET estado = 'PROGRAMADA'
   WHERE id = v_communication_id;

  -- El claim solo está disponible en contexto service_role.
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SELECT claimed.* INTO v_first_claim
    FROM public.fn_claim_recipients_for_dispatch(1, v_tenant_id) claimed
   WHERE claimed.id = v_recipient_id;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_first_claim.id = v_recipient_id
    AND v_first_claim.estado_entrega = 'ENVIANDO'
    AND v_first_claim.dispatch_attempt_id IS NOT NULL
    AND length(v_first_claim.provider_idempotency_key) = 64,
    'el primer claim no devolvió token, lease y clave idempotente'
  );
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    (SELECT estado FROM public.communications WHERE id = v_communication_id) = 'ENVIANDO',
    'el agregado no reflejó ENVIANDO'
  );

  SELECT public.fn_revalidate_recipient_dispatch_attempt(
    v_recipient_id,
    v_first_claim.dispatch_attempt_id,
    v_tenant_id,
    v_body_hash,
    1,
    (SELECT package_hash_sha512 FROM public.communications WHERE id = v_communication_id),
    '[]'::jsonb
  ) INTO v_ok;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_ok,
    'la revalidación del intento vigente falló'
  );

  BEGIN
    UPDATE public.communications
       SET asunto = 'Manipulación después de BORRADOR'
     WHERE id = v_communication_id;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    v_tamper_blocked := true;
  END;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_tamper_blocked,
    'el paquete se pudo modificar después de BORRADOR'
  );

  SELECT public.fn_recipient_handle_error_attempt(
    v_recipient_id,
    v_first_claim.dispatch_attempt_id,
    'fallo pre-proveedor recuperable',
    true
  ) INTO v_ok;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_ok
    AND (SELECT estado_entrega FROM public.communication_recipients WHERE id = v_recipient_id) = 'PENDIENTE'
    AND (SELECT estado FROM public.communications WHERE id = v_communication_id) = 'PROGRAMADA',
    'el fallo recuperable no reencoló de forma segura'
  );

  SELECT claimed.* INTO v_second_claim
    FROM public.fn_claim_recipients_for_dispatch(1, v_tenant_id) claimed
   WHERE claimed.id = v_recipient_id;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_second_claim.dispatch_attempt_id IS DISTINCT FROM v_first_claim.dispatch_attempt_id
    AND v_second_claim.provider_idempotency_key = v_first_claim.provider_idempotency_key,
    'el retry no renovó fencing token o cambió la idempotencia lógica'
  );

  SELECT public.fn_recipient_mark_sent_attempt(
    v_recipient_id,
    v_first_claim.dispatch_attempt_id,
    v_first_claim.provider_idempotency_key,
    'EMAIL_NORMAL',
    'RESEND',
    'stale-provider-event',
    NULL
  ) INTO v_ok;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_ok IS FALSE,
    'un fencing token obsoleto pudo cerrar el envío'
  );

  UPDATE public.communication_recipients
     SET dispatch_lease_expires_at = now() - interval '1 second'
   WHERE id = v_recipient_id;
  SELECT count(*) INTO v_claimed_after_expiry
    FROM public.fn_claim_recipients_for_dispatch(1, v_tenant_id) claimed
   WHERE claimed.id = v_recipient_id;
  PERFORM public.fn_secretaria_dispatch_probe_assert(
    v_claimed_after_expiry = 0
    AND (
      SELECT estado_entrega
        FROM public.communication_recipients
       WHERE id = v_recipient_id
    ) = 'RECONCILIATION_REQUIRED'
    AND (
      SELECT estado
        FROM public.communications
       WHERE id = v_communication_id
    ) = 'RECONCILIATION_REQUIRED',
    'un lease vencido se reenvió o no quedó bloqueado para conciliación'
  );

  PERFORM public.fn_secretaria_dispatch_probe_assert(
    has_table_privilege('authenticated', 'public.communications', 'UPDATE') IS FALSE
    AND has_table_privilege('authenticated', 'public.communication_recipients', 'UPDATE') IS FALSE
    AND has_table_privilege('authenticated', 'public.communication_attachments', 'INSERT') IS FALSE
    AND has_table_privilege('authenticated', 'public.attachments', 'INSERT') IS FALSE
    AND has_table_privilege(
      'authenticated', 'public.convocation_artifact_candidates', 'INSERT'
    ) IS FALSE
    AND has_function_privilege(
      'anon',
      'public.fn_precommit_convocation_final_candidate(uuid,uuid,text,text,text,text,text,jsonb)',
      'EXECUTE'
    ) IS FALSE,
    'authenticated conserva DML directo sobre el agregado o sus artefactos'
  );
END;
$probe$;

ROLLBACK;
