-- Migración: 20260927120000_secretaria_template_content_seal_guard.sql (MOI-200)
-- Descripción: ata cada plantilla vigente a la huella del texto que se aprobó,
-- hacia delante (el saneamiento del histórico de las 26 divergentes y las 15
-- sin huella de ARGA espera a la respuesta del Comité Legal a L2, MOI-199 —
-- esta migración NO toca ninguna fila existente).
--
-- Parte del problema descrito en el issue: nada mantenía `content_hash_sha256`
-- al día. Una migración/script que reescriba `capa1_inmutable` de una fila ya
-- ACTIVA/APROBADA directamente (como hizo 20260720113000 sin decisión L2) no
-- pasa por ninguna transición de estado, así que el guard de la RPC nunca se
-- volvía a evaluar sobre esa fila. Dos piezas, en las dos únicas funciones que
-- ya tocan esta tabla (sustitución ANCLADA sobre el cuerpo VIVO, patrón de
-- 20260906101026 / 20260926113700 — el ancla debe aparecer EXACTAMENTE una
-- vez o la migración aborta, para no pisar en silencio un cambio ajeno):
--
-- 1) fn_secretaria_guard_template_state_transition() (trigger BEFORE UPDATE,
--    ya dispara en TODO UPDATE de la tabla, no solo en la RPC): cuando
--    `capa1_inmutable` cambia, `content_hash_sha256` se recalcula a NULL —
--    "recalcular" aquí es dejar el campo en el único valor honesto posible:
--    ningún hash coincide con NULL, así que la huella queda invalidada sin
--    tocar `estado` (el issue lo pide explícitamente: "sin tocar estado").
--    Dispara sea cual sea el origen del UPDATE: la RPC, el editor de capa 1
--    de BORRADOR, o un script/migración directos.
--
-- 2) fn_secretaria_transition_template_state(...):
--    a) al promover a APROBADA (transición REVISADA→APROBADA, que YA exige
--       `p_aprobada_por` nuevo y no-demo desde MOI-137/20260926113700), se
--       sella `content_hash_sha256 = sha256(capa1_inmutable)` — la única
--       operación de este archivo que ESCRIBE un sello nuevo, y solo lo hace
--       atada a una aprobación nominativa fresca real.
--    b) al promover a ACTIVA, se exige que `content_hash_sha256` no sea NULL
--       y coincida con `sha256(capa1_inmutable)`; si no, MISSING_CONTENT_SEAL.
--       Ninguna de las 150 ACTIVA existentes en Cloud vuelve a pasar por esta
--       transición (ya están ACTIVA): el gate solo afecta a activaciones
--       FUTURAS.

DO $moi200_guard_trigger_anchor$
DECLARE
  v_live_def text;
  v_old_block text := $anchor$  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'template tenant_id is immutable'
      USING ERRCODE = '42501';
  END IF;$anchor$;
  v_new_block text := $anchor$  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'template tenant_id is immutable'
      USING ERRCODE = '42501';
  END IF;

  -- MOI-200: la huella de contenido se recalcula sola. Un UPDATE que cambie
  -- el texto aprobado (capa1_inmutable) — por la RPC, por el editor de
  -- BORRADOR, o por un script/migración directo que toque la tabla sin pasar
  -- por ningún flujo — invalida el sello de la aprobación anterior sin tocar
  -- `estado`: content_hash_sha256 pasa a NULL, que ya no coincide con ningún
  -- hash calculado. fn_secretaria_transition_template_state exige un sello
  -- coincidente para promover a ACTIVA, así que una plantilla cuyo texto
  -- cambió por esta vía deja de poder activarse hasta reaprobarse. No se
  -- re-sella aquí ninguna plantilla ya divergente o sin huella: eso exige la
  -- decisión del Comité Legal (MOI-199, L2).
  IF NEW.capa1_inmutable IS DISTINCT FROM OLD.capa1_inmutable THEN
    NEW.content_hash_sha256 := NULL;
  END IF;$anchor$;
  v_new_def text;
  v_occurrences integer;
BEGIN
  SELECT pg_get_functiondef('public.fn_secretaria_guard_template_state_transition()'::regprocedure)
    INTO v_live_def;

  v_occurrences := (length(v_live_def) - length(replace(v_live_def, v_old_block, '')))
    / length(v_old_block);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION
      'MOI-200 anchor: se esperaba el bloque de inmutabilidad de tenant_id exactamente una vez en fn_secretaria_guard_template_state_transition; se encontraron %. La función cambió de forma: re-escribir esta migración contra el cuerpo vivo actual antes de aplicar.',
      v_occurrences;
  END IF;

  v_new_def := replace(v_live_def, v_old_block, v_new_block);
  IF v_new_def = v_live_def THEN
    RAISE EXCEPTION 'MOI-200 anchor: la sustitución no produjo ningún cambio en fn_secretaria_guard_template_state_transition';
  END IF;

  EXECUTE v_new_def;
END;
$moi200_guard_trigger_anchor$;


DO $moi200_transition_rpc_anchor$
DECLARE
  v_live_def text;
  v_old_case_block text := $anchor$         content_hash_sha256 = CASE WHEN v_to = 'BORRADOR' THEN NULL ELSE content_hash_sha256 END$anchor$;
  v_new_case_block text := $anchor$         content_hash_sha256 = CASE
           WHEN v_to = 'BORRADOR' THEN NULL
           WHEN v_to = 'APROBADA' THEN encode(
             extensions.digest(convert_to(COALESCE(v_target.capa1_inmutable, ''), 'UTF8'), 'sha256'),
             'hex'
           )
           ELSE content_hash_sha256
         END$anchor$;
  v_old_gate_block text := $anchor$  IF v_to IN ('APROBADA', 'ACTIVA')
     AND (
       v_next_aprobada_por IS NULL
       OR v_next_fecha_aprobacion IS NULL
       OR v_next_aprobada_por ~* '^(falta|pendiente)'
     ) THEN
    RAISE EXCEPTION 'MISSING_APPROVAL_DATA: aprobación formal requerida'
      USING ERRCODE = '23514';
  END IF;$anchor$;
  v_new_gate_block text := $anchor$  IF v_to IN ('APROBADA', 'ACTIVA')
     AND (
       v_next_aprobada_por IS NULL
       OR v_next_fecha_aprobacion IS NULL
       OR v_next_aprobada_por ~* '^(falta|pendiente)'
     ) THEN
    RAISE EXCEPTION 'MISSING_APPROVAL_DATA: aprobación formal requerida'
      USING ERRCODE = '23514';
  END IF;

  -- MOI-200: ninguna plantilla puede pasar a vigente sin una huella de
  -- contenido que coincida con el texto que se activa. Solo se exige en la
  -- transición a ACTIVA (la que el issue llama "activar"): las 150 ACTIVA
  -- existentes en Cloud no vuelven a pasar por aquí, así que su recuento
  -- (incluidas las 26 divergentes y 15 nulas de ARGA) no cambia.
  IF v_to = 'ACTIVA'
     AND (
       v_target.content_hash_sha256 IS NULL
       OR v_target.content_hash_sha256 <> encode(
         extensions.digest(convert_to(COALESCE(v_target.capa1_inmutable, ''), 'UTF8'), 'sha256'),
         'hex'
       )
     ) THEN
    RAISE EXCEPTION 'MISSING_CONTENT_SEAL: la huella de contenido no coincide con el texto aprobado; requiere nueva aprobación'
      USING ERRCODE = '23514';
  END IF;$anchor$;
  v_new_def text;
  v_occurrences integer;
BEGIN
  SELECT pg_get_functiondef(
    'public.fn_secretaria_transition_template_state(uuid, text, text, text, uuid, uuid, text, timestamp with time zone, boolean)'::regprocedure
  ) INTO v_live_def;

  v_occurrences := (length(v_live_def) - length(replace(v_live_def, v_old_case_block, '')))
    / length(v_old_case_block);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION
      'MOI-200 anchor: se esperaba el CASE de content_hash_sha256 exactamente una vez en fn_secretaria_transition_template_state; se encontraron %. Re-escribir esta migración contra el cuerpo vivo actual.',
      v_occurrences;
  END IF;

  v_occurrences := (length(v_live_def) - length(replace(v_live_def, v_old_gate_block, '')))
    / length(v_old_gate_block);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION
      'MOI-200 anchor: se esperaba el bloque MISSING_APPROVAL_DATA (aprobación heredada/nueva) exactamente una vez en fn_secretaria_transition_template_state; se encontraron %. Re-escribir esta migración contra el cuerpo vivo actual.',
      v_occurrences;
  END IF;

  v_new_def := replace(replace(v_live_def, v_old_case_block, v_new_case_block), v_old_gate_block, v_new_gate_block);
  IF v_new_def = v_live_def THEN
    RAISE EXCEPTION 'MOI-200 anchor: la sustitución no produjo ningún cambio en fn_secretaria_transition_template_state';
  END IF;

  EXECUTE v_new_def;
END;
$moi200_transition_rpc_anchor$;


-- Verificación: aborta la migración si el guard no quedó como se espera, y
-- ejerce el instrumento real (control positivo) dentro de una subtransacción
-- que se deshace a propósito, para que ni las filas de usar y tirar ni lo que
-- escriban sus triggers (historial de versiones, changelog) sobrevivan.
DO $verify_moi200_20260927120000$
DECLARE
  v_guard_def text;
  v_rpc_def text;
  v_test_ok_id uuid := gen_random_uuid();
  v_test_edited_id uuid := gen_random_uuid();
  v_op1 uuid := gen_random_uuid();
  v_op2 uuid := gen_random_uuid();
  v_op3 uuid := gen_random_uuid();
  v_op4 uuid := gen_random_uuid();
  v_hash_after_seal text;
  v_hash_after_edit text;
  v_caught_missing_seal boolean := false;
  v_activated_ok boolean := false;
  v_arga_coinciden integer;
  v_arga_divergen integer;
  v_arga_nulas integer;
BEGIN
  -- 1) Las dos funciones vivas deben contener el guard nuevo.
  SELECT pg_get_functiondef('public.fn_secretaria_guard_template_state_transition()'::regprocedure)
    INTO v_guard_def;
  IF v_guard_def NOT ILIKE '%NEW.capa1_inmutable IS DISTINCT FROM OLD.capa1_inmutable%' THEN
    RAISE EXCEPTION 'MOI-200 verify: el guard de invalidación de huella no quedó en fn_secretaria_guard_template_state_transition';
  END IF;

  SELECT pg_get_functiondef(
    'public.fn_secretaria_transition_template_state(uuid, text, text, text, uuid, uuid, text, timestamp with time zone, boolean)'::regprocedure
  ) INTO v_rpc_def;
  IF v_rpc_def NOT ILIKE '%MISSING_CONTENT_SEAL%' THEN
    RAISE EXCEPTION 'MOI-200 verify: el gate de activación por huella no quedó en fn_secretaria_transition_template_state';
  END IF;
  IF v_rpc_def NOT ILIKE '%WHEN v_to = ''APROBADA'' THEN encode(%' THEN
    RAISE EXCEPTION 'MOI-200 verify: el sellado de huella al aprobar no quedó en fn_secretaria_transition_template_state';
  END IF;

  -- 2) Control positivo del propio instrumento, en una subtransacción que se
  --    deshace a propósito: ni v_test_ok_id ni v_test_edited_id sobreviven.
  BEGIN
    PERFORM set_config('app.secretaria_template_state_transition', v_op1::text, true);
    -- materia_acuerdo distintivo: evita que la clave funcional (tipo,
    -- jurisdicción, materia, órgano, modo de adopción, tipo social) de estas
    -- filas de usar y tirar coincida con la de ninguna plantilla real, así
    -- que activar v_test_ok_id no encuentra un predecesor real que sustituir.
    INSERT INTO public.plantillas_protegidas (
      id, tenant_id, tipo, jurisdiccion, version, estado,
      capa1_inmutable, snapshot_rule_pack_required, referencia_legal,
      adoption_mode, organo_tipo, materia_acuerdo
    ) VALUES (
      v_test_ok_id, '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'ES', '1.0.0', 'REVISADA',
      repeat('y', 130), false, 'Art. 160 LSC', 'MEETING', 'JUNTA_GENERAL', 'MOI200_PROBE_USAR_Y_TIRAR'
    ), (
      v_test_edited_id, '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'ES', '1.0.0', 'REVISADA',
      repeat('z', 130), false, 'Art. 160 LSC', 'MEETING', 'JUNTA_GENERAL', 'MOI200_PROBE_USAR_Y_TIRAR'
    );
    PERFORM set_config('app.secretaria_template_state_transition', '', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);

    -- 2a) Aprobar ambas filas con una aprobación nominativa fresca real:
    --     debe sellar content_hash_sha256 = sha256(capa1_inmutable).
    PERFORM public.fn_secretaria_transition_template_state(
      v_test_ok_id, 'REVISADA', 'APROBADA',
      'Verificación MOI-200 (control positivo, fila OK, usar y tirar)',
      v_op1, NULL, 'Comité Legal ARGA - Secretaria Societaria', now(), false
    );
    PERFORM public.fn_secretaria_transition_template_state(
      v_test_edited_id, 'REVISADA', 'APROBADA',
      'Verificación MOI-200 (control positivo, fila editada tras sellar, usar y tirar)',
      v_op2, NULL, 'Comité Legal ARGA - Secretaria Societaria', now(), false
    );

    SELECT content_hash_sha256 INTO v_hash_after_seal
      FROM public.plantillas_protegidas WHERE id = v_test_edited_id;
    IF v_hash_after_seal IS NULL
       OR v_hash_after_seal <> encode(extensions.digest(convert_to(repeat('z', 130), 'UTF8'), 'sha256'), 'hex') THEN
      RAISE EXCEPTION 'MOI-200 verify: el sellado al aprobar no produjo la huella esperada';
    END IF;

    -- 2b) Edición directa del texto SIN pasar por la RPC (simula el
    --     re-sellado silencioso del 20-07-2026): debe invalidar la huella.
    UPDATE public.plantillas_protegidas
       SET capa1_inmutable = capa1_inmutable || ' (editado sin nueva aprobación)'
     WHERE id = v_test_edited_id;

    SELECT content_hash_sha256 INTO v_hash_after_edit
      FROM public.plantillas_protegidas WHERE id = v_test_edited_id;
    IF v_hash_after_edit IS NOT NULL THEN
      RAISE EXCEPTION 'MOI-200 verify: editar capa1_inmutable no invalidó la huella (content_hash_sha256 sigue no-nulo)';
    END IF;

    -- 2c) Activar la fila editada debe fallar con MISSING_CONTENT_SEAL.
    BEGIN
      PERFORM public.fn_secretaria_transition_template_state(
        v_test_edited_id, 'APROBADA', 'ACTIVA',
        'Verificación MOI-200 (activar sin huella coincidente, debe fallar)',
        v_op3, NULL, NULL, NULL, false
      );
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE = '23514' AND SQLERRM ILIKE '%MISSING_CONTENT_SEAL%' THEN
        v_caught_missing_seal := true;
      ELSE
        RAISE EXCEPTION 'MOI-200 verify: error inesperado activando la fila editada: % (%)', SQLERRM, SQLSTATE;
      END IF;
    END;

    -- 2d) Activar la fila OK (huella intacta) debe funcionar: el gate no
    --     sobre-bloquea el camino normal.
    PERFORM public.fn_secretaria_transition_template_state(
      v_test_ok_id, 'APROBADA', 'ACTIVA',
      'Verificación MOI-200 (activar con huella coincidente, debe funcionar)',
      v_op4, NULL, NULL, NULL, false
    );
    v_activated_ok := true;

    RAISE EXCEPTION USING ERRCODE = 'P0200', MESSAGE = 'deshacer control positivo MOI-200';
  EXCEPTION
    WHEN SQLSTATE 'P0200' THEN
      NULL; -- subtransacción deshecha: sin residuo en ARGA
  END;

  IF NOT v_caught_missing_seal THEN
    RAISE EXCEPTION 'MOI-200 verify: la RPC activó una plantilla sin huella coincidente';
  END IF;
  IF NOT v_activated_ok THEN
    RAISE EXCEPTION 'MOI-200 verify: la RPC rechazó activar una plantilla con huella coincidente (falso positivo del gate)';
  END IF;

  -- 3) Sin residuo: las filas de usar y tirar no deben existir tras el
  --    rollback de la subtransacción.
  IF EXISTS (
    SELECT 1 FROM public.plantillas_protegidas
     WHERE id IN (v_test_ok_id, v_test_edited_id)
  ) THEN
    RAISE EXCEPTION 'MOI-200 verify: quedó residuo del control positivo en plantillas_protegidas';
  END IF;

  -- 4) El recuento de ARGA (31 coinciden / 26 divergen / 15 nulas) no cambia:
  --    esta migración no toca ninguna fila existente.
  SELECT
    count(*) FILTER (
      WHERE content_hash_sha256 = encode(extensions.digest(convert_to(capa1_inmutable, 'UTF8'), 'sha256'), 'hex')
    ),
    count(*) FILTER (
      WHERE content_hash_sha256 IS NOT NULL
        AND content_hash_sha256 <> encode(extensions.digest(convert_to(capa1_inmutable, 'UTF8'), 'sha256'), 'hex')
    ),
    count(*) FILTER (WHERE content_hash_sha256 IS NULL)
    INTO v_arga_coinciden, v_arga_divergen, v_arga_nulas
    FROM public.plantillas_protegidas
   WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
     AND estado = 'ACTIVA';

  IF v_arga_coinciden <> 31 OR v_arga_divergen <> 26 OR v_arga_nulas <> 15 THEN
    RAISE EXCEPTION
      'MOI-200 verify: el recuento de ARGA cambió (coinciden=%, divergen=%, nulas=%; se esperaba 31/26/15)',
      v_arga_coinciden, v_arga_divergen, v_arga_nulas;
  END IF;
END;
$verify_moi200_20260927120000$;
