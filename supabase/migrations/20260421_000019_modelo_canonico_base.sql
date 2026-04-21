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
-- capital_holdings. The estado CHECK uses an inline named constraint so
-- a fresh database gets a stable name from the start; the ALTER block
-- below handles environments where the table was created before this
-- rename (the auto-named CHECK is dropped, then the named one re-added).
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
                                     CONSTRAINT chk_entity_capital_profile_estado
                                     CHECK (estado IN ('VIGENTE','HISTORICO')),
  effective_from         DATE        NOT NULL,
  effective_to           DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: enforces at most one VIGENTE row per entity at
-- the DB level. HISTORICO rows are unconstrained (no uniqueness), so
-- audit trails can hold multiple past states. NOTE: the predicate is
-- tied to the CHECK constraint vocabulary above — if a future migration
-- extends the estado set (e.g. add 'ANULADO' or 'BORRADOR'), revisit
-- whether those states should compete with VIGENTE for uniqueness or
-- stay unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS ux_entity_capital_vigente
  ON entity_capital_profile(entity_id)
  WHERE estado = 'VIGENTE';

-- Composite index for time-series lookups (entity timeline ordering).
CREATE INDEX IF NOT EXISTS idx_entity_capital_profile_entity
  ON entity_capital_profile(entity_id, effective_from);

-- Clean up the auto-named inline CHECK from a prior migration run (if
-- present), then add the explicitly named one so the final state has a
-- stable constraint name matching the T2 convention. Needed because
-- CREATE TABLE IF NOT EXISTS no-ops on existing tables — the rename
-- can't happen via the CREATE TABLE alone in already-migrated envs.
ALTER TABLE entity_capital_profile
  DROP CONSTRAINT IF EXISTS entity_capital_profile_estado_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_entity_capital_profile_estado'
  ) THEN
    ALTER TABLE entity_capital_profile
      ADD CONSTRAINT chk_entity_capital_profile_estado
      CHECK (estado IN ('VIGENTE','HISTORICO'));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- T4. share_classes — clases de acciones/participaciones por entidad
-- Each class carries voting weight (votes_per_title), economic weight
-- (economic_rights_coeff), and optional rights flags (voting, veto).
-- Later tasks (T6 capital_holdings, T8 parte_votante_current) reference
-- share_classes.id for weighted voting computations.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS share_classes (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID        NOT NULL,
  entity_id              UUID        NOT NULL REFERENCES entities(id) ON DELETE CASCADE, -- FK auto-named share_classes_entity_id_fkey
  class_code             TEXT        NOT NULL,
  name                   TEXT        NOT NULL,
  votes_per_title        NUMERIC     NOT NULL DEFAULT 1,
  economic_rights_coeff  NUMERIC     NOT NULL DEFAULT 1,
  voting_rights          BOOLEAN     NOT NULL DEFAULT true,
  veto_rights            BOOLEAN     NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uniqueness at the (entity_id, class_code) level — each entity defines
-- its own class vocabulary; same code in different entities is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS ux_share_class_entity_code
  ON share_classes(entity_id, class_code);

-- ---------------------------------------------------------------------
-- T5. condiciones_persona — rol de persona en sociedad/órgano
-- Single source of truth for "what is person X in entity Y (and possibly
-- body Z)". Covers SOCIO (no body_id — socio en sociedad) and consejero
-- roles (with body_id — miembro de un órgano). The tipo_condicion CHECK
-- partitions the vocabulary and the chk_condicion_body_coherente CHECK
-- enforces cross-column coherence (SOCIO/ADMIN_* demand body_id NULL;
-- CONSEJERO/PRESIDENTE/etc. demand body_id NOT NULL).
--
-- CA-4 correction: the VIGENTE uniqueness index uses COALESCE because
-- PostgreSQL treats NULLs as DISTINCT in unique indexes — without the
-- sentinel, two rows with body_id IS NULL for the same (person, entity,
-- tipo) pair would coexist, defeating the "single VIGENTE condición"
-- invariant for SOCIO and ADMIN_* roles.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS condiciones_persona (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID        NOT NULL,
  person_id                  UUID        NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  entity_id                  UUID        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  body_id                    UUID        NULL REFERENCES governing_bodies(id) ON DELETE CASCADE,
  tipo_condicion             TEXT        NOT NULL
                                         CONSTRAINT chk_condiciones_persona_tipo_condicion
                                         CHECK (tipo_condicion IN (
                                           'SOCIO',
                                           'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','ADMIN_PJ',
                                           'CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
                                         )),
  estado                     TEXT        NOT NULL DEFAULT 'VIGENTE'
                                         CONSTRAINT chk_condiciones_persona_estado
                                         CHECK (estado IN ('VIGENTE','CESADO')),
  fecha_inicio               DATE        NOT NULL,
  fecha_fin                  DATE,
  representative_person_id   UUID        REFERENCES persons(id),
  metadata                   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_condicion_body_coherente CHECK (
    (tipo_condicion IN ('SOCIO','ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','ADMIN_PJ')
      AND body_id IS NULL)
    OR
    (tipo_condicion IN ('CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','CONSEJERO_COORDINADOR')
      AND body_id IS NOT NULL)
  )
);

-- Clean up auto-named inline CHECKs from prior migration runs, then add
-- the explicitly named ones (same idempotency pattern as T2 chk_entities
-- and T3 chk_entity_capital_profile_estado). Needed because
-- CREATE TABLE IF NOT EXISTS no-ops on existing tables — the rename
-- can't happen via CREATE TABLE alone in already-migrated envs.
ALTER TABLE condiciones_persona
  DROP CONSTRAINT IF EXISTS condiciones_persona_tipo_condicion_check;

ALTER TABLE condiciones_persona
  DROP CONSTRAINT IF EXISTS condiciones_persona_estado_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_condiciones_persona_tipo_condicion'
  ) THEN
    ALTER TABLE condiciones_persona
      ADD CONSTRAINT chk_condiciones_persona_tipo_condicion
      CHECK (tipo_condicion IN (
        'SOCIO',
        'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','ADMIN_PJ',
        'CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_condiciones_persona_estado'
  ) THEN
    ALTER TABLE condiciones_persona
      ADD CONSTRAINT chk_condiciones_persona_estado
      CHECK (estado IN ('VIGENTE','CESADO'));
  END IF;
END $$;

-- CA-4: COALESCE sentinel index. PostgreSQL treats NULLs as DISTINCT in
-- unique indexes, so a naive UNIQUE(person_id, entity_id, body_id,
-- tipo_condicion) WHERE estado='VIGENTE' would accept two rows with
-- body_id IS NULL. COALESCE into the zero-UUID forces collision for
-- SOCIO/ADMIN_* (body_id NULL) while leaving CONSEJERO/etc. indexed on
-- their real body_id. The sentinel is a pure UUID value, not an FK
-- reference, so no governing_bodies row is required.
CREATE UNIQUE INDEX IF NOT EXISTS ux_condicion_vigente
  ON condiciones_persona(
    person_id,
    entity_id,
    COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid),
    tipo_condicion
  )
  WHERE estado = 'VIGENTE';

-- Lookup index for "¿quiénes componen este órgano?" queries. Differs
-- from ux_condicion_vigente in column order (entity_id first, body_id
-- second, no person_id/tipo_condicion) and purpose (non-unique scan
-- support vs. uniqueness enforcement), so not redundant.
CREATE INDEX IF NOT EXISTS idx_condiciones_persona_entity_body
  ON condiciones_persona(entity_id, body_id) WHERE estado = 'VIGENTE';

-- ---------------------------------------------------------------------
-- T6. capital_holdings — libro de socios
-- Records who holds how many titles of which share class in which
-- entity, valid between effective_from and effective_to. The share
-- class link (share_class_id) is optional: early-stage entities that
-- haven't declared classes yet (T4) can still have holdings, and
-- NULL means "single implicit class" semantically. voting_rights on
-- the holding row overrides the share_class default (honoring shares
-- without voting rights, usufruct splits, etc.). is_treasury flags
-- autocartera so the rules engine can deduct those titles from the
-- voting base per LSC art. 148.
--
-- Two inline CHECK constraints (numero_titulos >= 0 and porcentaje in
-- [0,100]) are named explicitly via the same DROP+DO-block pattern as
-- T3/T5 so tests can regex-match on stable constraint names.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS capital_holdings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL,
  entity_id           UUID        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  holder_person_id    UUID        NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  share_class_id      UUID        NULL REFERENCES share_classes(id),
  numero_titulos      NUMERIC     NOT NULL CHECK (numero_titulos >= 0),
  porcentaje_capital  NUMERIC     CHECK (
    porcentaje_capital IS NULL OR (porcentaje_capital >= 0 AND porcentaje_capital <= 100)
  ),
  voting_rights       BOOLEAN     NOT NULL DEFAULT true,
  is_treasury         BOOLEAN     NOT NULL DEFAULT false,
  effective_from      DATE        NOT NULL,
  effective_to        DATE,
  metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clean up auto-named inline CHECKs from prior migration runs, then add
-- the explicitly named ones. Same idempotency pattern as T3/T5: needed
-- because CREATE TABLE IF NOT EXISTS no-ops on existing tables, so
-- already-migrated envs wouldn't otherwise pick up the rename.
ALTER TABLE capital_holdings
  DROP CONSTRAINT IF EXISTS capital_holdings_numero_titulos_check;

ALTER TABLE capital_holdings
  DROP CONSTRAINT IF EXISTS capital_holdings_porcentaje_capital_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_capital_holdings_numero_titulos'
  ) THEN
    ALTER TABLE capital_holdings
      ADD CONSTRAINT chk_capital_holdings_numero_titulos
      CHECK (numero_titulos >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_capital_holdings_porcentaje_capital'
  ) THEN
    ALTER TABLE capital_holdings
      ADD CONSTRAINT chk_capital_holdings_porcentaje_capital
      CHECK (
        porcentaje_capital IS NULL
        OR (porcentaje_capital >= 0 AND porcentaje_capital <= 100)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Temporal validity invariant: effective_to must be NULL or >= effective_from
-- (Added in T6 hardening: code review flagged the missing invariant.
-- Without it, inverted intervals would silently corrupt historical queries.)
-- ---------------------------------------------------------------------
ALTER TABLE capital_holdings
  DROP CONSTRAINT IF EXISTS chk_capital_holdings_effective_interval;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_capital_holdings_effective_interval'
      AND conrelid = 'capital_holdings'::regclass
  ) THEN
    ALTER TABLE capital_holdings
      ADD CONSTRAINT chk_capital_holdings_effective_interval
      CHECK (effective_to IS NULL OR effective_to >= effective_from);
  END IF;
END $$;

-- Three indexes, each doing distinct work (verified non-redundant):
--  - idx_capital_holdings_entity (entity_id, effective_to): composite
--    for historical timeline queries ("all holdings past+current for X,
--    ordered by effective_to").
--  - idx_capital_holdings_holder (holder_person_id): different leading
--    column, answers "what does person X hold?" across entities.
--  - idx_capital_holdings_entity_vigente (entity_id) WHERE effective_to
--    IS NULL: partial on ACTIVE rows only, hot path for the current
--    shareholder book. Smaller than the composite → faster scans. The
--    composite cannot fully substitute because the partial predicate
--    makes the index dramatically narrower in practice.
CREATE INDEX IF NOT EXISTS idx_capital_holdings_entity
  ON capital_holdings(entity_id, effective_to);

CREATE INDEX IF NOT EXISTS idx_capital_holdings_holder
  ON capital_holdings(holder_person_id);

CREATE INDEX IF NOT EXISTS idx_capital_holdings_entity_vigente
  ON capital_holdings(entity_id) WHERE effective_to IS NULL;

-- COALESCE partial unique: prevents two VIGENTE holdings of the same
-- (entity, holder, share_class). share_class_id is nullable, so we use
-- the T5-style sentinel to make NULLs collide.
-- Without this, fn_refresh_parte_votante_entity (T10) would double-count
-- a holder with two VIGENTE rows of the same class.
CREATE UNIQUE INDEX IF NOT EXISTS ux_capital_holdings_vigente
  ON capital_holdings(
    entity_id,
    holder_person_id,
    COALESCE(share_class_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE effective_to IS NULL;

COMMIT;
