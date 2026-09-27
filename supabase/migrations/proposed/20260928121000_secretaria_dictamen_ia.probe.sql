-- Ensayo de 20260928121000_secretaria_dictamen_ia.sql (MOI-175 F5.T13).
-- Concatenado por probe_rollback.py dentro de BEGIN ... ROLLBACK; sin control
-- de transacción propio.
--
-- Sesión real: demo@arga-seguros.com (sub 85e24c66-02c7-4175-b260-1330930ad49f,
-- tenant ARGA …0001, SECRETARIO con capacidad CERTIFICATION, y miembro
-- VIGENTE del CATIT — comprobado por SELECT antes de escribir este ensayo).

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"85e24c66-02c7-4175-b260-1330930ad49f","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

-- 1) Camino positivo: dictamen + decisión quedan registrados, APPROVED,
--    referenciando el sistema y el órgano.
DO $$
DECLARE
  v_id uuid;
  v_status text;
  v_domain text;
  v_source_id uuid;
BEGIN
  v_id := public.fn_secretaria_registrar_dictamen_ia(
    p_system_id => '90000000-0000-0000-0000-000000000001',
    p_entity_id => '6d7ed736-f263-4531-a59d-c6ca0cd41602',
    p_body_id => '08a4156b-a814-4dc6-b953-fafac1b5b840', -- CATIT
    p_asunto => 'CLASIFICACION',
    p_contenido => 'Sonda de verificación MOI-175 T13: dictamen de prueba, nunca real.',
    p_decisor_person_id => '4b5b1326-63ee-4e84-983b-5c8220be4157' -- Sofía Herrera Ramos, PRESIDENTE vigente
  );

  SELECT status, source_domain, source_id INTO v_status, v_domain, v_source_id
    FROM public.secretaria_document_artifacts WHERE id = v_id;

  IF v_status <> 'APPROVED' THEN
    RAISE EXCEPTION 'PROBE T13: status esperado APPROVED, fue %', v_status;
  END IF;
  IF v_domain <> 'ai_system' OR v_source_id <> '90000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'PROBE T13: source_domain/source_id no enlazan al sistema esperado';
  END IF;

  -- 2) G-VIVO-NEG: el dictamen recién aprobado es inmutable, incluso para la
  --    misma sesión que sí tiene capacidad de escritura sobre la tabla.
  DECLARE
    v_rechazado boolean := false;
  BEGIN
    BEGIN
      UPDATE public.secretaria_document_artifacts SET title = 'edición no permitida' WHERE id = v_id;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'DICTAMEN_IA_INMUTABLE%' THEN
        v_rechazado := true;
      ELSE
        RAISE;
      END IF;
    END;
    IF NOT v_rechazado THEN
      RAISE EXCEPTION 'PROBE T13: el UPDATE del dictamen recién aprobado no fue rechazado';
    END IF;
  END;

  -- 2-bis) Tampoco se puede borrar.
  DECLARE
    v_rechazado boolean := false;
  BEGIN
    BEGIN
      DELETE FROM public.secretaria_document_artifacts WHERE id = v_id;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'DICTAMEN_IA_NO_BORRABLE%' THEN
        v_rechazado := true;
      ELSE
        RAISE;
      END IF;
    END;
    IF NOT v_rechazado THEN
      RAISE EXCEPTION 'PROBE T13: el DELETE del dictamen recién aprobado no fue rechazado';
    END IF;
  END;
END $$;

-- 3) G-VIVO-NEG: autor que NO es miembro vigente del órgano (misma sesión,
--    órgano distinto: "Reunião de Sócios ARGA Brasil", donde Lucía Paredes
--    —la persona de esta sesión— no tiene condición vigente).
DO $$
DECLARE
  v_rechazado boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_secretaria_registrar_dictamen_ia(
      p_system_id => '90000000-0000-0000-0000-000000000001',
      p_entity_id => '6d7ed736-f263-4531-a59d-c6ca0cd41602',
      p_body_id => '00000000-0000-0000-0000-000000000040',
      p_asunto => 'CLASIFICACION',
      p_contenido => 'sonda',
      p_decisor_person_id => '4b5b1326-63ee-4e84-983b-5c8220be4157'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'AUTOR_NO_MIEMBRO_ORGANO%' THEN
      v_rechazado := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'PROBE T13: se esperaba AUTOR_NO_MIEMBRO_ORGANO y no se disparó';
  END IF;
END $$;

-- 4) G-VIVO-NEG: decisor sin ningún cargo vigente.
DO $$
DECLARE
  v_rechazado boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_secretaria_registrar_dictamen_ia(
      p_system_id => '90000000-0000-0000-0000-000000000001',
      p_entity_id => '6d7ed736-f263-4531-a59d-c6ca0cd41602',
      p_body_id => '08a4156b-a814-4dc6-b953-fafac1b5b840',
      p_asunto => 'CLASIFICACION',
      p_contenido => 'sonda',
      p_decisor_person_id => '99999999-9999-9999-9999-999999999999'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'DECISOR_SIN_CARGO_VIGENTE%' THEN
      v_rechazado := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'PROBE T13: se esperaba DECISOR_SIN_CARGO_VIGENTE y no se disparó';
  END IF;
END $$;

-- 5) G-VIVO-NEG: asunto no reconocido.
DO $$
DECLARE
  v_rechazado boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_secretaria_registrar_dictamen_ia(
      p_system_id => '90000000-0000-0000-0000-000000000001',
      p_entity_id => '6d7ed736-f263-4531-a59d-c6ca0cd41602',
      p_body_id => '08a4156b-a814-4dc6-b953-fafac1b5b840',
      p_asunto => 'ASUNTO_INVENTADO',
      p_contenido => 'sonda',
      p_decisor_person_id => '4b5b1326-63ee-4e84-983b-5c8220be4157'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rechazado := true; -- cualquier rechazo vale aquí; se comprueba el mensaje debajo
    IF SQLERRM NOT LIKE '%asunto%no reconocido%' THEN
      RAISE;
    END IF;
  END;
  IF NOT v_rechazado THEN
    RAISE EXCEPTION 'PROBE T13: se esperaba rechazo por asunto no reconocido y no se disparó';
  END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
