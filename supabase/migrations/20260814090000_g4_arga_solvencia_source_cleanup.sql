-- supabase/migrations/20260814090000_g4_arga_solvencia_source_cleanup.sql
-- G4 Task 7 (round 2) — mismo defecto de catálogo corregido en el bloque
-- PBC/FT de Garrigues (Task 4): el artículo metido dentro de `source` en vez
-- de en `legal_reference`. La fila OBL-ORSA-001 de ARGA tenía
-- "Solvencia II, art. 45 Directiva 2009/138/CE" en `source`; el artículo no
-- vivía en `legal_reference` (columna añadida en 20260813120000, NULL en
-- ARGA hasta ahora). Se normaliza a la vez 'SolvenciaII' (sin espacio,
-- OBL-SII-001) a 'Solvencia II' para que ambas filas caigan en la misma
-- sección de /obligaciones, que agrupa por `source` exacto.
--
-- NO cambia el número de obligaciones, criticidad ni controles de ninguna
-- fila — solo `source`/`legal_reference` de las 2 filas Solvencia de ARGA.
-- Garrigues (`…0002`) no tiene ninguna fila con estos `source`: 0 filas
-- afectadas ahí.
--
-- Forward-only. Acotado por tenant_id + valor exacto de `source`:
-- idempotente (tras la primera ejecución ningún UPDATE encuentra ya el
-- valor antiguo, así que re-ejecutar no hace daño).

BEGIN;

UPDATE public.obligations
SET
  source = 'Solvencia II',
  legal_reference = 'Directiva 2009/138/CE, art. 45'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND source = 'Solvencia II, art. 45 Directiva 2009/138/CE';

UPDATE public.obligations
SET source = 'Solvencia II'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND source = 'SolvenciaII';

COMMIT;
