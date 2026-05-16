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

CREATE INDEX IF NOT EXISTS idx_representaciones_represented
  ON representaciones(represented_person_id, entity_id) WHERE effective_to IS NULL;
