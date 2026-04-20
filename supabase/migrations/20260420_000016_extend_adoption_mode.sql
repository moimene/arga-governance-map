-- ============================================================
-- Migration 000016 — Extend agreements + entities for v2.1
-- ============================================================

-- Add execution_mode JSONB to agreements (nullable)
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS execution_mode JSONB;

-- Add constraint on execution_mode.tipo
ALTER TABLE agreements DROP CONSTRAINT IF EXISTS chk_execution_mode_tipo;
ALTER TABLE agreements ADD CONSTRAINT chk_execution_mode_tipo
  CHECK (
    execution_mode IS NULL
    OR execution_mode->>'tipo' IN ('SESION', 'CO_APROBACION', 'SOLIDARIO')
  );

-- Add solidario restrictions to entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS admin_solidario_restricciones JSONB;
