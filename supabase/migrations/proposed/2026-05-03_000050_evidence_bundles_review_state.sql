-- ESTADO: PROPUESTO — NO APLICADO
-- Requiere autorización explícita antes de ejecutar.
-- Antes de aplicar: bun run db:check-target.
-- Cloud: governance_OS (hzqwefkwsxopwrmtksbg).

-- Proposito:
--   Estado de revision append-only para documentos generados y archivados como
--   DEMO_OPERATIVA en evidence_bundles. No convierte ningun artefacto en
--   evidencia final productiva.

CREATE TABLE IF NOT EXISTS evidence_bundle_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  evidence_bundle_id uuid NOT NULL REFERENCES evidence_bundles(id) ON DELETE RESTRICT,
  agreement_id uuid REFERENCES agreements(id) ON DELETE RESTRICT,

  review_state text NOT NULL CHECK (review_state IN (
    'DRAFT',
    'PENDING_REVIEW',
    'IN_REVIEW',
    'APPROVED',
    'PROMOTED',
    'ARCHIVED',
    'REJECTED',
    'REGENERATION_NEEDED'
  )),

  event_type text NOT NULL CHECK (event_type IN (
    'GENERATED',
    'SUBMITTED',
    'ASSIGNED',
    'REASSIGNED',
    'REVIEW_STARTED',
    'APPROVED',
    'PROMOTED',
    'REJECTED',
    'REGENERATION_REQUESTED',
    'ARCHIVED'
  )),

  actor_id uuid,
  assignee_id uuid,
  reason text,
  notes text,
  request_id text,
  request_hash_sha256 text,
  document_url text,
  content_hash_sha256 text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER evidence_bundle_review_events_worm_guard
  BEFORE UPDATE OR DELETE ON evidence_bundle_review_events
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

ALTER TABLE evidence_bundle_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY evidence_bundle_review_events_select_tenant
  ON evidence_bundle_review_events
  FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY evidence_bundle_review_events_insert_tenant
  ON evidence_bundle_review_events
  FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX IF NOT EXISTS idx_evidence_bundle_review_events_bundle_created
  ON evidence_bundle_review_events(tenant_id, evidence_bundle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_bundle_review_events_state
  ON evidence_bundle_review_events(tenant_id, review_state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_bundle_review_events_assignee
  ON evidence_bundle_review_events(tenant_id, assignee_id, created_at DESC)
  WHERE assignee_id IS NOT NULL;

CREATE OR REPLACE VIEW evidence_bundle_review_state_current AS
SELECT DISTINCT ON (tenant_id, evidence_bundle_id)
  id,
  tenant_id,
  evidence_bundle_id,
  agreement_id,
  review_state,
  event_type,
  actor_id,
  assignee_id,
  reason,
  notes,
  request_id,
  request_hash_sha256,
  document_url,
  content_hash_sha256,
  metadata,
  created_at
FROM evidence_bundle_review_events
ORDER BY tenant_id, evidence_bundle_id, created_at DESC, id DESC;

GRANT SELECT, INSERT ON evidence_bundle_review_events TO authenticated;
GRANT SELECT ON evidence_bundle_review_state_current TO authenticated;
