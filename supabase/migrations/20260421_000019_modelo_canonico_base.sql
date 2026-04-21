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
-- Column + CHECK are separated so the constraint has an explicit stable
-- name (chk_entities_tipo_organo_admin) and gets an idempotency guard
-- matching the FK pattern above. Inline CHECK would rely on the PG auto
-- name (entities_tipo_organo_admin_check), which is not contractually
-- stable and wouldn't be re-added if later dropped while the column
-- already exists.
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS tipo_organo_admin TEXT;

-- Clean up the auto-named inline CHECK from the previous migration run
-- (if present), so the final state has exactly one CHECK constraint with
-- an explicit stable name.
ALTER TABLE entities
  DROP CONSTRAINT IF EXISTS entities_tipo_organo_admin_check;

-- Add the explicitly named CHECK, guarded so migration is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_entities_tipo_organo_admin'
  ) THEN
    ALTER TABLE entities
      ADD CONSTRAINT chk_entities_tipo_organo_admin
      CHECK (tipo_organo_admin IN (
        'ADMIN_UNICO',
        'ADMIN_SOLIDARIOS',
        'ADMIN_MANCOMUNADOS',
        'CDA'
      ));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- T3. entity_capital_profile — capital social histórico
-- One entity has zero-or-one VIGENTE row (enforced by partial unique index)
-- plus zero-or-more HISTORICO rows for audit/retrospection. Phase 1
-- (T6+) will reference the VIGENTE row via share_classes and
-- capital_holdings. CHECK is inline (no DO $$ guard needed) because
-- CREATE TABLE IF NOT EXISTS is atomic — either the table exists with
-- all constraints or it does not.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entity_capital_profile (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID        NOT NULL,
  entity_id              UUID        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  currency               TEXT        NOT NULL DEFAULT 'EUR',
  capital_escriturado    NUMERIC     NOT NULL,
  capital_desembolsado   NUMERIC,
  numero_titulos         NUMERIC,
  valor_nominal          NUMERIC,
  estado                 TEXT        NOT NULL DEFAULT 'VIGENTE'
                                     CHECK (estado IN ('VIGENTE','HISTORICO')),
  effective_from         DATE        NOT NULL,
  effective_to           DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: enforces at most one VIGENTE row per entity at
-- the DB level. HISTORICO rows are unconstrained (no uniqueness), so
-- audit trails can hold multiple past states.
CREATE UNIQUE INDEX IF NOT EXISTS ux_entity_capital_vigente
  ON entity_capital_profile(entity_id)
  WHERE estado = 'VIGENTE';

-- Composite index for time-series lookups (entity timeline ordering).
CREATE INDEX IF NOT EXISTS idx_entity_capital_profile_entity
  ON entity_capital_profile(entity_id, effective_from);

COMMIT;
