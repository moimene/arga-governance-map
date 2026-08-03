-- EAD Trust Notice Manager / Evidence Manager trust boundary.
--
-- A custody record in Evidence Manager is not proof that a message was sent or
-- delivered. Only a provider response with a stable request id and provider
-- timestamps may advance a recipient to ENVIADO/ENTREGADO. The exact provider
-- facts are appended to the WORM delivery ledger.

CREATE OR REPLACE FUNCTION public.fn_recipient_mark_ead_notice_result(
  p_recipient_id uuid,
  p_provider_request_id text,
  p_provider_event_id text,
  p_provider_status text,
  p_requested_at timestamptz,
  p_delivered_at timestamptz,
  p_earchive_status text,
  p_earchive_evidence_id text,
  p_earchive_archived_at timestamptz,
  p_earchive_hash_sha512 text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_recipient public.communication_recipients%ROWTYPE;
  v_communication_created_at timestamptz;
  v_existing_recipient_id uuid;
  v_existing_requested_at timestamptz;
  v_inserted_request boolean := false;
  v_inserted_delivery boolean := false;
  v_archive_status text := upper(COALESCE(NULLIF(trim(p_earchive_status), ''), 'PENDING'));
  v_provider_status text := upper(COALESCE(trim(p_provider_status), ''));
BEGIN
  IF p_recipient_id IS NULL OR NULLIF(trim(p_provider_request_id), '') IS NULL THEN
    RAISE EXCEPTION 'EAD provider recipient/request id required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('EAD:SENT:' || trim(p_provider_request_id), 0));
  IF v_provider_status NOT IN ('REQUESTED', 'DELIVERED') THEN
    RAISE EXCEPTION 'EAD provider status must be REQUESTED or DELIVERED';
  END IF;
  IF p_requested_at IS NULL
     OR p_requested_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'EAD provider requested_at missing or in the future';
  END IF;
  IF v_provider_status = 'DELIVERED'
     AND (p_delivered_at IS NULL OR p_delivered_at < p_requested_at OR p_delivered_at > now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'EAD provider delivered_at missing or inconsistent';
  END IF;
  IF v_provider_status = 'REQUESTED' AND p_delivered_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUESTED response cannot carry delivered_at';
  END IF;
  IF v_archive_status NOT IN ('PENDING', 'COMPLETED', 'ERROR') THEN
    RAISE EXCEPTION 'EAD Evidence Manager archive status is invalid';
  END IF;
  IF v_archive_status = 'COMPLETED'
     AND (NULLIF(trim(p_earchive_evidence_id), '') IS NULL OR p_earchive_archived_at IS NULL) THEN
    RAISE EXCEPTION 'completed EAD e-archive requires evidence id and archived_at';
  END IF;
  IF p_earchive_archived_at IS NOT NULL
     AND (p_earchive_archived_at < p_requested_at OR p_earchive_archived_at > now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'EAD e-archive archived_at is inconsistent';
  END IF;
  IF p_earchive_hash_sha512 IS NOT NULL
     AND p_earchive_hash_sha512 !~ '^[0-9a-fA-F]{128}$' THEN
    RAISE EXCEPTION 'EAD e-archive SHA-512 is invalid';
  END IF;

  SELECT cr.*
    INTO v_recipient
    FROM public.communication_recipients cr
    JOIN public.communications c ON c.id = cr.communication_id
   WHERE cr.id = p_recipient_id
   FOR UPDATE OF cr;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'communication recipient not found';
  END IF;
  SELECT c.created_at
    INTO v_communication_created_at
    FROM public.communications c
   WHERE c.id = v_recipient.communication_id;
  IF v_recipient.canal_primario <> 'BUROFAX_ERDS'
     OR v_recipient.estado_entrega NOT IN ('ENVIANDO', 'ENVIADO', 'ENTREGADO') THEN
    RAISE EXCEPTION 'recipient is not in an EAD Notice Manager dispatch state';
  END IF;
  IF p_requested_at < v_communication_created_at - interval '5 minutes' THEN
    RAISE EXCEPTION 'EAD provider requested_at predates the communication';
  END IF;

  SELECT recipient_id, ocurrido_en
    INTO v_existing_recipient_id, v_existing_requested_at
    FROM public.communication_delivery_events
   WHERE proveedor = 'EAD_TRUST'
     AND proveedor_evento_id = trim(p_provider_request_id)
     AND evento = 'SENT'
   LIMIT 1;
  IF v_existing_recipient_id IS NOT NULL AND v_existing_recipient_id <> p_recipient_id THEN
    RAISE EXCEPTION 'EAD provider request id is already bound to another recipient';
  END IF;
  IF v_existing_recipient_id IS NOT NULL AND v_existing_requested_at <> p_requested_at THEN
    RAISE EXCEPTION 'EAD provider request id returned with a different requested_at';
  END IF;
  IF v_recipient.estado_entrega = 'ENTREGADO'
     AND v_existing_recipient_id IS NULL THEN
    RAISE EXCEPTION 'EAD delivered recipient is terminal; a later request cannot reopen delivery';
  END IF;

  IF v_existing_recipient_id IS NULL THEN
    UPDATE public.communication_recipients
       SET estado_entrega = 'ENVIADO',
           canal_usado = 'BUROFAX_ERDS',
           fecha_envio = p_requested_at,
           intento_reenvio_n = COALESCE(intento_reenvio_n, 0) + 1,
           ultimo_error = NULL,
           acuse_evidence_hash = CASE
             WHEN v_archive_status = 'COMPLETED' AND p_earchive_hash_sha512 IS NOT NULL
               THEN lower(p_earchive_hash_sha512)
             ELSE acuse_evidence_hash
           END,
           updated_at = now()
     WHERE id = p_recipient_id;

    INSERT INTO public.communication_delivery_events (
      recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id, payload, hash_self
    ) VALUES (
      p_recipient_id,
      'SENT',
      p_requested_at,
      'EAD_TRUST',
      trim(p_provider_request_id),
      jsonb_build_object(
        'provider_service', 'EAD_TRUST_NOTICE_MANAGER',
        'provider_status', 'REQUESTED',
        'provider_response_status', v_provider_status,
        'provider_request_id', trim(p_provider_request_id),
        'provider_event_id', NULLIF(trim(p_provider_event_id), ''),
        'provider_requested_at', p_requested_at,
        'earchive_service', 'EAD_TRUST_EVIDENCE_MANAGER',
        'earchive_status', v_archive_status,
        'earchive_evidence_id', NULLIF(trim(p_earchive_evidence_id), ''),
        'earchive_archived_at', p_earchive_archived_at,
        'earchive_hash_sha512', lower(p_earchive_hash_sha512)
      ),
      ''
    );
    v_inserted_request := true;
  END IF;

  IF v_provider_status = 'DELIVERED' THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.communication_delivery_events
       WHERE recipient_id = p_recipient_id
         AND proveedor = 'EAD_TRUST'
         AND evento = 'DELIVERED'
         AND payload->>'provider_request_id' = trim(p_provider_request_id)
    ) THEN
      UPDATE public.communication_recipients
         SET estado_entrega = 'ENTREGADO',
             fecha_entrega = p_delivered_at,
             acuse_evidence_hash = CASE
               WHEN v_archive_status = 'COMPLETED' AND p_earchive_hash_sha512 IS NOT NULL
                 THEN lower(p_earchive_hash_sha512)
               ELSE acuse_evidence_hash
             END,
             ultimo_error = NULL,
             updated_at = now()
       WHERE id = p_recipient_id;

      INSERT INTO public.communication_delivery_events (
        recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id, payload, hash_self
      ) VALUES (
        p_recipient_id,
        'DELIVERED',
        p_delivered_at,
        'EAD_TRUST',
        COALESCE(NULLIF(trim(p_provider_event_id), ''), trim(p_provider_request_id) || ':DELIVERED'),
        jsonb_build_object(
          'provider_service', 'EAD_TRUST_NOTICE_MANAGER',
          'provider_status', 'DELIVERED',
          'provider_request_id', trim(p_provider_request_id),
          'provider_event_id', NULLIF(trim(p_provider_event_id), ''),
          'provider_requested_at', p_requested_at,
          'provider_delivered_at', p_delivered_at,
          'earchive_service', 'EAD_TRUST_EVIDENCE_MANAGER',
          'earchive_status', v_archive_status,
          'earchive_evidence_id', NULLIF(trim(p_earchive_evidence_id), ''),
          'earchive_archived_at', p_earchive_archived_at,
          'earchive_hash_sha512', lower(p_earchive_hash_sha512)
        ),
        ''
      );
      v_inserted_delivery := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'recipient_id', p_recipient_id,
    'provider_request_id', trim(p_provider_request_id),
    'provider_status', v_provider_status,
    'requested_recorded', v_inserted_request,
    'delivery_recorded', v_inserted_delivery,
    'earchive_status', v_archive_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_recipient_mark_ead_notice_result(
  uuid, text, text, text, timestamptz, timestamptz, text, text, timestamptz, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recipient_mark_ead_notice_result(
  uuid, text, text, text, timestamptz, timestamptz, text, text, timestamptz, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_recipient_record_ead_notice_callback(
  p_provider_request_id text,
  p_provider_event_id text,
  p_event_status text,
  p_occurred_at timestamptz,
  p_delivered_at timestamptz,
  p_earchive_status text,
  p_earchive_evidence_id text,
  p_earchive_archived_at timestamptz,
  p_earchive_hash_sha512 text,
  p_provider_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_recipient_id uuid;
  v_recipient_state text;
  v_requested_at timestamptz;
  v_event_status text := upper(COALESCE(trim(p_event_status), ''));
  v_archive_status text := upper(COALESCE(NULLIF(trim(p_earchive_status), ''), 'PENDING'));
BEGIN
  IF NULLIF(trim(p_provider_request_id), '') IS NULL
     OR NULLIF(trim(p_provider_event_id), '') IS NULL THEN
    RAISE EXCEPTION 'EAD callback request/event id required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('EAD:EVENT:' || trim(p_provider_event_id), 0));
  IF v_event_status NOT IN ('DELIVERED', 'ERROR') THEN
    RAISE EXCEPTION 'EAD callback status must be DELIVERED or ERROR';
  END IF;
  IF p_occurred_at IS NULL OR p_occurred_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'EAD callback occurred_at missing or in the future';
  END IF;
  IF v_event_status = 'DELIVERED'
     AND (p_delivered_at IS NULL OR p_delivered_at > now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'EAD delivery callback requires a valid delivered_at';
  END IF;
  IF v_event_status = 'ERROR' AND p_delivered_at IS NOT NULL THEN
    RAISE EXCEPTION 'EAD failure callback cannot carry delivered_at';
  END IF;
  IF v_archive_status NOT IN ('PENDING', 'COMPLETED', 'ERROR') THEN
    RAISE EXCEPTION 'EAD callback archive status is invalid';
  END IF;
  IF v_archive_status = 'COMPLETED'
     AND (NULLIF(trim(p_earchive_evidence_id), '') IS NULL OR p_earchive_archived_at IS NULL) THEN
    RAISE EXCEPTION 'completed callback e-archive requires evidence id and archived_at';
  END IF;
  IF p_earchive_archived_at IS NOT NULL
     AND p_earchive_archived_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'EAD callback e-archive archived_at is in the future';
  END IF;
  IF p_earchive_hash_sha512 IS NOT NULL
     AND p_earchive_hash_sha512 !~ '^[0-9a-fA-F]{128}$' THEN
    RAISE EXCEPTION 'EAD callback e-archive SHA-512 is invalid';
  END IF;

  SELECT recipient_id, ocurrido_en
    INTO v_recipient_id, v_requested_at
    FROM public.communication_delivery_events
   WHERE proveedor = 'EAD_TRUST'
     AND proveedor_evento_id = trim(p_provider_request_id)
     AND evento = 'SENT'
   LIMIT 1;
  IF v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'EAD callback request id is not bound to a recorded provider request';
  END IF;
  SELECT estado_entrega
    INTO v_recipient_state
    FROM public.communication_recipients
   WHERE id = v_recipient_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EAD callback recipient no longer exists';
  END IF;

  IF p_occurred_at < v_requested_at
     OR (p_delivered_at IS NOT NULL AND (p_delivered_at < v_requested_at OR p_delivered_at > p_occurred_at + interval '5 minutes'))
     OR (p_earchive_archived_at IS NOT NULL AND p_earchive_archived_at < v_requested_at) THEN
    RAISE EXCEPTION 'EAD callback chronology is inconsistent';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.communication_delivery_events
     WHERE proveedor = 'EAD_TRUST'
       AND proveedor_evento_id = trim(p_provider_event_id)
       AND evento = CASE WHEN v_event_status = 'DELIVERED' THEN 'DELIVERED' ELSE 'ERROR' END
  ) THEN
    RETURN jsonb_build_object(
      'recipient_id', v_recipient_id,
      'provider_request_id', trim(p_provider_request_id),
      'provider_event_id', trim(p_provider_event_id),
      'provider_status', v_event_status,
      'already_recorded', true
    );
  END IF;

  -- ENTREGADO es terminal. Un callback tardío sigue entrando en el ledger WORM,
  -- pero nunca puede rebajar ni reescribir el hecho de entrega ya acreditado.
  IF v_recipient_state = 'ENTREGADO' THEN
    NULL;
  ELSIF v_event_status = 'DELIVERED' THEN
    UPDATE public.communication_recipients
       SET estado_entrega = 'ENTREGADO',
           fecha_entrega = p_delivered_at,
           acuse_evidence_hash = CASE
             WHEN v_archive_status = 'COMPLETED' AND p_earchive_hash_sha512 IS NOT NULL
               THEN lower(p_earchive_hash_sha512)
             ELSE acuse_evidence_hash
           END,
           ultimo_error = NULL,
           updated_at = now()
     WHERE id = v_recipient_id;
  ELSE
    UPDATE public.communication_recipients
       SET estado_entrega = 'ERROR',
           ultimo_error = COALESCE(NULLIF(p_provider_payload->>'error', ''), 'EAD Notice Manager reported delivery failure'),
           updated_at = now()
     WHERE id = v_recipient_id;
  END IF;

  INSERT INTO public.communication_delivery_events (
    recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id, payload, hash_self
  ) VALUES (
    v_recipient_id,
    CASE WHEN v_event_status = 'DELIVERED' THEN 'DELIVERED' ELSE 'ERROR' END,
    CASE WHEN v_event_status = 'DELIVERED' THEN p_delivered_at ELSE p_occurred_at END,
    'EAD_TRUST',
    trim(p_provider_event_id),
    COALESCE(p_provider_payload, '{}'::jsonb) || jsonb_build_object(
      'provider_service', 'EAD_TRUST_NOTICE_MANAGER',
      'provider_status', v_event_status,
      'provider_request_id', trim(p_provider_request_id),
      'provider_event_id', trim(p_provider_event_id),
      'provider_occurred_at', p_occurred_at,
      'provider_delivered_at', p_delivered_at,
      'earchive_service', 'EAD_TRUST_EVIDENCE_MANAGER',
      'earchive_status', v_archive_status,
      'earchive_evidence_id', NULLIF(trim(p_earchive_evidence_id), ''),
      'earchive_archived_at', p_earchive_archived_at,
      'earchive_hash_sha512', lower(p_earchive_hash_sha512)
    ),
    ''
  );

  RETURN jsonb_build_object(
    'recipient_id', v_recipient_id,
    'provider_request_id', trim(p_provider_request_id),
    'provider_event_id', trim(p_provider_event_id),
    'provider_status', v_event_status,
    'already_recorded', false,
    'terminal_delivery_preserved', v_recipient_state = 'ENTREGADO',
    'earchive_status', v_archive_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_recipient_record_ead_notice_callback(
  text, text, text, timestamptz, timestamptz, text, text, timestamptz, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recipient_record_ead_notice_callback(
  text, text, text, timestamptz, timestamptz, text, text, timestamptz, text, jsonb
) TO service_role;

COMMENT ON FUNCTION public.fn_recipient_mark_ead_notice_result(
  uuid, text, text, text, timestamptz, timestamptz, text, text, timestamptz, text
) IS 'Records an actual Notice Manager REQUESTED/DELIVERED response and optional verified Evidence Manager archive facts.';

COMMENT ON FUNCTION public.fn_recipient_record_ead_notice_callback(
  text, text, text, timestamptz, timestamptz, text, text, timestamptz, text, jsonb
) IS 'Appends a verified Notice Manager delivery/failure callback to the WORM ledger using provider ids and timestamps.';
