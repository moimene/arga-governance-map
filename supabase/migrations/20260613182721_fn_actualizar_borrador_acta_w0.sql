-- W0 — fn_actualizar_borrador_acta (2026-06-13) — saneamiento de generación documental.
-- ============================================================================
-- Permite EDITAR y persistir el contenido de un acta mientras está en BORRADOR
-- (ni firmada `signed_at` ni bloqueada `is_locked`). Hasta ahora el contenido
-- solo se escribía una vez vía `fn_generar_acta` y `ActaDetalle` era read-only:
-- no existía ningún camino para guardar ediciones del acta como borrador
-- (incidencia de la primera pasada de test, Parte II del informe legal).
--
-- Recalcula `content_hash` con el MISMO algoritmo que `fn_generar_acta`
-- (`encode(digest(content,'sha256'),'hex')`) para no romper la coherencia
-- contenido↔hash. Tras `fn_aprobar_acta` el acta queda firmada+bloqueada y el
-- trigger `trg_minutes_lock_guard` la hace inmutable (art. 202 LSC / RRM
-- 108-109); esta RPC rechaza ese caso explícitamente.
--
-- Seguridad: SECURITY DEFINER con aserción de tenant FAIL-CLOSED v3 (idéntica a
-- `fn_aprobar_acta`) + REVOKE a anon. Forward-only, idempotente.

CREATE OR REPLACE FUNCTION public.fn_actualizar_borrador_acta(
  p_minute_id uuid,
  p_content   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
  v_content_hash text;
BEGIN
  SELECT * INTO v_minute FROM public.minutes WHERE id = p_minute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'acta % no encontrada', p_minute_id;
  END IF;

  -- FAIL-CLOSED: solo un service_role explícito omite la aserción de tenant.
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_minute.tenant_id THEN
      RAISE EXCEPTION 'acta tenant mismatch: el caller del tenant % no puede editar actas del tenant %',
        public.fn_current_tenant_id(), v_minute.tenant_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Solo editable en BORRADOR: ni firmada ni bloqueada.
  IF v_minute.is_locked OR v_minute.signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'acta % no editable: está firmada o bloqueada (art. 202 LSC / RRM 108-109)', p_minute_id
      USING ERRCODE = '42501';
  END IF;

  -- No vaciar el acta por accidente (un borrador editable debe tener contenido).
  IF COALESCE(btrim(p_content), '') = '' THEN
    RAISE EXCEPTION 'el contenido del acta no puede quedar vacío';
  END IF;

  v_content_hash := encode(digest(p_content, 'sha256'), 'hex');

  UPDATE public.minutes
     SET content = p_content,
         content_hash = v_content_hash
   WHERE id = p_minute_id;

  RETURN jsonb_build_object(
    'minute_id', p_minute_id,
    'content_hash', v_content_hash,
    'updated', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_actualizar_borrador_acta(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_actualizar_borrador_acta(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_actualizar_borrador_acta(uuid, text) TO authenticated, service_role;
