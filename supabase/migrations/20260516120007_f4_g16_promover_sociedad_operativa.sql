-- =============================================================
-- F4.G16 — RPC fn_promover_sociedad_operativa (atomicidad D6)
-- Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §6
-- =============================================================
--
-- Concilio K9: SociedadNuevaStepper.tsx:252-259 promueve la sociedad a
-- OPERATIVA con `.update()` client-side directo. Si el cliente pierde la
-- conexión entre TX2 y la promoción, la sociedad queda creada pero no
-- promovida (estado inconsistente). Esta migración mueve la promoción a
-- una RPC server-side con guards de invariantes.
--
-- Invariantes server-side (defense-in-depth, RLS+role+capability):
--   - tenant_access (G13 helper).
--   - role allowed: SECRETARIO o ADMIN_TENANT.
--   - entity existe y pertenece al tenant.
--   - onboarding_status NO es ya OPERATIVA (idempotente).
--   - al menos PRESIDENTE + SECRETARIO vigentes en algún body (cargos mínimos).
--
-- Forward-only. La promoción frontend se reescribe para llamar este RPC.

CREATE OR REPLACE FUNCTION public.fn_promover_sociedad_operativa(
  p_tenant_id uuid,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_cargos_count integer;
  v_presidente integer;
  v_secretario integer;
BEGIN
  -- 1) Guards comunes.
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;
  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'p_entity_id is required';
  END IF;

  PERFORM public.fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM public.fn_secretaria_assert_role_allowed(
    p_tenant_id, ARRAY['SECRETARIO','ADMIN_TENANT']::text[]
  );

  -- 2) Lookup entity.
  SELECT onboarding_status INTO v_status
  FROM public.entities
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'entity % not found in tenant %', p_entity_id, p_tenant_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_status = 'OPERATIVA' THEN
    -- Idempotente: ya está promovida.
    RETURN jsonb_build_object('ok', true, 'already_operativa', true, 'entity_id', p_entity_id);
  END IF;

  -- 3) Invariantes de cargos mínimos: PRESIDENTE + SECRETARIO vigentes.
  SELECT count(*) INTO v_cargos_count
  FROM public.condiciones_persona cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.entity_id = p_entity_id
    AND cp.estado = 'VIGENTE';

  IF v_cargos_count < 2 THEN
    RAISE EXCEPTION 'sociedad % has insufficient vigente condiciones_persona (% < 2, need at least PRESIDENTE + SECRETARIO)', p_entity_id, v_cargos_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_presidente
  FROM public.condiciones_persona cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.entity_id = p_entity_id
    AND cp.estado = 'VIGENTE'
    AND cp.tipo_condicion = 'PRESIDENTE';

  SELECT count(*) INTO v_secretario
  FROM public.condiciones_persona cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.entity_id = p_entity_id
    AND cp.estado = 'VIGENTE'
    AND cp.tipo_condicion = 'SECRETARIO';

  IF v_presidente < 1 OR v_secretario < 1 THEN
    RAISE EXCEPTION 'sociedad % requires at least 1 PRESIDENTE (got %) and 1 SECRETARIO (got %)', p_entity_id, v_presidente, v_secretario
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4) Promoción atómica.
  UPDATE public.entities
  SET onboarding_status = 'OPERATIVA'
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_operativa', false,
    'entity_id', p_entity_id,
    'cargos_vigentes', v_cargos_count,
    'presidente_count', v_presidente,
    'secretario_count', v_secretario
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_promover_sociedad_operativa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_promover_sociedad_operativa(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_promover_sociedad_operativa(uuid, uuid) IS
  'F4.G16: promueve entity.onboarding_status a OPERATIVA server-side con guards de invariantes (tenant, role, cargos mínimos). Reemplaza el UPDATE client-side de SociedadNuevaStepper:252.';


-- =============================================================
-- Cierre G16 — Probe mecánico
-- =============================================================
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT to_regprocedure('public.fn_promover_sociedad_operativa(uuid, uuid)') IS NOT NULL
    INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'F4.G16 verification failed: fn_promover_sociedad_operativa not registered';
  END IF;
  RAISE NOTICE 'F4.G16 verification OK: fn_promover_sociedad_operativa(uuid, uuid) registered';
END;
$$;
