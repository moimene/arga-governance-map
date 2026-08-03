-- P1 cierre previo a Cloud:
--   1. El paquete de comunicación admite exclusivamente la convocatoria final
--      renderizada en servidor y ligada al manifiesto DEMO exacto. Un candidato
--      del navegador puede conservarse como histórico, pero nunca habilita envío.
--   2. Cada request/event id de Notice Manager conserva una única identidad
--      WORM. Un replay solo es idempotente si reproduce exactamente la misma
--      fuente, destinatario, cronología, estado, custodia y payload autenticado.

-- ---------------------------------------------------------------------------
-- 1. Binding del paquete con el artefacto server-rendered y su manifest exacto
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_communication_authoritative_binding_valid(
  p_communication_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF public.fn_communication_authoritative_binding_valid_201320(p_communication_id)
       IS NOT TRUE THEN
    RETURN false;
  END IF;
  IF v_communication.tipo_comunicacion <> 'CONVOCATORIA' THEN
    RETURN true;
  END IF;
  IF public.fn_communication_census_binding_valid(p_communication_id) IS NOT TRUE THEN
    RETURN false;
  END IF;
  IF v_communication.package_hash_sha512 !~ '^[0-9a-f]{128}$'
     OR v_communication.package_hash_sha512 IS DISTINCT FROM
        public.fn_communication_compute_package_hash(p_communication_id) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.communication_attachments communication_attachment
      LEFT JOIN public.attachments source_attachment
        ON source_attachment.id = communication_attachment.source_attachment_id
     WHERE communication_attachment.communication_id = p_communication_id
       AND (
         source_attachment.id IS NULL
         OR source_attachment.artifact_verified_at IS NULL
         OR source_attachment.artifact_verified_by_service IS NOT TRUE
         OR COALESCE(source_attachment.artifact_verified_size_bytes, 0) <= 0
         OR communication_attachment.size_bytes IS DISTINCT FROM
            source_attachment.artifact_verified_size_bytes
         OR communication_attachment.mime_type IS DISTINCT FROM
            source_attachment.artifact_verified_mime_type
         OR (
           source_attachment.artifact_kind = 'CONVOCATORIA_FINAL'
           AND (
             -- Un candidato browser, aunque esté consumido, no es el output
             -- autoritativo del renderer y no habilita el paquete.
             source_attachment.artifact_candidate_id IS NOT NULL
             OR source_attachment.convocation_manifest_hash_sha512
                  !~ '^[0-9a-f]{128}$'
             OR source_attachment.tenant_id IS DISTINCT FROM v_communication.tenant_id
             OR source_attachment.convocatoria_id IS DISTINCT FROM
                v_communication.convocatoria_id
             OR source_attachment.artifact_verified_mime_type IS DISTINCT FROM
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
             OR NOT EXISTS (
               SELECT 1
                 FROM public.convocation_manifests manifest
                 JOIN public.convocatorias convocatoria
                   ON convocatoria.id = manifest.convocatoria_id
                  AND convocatoria.tenant_id = manifest.tenant_id
                WHERE manifest.tenant_id = v_communication.tenant_id
                  AND manifest.convocatoria_id = v_communication.convocatoria_id
                  AND manifest.manifest_hash_sha512 =
                      source_attachment.convocation_manifest_hash_sha512
                  AND manifest.immutable_at IS NOT NULL
                  AND manifest.data_class = 'DEMO'
                  AND manifest.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
                  AND manifest.manifest_hash_sha512 = encode(
                    extensions.digest(
                      pg_catalog.convert_to(manifest.manifest_json::text, 'UTF8'),
                      'sha512'
                    ),
                    'hex'
                  )
                  AND manifest.manifest_json ->> 'reviewed_demo_draft_text'
                      IS NOT DISTINCT FROM convocatoria.convocatoria_text
                  AND manifest.manifest_json ->> 'reviewed_demo_draft_text_hash_sha256'
                      IS NOT DISTINCT FROM encode(
                        extensions.digest(
                          pg_catalog.convert_to(convocatoria.convocatoria_text, 'UTF8'),
                          'sha256'
                        ),
                        'hex'
                      )
             )
           )
         )
       )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_communication_authoritative_binding_valid(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_communication_authoritative_binding_valid(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Identidad única y source-bound de callbacks Notice Manager
-- ---------------------------------------------------------------------------

DO $block$
BEGIN
  IF EXISTS (
    SELECT btrim(event.proveedor_evento_id)
      FROM public.communication_delivery_events event
     WHERE event.proveedor = 'EAD_TRUST'
       AND event.evento = 'SENT'
       AND NULLIF(btrim(event.proveedor_evento_id), '') IS NOT NULL
     GROUP BY btrim(event.proveedor_evento_id)
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'EAD_PROVIDER_REQUEST_ID_REPAIR_REQUIRED: duplicate WORM request ids';
  END IF;
  IF EXISTS (
    SELECT btrim(event.proveedor_evento_id)
      FROM public.communication_delivery_events event
     WHERE event.proveedor = 'EAD_TRUST'
       AND event.evento IN ('DELIVERED', 'ERROR')
       AND NULLIF(btrim(event.proveedor_evento_id), '') IS NOT NULL
     GROUP BY btrim(event.proveedor_evento_id)
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'EAD_PROVIDER_EVENT_ID_REPAIR_REQUIRED: duplicate WORM callback ids';
  END IF;
END
$block$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_events_ead_request_identity
  ON public.communication_delivery_events((btrim(proveedor_evento_id)))
  WHERE proveedor = 'EAD_TRUST'
    AND evento = 'SENT'
    AND NULLIF(btrim(proveedor_evento_id), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_events_ead_callback_identity
  ON public.communication_delivery_events((btrim(proveedor_evento_id)))
  WHERE proveedor = 'EAD_TRUST'
    AND evento IN ('DELIVERED', 'ERROR')
    AND NULLIF(btrim(proveedor_evento_id), '') IS NOT NULL;

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
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_request_event public.communication_delivery_events%ROWTYPE;
  v_existing_event public.communication_delivery_events%ROWTYPE;
  v_recipient_state text;
  v_communication public.communications%ROWTYPE;
  v_attachment_count integer;
  v_delivery_mode text;
  v_expected_archive_hash text;
  v_event_status text := upper(COALESCE(btrim(p_event_status), ''));
  v_archive_status text := upper(COALESCE(NULLIF(btrim(p_earchive_status), ''), 'PENDING'));
  v_event_recorded_at timestamptz;
  v_callback_binding jsonb;
  v_callback_binding_hash text;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_provider_request_id), '') IS NULL
     OR NULLIF(btrim(p_provider_event_id), '') IS NULL THEN
    RAISE EXCEPTION 'EAD callback request/event id required';
  END IF;
  IF p_provider_payload IS NOT NULL
     AND jsonb_typeof(p_provider_payload) <> 'object' THEN
    RAISE EXCEPTION 'EAD callback provider payload must be a JSON object';
  END IF;
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
     AND (
       NULLIF(btrim(p_earchive_evidence_id), '') IS NULL
       OR p_earchive_archived_at IS NULL
       OR p_earchive_hash_sha512 IS NULL
     ) THEN
    RAISE EXCEPTION 'completed callback e-archive requires evidence id, archived_at and exact SHA-512';
  END IF;
  IF p_earchive_archived_at IS NOT NULL
     AND p_earchive_archived_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'EAD callback e-archive archived_at is in the future';
  END IF;
  IF p_earchive_hash_sha512 IS NOT NULL
     AND p_earchive_hash_sha512 !~ '^[0-9a-fA-F]{128}$' THEN
    RAISE EXCEPTION 'EAD callback e-archive SHA-512 is invalid';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('EAD:EVENT:' || btrim(p_provider_event_id), 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('EAD:REQUEST:' || btrim(p_provider_request_id), 0)
  );

  SELECT event.* INTO v_request_event
    FROM public.communication_delivery_events event
   WHERE event.proveedor = 'EAD_TRUST'
     AND btrim(event.proveedor_evento_id) = btrim(p_provider_request_id)
     AND event.evento = 'SENT';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EAD callback request id is not bound to one recorded provider request';
  END IF;

  SELECT recipient.estado_entrega
    INTO v_recipient_state
    FROM public.communication_recipients recipient
   WHERE recipient.id = v_request_event.recipient_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EAD callback recipient no longer exists';
  END IF;
  SELECT communication.*
    INTO v_communication
    FROM public.communications communication
    JOIN public.communication_recipients recipient
      ON recipient.communication_id = communication.id
   WHERE recipient.id = v_request_event.recipient_id
   FOR SHARE OF communication;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EAD callback communication no longer exists';
  END IF;

  SELECT count(*) INTO v_attachment_count
    FROM public.communication_attachments attachment
   WHERE attachment.communication_id = v_communication.id;
  v_delivery_mode := v_communication.metadata ->> 'ead_delivery_mode';
  IF v_delivery_mode = 'BASIC_MESSAGE' AND v_attachment_count = 0 THEN
    v_expected_archive_hash := v_communication.cuerpo_hash_sha512;
  ELSIF v_delivery_mode = 'PACKAGE_WITH_ATTACHMENTS' AND v_attachment_count > 0 THEN
    v_expected_archive_hash := v_communication.package_hash_sha512;
  ELSE
    RAISE EXCEPTION 'EAD callback delivery mode/attachment cardinality is inconsistent';
  END IF;
  IF v_expected_archive_hash !~ '^[0-9a-f]{128}$' THEN
    RAISE EXCEPTION 'EAD callback expected archive hash is unavailable';
  END IF;
  IF v_archive_status = 'COMPLETED'
     AND lower(p_earchive_hash_sha512) IS DISTINCT FROM v_expected_archive_hash THEN
    RAISE EXCEPTION 'EAD callback archive hash differs from the exact message/package hash'
      USING ERRCODE = '23514';
  END IF;

  IF p_occurred_at < v_request_event.ocurrido_en
     OR (
       p_delivered_at IS NOT NULL
       AND (
         p_delivered_at < v_request_event.ocurrido_en
         OR p_delivered_at > p_occurred_at + interval '5 minutes'
       )
     )
     OR (
       p_earchive_archived_at IS NOT NULL
       AND p_earchive_archived_at < v_request_event.ocurrido_en
     ) THEN
    RAISE EXCEPTION 'EAD callback chronology is inconsistent';
  END IF;

  v_event_recorded_at := CASE
    WHEN v_event_status = 'DELIVERED' THEN p_delivered_at
    ELSE p_occurred_at
  END;
  v_callback_binding := jsonb_build_object(
    'schema_version', 'secretaria.ead-notice-callback-binding.v1',
    'tenant_id', v_communication.tenant_id,
    'communication_id', v_communication.id,
    'recipient_id', v_request_event.recipient_id,
    'provider_request_id', btrim(p_provider_request_id),
    'provider_event_id', btrim(p_provider_event_id),
    'provider_status', v_event_status,
    'provider_occurred_at', p_occurred_at,
    'provider_delivered_at', p_delivered_at,
    'event_recorded_at', v_event_recorded_at,
    'delivery_mode', v_delivery_mode,
    'expected_archive_hash_sha512', v_expected_archive_hash,
    'earchive_status', v_archive_status,
    'earchive_evidence_id', NULLIF(btrim(p_earchive_evidence_id), ''),
    'earchive_archived_at', p_earchive_archived_at,
    'earchive_hash_sha512', lower(p_earchive_hash_sha512),
    'provider_payload', COALESCE(p_provider_payload, '{}'::jsonb)
  );
  v_callback_binding_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(v_callback_binding::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  SELECT event.* INTO v_existing_event
    FROM public.communication_delivery_events event
   WHERE event.proveedor = 'EAD_TRUST'
     AND btrim(event.proveedor_evento_id) = btrim(p_provider_event_id)
     AND event.evento IN ('DELIVERED', 'ERROR');
  IF FOUND THEN
    IF v_existing_event.recipient_id IS DISTINCT FROM v_request_event.recipient_id
       OR v_existing_event.evento IS DISTINCT FROM v_event_status
       OR v_existing_event.ocurrido_en IS DISTINCT FROM v_event_recorded_at
       OR v_existing_event.payload -> 'callback_binding'
            IS DISTINCT FROM v_callback_binding
       OR v_existing_event.payload ->> 'callback_binding_hash_sha256'
            IS DISTINCT FROM v_callback_binding_hash THEN
      RAISE EXCEPTION
        'EAD_PROVIDER_EVENT_ID_COLLISION: callback event id is bound to another immutable source'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'recipient_id', v_request_event.recipient_id,
      'provider_request_id', btrim(p_provider_request_id),
      'provider_event_id', btrim(p_provider_event_id),
      'provider_status', v_event_status,
      'callback_binding_hash_sha256', v_callback_binding_hash,
      'already_recorded', true
    );
  END IF;

  IF v_event_status = 'DELIVERED' THEN
    UPDATE public.communication_recipients
       SET estado_entrega = CASE
             WHEN estado_entrega IN ('ENTREGADO','LEIDO','RESPONDIDO')
               THEN estado_entrega
             ELSE 'ENTREGADO'
           END,
           fecha_entrega = COALESCE(fecha_entrega, p_delivered_at),
           acuse_evidence_hash = CASE
             WHEN v_archive_status = 'COMPLETED'
               THEN lower(p_earchive_hash_sha512)
             ELSE acuse_evidence_hash
           END,
           ultimo_error = NULL,
           updated_at = now()
     WHERE id = v_request_event.recipient_id;
  ELSIF v_recipient_state NOT IN ('ENTREGADO','LEIDO','RESPONDIDO') THEN
    UPDATE public.communication_recipients
       SET estado_entrega = 'ERROR',
           ultimo_error = COALESCE(
             NULLIF(p_provider_payload ->> 'error', ''),
             'EAD Notice Manager reported delivery failure'
           ),
           updated_at = now()
     WHERE id = v_request_event.recipient_id;
  END IF;

  INSERT INTO public.communication_delivery_events (
    recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id,
    payload, hash_self
  ) VALUES (
    v_request_event.recipient_id,
    v_event_status,
    v_event_recorded_at,
    'EAD_TRUST',
    btrim(p_provider_event_id),
    COALESCE(p_provider_payload, '{}'::jsonb) || jsonb_build_object(
      'provider_service', 'EAD_TRUST_NOTICE_MANAGER',
      'provider_status', v_event_status,
      'provider_request_id', btrim(p_provider_request_id),
      'provider_event_id', btrim(p_provider_event_id),
      'provider_occurred_at', p_occurred_at,
      'provider_delivered_at', p_delivered_at,
      'earchive_service', 'EAD_TRUST_EVIDENCE_MANAGER',
      'earchive_status', v_archive_status,
      'earchive_evidence_id', NULLIF(btrim(p_earchive_evidence_id), ''),
      'earchive_archived_at', p_earchive_archived_at,
      'earchive_hash_sha512', lower(p_earchive_hash_sha512),
      'callback_binding', v_callback_binding,
      'callback_binding_hash_sha256', v_callback_binding_hash
    ),
    ''
  );

  RETURN jsonb_build_object(
    'recipient_id', v_request_event.recipient_id,
    'provider_request_id', btrim(p_provider_request_id),
    'provider_event_id', btrim(p_provider_event_id),
    'provider_status', v_event_status,
    'callback_binding_hash_sha256', v_callback_binding_hash,
    'already_recorded', false,
    'terminal_delivery_preserved',
      v_recipient_state IN ('ENTREGADO','LEIDO','RESPONDIDO'),
    'earchive_status', v_archive_status
  );
END
$function$;

REVOKE ALL ON FUNCTION public.fn_recipient_record_ead_notice_callback(
  text, text, text, timestamptz, timestamptz, text, text, timestamptz, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recipient_record_ead_notice_callback(
  text, text, text, timestamptz, timestamptz, text, text, timestamptz, text, jsonb
) TO service_role;
