-- Migration 000041: C4+C5 — add approval_workflow and document_url to agreements
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS approval_workflow jsonb,
  ADD COLUMN IF NOT EXISTS document_url text;

COMMENT ON COLUMN agreements.approval_workflow IS 'JSON array of ApprovalStep {id, label, role, approvedAt, approvedBy} — persisted approval pipeline state';
COMMENT ON COLUMN agreements.document_url IS 'Supabase Storage URL of the generated/archived document (set by GenerarDocumentoStepper)';
