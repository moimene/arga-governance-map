begin;

-- Ensayo revertido de la migración 20260926113700_secretaria_transition_guard_demo_marker.sql
-- (MOI-137). Espejo exacto del cuerpo aplicado por esa migración — ver ese
-- fichero para la descripción completa y la justificación de la técnica de
-- sustitución anclada (revisión adversarial, hallazgo P2).

DO $moi137_20260926113700_anchor$
DECLARE
  v_live_def text;
  v_old_block text := $anchor$  IF v_to = 'APROBADA'
     AND (
       NULLIF(btrim(p_aprobada_por), '') IS NULL
       OR p_fecha_aprobacion IS NULL
       OR btrim(p_aprobada_por) ~* '^(falta|pendiente)'
     ) THEN
    RAISE EXCEPTION 'MISSING_APPROVAL_DATA: nueva aprobación formal requerida'
      USING ERRCODE = '23514';
  END IF;$anchor$;
  v_new_block text := $anchor$  IF v_to = 'APROBADA'
     AND (
       NULLIF(btrim(p_aprobada_por), '') IS NULL
       OR p_fecha_aprobacion IS NULL
       OR btrim(p_aprobada_por) ~* '^(falta|pendiente)'
       OR btrim(p_aprobada_por) ~* '\y(demo|seed|prototipo|remediaci[oó]n|simulad[oa]|prueba|fictici[oa]|ejemplo|test|placeholder)\y'
       OR btrim(p_aprobada_por) ~* 'demo\s+operativo'
     ) THEN
    RAISE EXCEPTION 'MISSING_APPROVAL_DATA: nueva aprobación formal requerida (marcador de demostración no constituye aprobación nominativa)'
      USING ERRCODE = '23514';
  END IF;$anchor$;
  v_new_def text;
  v_occurrences integer;
BEGIN
  SELECT pg_get_functiondef(
    'public.fn_secretaria_transition_template_state(uuid, text, text, text, uuid, uuid, text, timestamp with time zone, boolean)'::regprocedure
  ) INTO v_live_def;

  v_occurrences := (length(v_live_def) - length(replace(v_live_def, v_old_block, '')))
    / length(v_old_block);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION
      'MOI-137 anchor: se esperaba el bloque MISSING_APPROVAL_DATA (aprobación nueva, sin marcador demo) exactamente una vez en fn_secretaria_transition_template_state; se encontraron %. La función cambió de forma desde 20260925110000: re-escribir esta migración contra el cuerpo vivo actual antes de aplicar.',
      v_occurrences;
  END IF;

  v_new_def := replace(v_live_def, v_old_block, v_new_block);
  IF v_new_def = v_live_def THEN
    RAISE EXCEPTION 'MOI-137 anchor: la sustitución no produjo ningún cambio en el cuerpo de la función';
  END IF;

  EXECUTE v_new_def;
END;
$moi137_20260926113700_anchor$;


-- Verificación: aborta el ensayo si el guard no quedó como se espera.
DO $verify_moi137_20260926113700$
DECLARE
  v_def text;
  v_test_id uuid := gen_random_uuid();
  v_setup_op uuid := gen_random_uuid();
  v_call_op uuid := gen_random_uuid();
  v_caught boolean := false;
BEGIN
  -- 1) La definición viva debe contener el guard nuevo (marcador de demo en la
  --    aprobación NUEVA a APROBADA).
  SELECT pg_get_functiondef(
    'public.fn_secretaria_transition_template_state(uuid, text, text, text, uuid, uuid, text, timestamp with time zone, boolean)'::regprocedure
  ) INTO v_def;
  IF v_def NOT ILIKE '%marcador de demostraci%n no constituye aprobaci%n nominativa%' THEN
    RAISE EXCEPTION 'MOI-137 D-20 verify: el guard de marcador demo no quedó en fn_secretaria_transition_template_state';
  END IF;
  IF v_def NOT ILIKE '%(demo|seed|prototipo%' THEN
    RAISE EXCEPTION 'MOI-137 D-20 verify: la expresión regular del marcador demo no está en el cuerpo vivo';
  END IF;

  -- 2) Control positivo del propio instrumento: crear una plantilla REVISADA
  --    de usar y tirar (autorizada vía GUC, como hace la propia RPC) y
  --    comprobar que promoverla a APROBADA con un aprobada_por marcado como
  --    demo es RECHAZADO por la RPC real, no solo por el texto de la función.
  --    Todo dentro de esta misma transacción (revertida al final): no deja
  --    residuo.
  -- Corregido por el orquestador (26-09-2026): el control positivo corre
  -- dentro de una subtransacción que se deshace a propósito, para que ni la
  -- fila de usar y tirar ni lo que escriban sus triggers (historial de
  -- versiones) sobrevivan en ARGA.
  BEGIN
    PERFORM set_config('app.secretaria_template_state_transition', v_setup_op::text, true);
    INSERT INTO public.plantillas_protegidas (
      id, tenant_id, tipo, jurisdiccion, version, estado,
      capa1_inmutable, snapshot_rule_pack_required, referencia_legal,
      adoption_mode, organo_tipo
    ) VALUES (
      v_test_id, '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'ES', '1.0.0', 'REVISADA',
      repeat('x', 120), false, 'Art. 160 LSC',
      'MEETING', 'JUNTA_GENERAL'
    );
    -- El GUC de la RPC se limpia entre llamadas: solo debe estar activo dentro
    -- de la propia función, así que se resetea antes de invocarla como llamador
    -- externo (igual que haría PostgREST).
    PERFORM set_config('app.secretaria_template_state_transition', '', true);

    -- fn_secretaria_is_service_role() lee el claim de rol, no la identidad real
    -- de conexión: sin él, fn_current_tenant_id()/fn_secretaria_assert_active_template_admin
    -- fallarían por falta de sesión humana en una migración.
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);

    BEGIN
      PERFORM public.fn_secretaria_transition_template_state(
        v_test_id, 'REVISADA', 'APROBADA',
        'Verificación MOI-137 D-20 (control positivo, fila de usar y tirar)',
        v_call_op, NULL,
        'Comité Legal (demo-operativo)', now(), false
      );
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE = '23514' AND SQLERRM ILIKE '%MISSING_APPROVAL_DATA%' THEN
        v_caught := true;
      ELSE
        RAISE EXCEPTION 'MOI-137 D-20 verify: error inesperado en el control positivo: % (%)', SQLERRM, SQLSTATE;
      END IF;
    END;
    RAISE EXCEPTION USING ERRCODE = 'P0137', MESSAGE = 'deshacer control positivo MOI-137';
  EXCEPTION
    WHEN SQLSTATE 'P0137' THEN
      NULL; -- subtransacción deshecha
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'MOI-137 D-20 verify: la RPC aceptó un marcador de demostración como aprobación formal nueva';
  END IF;
END;
$verify_moi137_20260926113700$;


-- SELECT de comprobación (además del bloque DO de verificación incluido en la
-- propia migración, que ya aborta con RAISE EXCEPTION si algo falla): confirma
-- que la función viva contiene el guard nuevo y que el DO de verificación de
-- arriba corrió sin abortar la transacción (si hubiera fallado, este SELECT
-- nunca se alcanzaría: el ensayo entero habría abortado antes).
SELECT
  pg_get_functiondef(
    'public.fn_secretaria_transition_template_state(uuid, text, text, text, uuid, uuid, text, timestamp with time zone, boolean)'::regprocedure
  ) ILIKE '%marcador de demostraci%n no constituye aprobaci%n nominativa%' AS guard_presente,
  NOT EXISTS (
    SELECT 1 FROM public.plantillas_protegidas
    WHERE referencia_legal = 'Art. 160 LSC'
      AND capa1_inmutable = repeat('x', 120)
  ) AS sin_residuo_de_prueba;

rollback;
