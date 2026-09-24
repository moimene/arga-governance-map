-- Remediación W9 (/codex) — CONVOCAR exige convocatoria_id (2026-06-14).
-- ============================================================================
-- Hallazgo: CONVOCAR terminalizaba el borrador (CONVOCADO) sin que existiera
-- convocatoria/reunión; si el usuario abandonaba el intake, el borrador
-- desaparecía de la bandeja sin target materializado. Ahora la RPC exige
-- p_convocatoria_id para CONVOCAR. La UI navega al intake dejando el borrador en
-- APROBADO (visible); la marca CONVOCADO + el enlace se harán cuando el intake
-- materialice la reunión (wiring de materialización = follow-up). Forward-only.

CREATE OR REPLACE FUNCTION public.fn_agenda_draft_transicion(p_draft_id uuid, p_action text, p_convocatoria_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d public.agenda_draft%ROWTYPE; v_next text;
BEGIN
  SELECT * INTO d FROM public.agenda_draft WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'borrador % no encontrado', p_draft_id; END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> d.tenant_id THEN
      RAISE EXCEPTION 'agenda_draft tenant mismatch' USING ERRCODE = '42501'; END IF;
  END IF;
  v_next := CASE
    WHEN p_action = 'APROBAR'  AND d.estado IN ('PENDIENTE','POSPUESTO') THEN 'APROBADO'
    WHEN p_action = 'POSPONER' AND d.estado = 'PENDIENTE' THEN 'POSPUESTO'
    WHEN p_action = 'RECHAZAR' AND d.estado IN ('PENDIENTE','POSPUESTO') THEN 'RECHAZADO'
    WHEN p_action = 'CONVOCAR' AND d.estado = 'APROBADO' THEN 'CONVOCADO'
    ELSE NULL END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'transición de borrador inválida: % desde %', p_action, d.estado; END IF;
  IF p_action = 'CONVOCAR' AND p_convocatoria_id IS NULL THEN
    RAISE EXCEPTION 'CONVOCAR requiere convocatoria_id: materializa la reunión/convocatoria primero'; END IF;
  PERFORM set_config('app.agenda_draft_rpc', '1', true);
  UPDATE public.agenda_draft
     SET estado = v_next, decidido_by = auth.uid(), decidido_at = now(),
         convocatoria_id = CASE WHEN p_action = 'CONVOCAR' THEN p_convocatoria_id ELSE convocatoria_id END
   WHERE id = p_draft_id;
  RETURN jsonb_build_object('draft_id', p_draft_id, 'estado', v_next);
END; $function$;
REVOKE ALL ON FUNCTION public.fn_agenda_draft_transicion(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_agenda_draft_transicion(uuid, text, uuid) TO authenticated, service_role;
