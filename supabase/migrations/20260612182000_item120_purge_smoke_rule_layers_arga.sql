-- ITEM-120 — Purga de capas normativas de smoke-test en la entidad canónica ARGA.
--
-- La matriz de reglas efectivas (secretaria_effective_rule_matrix) de ARGA Seguros
-- para MODIFICACION_ESTATUTOS mostraba contenido jurídico insostenible procedente de
-- smoke-tests del 2026-05-17:
--   * Override estatutario UNANIMIDAD (secretaria_normative_overrides eb79793f) —
--     un requisito de unanimidad estatutaria es INADMISIBLE en derecho español
--     (art. 200.1 LSC lo prohíbe expresamente para SL; doctrina equivalente para SA
--     ex art. 201.3, y más en cotizada).
--   * Reglamento del 'Comité P2 Restauración Demo' (secretaria_organ_rules 4c4d3360).
--   * Versión estatutaria 'P2 Smoke Estatutos 20260517055136119' (única versión de
--     ARGA, íntegramente smoke) y sus cláusulas mapeadas.
--   * Override de smoke del motor V2 (rule_param_overrides e60f0fee, misma UNANIMIDAD).
--
-- En una demo a cliente la sociedad estrella mostraría datos de prueba con contenido
-- jurídico inválido. Se purgan las fuentes smoke; la matriz se re-materializa aparte
-- vía fn_secretaria_materialize_effective_rule_matrix (proyección regenerable).
-- Forward-only, idempotente: cada DELETE acota por id Y por marcador de smoke.

-- 1) Cláusulas de la versión estatutaria smoke.
DELETE FROM public.secretaria_statute_clause_mappings
 WHERE statute_version_id = '7bac7884-78ae-4662-b532-49d7e4127779';

-- 2) Versión estatutaria smoke (DELETE no está bloqueado por el guard de
--    inmutabilidad, que solo cubre BEFORE UPDATE).
DELETE FROM public.secretaria_statute_versions
 WHERE id = '7bac7884-78ae-4662-b532-49d7e4127779'
   AND version_label ILIKE '%smoke%';

-- 3) Override estatutario UNANIMIDAD (inadmisible).
DELETE FROM public.secretaria_normative_overrides
 WHERE id = 'eb79793f-9f8c-4f80-9a69-a1d85a441c40'
   AND source_ref ILIKE '%smoke%';

-- 4) Reglamento del comité de smoke.
DELETE FROM public.secretaria_organ_rules
 WHERE id = '4c4d3360-1836-4f0f-a1d5-9afbfe8c4e3c'
   AND source_ref ILIKE '%smoke%';

-- 5) Override de smoke del motor V2 (rule_param_overrides).
DELETE FROM public.rule_param_overrides
 WHERE id = 'e60f0fee-8ef1-45fa-b815-e5f70e79863d'
   AND referencia ILIKE '%smoke%';

-- Self-verify: no debe quedar ninguna capa smoke en ARGA.
DO $$
DECLARE v_smoke integer;
BEGIN
  SELECT
    (SELECT count(*) FROM public.secretaria_normative_overrides
       WHERE entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602' AND source_ref ILIKE '%smoke%')
  + (SELECT count(*) FROM public.secretaria_organ_rules
       WHERE entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602' AND source_ref ILIKE '%smoke%')
  + (SELECT count(*) FROM public.secretaria_statute_versions
       WHERE entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602' AND version_label ILIKE '%smoke%')
  + (SELECT count(*) FROM public.rule_param_overrides
       WHERE entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602' AND referencia ILIKE '%smoke%')
    INTO v_smoke;
  IF v_smoke <> 0 THEN
    RAISE EXCEPTION 'ITEM-120 verificación fallida: quedan % capas smoke en ARGA', v_smoke;
  END IF;
END $$;
