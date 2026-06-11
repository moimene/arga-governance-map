-- ITEM-012 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- Corrección factual contrastada con BOE (re-triada de BLOQUEADO-LEGAL):
-- la LSC NO establece quórum de constitución para la junta de la SL (el
-- control es la mayoría sobre votos totales de los arts. 198-199). Once packs
-- activos codificaban constitucion.quorum.SL = 50 citando los arts. 196/197
-- LSC — que regulan el DERECHO DE INFORMACIÓN (SL y SA respectivamente), no
-- ningún quórum. constitucion-engine toma el quórum del pack si es mayor que
-- el legal: una junta SL con el 40% del capital presente quedaba BLOQUEADA
-- aunque pudiera adoptar válidamente acuerdos ex art. 198.
-- Además, dos packs citaban el art. 190 (conflictos de interés) como fuente
-- del quórum SA del 25% (es el art. 193.1).
-- Scoped por id + guard del valor previo.

UPDATE rule_pack_versions
   SET payload = jsonb_set(payload, '{constitucion,quorum,SL}', jsonb_build_object(
     'valor', 0,
     'fuente', 'LEY',
     'referencia', 'Sin quórum legal de constitución en la junta de SL — el control es la mayoría con suelo de los arts. 198-199 LSC'
   ))
 WHERE id IN (
   '7f6827ab-b408-4543-9eaa-08bb0e97a375',  -- APLICACION_RESULTADO
   '4abb47ee-9eda-4d24-937a-f98f0bcdbbad',  -- AUMENTO_CAPITAL_NO_DINERARIO
   'ce5d8a12-9655-4b96-88e8-35dccde6dc29',  -- CESION_GLOBAL_ACTIVO
   'cf2f5a40-e47c-48e8-9a0f-1bddfb65da7e',  -- DISOLUCION
   '5951215d-cbe1-46c8-b553-26e511f0d3ac',  -- EMISION_OBLIGACIONES
   '77177821-9ed8-49bf-b7a1-087939530639',  -- ESCISION
   'f274e1db-3a26-485b-b3a7-20fd0a2a0fb7',  -- FUSION
   'd8ac0b64-d438-48d2-b688-13b601902f5b',  -- MOD_ESTATUTOS
   '29cb30ef-a4e9-4b32-8031-63a35f87ea19',  -- RETRIBUCION_ADMIN
   'a2f842ae-ba87-4293-9742-bd3ba95ad5b7',  -- SUPRESION_PREFERENTE
   '2794af7f-acec-43f7-a086-bea253513367'   -- TRANSFORMACION
 )
   AND payload->'constitucion'->'quorum'->'SL'->>'valor' = '50';

-- Citas 190 → 193.1 en el quórum SA de las dos materias ordinarias:
UPDATE rule_pack_versions
   SET payload = jsonb_set(payload, '{constitucion,quorum,SA_1a,fuente}', '"LEY"'::jsonb)
 WHERE id IN ('7f6827ab-b408-4543-9eaa-08bb0e97a375', '29cb30ef-a4e9-4b32-8031-63a35f87ea19')
   AND payload->'constitucion'->'quorum'->'SA_1a'->>'fuente' = 'art. 190 LSC';

UPDATE rule_pack_versions
   SET payload = jsonb_set(payload, '{constitucion,quorum,SA_1a,referencia}',
     '"art. 193.1 LSC — quórum del 25% en primera convocatoria"'::jsonb)
 WHERE id IN ('7f6827ab-b408-4543-9eaa-08bb0e97a375', '29cb30ef-a4e9-4b32-8031-63a35f87ea19')
   AND payload->'constitucion'->'quorum'->'SA_1a'->>'fuente' = 'LEY'
   AND (payload->'constitucion'->'quorum'->'SA_1a'->>'referencia') IS NULL;
