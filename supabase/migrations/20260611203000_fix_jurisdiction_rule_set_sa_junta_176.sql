-- ITEM-033 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- El rule set ES+SA+JUNTA_GENERAL (fila legacy 47448c9d, sin nombre ni
-- legal_reference) declaraba notice_min_days_first_call=15, contrario al art.
-- 176.1 LSC (un mes para la junta de SA; 15 días solo cabría vía art. 515 LSC
-- para JGE de cotizada con voto electrónico y acuerdo previo de JGO por 2/3 —
-- condiciones aquí ausentes y sin anotar). Esa fila legacy además bloqueó,
-- vía el guard WHERE NOT EXISTS, el seed correcto posterior.
-- Corrección factual contrastada con BOE (re-triada de BLOQUEADO-LEGAL: no es
-- redacción legal nueva). El stepper, en el mismo commit, pasa a seleccionar
-- el rule set por typology_code coherente con el órgano convocado.

UPDATE jurisdiction_rule_sets
   SET rule_config = jsonb_set(rule_config, '{notice_min_days_first_call}', '30'::jsonb),
       name = COALESCE(name, 'España SA — Junta General'),
       legal_reference = COALESCE(legal_reference, 'RD Leg. 1/2010 (LSC) — art. 176.1 (un mes; cómputo de fecha a fecha)')
 WHERE id = '47448c9d-b477-42a2-8055-a47d766a7bd2'
   AND jurisdiction = 'ES'
   AND company_form = 'SA'
   AND typology_code = 'JUNTA_GENERAL'
   AND rule_config->>'notice_min_days_first_call' = '15';
