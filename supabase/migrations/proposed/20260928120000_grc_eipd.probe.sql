-- Ensayo de 20260928120000_grc_eipd.sql (MOI-175 F5.T11).
-- Se ejecuta concatenado con la migración por probe_rollback.py dentro de
-- BEGIN ... ROLLBACK; no lleva su propio control de transacción.
--
-- Sesión real: demo@arga-seguros.com (sub 85e24c66-02c7-4175-b260-1330930ad49f,
-- tenant ARGA …0001). Simula el JWT y adopta el rol `authenticated` para que
-- las políticas RLS y los GRANT/REVOKE de la migración se ejercan de verdad,
-- no como `postgres`.

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

-- 1) Camino positivo: la RPC crea la fila con necessity_result PENDIENTE por
--    defecto y un motivo automático (nunca NULL).
DO $$
DECLARE
  v_id uuid;
  v_rationale text;
  v_result text;
BEGIN
  v_id := public.fn_grc_registrar_eipd(
    p_code => '__PROBE_MOI175_T11__',
    p_entity_id => '6d7ed736-f263-4531-a59d-c6ca0cd41602',
    p_controller_role => 'RESPONSABLE',
    p_processing_description => 'Sonda de verificación EIPD — Motor de triaje de siniestros auto',
    p_ai_system_id => '90000000-0000-0000-0000-000000000001'
  );

  SELECT necessity_rationale, necessity_result INTO v_rationale, v_result
    FROM public.grc_dpias WHERE id = v_id;

  IF v_rationale IS NULL OR v_rationale = '' THEN
    RAISE EXCEPTION 'PROBE T11: la fila creada por la RPC quedó sin motivo';
  END IF;
  IF v_result <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'PROBE T11: necessity_result esperado PENDIENTE, fue %', v_result;
  END IF;
END $$;

-- 2) G-VIVO-NEG: fijar una necesidad distinta de PENDIENTE sin motivo debe
--    rechazarse con NECESIDAD_SIN_MOTIVO (mismo código, camino de UPDATE).
DO $$
DECLARE
  v_rechazado boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_grc_registrar_eipd(
      p_code => '__PROBE_MOI175_T11__',
      p_entity_id => '6d7ed736-f263-4531-a59d-c6ca0cd41602',
      p_controller_role => 'RESPONSABLE',
      p_processing_description => 'Sonda de verificación EIPD',
      p_necessity_result => 'REQUERIDA',
      p_necessity_rationale => NULL
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'NECESIDAD_SIN_MOTIVO%' THEN
      v_rechazado := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'PROBE T11: se esperaba NECESIDAD_SIN_MOTIVO y no se disparó';
  END IF;
END $$;

-- 3) G-VIVO-NEG: entidad de OTRO tenant (Garrigues) con sesión de ARGA debe
--    rechazarse — la RPC no confía en el tenant que le pase el cliente.
DO $$
DECLARE
  v_rechazado boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_grc_registrar_eipd(
      p_code => '__PROBE_MOI175_T11_CROSS__',
      p_entity_id => '00000000-0000-0000-0002-000000000004', -- Garrigues Letrados de Soporte, SLP
      p_controller_role => 'RESPONSABLE',
      p_processing_description => 'Sonda cross-tenant'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%ajena al tenant de sesión%' THEN
      v_rechazado := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'PROBE T11: se esperaba rechazo por entidad de otro tenant y no se disparó';
  END IF;
END $$;

-- 4) G-VIVO-NEG: un INSERT directo sobre grc_dpias, sin pasar por la RPC,
--    debe rechazarse por falta de privilegio (REVOKE INSERT de authenticated).
DO $$
DECLARE
  v_rechazado boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.grc_dpias (tenant_id, code, entity_id, controller_role, processing_description, necessity_rationale)
    VALUES ('00000000-0000-0000-0000-000000000001', '__PROBE_MOI175_T11_DIRECT__', '6d7ed736-f263-4531-a59d-c6ca0cd41602', 'RESPONSABLE', 'sonda', 'sonda');
  EXCEPTION WHEN insufficient_privilege THEN
    v_rechazado := true;
  END;
  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'PROBE T11: un INSERT directo (sin RPC) no fue rechazado por privilegios';
  END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
