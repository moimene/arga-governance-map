-- ITEM-014 — Corrección legal: la autorización de la Junta General para la
-- transmisión voluntaria de participaciones de una SL se adopta por MAYORÍA
-- ORDINARIA del art. 198 LSC, no por la reforzada del art. 199.a.
--
-- BOE (art. 107.2.b LSC, verbatim): «La transmisión quedará sometida al
-- consentimiento de la sociedad, que se expresará mediante acuerdo de la Junta
-- General, previa inclusión del asunto en el orden del día, adoptado por la
-- mayoría ordinaria establecida por la ley.»
--
-- El seed (20260518070443) marcaba esta materia como REFORZADA_1_2 / fórmula
-- "favor > 1/2_capital_total_con_voto" (art. 199.a), sobre-restringiendo la
-- adopción. Se corrige a la mayoría ordinaria (art. 198): "favor >
-- 1/3_capital_total_con_voto" (el evaluador implementa el doble requisito del
-- 198: mayoría de votos válidos + suelo de 1/3 del capital).
-- Forward-only, idempotente (WHERE acota al valor erróneo).

UPDATE public.materia_catalog
SET min_majority_code = 'SIMPLE',
    referencia_legal  = 'art. 107.2 LSC (mayoria ordinaria, art. 198 LSC)'
WHERE materia = 'TRANSMISION_PARTICIPACIONES'
  AND min_majority_code = 'REFORZADA_1_2';

UPDATE public.rule_pack_versions
SET payload = jsonb_set(
      payload,
      '{votacion,mayoria,SL}',
      '{"fuente":"LEY","formula":"favor > 1/3_capital_total_con_voto","referencia":"art. 107.2 LSC (mayoria ordinaria art. 198)"}'::jsonb,
      false
    )
WHERE pack_id = 'TRANSMISION_PARTICIPACIONES'
  AND payload #>> '{votacion,mayoria,SL,formula}' = 'favor > 1/2_capital_total_con_voto';
