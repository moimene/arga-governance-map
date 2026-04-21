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

-- ---------------------------------------------------------------------
-- T7. representaciones — PJ permanente + proxy junta + delegación consejo
-- Three distinct representation scopes rolled into one table because the
-- data model is identical (represented → representative with validity
-- interval + evidence) while the business semantics diverge:
--   - ADMIN_PJ_REPRESENTANTE: persistent (LSC art. 212 bis) — the natural
--     person who exercises the administrator role on behalf of a persona
--     jurídica administrador. No meeting scope.
--   - JUNTA_PROXY: per-meeting proxy (LSC arts. 184–187) — a shareholder
--     delegates voting power to another person for a specific junta.
--   - CONSEJO_DELEGACION: per-session delegation (LSC arts. 248–249) — a
--     consejero delegates their vote on a specific sesión de CdA.
-- chk_representacion_scope_meeting enforces the meeting_id coherence:
-- ADMIN_PJ_REPRESENTANTE must have meeting_id NULL (it's persistent);
-- JUNTA_PROXY and CONSEJO_DELEGACION must have meeting_id NOT NULL.
-- meeting_id intentionally has NO FK — how meetings integrate is future
-- work (T8+ and agreements aggregation already cover meeting linkage
-- elsewhere). The CHECK alone guarantees the NULL-vs-NOT-NULL invariant
-- T7 needs.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS representaciones (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL,
  entity_id                 UUID        NOT NULL REFERENCES entities(id),
  represented_person_id     UUID        NOT NULL REFERENCES persons(id),
  representative_person_id  UUID        NOT NULL REFERENCES persons(id),
  scope                     TEXT        NOT NULL,
  meeting_id                UUID,
  porcentaje_delegado       NUMERIC     DEFAULT 100,
  effective_from            DATE        NOT NULL,
  effective_to              DATE,
  evidence                  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clean up any auto-named inline CHECKs from prior migration runs, then
-- add explicitly named ones via DO-block idempotency guards. Matches the
-- T3/T5/T6 convention: named constraints are stable across rebuilds so
-- tests can regex-match on constraint names without surprise. The scope
-- CHECK and porcentaje CHECK are straightforward; chk_representacion_
-- scope_meeting is the cross-column coherence guard wrapped in the same
-- pattern so it too can be safely re-added if ever amended.
ALTER TABLE representaciones
  DROP CONSTRAINT IF EXISTS representaciones_scope_check;

ALTER TABLE representaciones
  DROP CONSTRAINT IF EXISTS representaciones_porcentaje_delegado_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_representacion_scope_enum'
      AND conrelid = 'representaciones'::regclass
  ) THEN
    ALTER TABLE representaciones
      ADD CONSTRAINT chk_representacion_scope_enum
      CHECK (scope IN (
        'ADMIN_PJ_REPRESENTANTE',
        'JUNTA_PROXY',
        'CONSEJO_DELEGACION'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_representacion_porcentaje_delegado'
      AND conrelid = 'representaciones'::regclass
  ) THEN
    ALTER TABLE representaciones
      ADD CONSTRAINT chk_representacion_porcentaje_delegado
      CHECK (porcentaje_delegado >= 0 AND porcentaje_delegado <= 100);
  END IF;
END $$;

-- Cross-column coherence: meeting_id must be NULL for the persistent
-- ADMIN_PJ_REPRESENTANTE scope and NOT NULL for the per-meeting
-- JUNTA_PROXY and CONSEJO_DELEGACION scopes. Wrapped in the DROP+DO-block
-- pattern (same as chk_capital_holdings_effective_interval in T6) so
-- future migrations can safely amend the rule without leaving orphan
-- constraints around.
ALTER TABLE representaciones
  DROP CONSTRAINT IF EXISTS chk_representacion_scope_meeting;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_representacion_scope_meeting'
      AND conrelid = 'representaciones'::regclass
  ) THEN
    ALTER TABLE representaciones
      ADD CONSTRAINT chk_representacion_scope_meeting
      CHECK (
        (scope = 'ADMIN_PJ_REPRESENTANTE' AND meeting_id IS NULL)
        OR
        (scope IN ('JUNTA_PROXY','CONSEJO_DELEGACION') AND meeting_id IS NOT NULL)
      );
  END IF;
END $$;

-- Partial index on ACTIVE representations for the hot path
-- "¿quién me representa / a quién represento?" — effective_to IS NULL
-- filters out historical records keeping the index narrow and scan-fast.
CREATE INDEX IF NOT EXISTS idx_representaciones_represented
  ON representaciones(represented_person_id, entity_id) WHERE effective_to IS NULL;

-- ---------------------------------------------------------------------
-- Temporal validity invariant: effective_to must be NULL or >= effective_from
-- (Added in T7 hardening: code review flagged the missing invariant — same
-- pattern as T6's chk_capital_holdings_effective_interval. Without it,
-- inverted intervals would silently corrupt "currently representing?"
-- queries read by fn_refresh_parte_votante and by the rules engine.)
-- ---------------------------------------------------------------------
ALTER TABLE representaciones
  DROP CONSTRAINT IF EXISTS chk_representacion_effective_interval;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_representacion_effective_interval'
      AND conrelid = 'representaciones'::regclass
  ) THEN
    ALTER TABLE representaciones
      ADD CONSTRAINT chk_representacion_effective_interval
      CHECK (effective_to IS NULL OR effective_to >= effective_from);
  END IF;
END $$;

-- COALESCE partial unique on ACTIVE representations: prevents two VIGENTE
-- rows for the same (entity, represented_person, scope, meeting_id) tuple.
-- Without this, fn_refresh_parte_votante (T10) would double-count proxy /
-- delegation votes. meeting_id is nullable (ADMIN_PJ_REPRESENTANTE has no
-- meeting scope) so we use the T5/T6-style zero-UUID sentinel to make two
-- NULL-meeting_id rows collide under the same scope. scope is part of the
-- key because a represented person MAY legitimately hold both an
-- ADMIN_PJ_REPRESENTANTE (persistent) AND a one-off JUNTA_PROXY for a
-- specific meeting — different scopes must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS ux_representaciones_vigente
  ON representaciones(
    entity_id,
    represented_person_id,
    scope,
    COALESCE(meeting_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE effective_to IS NULL;

-- ---------------------------------------------------------------------
-- T8. parte_votante_current — proyección regenerable de la base votante
-- Holds the CURRENT voting base per (entity, body), derived from two
-- source vocabularies via source_type:
--   - 'CAPITAL': rows derived from capital_holdings (junta-level voters).
--   - 'CARGO':   rows derived from condiciones_persona cargos (consejo-
--                level voters).
-- source_id is a polymorphic pointer — intentionally NO FK (C9) because
-- the target differs by source_type; T10's fn_refresh_parte_votante_entity
-- / _body is responsible for referential integrity.
-- body_id is nullable (C8): junta-level shareholders have body_id NULL
-- (the entire shareholder base acts as the "body"); consejo-level members
-- have body_id set to the specific governing_bodies row.
-- Two weights separate voting from quorum accounting:
--   - voting_weight:      weight applied when the person votes.
--   - denominator_weight: weight contributed to the quorum/denominator.
-- exclusion_policy drives conflict-of-interest handling: NONE (full
-- participation), EXCLUIR_QUORUM (excluded from denominator only),
-- EXCLUIR_VOTO (excluded from votes but counted in denominator),
-- EXCLUIR_AMBOS (excluded from both).
-- generated_at is the WRITE timestamp (not an effective_from interval).
-- Unlike T5/T6/T7 this is a REGENERABLE projection, so NO temporal
-- interval CHECK and NO VIGENTE unique index — T10 owns the dedup
-- invariant on (entity, body, person, source_type, source_id) and
-- decides whether to enforce it via a unique index or by ordering on
-- generated_at (C7).
-- T10 will likely add: CREATE UNIQUE INDEX ux_parte_votante_current_regen
--   ON parte_votante_current(entity_id, body_id, person_id, source_type, source_id);
-- (shape is advisory — final predicate may differ if generated_at versioning is used)
--
-- Constraints follow the T3/T5/T6/T7 convention: extract both inline
-- CHECKs into explicitly named constraints via the DROP + DO-block
-- idempotency pattern (C6).
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS parte_votante_current (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL,
  entity_id            UUID        NOT NULL REFERENCES entities(id),
  body_id              UUID        NULL REFERENCES governing_bodies(id),
  person_id            UUID        NOT NULL REFERENCES persons(id),
  source_type          TEXT        NOT NULL
                                    CONSTRAINT chk_parte_votante_current_source_type
                                    CHECK (source_type IN ('CAPITAL','CARGO')),
  source_id            UUID        NOT NULL,
  voting_rights        BOOLEAN     NOT NULL,
  voting_weight        NUMERIC     NOT NULL DEFAULT 0,
  denominator_weight   NUMERIC     NOT NULL DEFAULT 0,
  exclusion_policy     TEXT        NOT NULL DEFAULT 'NONE'
                                    CONSTRAINT chk_parte_votante_current_exclusion_policy
                                    CHECK (exclusion_policy IN (
                                      'NONE','EXCLUIR_QUORUM','EXCLUIR_VOTO','EXCLUIR_AMBOS'
                                    )),
  exclusion_reason     TEXT,
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clean up auto-named inline CHECKs from prior migration runs, then add
-- the explicitly named ones. Same idempotency pattern as T3/T5/T6/T7:
-- CREATE TABLE IF NOT EXISTS no-ops on existing tables, so already-
-- migrated envs wouldn't otherwise pick up the rename.
ALTER TABLE parte_votante_current
  DROP CONSTRAINT IF EXISTS parte_votante_current_source_type_check;

ALTER TABLE parte_votante_current
  DROP CONSTRAINT IF EXISTS parte_votante_current_exclusion_policy_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_parte_votante_current_source_type'
      AND conrelid = 'parte_votante_current'::regclass
  ) THEN
    ALTER TABLE parte_votante_current
      ADD CONSTRAINT chk_parte_votante_current_source_type
      CHECK (source_type IN ('CAPITAL','CARGO'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_parte_votante_current_exclusion_policy'
      AND conrelid = 'parte_votante_current'::regclass
  ) THEN
    ALTER TABLE parte_votante_current
      ADD CONSTRAINT chk_parte_votante_current_exclusion_policy
      CHECK (exclusion_policy IN (
        'NONE','EXCLUIR_QUORUM','EXCLUIR_VOTO','EXCLUIR_AMBOS'
      ));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Magnitude invariants (added in T8 hardening, analogous to T6/T7 pattern):
-- voting_weight and denominator_weight must be non-negative. Cheap defense
-- in depth — T10 will populate these from bounded domain values, but a
-- bug in the refresh function could write negatives that silently corrupt
-- the rules engine's voting arithmetic downstream. One combined CHECK to
-- keep pg_constraint clutter low; regex-match either column name to
-- identify the violation.
-- ---------------------------------------------------------------------
ALTER TABLE parte_votante_current
  DROP CONSTRAINT IF EXISTS chk_parte_votante_current_weights_nonneg;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_parte_votante_current_weights_nonneg'
      AND conrelid = 'parte_votante_current'::regclass
  ) THEN
    ALTER TABLE parte_votante_current
      ADD CONSTRAINT chk_parte_votante_current_weights_nonneg
      CHECK (voting_weight >= 0 AND denominator_weight >= 0);
  END IF;
END $$;

-- Scan index for the hot "¿quién forma la base votante de este órgano?"
-- query path — (entity_id, body_id) covers both junta-level (body_id
-- NULL) and consejo-level (body_id set) reads. No partial predicate on
-- generated_at because this table is a CURRENT projection: T10 rewrites
-- it atomically on refresh, so every row is always "current" by
-- construction.
CREATE INDEX IF NOT EXISTS idx_parte_votante_current_entity_body
  ON parte_votante_current(entity_id, body_id);

-- ---------------------------------------------------------------------
-- T9. censo_snapshot — inmutable, WORM integrado (CA-7)
-- ---------------------------------------------------------------------
-- Append-only snapshot that freezes the voting census for a specific
-- session (meeting / no-session / unipersonal). Once written, rows are
-- WORM: UPDATE and DELETE are blocked by BEFORE triggers that raise an
-- exception whose message contains "inmutable" (the T9 test regex
-- matches /inmutable/i).
--
-- session_kind distinguishes the three adoption flows; snapshot_type
-- distinguishes the stake basis (ECONOMICO = capital holders with
-- economic rights, POLITICO = voting rights carriers, UNIVERSAL = both).
--
-- audit_worm_id stays NULL-able and FK-less on purpose: T11 is responsible
-- for adding the FK to audit_worm_trail(id) after the final column name
-- and idempotency semantics are agreed. Keeping the column present now
-- means T11 can ALTER TABLE ADD CONSTRAINT without another migration to
-- add the column.
--
-- body_id keeps its nullable semantics (C8 from T8): junta-level snapshots
-- use body_id NULL, consejo-level snapshots point at the specific
-- governing_bodies row.
--
-- Constraints follow the T3/T5/T6/T7/T8 convention: extract inline CHECKs
-- into explicitly named constraints via the DROP + DO-block idempotency
-- pattern (C6), avoiding auto-generated *_check names.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS censo_snapshot (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL,
  meeting_id          UUID        NOT NULL,
  session_kind        TEXT        NOT NULL
                                    CONSTRAINT chk_censo_snapshot_session_kind
                                    CHECK (session_kind IN ('MEETING','NO_SESSION','UNIPERSONAL')),
  entity_id           UUID        NOT NULL REFERENCES entities(id),
  body_id             UUID        NULL REFERENCES governing_bodies(id),
  snapshot_type       TEXT        NOT NULL
                                    CONSTRAINT chk_censo_snapshot_snapshot_type
                                    CHECK (snapshot_type IN ('ECONOMICO','POLITICO','UNIVERSAL')),
  payload             JSONB       NOT NULL,
  capital_total_base  NUMERIC,
  total_partes        INT         NOT NULL,
  audit_worm_id       UUID        NULL,   -- FK added in T11 (deferred per plan)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clean up auto-named inline CHECKs from prior migration runs, then add
-- the explicitly named ones. CREATE TABLE IF NOT EXISTS no-ops on
-- existing tables, so already-migrated envs wouldn't otherwise pick up
-- the rename.
ALTER TABLE censo_snapshot
  DROP CONSTRAINT IF EXISTS censo_snapshot_session_kind_check;

ALTER TABLE censo_snapshot
  DROP CONSTRAINT IF EXISTS censo_snapshot_snapshot_type_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_censo_snapshot_session_kind'
      AND conrelid = 'censo_snapshot'::regclass
  ) THEN
    ALTER TABLE censo_snapshot
      ADD CONSTRAINT chk_censo_snapshot_session_kind
      CHECK (session_kind IN ('MEETING','NO_SESSION','UNIPERSONAL'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_censo_snapshot_snapshot_type'
      AND conrelid = 'censo_snapshot'::regclass
  ) THEN
    ALTER TABLE censo_snapshot
      ADD CONSTRAINT chk_censo_snapshot_snapshot_type
      CHECK (snapshot_type IN ('ECONOMICO','POLITICO','UNIVERSAL'));
  END IF;
END $$;

-- Hot path: "censo for a meeting" lookup. (meeting_id, snapshot_type)
-- covers both the common "economico snapshot for meeting X" query and
-- the less frequent POLITICO/UNIVERSAL variants.
CREATE INDEX IF NOT EXISTS idx_censo_snapshot_meeting
  ON censo_snapshot(meeting_id, snapshot_type);

-- Shared guard function — one implementation, two triggers. The exception
-- message MUST contain the substring "inmutable" because the T9 test
-- regex matches /inmutable/i; any rewording here breaks CA-7 coverage.
CREATE OR REPLACE FUNCTION trg_block_censo_snapshot_ud()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'censo_snapshot es inmutable (WORM). Operaciones UPDATE/DELETE prohibidas.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_censo_snapshot_update ON censo_snapshot;
CREATE TRIGGER trg_block_censo_snapshot_update
  BEFORE UPDATE ON censo_snapshot
  FOR EACH ROW EXECUTE FUNCTION trg_block_censo_snapshot_ud();

DROP TRIGGER IF EXISTS trg_block_censo_snapshot_delete ON censo_snapshot;
CREATE TRIGGER trg_block_censo_snapshot_delete
  BEFORE DELETE ON censo_snapshot
  FOR EACH ROW EXECUTE FUNCTION trg_block_censo_snapshot_ud();

-- ---------------------------------------------------------------------
-- T10. Funciones de refresh de parte_votante_current (CA-5, CA-9)
-- ---------------------------------------------------------------------
-- Two PL/pgSQL functions that REGENERATE the regenerable projection
-- parte_votante_current from the source-of-truth tables:
--
--   fn_refresh_parte_votante_entity(p_entity_id UUID)
--     For economic voting (shareholders). Reads capital_holdings JOINed
--     with share_classes (to compute voting_weight with votes_per_title)
--     and LATERAL-joined with representaciones (to resolve the PJ admin
--     representative when the holder is a persona jurídica with an
--     ADMIN_PJ_REPRESENTANTE row). DELETE-then-INSERT rows where
--     entity_id = p_entity_id AND body_id IS NULL (junta scope).
--     CA-5 encoded: voting_rights=true AND NOT is_treasury → positive
--     voting_weight and denominator_weight. CA-9 encoded: is_treasury=true
--     → voting_weight=0 AND denominator_weight=0 (autocartera out of base).
--
--   fn_refresh_parte_votante_body(p_body_id UUID)
--     For political voting (administrators). Reads condiciones_persona
--     WHERE estado='VIGENTE' AND tipo_condicion IN the consejo-level set
--     (CONSEJERO, PRESIDENTE, SECRETARIO, VICEPRESIDENTE,
--     CONSEJERO_COORDINADOR). DELETE-then-INSERT rows where
--     body_id = p_body_id. Every consejero counts as voting_weight=1 and
--     denominator_weight=1 — the voto de calidad / weighted board rules
--     live in the rules engine, not in this projection.
--
-- Both functions are idempotent (DELETE-then-INSERT) and return VOID.
-- Applied via CREATE OR REPLACE FUNCTION so repeated runs are safe.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_refresh_parte_votante_entity(p_entity_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM parte_votante_current
   WHERE entity_id = p_entity_id AND body_id IS NULL;

  INSERT INTO parte_votante_current(
    tenant_id, entity_id, body_id, person_id,
    source_type, source_id, voting_rights,
    voting_weight, denominator_weight
  )
  SELECT
    ch.tenant_id,
    ch.entity_id,
    NULL,
    COALESCE(rep.representative_person_id, ch.holder_person_id),
    'CAPITAL',
    ch.id,
    ch.voting_rights,
    CASE
      WHEN ch.voting_rights AND NOT ch.is_treasury
      THEN COALESCE(ch.porcentaje_capital, 0) * COALESCE(sc.votes_per_title, 1)
      ELSE 0
    END,
    CASE
      WHEN NOT ch.is_treasury
      THEN COALESCE(ch.porcentaje_capital, 0)
      ELSE 0
    END
  FROM capital_holdings ch
  LEFT JOIN share_classes sc ON sc.id = ch.share_class_id
  LEFT JOIN LATERAL (
    SELECT r.representative_person_id
    FROM representaciones r
    WHERE r.represented_person_id = ch.holder_person_id
      AND r.entity_id = ch.entity_id
      AND r.scope = 'ADMIN_PJ_REPRESENTANTE'
      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
    ORDER BY r.effective_from DESC
    LIMIT 1
  ) rep ON true
  WHERE ch.entity_id = p_entity_id
    AND ch.effective_to IS NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_refresh_parte_votante_body(p_body_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM parte_votante_current WHERE body_id = p_body_id;

  INSERT INTO parte_votante_current(
    tenant_id, entity_id, body_id, person_id,
    source_type, source_id, voting_rights,
    voting_weight, denominator_weight
  )
  SELECT
    cp.tenant_id,
    cp.entity_id,
    cp.body_id,
    cp.person_id,
    'CARGO',
    cp.id,
    true,
    1.0,
    1.0
  FROM condiciones_persona cp
  WHERE cp.body_id = p_body_id
    AND cp.estado = 'VIGENTE'
    AND cp.tipo_condicion IN (
      'CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','CONSEJERO_COORDINADOR'
    );
END;
$$ LANGUAGE plpgsql;

COMMIT;
