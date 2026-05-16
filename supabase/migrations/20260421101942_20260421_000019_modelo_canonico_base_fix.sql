-- Fix: rename entities.tipo_organo_admin CHECK from auto-generated
-- entities_tipo_organo_admin_check to explicit chk_entities_tipo_organo_admin
-- with idempotency guard, matching the FK pattern.

BEGIN;

ALTER TABLE entities
  DROP CONSTRAINT IF EXISTS entities_tipo_organo_admin_check;

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

COMMIT;
