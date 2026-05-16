ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS approval_workflow jsonb,
  ADD COLUMN IF NOT EXISTS document_url text;

COMMENT ON COLUMN agreements.approval_workflow IS 'JSON array of ApprovalStep {id, label, role, approvedAt, approvedBy} — persisted approval pipeline state';
COMMENT ON COLUMN agreements.document_url IS 'Supabase Storage URL of the generated/archived document (set by GenerarDocumentoStepper)';
