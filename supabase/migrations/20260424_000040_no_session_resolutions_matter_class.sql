-- Migration 000040: Sprint C2 — add matter_class, agreement_kind, total_members to no_session_resolutions
ALTER TABLE no_session_resolutions
  ADD COLUMN IF NOT EXISTS matter_class text DEFAULT 'ORDINARIA',
  ADD COLUMN IF NOT EXISTS agreement_kind text,
  ADD COLUMN IF NOT EXISTS total_members integer DEFAULT 1;

COMMENT ON COLUMN no_session_resolutions.matter_class IS 'ORDINARIA | ESTATUTARIA | ESTRUCTURAL';
COMMENT ON COLUMN no_session_resolutions.agreement_kind IS 'e.g. APROBACION_CUENTAS, MOD_ESTATUTOS';
COMMENT ON COLUMN no_session_resolutions.total_members IS 'Number of eligible voters (denominator for majority check)';
