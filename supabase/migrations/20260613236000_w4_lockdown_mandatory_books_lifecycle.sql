-- Remediación W4 (/codex) — blindar el ciclo de vida de mandatory_books (2026-06-13).
-- ============================================================================
-- [P1] mandatory_books tenía RLS FOR ALL tenant-only: un cliente authenticated
-- podía UPDATE directo de status/legalization_status/closed_at, bypasseando la
-- máquina de estados de las RPC. La app NO escribe mandatory_books directamente
-- (read-only; las escrituras van por RPC SECURITY DEFINER). Se revoca el UPDATE
-- de las columnas de ciclo a authenticated: solo las RPC (owner) pueden cambiarlas.
-- [P2] defensa en profundidad: LEGALIZAR exige también volumen cerrado.
-- Forward-only, idempotente.

REVOKE UPDATE (status, closed_at, legalization_status, requires_legalization,
               legalization_evidence_url, legalization_deadline, legalization_mode)
  ON public.mandatory_books FROM authenticated;

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
  v_cerrado boolean;
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

  v_cerrado := (v.status = 'CERRADO' OR v.closed_at IS NOT NULL);

  v_next := CASE
    WHEN p_action = 'PRESENTAR' AND COALESCE(v.legalization_status,'PENDIENTE') IN ('PENDIENTE','RECHAZADO') THEN 'PRESENTADO'
    WHEN p_action = 'LEGALIZAR' AND v.legalization_status = 'PRESENTADO' THEN 'LEGALIZADO'
    WHEN p_action = 'RECHAZAR' AND v.legalization_status = 'PRESENTADO' THEN 'RECHAZADO'
    ELSE NULL
  END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'transición de legalización inválida: % desde %', p_action, v.legalization_status;
  END IF;

  -- Defensa en profundidad: no se presenta NI se legaliza un volumen abierto.
  IF p_action IN ('PRESENTAR','LEGALIZAR') AND NOT v_cerrado THEN
    RAISE EXCEPTION 'el volumen debe estar cerrado antes de % (libro %)', p_action, p_libro_id;
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

REVOKE ALL ON FUNCTION public.fn_libro_legalizacion_transicion(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_libro_legalizacion_transicion(uuid, text, text) TO authenticated, service_role;
