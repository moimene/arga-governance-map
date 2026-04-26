-- ============================================================
-- Migration 000035: deed/elevation tracking in registry_filings
-- Adds fields to track notarial deed reference after REGISTERED status.
-- ============================================================

ALTER TABLE registry_filings
  ADD COLUMN IF NOT EXISTS deed_reference    text,
  ADD COLUMN IF NOT EXISTS deed_date         date,
  ADD COLUMN IF NOT EXISTS notary_id         text,
  ADD COLUMN IF NOT EXISTS notary_name       text,
  ADD COLUMN IF NOT EXISTS protocol_number   text,
  ADD COLUMN IF NOT EXISTS elevated_at       timestamptz;

-- Extend status enum with ELEVATED
DO $$
BEGIN
  -- registry_filings.status is text (not a real enum), so just document valid values:
  -- DRAFT → SUBMITTED → UNDER_REVIEW → SUBSANACION → REGISTERED → ELEVATED → PUBLISHED
  -- REJECTED at any step
  COMMENT ON COLUMN registry_filings.deed_reference IS
    'Referencia de la escritura notarial (e.g. "Escritura nº 1234/2026")';
  COMMENT ON COLUMN registry_filings.deed_date IS
    'Fecha de otorgamiento de la escritura pública';
  COMMENT ON COLUMN registry_filings.notary_id IS
    'NIF o número de colegiado del notario autorizante';
  COMMENT ON COLUMN registry_filings.notary_name IS
    'Nombre del notario autorizante';
  COMMENT ON COLUMN registry_filings.protocol_number IS
    'Número de protocolo notarial';
  COMMENT ON COLUMN registry_filings.elevated_at IS
    'Timestamp en que el acuerdo fue elevado a escritura pública';
END;
$$;

-- Index for elevated filings
CREATE INDEX IF NOT EXISTS idx_registry_filings_elevated
  ON registry_filings (elevated_at)
  WHERE elevated_at IS NOT NULL;
