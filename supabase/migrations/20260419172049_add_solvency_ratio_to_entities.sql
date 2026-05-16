ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS solvency_ii_ratio numeric(6,1);
COMMENT ON COLUMN entities.solvency_ii_ratio IS 'Solvency II coverage ratio (%), e.g. 210.4';
