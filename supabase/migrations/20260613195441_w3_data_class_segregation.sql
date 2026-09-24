-- W3 — segregación de datos por data_class (2026-06-13).
-- ============================================================================
-- Los informes (G3d) piden separar datos demo / test / pre / prod sin depender
-- de la memoria del usuario. Se añade `data_class` a entities y persons (default
-- DEMO en este tenant demo) y se marcan como TEST los artefactos de E2E/pruebas
-- (PHASE-B*, 'Arga test A', 'PRUEBA', 'SEGUROS TEST'; personas con tax_id E2E-/
-- QA-/PHASE-B-). Los NIF 'PENDIENTE-' se dejan en DEMO (datos demo incompletos a
-- depurar, no artefactos de test). En un tenant productivo el default sería
-- PRODUCTION; aquí el entorno es demo/dev. Forward-only, idempotente.

ALTER TABLE entities ADD COLUMN IF NOT EXISTS data_class text NOT NULL DEFAULT 'DEMO';
ALTER TABLE persons  ADD COLUMN IF NOT EXISTS data_class text NOT NULL DEFAULT 'DEMO';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='entities_data_class_check') THEN
    ALTER TABLE entities ADD CONSTRAINT entities_data_class_check
      CHECK (data_class IN ('DEMO','TEST','PRE_RELEASE','PRODUCTION'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='persons_data_class_check') THEN
    ALTER TABLE persons ADD CONSTRAINT persons_data_class_check
      CHECK (data_class IN ('DEMO','TEST','PRE_RELEASE','PRODUCTION'));
  END IF;
END $$;

UPDATE entities SET data_class='TEST'
 WHERE data_class <> 'TEST' AND (
   common_name ILIKE 'PHASE-B%'
   OR common_name ILIKE '%arga test%'
   OR common_name IN ('PRUEBA','SEGUROS TEST')
 );

UPDATE persons SET data_class='TEST'
 WHERE data_class <> 'TEST' AND (
   tax_id ILIKE 'E2E-%' OR tax_id ILIKE 'QA-%' OR tax_id ILIKE 'PHASE-B%'
 );
