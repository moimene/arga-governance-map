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
