-- ITEM-115 — Endurecer RLS de no_session_resolutions: quitar UPDATE/DELETE directo.
--
-- La cabecera no_session_resolutions tenía una única policy ALL con tenant
-- isolation, de modo que cualquier `authenticated` del tenant podía actualizar
-- votes_for/votes_against/status/voting_deadline por PostgREST sin pasar por las
-- RPCs del pipeline. La materialización v2 es fail-closed (no se puede materializar
-- un agreement falso), pero sí se podían falsear listados/KPIs/tracker (status
-- 'APROBADO' forjado, contadores inflados) y alargar el plazo de una votación viva.
--
-- Las transiciones de estado y contadores ya viven en RPCs SECURITY DEFINER
-- (fn_cerrar_votaciones_vencidas, etc.) que bypassean RLS. El cliente solo necesita
-- SELECT (lectura) e INSERT (alta vía useCreateNoSessionResolution). No hay ningún
-- UPDATE/DELETE directo de cliente (verificado por grep). Se sustituye la policy ALL
-- por SELECT + INSERT. Forward-only, idempotente.

DROP POLICY IF EXISTS no_session_resolutions_tenant_isolation ON public.no_session_resolutions;

CREATE POLICY no_session_resolutions_select
  ON public.no_session_resolutions
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

CREATE POLICY no_session_resolutions_insert
  ON public.no_session_resolutions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

-- Self-verify: la policy ALL ya no existe y hay exactamente SELECT + INSERT.
DO $$
DECLARE v_all integer; v_si integer;
BEGIN
  SELECT count(*) INTO v_all FROM pg_policies
   WHERE schemaname='public' AND tablename='no_session_resolutions' AND cmd='ALL';
  SELECT count(*) INTO v_si FROM pg_policies
   WHERE schemaname='public' AND tablename='no_session_resolutions' AND cmd IN ('SELECT','INSERT');
  IF v_all <> 0 OR v_si <> 2 THEN
    RAISE EXCEPTION 'ITEM-115 verificación fallida: all=%, select_insert=%', v_all, v_si;
  END IF;
END $$;
