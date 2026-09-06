-- fn_save_meeting_resolutions hacía DELETE FROM rule_evaluation_results, tabla
-- WORM: worm_guard lo rechazaba (P0001) y tumbaba la transacción entera, así
-- que ninguna reunión podía volver a registrar su votación una vez emitida la
-- evaluación V2_CLOUD (medido 2026-09-06 sobre ac961a00). Pasa a append-only:
-- una reevaluación es una fila nueva; si no cambió nada (mismo evaluation_hash
-- que la última), no se escribe. Los lectores toman la última por created_at
-- (índice idx_rule_eval_stage_created ya existente).
--
-- Se parchea por SUSTITUCIÓN ANCLADA sobre el cuerpo vivo para no retranscribir
-- ~300 líneas: cada ancla tiene que aparecer exactamente una vez o se aborta.
-- Idempotente: si ya está parcheada, no hace nada.
DO $patch$
DECLARE
  src text;
  n int;
  a1 text := $a$  v_etapa text;
BEGIN$a$;
  r1 text := $a$  v_etapa text;
  v_prev_eval_hash text;
BEGIN$a$;
  a2 text := $a$        DELETE FROM rule_evaluation_results rer
         WHERE rer.tenant_id = p_tenant_id
           AND rer.agreement_id = v_resolution_agreement_id
           AND rer.etapa = v_etapa;

        INSERT INTO rule_evaluation_results ($a$;
  r2 text := $a$        -- Append-only (2026-09-06): rule_evaluation_results es WORM. El
        -- DELETE que había aquí disparaba worm_guard (P0001) y tumbaba la
        -- transacción entera. Una reevaluación es una fila NUEVA; si la
        -- evaluación no cambió (mismo evaluation_hash que la última), no se
        -- escribe nada. Los lectores toman la última por created_at.
        SELECT rer.evaluation_hash
          INTO v_prev_eval_hash
          FROM rule_evaluation_results rer
         WHERE rer.tenant_id = p_tenant_id
           AND rer.agreement_id = v_resolution_agreement_id
           AND rer.etapa = v_etapa
         ORDER BY rer.created_at DESC
         LIMIT 1;

        IF v_prev_eval_hash IS DISTINCT FROM v_eval_hash THEN
        INSERT INTO rule_evaluation_results ($a$;
  a3 text := $a$          v_eval_hash
        );$a$;
  r3 text := $a$          v_eval_hash
        );
        END IF;$a$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p WHERE p.proname = 'fn_save_meeting_resolutions' AND p.pronamespace = 'public'::regnamespace;
  IF src IS NULL THEN RAISE EXCEPTION 'fn_save_meeting_resolutions no existe'; END IF;
  IF position('v_prev_eval_hash' in src) > 0 THEN
    RAISE NOTICE 'ya parcheada; nada que hacer'; RETURN;
  END IF;
  n := (length(src) - length(replace(src, a1, ''))) / length(a1);
  IF n <> 1 THEN RAISE EXCEPTION 'ancla 1 aparece % veces', n; END IF;
  n := (length(src) - length(replace(src, a2, ''))) / length(a2);
  IF n <> 1 THEN RAISE EXCEPTION 'ancla 2 aparece % veces', n; END IF;
  n := (length(src) - length(replace(src, a3, ''))) / length(a3);
  IF n <> 1 THEN RAISE EXCEPTION 'ancla 3 aparece % veces', n; END IF;
  src := replace(replace(replace(src, a1, r1), a2, r2), a3, r3);
  IF position('DELETE FROM rule_evaluation_results' in src) > 0 THEN
    RAISE EXCEPTION 'el DELETE sigue presente tras el parche';
  END IF;
  EXECUTE src;
END
$patch$;
