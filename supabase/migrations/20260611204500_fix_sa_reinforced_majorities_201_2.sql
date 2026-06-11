-- ITEM-008/013 (+007 data) [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- Corrección factual de payloads de mayoría contrastada con BOE (re-triada de
-- BLOQUEADO-LEGAL: los packs citaban artículos de quórum o codificaban
-- fórmulas que contradicen el artículo aplicable):
--   * Art. 201.2 LSC (texto post-Ley 31/2014): con capital presente >50%
--     basta MAYORÍA ABSOLUTA; los dos tercios (del CAPITAL PRESENTE, no de
--     los emitidos) solo se exigen en 2ª convocatoria con concurrencia
--     [25%, 50%). Los packs reforzados SA codificaban un 2/3 de emitidos
--     PLANO (sobre-restrictivo con >50% de concurrencia e infra-restrictivo
--     con abstenciones en el tramo 25-50%), tres de ellos citando además el
--     art. 194.1 (que regula el QUÓRUM, no la mayoría).
--   * RETRIBUCION_ADMIN SL codificaba 'Mayoría simple' sin el suelo de 1/3
--     del art. 198 LSC (el evaluador implementa la doble condición desde
--     este mismo commit).
-- La fórmula 'reforzada art. 201.2 lsc' del evaluador implementa la
-- estructura correcta de dos tramos. Scoped por id + guard de fórmula previa.

-- 3 packs con 'favor >= 2/3_emitidos' citando art. 194.1:
UPDATE rule_pack_versions
   SET payload = jsonb_set(payload, '{votacion,mayoria,SA}', jsonb_build_object(
     'fuente', 'LEY',
     'formula', 'reforzada art. 201.2 LSC',
     'referencia', 'art. 201.2 LSC — mayoría absoluta si concurre >50%; 2/3 del capital presente en el tramo 25-50%'
   ))
 WHERE id IN (
   '64f4de9c-bb3f-47db-8f79-87bd49b694ed',  -- AUMENTO_CAPITAL
   '966d65d0-4b83-4773-9101-4e8b5fe7dbf3',  -- MODIFICACION_ESTATUTOS
   '99c1196a-babc-4249-ac55-86af43a02516'   -- REDUCCION_CAPITAL
 )
   AND payload->'votacion'->'mayoria'->'SA'->>'formula' = 'favor >= 2/3_emitidos';

-- 6 packs estructurales con '>= 2/3 emitidos SIEMPRE':
UPDATE rule_pack_versions
   SET payload = jsonb_set(payload, '{votacion,mayoria,SA}', jsonb_build_object(
     'fuente', 'LEY',
     'formula', 'reforzada art. 201.2 LSC',
     'referencia', 'art. 201.2 LSC — mayoría absoluta si concurre >50%; 2/3 del capital presente en el tramo 25-50%'
   ))
 WHERE id IN (
   'ce5d8a12-9655-4b96-88e8-35dccde6dc29',  -- CESION_GLOBAL_ACTIVO
   'cf2f5a40-e47c-48e8-9a0f-1bddfb65da7e',  -- DISOLUCION
   '77177821-9ed8-49bf-b7a1-087939530639',  -- ESCISION
   'f274e1db-3a26-485b-b3a7-20fd0a2a0fb7',  -- FUSION
   'a2f842ae-ba87-4293-9742-bd3ba95ad5b7',  -- SUPRESION_PREFERENTE
   '2794af7f-acec-43f7-a086-bea253513367'   -- TRANSFORMACION
 )
   AND payload->'votacion'->'mayoria'->'SA'->>'formula' = '>= 2/3 emitidos SIEMPRE';

-- RETRIBUCION_ADMIN SL → art. 198 (doble condición implementada en el evaluador):
UPDATE rule_pack_versions
   SET payload = jsonb_set(payload, '{votacion,mayoria,SL}', jsonb_build_object(
     'fuente', 'LEY',
     'formula', 'favor > 1/3_capital_total_con_voto',
     'referencia', 'art. 198 LSC — mayoría de votos emitidos con suelo de 1/3 del capital'
   ))
 WHERE id = '29cb30ef-a4e9-4b32-8031-63a35f87ea19'
   AND payload->'votacion'->'mayoria'->'SL'->>'formula' IN ('Mayoría simple', 'Mayoria simple');
