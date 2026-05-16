-- T8 hardening: non-negativity CHECK on voting/denominator weights.
-- Additive only; analogous to T6/T7 hardening (7761fb9 / e31019d).
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
