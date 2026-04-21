-- supabase/migrations/20260421_000019_modelo_canonico_base.sql
-- =====================================================================
-- Fase 0 — Modelo canónico de identidad
-- Spec: docs/superpowers/specs/2026-04-21-modelo-canonico-identidad-design.md
-- This migration grows across Tasks T2..T12 of the Phase 0+1 plan.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- T2. Modificaciones a entities
-- Adds person_id link to persons (identity bridge: a sociedad IS a
-- persona jurídica) and the typed enum tipo_organo_admin used by the
-- rules engine. forma_administracion (free-text legacy) is preserved
-- intentionally — the two columns are complementary, not redundant.
-- ---------------------------------------------------------------------

-- person_id column (nullable — entities without a persons row allowed
-- during rollout, tightened in later tasks / Task 14 bootstrap)
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS person_id UUID;

-- FK to persons(id), DEFERRABLE so multi-row transactional bootstrap
-- (entity + persons row in same tx) can order inserts freely.
-- Guarded because ADD CONSTRAINT is NOT idempotent (re-running this
-- migration would otherwise fail with "already exists").
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_entities_person_id'
  ) THEN
    ALTER TABLE entities
      ADD CONSTRAINT fk_entities_person_id
      FOREIGN KEY (person_id) REFERENCES persons(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- Unique index (partial — allows many NULLs; forbids two entities
-- sharing the same persons(id))
CREATE UNIQUE INDEX IF NOT EXISTS ux_entities_person_id
  ON entities(person_id) WHERE person_id IS NOT NULL;

-- tipo_organo_admin typed enum used by the rules engine to decide
-- administrator regime (distinct from free-text forma_administracion).
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS tipo_organo_admin TEXT
  CHECK (tipo_organo_admin IN (
    'ADMIN_UNICO',
    'ADMIN_SOLIDARIOS',
    'ADMIN_MANCOMUNADOS',
    'CDA'
  ));

COMMIT;
