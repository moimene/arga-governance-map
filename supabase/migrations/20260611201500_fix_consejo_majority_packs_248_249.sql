-- ITEM-009/010/036 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- Corrección factual de dos payloads de rule pack contrastada con BOE (no es
-- redacción legal nueva: los packs citaban la norma equivocada o una fórmula
-- que contradice su propia base legal):
--   1. DELEGACION_FACULTADES (CONSEJO): exigía 'favor > total_miembros / 2'
--      citando el art. 247.2 (que es el QUÓRUM del consejo de la SA). La
--      delegación permanente de facultades exige "el voto favorable de las
--      dos terceras partes de los componentes del consejo" (art. 249.3 LSC).
--   2. FORMULACION_CUENTAS (CONSEJO): 'Mayoría' canonicalizaba a mayoría
--      simple (favor > contra), infra-restrictivo frente a la mayoría
--      absoluta de los consejeros CONCURRENTES del art. 248.1 LSC.
-- El evaluador soporta ambas fórmulas desde este mismo commit
-- ('favor >= 2/3_total_miembros' y 'favor > presentes_mitad' → concurrentes).
-- Forward-only sobre las versiones ACTIVAS (ids verificados en Cloud).

UPDATE rule_pack_versions
   SET payload = jsonb_set(
     payload,
     '{votacion,mayoria,CONSEJO}',
     jsonb_build_object(
       'fuente', 'LEY',
       'formula', 'favor >= 2/3_total_miembros',
       'referencia', 'art. 249.3 LSC — dos terceras partes de los componentes del consejo'
     )
   )
 WHERE id = '36a3b08c-c05e-4f4b-846a-2985656d8c43'
   AND payload->'votacion'->'mayoria'->'CONSEJO'->>'formula' = 'favor > total_miembros / 2';

UPDATE rule_pack_versions
   SET payload = jsonb_set(
     payload,
     '{votacion,mayoria,CONSEJO}',
     jsonb_build_object(
       'fuente', 'LEY',
       'formula', 'favor > presentes_mitad',
       'referencia', 'art. 248.1 LSC — mayoría absoluta de los consejeros concurrentes'
     )
   )
 WHERE id = '5a43f95d-0589-4888-afdf-147405e0b44e'
   AND payload->'votacion'->'mayoria'->'CONSEJO'->>'formula' = 'Mayoría';
