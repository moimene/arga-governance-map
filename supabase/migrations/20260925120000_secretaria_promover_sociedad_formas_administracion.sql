-- =============================================================
-- Migración: 20260925120000_secretaria_promover_sociedad_formas_administracion.sql
-- Issue: MOI-219 — Secretaría · Soportar formas de administración sin Consejo en fn_promover_sociedad_operativa
-- =============================================================
--
-- Problema resuelto:
-- fn_promover_sociedad_operativa exigía rígidamente al menos 2 cargos
-- vigentes y la presencia simultánea de PRESIDENTE + SECRETARIO. Esta
-- restricción es exclusiva de órganos colegiados (Consejo de Administración).
-- En el derecho societario español (LSC arts. 210 y ss.), las sociedades
-- de capital (especialmente filiales y sociedades de responsabilidad limitada)
-- se rigen frecuentemente mediante Administrador Único o Administradores
-- Solidarios o Mancomunados. Al dar de alta estas sociedades, quedaban
-- bloqueadas erróneamente en estado INCOMPLETA_CARGOS.
--
-- Solución:
-- Ramificar la validación de invariantes de cargos mínimos en función de
-- entities.forma_administracion:
-- 1. ADMINISTRADOR_UNICO: requiere >= 1 cargo vigente de tipo ADMIN_UNICO o ADMIN_PJ.
-- 2. ADMINISTRADORES_SOLIDARIOS: requiere >= 2 cargos vigentes de tipo ADMIN_SOLIDARIO o ADMIN_PJ.
-- 3. ADMINISTRADORES_MANCOMUNADOS: requiere >= 2 cargos vigentes de tipo ADMIN_MANCOMUNADO o ADMIN_PJ.
-- 4. CONSEJO (o default): mantiene la exigencia colegiada de >= 2 cargos con al menos 1 PRESIDENTE y 1 SECRETARIO.
--
-- Mantiene todas las garantías de seguridad F4/F6:
-- - SECURITY DEFINER con SET search_path = public.
-- - fn_secretaria_assert_tenant_access(p_tenant_id).
-- - fn_secretaria_assert_role_allowed(SECRETARIO, ADMIN_TENANT).
-- - SELECT ... FOR UPDATE sobre la fila de entities (serialización TOCTOU).
-- - pg_advisory_xact_lock sobre el namespace cargos:<entity_id>.
-- =============================================================

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
  v_forma_admin text;
  v_cargos_count integer;
  v_presidente integer;
  v_secretario integer;
BEGIN
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

  -- Lock entity row para serializar contra promociones concurrentes.
  SELECT onboarding_status, forma_administracion
  INTO v_status, v_forma_admin
  FROM public.entities
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'entity % not found in tenant %', p_entity_id, p_tenant_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_status = 'OPERATIVA' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_operativa', true,
      'entity_id', p_entity_id,
      'forma_administracion', v_forma_admin
    );
  END IF;

  -- Advisory lock para serializar contra concurrent cese/designar de cargos.
  PERFORM pg_advisory_xact_lock(hashtext('cargos:' || p_entity_id::text));

  -- Ramificación de invariantes según la forma de administración legal.
  IF v_forma_admin IN ('ADMINISTRADOR_UNICO', 'ADMIN_UNICO') THEN
    SELECT count(*) INTO v_cargos_count
    FROM public.condiciones_persona cp
    WHERE cp.tenant_id = p_tenant_id
      AND cp.entity_id = p_entity_id
      AND cp.estado = 'VIGENTE'
      AND cp.tipo_condicion IN ('ADMIN_UNICO', 'ADMINISTRADOR_UNICO', 'ADMIN_PJ');

    IF v_cargos_count < 1 THEN
      RAISE EXCEPTION 'sociedad % con forma % requiere al menos 1 Administrador Único vigente', p_entity_id, v_forma_admin
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF v_forma_admin IN ('ADMINISTRADORES_SOLIDARIOS', 'ADMIN_SOLIDARIO') THEN
    SELECT count(*) INTO v_cargos_count
    FROM public.condiciones_persona cp
    WHERE cp.tenant_id = p_tenant_id
      AND cp.entity_id = p_entity_id
      AND cp.estado = 'VIGENTE'
      AND cp.tipo_condicion IN ('ADMIN_SOLIDARIO', 'ADMINISTRADOR_SOLIDARIO', 'ADMIN_PJ');

    IF v_cargos_count < 2 THEN
      RAISE EXCEPTION 'sociedad % con forma % requiere al menos 2 Administradores Solidarios vigentes (got %)', p_entity_id, v_forma_admin, v_cargos_count
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF v_forma_admin IN ('ADMINISTRADORES_MANCOMUNADOS', 'ADMIN_MANCOMUNADO') THEN
    SELECT count(*) INTO v_cargos_count
    FROM public.condiciones_persona cp
    WHERE cp.tenant_id = p_tenant_id
      AND cp.entity_id = p_entity_id
      AND cp.estado = 'VIGENTE'
      AND cp.tipo_condicion IN ('ADMIN_MANCOMUNADO', 'ADMINISTRADOR_MANCOMUNADO', 'ADMIN_PJ');

    IF v_cargos_count < 2 THEN
      RAISE EXCEPTION 'sociedad % con forma % requiere al menos 2 Administradores Mancomunados vigentes (got %)', p_entity_id, v_forma_admin, v_cargos_count
        USING ERRCODE = 'check_violation';
    END IF;

  ELSE
    -- Consejo de Administración o forma colegiada general
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
  END IF;

  UPDATE public.entities
  SET onboarding_status = 'OPERATIVA'
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_operativa', false,
    'entity_id', p_entity_id,
    'forma_administracion', v_forma_admin,
    'cargos_vigentes', v_cargos_count,
    'presidente_count', COALESCE(v_presidente, 0),
    'secretario_count', COALESCE(v_secretario, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_promover_sociedad_operativa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_promover_sociedad_operativa(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_promover_sociedad_operativa(uuid, uuid) IS
  'MOI-219: promueve entity.onboarding_status a OPERATIVA server-side con invariantes adaptadas a la forma de administración (Administrador Único, Solidarios, Mancomunados o Consejo). Preserva locks TOCTOU F6.';
