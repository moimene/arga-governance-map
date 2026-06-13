-- W4 — cierre de volumen + legalización de libros (G6) (2026-06-13).
-- ============================================================================
-- Operativiza el ciclo de legalización: cerrar el volumen (congela los asientos)
-- y la máquina PENDIENTE → PRESENTADO → LEGALIZADO|RECHAZADO (RECHAZADO se puede
-- re-presentar). Dos RPC SECURITY DEFINER con aserción de tenant fail-closed v3
-- y REVOKE a anon, espejando la máquina pura `libro-legalizacion.ts`.
-- Forward-only, idempotente.

-- 1) Cerrar volumen.
CREATE OR REPLACE FUNCTION public.fn_libro_cerrar_volumen(p_libro_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v public.mandatory_books%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.mandatory_books WHERE id = p_libro_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'libro % no encontrado', p_libro_id; END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v.tenant_id THEN
      RAISE EXCEPTION 'libro tenant mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v.status = 'CERRADO' OR v.closed_at IS NOT NULL THEN
    RETURN jsonb_build_object('libro_id', v.id, 'status', 'CERRADO', 'already_closed', true);
  END IF;

  UPDATE public.mandatory_books
     SET status = 'CERRADO', closed_at = now()
   WHERE id = p_libro_id;

  RETURN jsonb_build_object('libro_id', p_libro_id, 'status', 'CERRADO', 'already_closed', false);
END;
$function$;

-- 2) Transición de legalización (PRESENTAR / LEGALIZAR / RECHAZAR).
CREATE OR REPLACE FUNCTION public.fn_libro_legalizacion_transicion(
  p_libro_id uuid,
  p_action   text,
  p_evidence_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v public.mandatory_books%ROWTYPE;
  v_next text;
BEGIN
  SELECT * INTO v FROM public.mandatory_books WHERE id = p_libro_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'libro % no encontrado', p_libro_id; END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v.tenant_id THEN
      RAISE EXCEPTION 'libro tenant mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v.requires_legalization IS NOT TRUE THEN
    RAISE EXCEPTION 'el libro % no es legalizable (registro auxiliar)', p_libro_id;
  END IF;

  v_next := CASE
    WHEN p_action = 'PRESENTAR' AND COALESCE(v.legalization_status,'PENDIENTE') IN ('PENDIENTE','RECHAZADO') THEN 'PRESENTADO'
    WHEN p_action = 'LEGALIZAR' AND v.legalization_status = 'PRESENTADO' THEN 'LEGALIZADO'
    WHEN p_action = 'RECHAZAR' AND v.legalization_status = 'PRESENTADO' THEN 'RECHAZADO'
    ELSE NULL
  END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'transición de legalización inválida: % desde %', p_action, v.legalization_status;
  END IF;

  IF p_action = 'PRESENTAR' AND v.status <> 'CERRADO' AND v.closed_at IS NULL THEN
    RAISE EXCEPTION 'el volumen debe cerrarse antes de presentar a legalización';
  END IF;

  UPDATE public.mandatory_books
     SET legalization_status = v_next,
         legalization_evidence_url = CASE WHEN p_action = 'LEGALIZAR'
           THEN COALESCE(p_evidence_url, legalization_evidence_url)
           ELSE legalization_evidence_url END
   WHERE id = p_libro_id;

  RETURN jsonb_build_object('libro_id', p_libro_id, 'legalization_status', v_next);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_libro_cerrar_volumen(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_libro_legalizacion_transicion(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_libro_cerrar_volumen(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_libro_legalizacion_transicion(uuid, text, text) TO authenticated, service_role;
