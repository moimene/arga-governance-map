-- Remediación W4 (/codex round 2) — trigger guard del ciclo de mandatory_books.
-- ============================================================================
-- El REVOKE column-level (migración anterior) es INEFECTIVO en Supabase porque
-- el GRANT table-level de authenticated incluye UPDATE de todas las columnas
-- (documentado en 20260516120008_f6_codex_review_fixes.sql). El patrón correcto
-- del repo es un trigger BEFORE UPDATE. Aquí: bloquea cambios a las columnas de
-- ciclo (status, closed_at, legalization_*) salvo (a) service_role o (b) que la
-- llamada venga de las RPC fn_libro_* (que fijan un flag de sesión local). Así
-- la máquina de estados de las RPC es el único camino de escritura del ciclo.
-- Forward-only, idempotente.

CREATE OR REPLACE FUNCTION public.fn_mandatory_books_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (edge functions, seeds) y las RPC fn_libro_* (flag de sesión)
  -- pueden mutar el ciclo. Cualquier UPDATE directo de authenticated, no.
  IF public.fn_secretaria_is_service_role() THEN
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.libro_lifecycle_rpc', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
     OR NEW.legalization_status IS DISTINCT FROM OLD.legalization_status
     OR NEW.legalization_evidence_url IS DISTINCT FROM OLD.legalization_evidence_url
     OR NEW.requires_legalization IS DISTINCT FROM OLD.requires_legalization
     OR NEW.legalization_deadline IS DISTINCT FROM OLD.legalization_deadline
     OR NEW.legalization_mode IS DISTINCT FROM OLD.legalization_mode THEN
    RAISE EXCEPTION 'mandatory_books: las columnas de ciclo solo se modifican vía RPC fn_libro_* (no UPDATE directo)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_mandatory_books_lifecycle_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mandatory_books_lifecycle_guard() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_mandatory_books_lifecycle_guard ON public.mandatory_books;
CREATE TRIGGER trg_mandatory_books_lifecycle_guard
  BEFORE UPDATE ON public.mandatory_books
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_mandatory_books_lifecycle_guard();

-- Las RPC fijan el flag de sesión local antes de su UPDATE.
CREATE OR REPLACE FUNCTION public.fn_libro_cerrar_volumen(p_libro_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.mandatory_books%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.mandatory_books WHERE id = p_libro_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'libro % no encontrado', p_libro_id; END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v.tenant_id THEN
      RAISE EXCEPTION 'libro tenant mismatch' USING ERRCODE = '42501'; END IF;
  END IF;
  IF v.status = 'CERRADO' OR v.closed_at IS NOT NULL THEN
    RETURN jsonb_build_object('libro_id', v.id, 'status', 'CERRADO', 'already_closed', true); END IF;
  PERFORM set_config('app.libro_lifecycle_rpc', '1', true);
  UPDATE public.mandatory_books SET status = 'CERRADO', closed_at = now() WHERE id = p_libro_id;
  RETURN jsonb_build_object('libro_id', p_libro_id, 'status', 'CERRADO', 'already_closed', false);
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_libro_legalizacion_transicion(p_libro_id uuid, p_action text, p_evidence_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.mandatory_books%ROWTYPE; v_next text; v_cerrado boolean;
BEGIN
  SELECT * INTO v FROM public.mandatory_books WHERE id = p_libro_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'libro % no encontrado', p_libro_id; END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v.tenant_id THEN
      RAISE EXCEPTION 'libro tenant mismatch' USING ERRCODE = '42501'; END IF;
  END IF;
  IF v.requires_legalization IS NOT TRUE THEN
    RAISE EXCEPTION 'el libro % no es legalizable (registro auxiliar)', p_libro_id; END IF;
  v_cerrado := (v.status = 'CERRADO' OR v.closed_at IS NOT NULL);
  v_next := CASE
    WHEN p_action = 'PRESENTAR' AND COALESCE(v.legalization_status,'PENDIENTE') IN ('PENDIENTE','RECHAZADO') THEN 'PRESENTADO'
    WHEN p_action = 'LEGALIZAR' AND v.legalization_status = 'PRESENTADO' THEN 'LEGALIZADO'
    WHEN p_action = 'RECHAZAR' AND v.legalization_status = 'PRESENTADO' THEN 'RECHAZADO'
    ELSE NULL END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'transición de legalización inválida: % desde %', p_action, v.legalization_status; END IF;
  IF p_action IN ('PRESENTAR','LEGALIZAR') AND NOT v_cerrado THEN
    RAISE EXCEPTION 'el volumen debe estar cerrado antes de % (libro %)', p_action, p_libro_id; END IF;
  PERFORM set_config('app.libro_lifecycle_rpc', '1', true);
  UPDATE public.mandatory_books
     SET legalization_status = v_next,
         legalization_evidence_url = CASE WHEN p_action = 'LEGALIZAR' THEN COALESCE(p_evidence_url, legalization_evidence_url) ELSE legalization_evidence_url END
   WHERE id = p_libro_id;
  RETURN jsonb_build_object('libro_id', p_libro_id, 'legalization_status', v_next);
END; $function$;

REVOKE ALL ON FUNCTION public.fn_libro_cerrar_volumen(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_libro_legalizacion_transicion(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_libro_cerrar_volumen(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_libro_legalizacion_transicion(uuid, text, text) TO authenticated, service_role;
