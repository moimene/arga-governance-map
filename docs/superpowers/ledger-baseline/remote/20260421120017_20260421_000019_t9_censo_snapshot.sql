-- T9 — censo_snapshot + inmutabilidad WORM (CA-7)
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
  audit_worm_id       UUID        NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_censo_snapshot_meeting
  ON censo_snapshot(meeting_id, snapshot_type);

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
