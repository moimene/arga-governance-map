-- T8. parte_votante_current — proyección regenerable de la base votante
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

CREATE INDEX IF NOT EXISTS idx_parte_votante_current_entity_body
  ON parte_votante_current(entity_id, body_id);
