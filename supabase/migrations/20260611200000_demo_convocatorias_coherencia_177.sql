-- ITEM-034 (datos demo) — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- Coherencia de datos demo con el art. 177 LSC y con el sello de
-- inmutabilidad introducido en 20260611192500:
--   1. La convocatoria seed 3a829751 tenía un gap de 2 horas entre 1ª y 2ª
--      convocatoria; el art. 177.2 LSC exige al menos 24 horas.
--   2. Las convocatorias seed en estado CELEBRADA no pasaron por EMITIDA en
--      su ciclo de seed y quedaron sin sello: se sellan con su
--      updated_at/created_at (ya fueron comunicadas y celebradas).

UPDATE public.convocatorias
   SET fecha_2 = fecha_1 + interval '24 hours'
 WHERE id = '3a829751-70d0-4a01-b858-7ce8c5950f10'
   AND fecha_1 IS NOT NULL
   AND fecha_2 IS NOT NULL
   AND fecha_2 < fecha_1 + interval '24 hours';

UPDATE public.convocatorias
   SET immutable_at = COALESCE(updated_at, created_at)
 WHERE estado = 'CELEBRADA'
   AND immutable_at IS NULL;
