-- fn_claim_recipients_for_dispatch: atomic claim of recipients with FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION fn_claim_recipients_for_dispatch(p_limit int DEFAULT 50)
RETURNS SETOF communication_recipients LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE communication_recipients cr
     SET estado_entrega = 'ENVIANDO', updated_at = now()
   WHERE cr.id IN (
     SELECT cr2.id FROM communication_recipients cr2
     JOIN communications c ON c.id = cr2.communication_id
     WHERE cr2.estado_entrega = 'PENDIENTE'
       AND c.estado IN ('PROGRAMADA','ENVIANDO','ENVIADA')
       AND c.fecha_programada <= now()
     ORDER BY c.fecha_programada ASC
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
   )
   RETURNING cr.*;
$$;

REVOKE EXECUTE ON FUNCTION fn_claim_recipients_for_dispatch(int) FROM public;
GRANT EXECUTE ON FUNCTION fn_claim_recipients_for_dispatch(int) TO service_role;

-- fn_recipient_mark_sent: success path
CREATE OR REPLACE FUNCTION fn_recipient_mark_sent(
  p_recipient_id uuid,
  p_canal_usado text,
  p_proveedor text,
  p_proveedor_evento_id text,
  p_evidence_hash text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intento int;
BEGIN
  SELECT intento_reenvio_n INTO v_intento FROM communication_recipients WHERE id = p_recipient_id;
  UPDATE communication_recipients
     SET estado_entrega = 'ENVIADO',
         canal_usado = p_canal_usado,
         fecha_envio = now(),
         intento_reenvio_n = COALESCE(v_intento, 0) + 1,
         ultimo_error = NULL,
         acuse_evidence_hash = COALESCE(p_evidence_hash, acuse_evidence_hash),
         updated_at = now()
   WHERE id = p_recipient_id;

  INSERT INTO communication_delivery_events (
    recipient_id, evento, proveedor, proveedor_evento_id, payload, hash_self
  ) VALUES (
    p_recipient_id, 'SENT', p_proveedor, p_proveedor_evento_id,
    jsonb_build_object('evidence_hash', p_evidence_hash),
    '' -- filled by tg_delivery_events_hash_chain
  );
END $$;

REVOKE EXECUTE ON FUNCTION fn_recipient_mark_sent(uuid, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION fn_recipient_mark_sent(uuid, text, text, text, text) TO service_role;

-- fn_recipient_handle_error: error path with retry + fallback logic
CREATE OR REPLACE FUNCTION fn_recipient_handle_error(
  p_recipient_id uuid,
  p_error_message text,
  p_retriable boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intento int;
  v_fallback text;
  v_dest_fallback text;
BEGIN
  SELECT intento_reenvio_n, canal_fallback, destino_fallback
    INTO v_intento, v_fallback, v_dest_fallback
    FROM communication_recipients WHERE id = p_recipient_id;

  IF p_retriable AND v_intento < 3 THEN
    UPDATE communication_recipients
       SET estado_entrega = 'PENDIENTE',
           intento_reenvio_n = v_intento + 1,
           ultimo_error = p_error_message,
           updated_at = now()
     WHERE id = p_recipient_id;
  ELSIF v_fallback IS NOT NULL THEN
    UPDATE communication_recipients
       SET canal_primario = canal_fallback,
           canal_fallback = NULL,
           destino_primario = COALESCE(v_dest_fallback, destino_primario),
           destino_fallback = NULL,
           estado_entrega = 'PENDIENTE',
           intento_reenvio_n = 0,
           ultimo_error = p_error_message,
           updated_at = now()
     WHERE id = p_recipient_id;
  ELSE
    UPDATE communication_recipients
       SET estado_entrega = 'ERROR',
           ultimo_error = p_error_message,
           updated_at = now()
     WHERE id = p_recipient_id;

    INSERT INTO communication_delivery_events (
      recipient_id, evento, proveedor, payload, hash_self
    ) VALUES (
      p_recipient_id, 'ERROR', 'INTERNAL',
      jsonb_build_object('error', p_error_message), ''
    );
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION fn_recipient_handle_error(uuid, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION fn_recipient_handle_error(uuid, text, boolean) TO service_role;;
