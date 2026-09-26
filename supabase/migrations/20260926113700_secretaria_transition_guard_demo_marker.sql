-- Migración: 20260926113700_secretaria_transition_guard_demo_marker.sql (MOI-137)
-- Descripción: D-20 (decisión por delegación, 2026-09-26) — la RPC
-- fn_secretaria_transition_template_state trataba el marcador de demostración
-- de forma más laxa que la librería cliente (legal-template-review.ts): esta
-- última veta SIEMPRE `canClaimLegalApproval` ante un marcador demo, pero el
-- servidor solo rechazaba valores nulos, vacíos o `falta|pendiente` — un valor
-- demo se aceptaba sin más como aprobación formal nueva.
--
-- Esta migración cierra ESA brecha concreta: al promover REVISADA/APROBADA→
-- APROBADA con un `p_aprobada_por` NUEVO que contenga un marcador de
-- demostración (demo, seed, prototipo, remediación, simulado/a, prueba,
-- ficticio/a, ejemplo, test, placeholder — espejo de DEMO_APPROVAL_MARKER_RE
-- en src/lib/secretaria/template-admin/patterns.ts), la RPC lo rechaza con
-- MISSING_APPROVAL_DATA, igual que ya rechazaba `falta|pendiente`.
--
-- Alcance deliberado (documentado, no una omisión): el guard SOLO se aplica al
-- valor NUEVO que se intenta registrar como aprobación formal (bloque
-- `v_to = 'APROBADA'` que exige `p_aprobada_por` explícito). NO se aplica a
-- `v_next_aprobada_por` (el bloque `v_to IN ('APROBADA','ACTIVA')` que hereda
-- el valor ya existente cuando no se pasa uno nuevo): eso permitiría que una
-- plantilla YA sembrada en APROBADA con marcador demo (semillas, tests
-- automáticos, y las versiones futuras de MOI-139/MOI-141 mientras usen el
-- mismo patrón de semilla) siguiera pudiendo promoverse a ACTIVA sin volver a
-- escribir `aprobada_por` — la compatibilidad que el cierre previo de MOI-137
-- (20260925110000) ya declaraba como requisito. Ninguna de las 150 plantillas
-- ACTIVA existentes en Cloud transiciona de nuevo por este camino: el cambio
-- solo afecta a transiciones FUTURAS que intenten escribir un marcador demo
-- como aprobación nueva.
--
-- La "no-atribución nominativa" para plantillas YA vigentes con marcador demo
-- (o con una aprobación citada de OTRO tenant/origen, MOI-137 D-20 §3) sigue
-- siendo una regla de presentación en el motor de revisión legal
-- (legal-template-review.ts: canClaimLegalApproval / label "Vigente sin
-- aprobación nominativa"), no una reescritura de datos server-side.
--
-- Revisión adversarial (rama agent/moi-137-cierre, hallazgo P2): la primera
-- versión de esta migración reescribía la función completa con un
-- CREATE OR REPLACE de cuerpo hardcodeado. El diff contra el cuerpo VIVO en
-- Cloud (verificado byte a byte antes de este fix) no tenía drift en ese
-- momento, pero la técnica arriesgaba sobrescribir en silencio un cambio que
-- otra migración introdujera sobre esta misma función entre la preparación y
-- la aplicación de esta. Se sustituye por el patrón ya establecido en el
-- repo (fn_save_meeting_resolutions, 20260906101026): sustitución ANCLADA
-- sobre `pg_get_functiondef` del cuerpo vivo en el momento de aplicar — el
-- ancla debe aparecer EXACTAMENTE una vez o la migración aborta. Así, si el
-- cuerpo vivo cambió de forma desde que se escribió este fichero, la
-- migración falla en voz alta en vez de pisar el cambio ajeno.

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

  -- Ancla anti-drift: el bloque previo (MISSING_APPROVAL_DATA de aprobación
  -- NUEVA, sin marcador demo) debe existir EXACTAMENTE una vez en el cuerpo
  -- vivo. Si el cuerpo cambió de forma (otra migración lo tocó de otro modo
  -- entre tanto), esto aborta en vez de aplicar un reemplazo a ciegas.
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


-- Verificación: aborta la migración si el guard no quedó como se espera.
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
  --    Todo dentro de esta misma transacción de migración: se borra antes de
  --    terminar el bloque, así que no deja residuo si la migración se aplica.
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
      DELETE FROM public.plantillas_protegidas WHERE id = v_test_id;
      RAISE EXCEPTION 'MOI-137 D-20 verify: error inesperado en el control positivo: % (%)', SQLERRM, SQLSTATE;
    END IF;
  END;

  DELETE FROM public.plantillas_protegidas WHERE id = v_test_id;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'MOI-137 D-20 verify: la RPC aceptó un marcador de demostración como aprobación formal nueva';
  END IF;
END;
$verify_moi137_20260926113700$;
