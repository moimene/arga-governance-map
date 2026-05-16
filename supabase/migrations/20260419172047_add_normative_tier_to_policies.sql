ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS normative_tier text
  CHECK (normative_tier IN ('POLITICA','NORMA','PROCEDIMIENTO','DOCUMENTO'));
COMMENT ON COLUMN policies.normative_tier IS '4-level normative hierarchy: POLITICA > NORMA > PROCEDIMIENTO > DOCUMENTO';
