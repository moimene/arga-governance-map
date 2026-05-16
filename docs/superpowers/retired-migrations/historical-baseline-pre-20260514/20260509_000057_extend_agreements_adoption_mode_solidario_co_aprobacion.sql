-- ============================================================
-- 000057 — Extend agreements.adoption_mode CHECK constraint
-- ============================================================
--
-- B1 v3 (commit 5d8f7a9, 2026-05-09) descubrió contra Cloud que
-- agreements.adoption_mode CHECK constraint NO aceptaba 'SOLIDARIO' ni
-- 'CO_APROBACION', pese a que:
--
--   - Sprint G amplió `AdoptionMode` en src/lib/rules-engine/types.ts:
--       export type AdoptionMode = '...' | 'SOLIDARIO' | 'CO_APROBACION';
--   - `evaluarSolidario()` y `evaluarCoAprobacion()` existen en
--     src/lib/rules-engine/votacion-engine.ts
--   - `SolidarioStepper.tsx` y `CoAprobacionStepper.tsx` insertan en
--     agreements con esos adoption_mode
--
-- Sin esta migración, los flujos UI de admin solidarios/mancomunados
-- rompen contra BD con `agreements_adoption_mode_check` violation.
--
-- Aplicada en Cloud governance_OS via MCP apply_migration el 2026-05-09.
-- Esta versión .sql persiste la migración para otros entornos (CI,
-- nuevos clones del schema).
--
-- Reversible: la migración inversa restaura los 5 valores previos.
-- ============================================================

ALTER TABLE agreements DROP CONSTRAINT IF EXISTS agreements_adoption_mode_check;

ALTER TABLE agreements ADD CONSTRAINT agreements_adoption_mode_check
  CHECK (adoption_mode IN (
    'MEETING',
    'UNIVERSAL',
    'NO_SESSION',
    'UNIPERSONAL_SOCIO',
    'UNIPERSONAL_ADMIN',
    'SOLIDARIO',
    'CO_APROBACION'
  ));

COMMENT ON CONSTRAINT agreements_adoption_mode_check ON agreements IS
  'Enumeración alineada con AdoptionMode del motor V2 (Sprint G). Permite todos los modes: MEETING, UNIVERSAL, NO_SESSION, UNIPERSONAL_SOCIO, UNIPERSONAL_ADMIN, SOLIDARIO, CO_APROBACION.';
