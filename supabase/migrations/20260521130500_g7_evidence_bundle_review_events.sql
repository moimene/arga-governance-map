CREATE TABLE IF NOT EXISTS public.evidence_bundle_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.fn_current_tenant_id(),
  evidence_bundle_id uuid NOT NULL REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT,
  agreement_id uuid REFERENCES public.agreements(id) ON DELETE RESTRICT,

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
    'ARCHIVED',
    'COMMENT_ADDED',
    'LEGAL_HOLD_APPLIED',
    'LEGAL_HOLD_RELEASED'
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

-- Protección WORM en tabla de eventos G7
DROP TRIGGER IF EXISTS evidence_bundle_review_events_worm_guard ON public.evidence_bundle_review_events;
CREATE TRIGGER evidence_bundle_review_events_worm_guard
  BEFORE UPDATE OR DELETE ON public.evidence_bundle_review_events
  FOR EACH ROW EXECUTE FUNCTION public.worm_guard();

-- RLS Multitenant dinámico
ALTER TABLE public.evidence_bundle_review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_bundle_review_events_tenant_isolation ON public.evidence_bundle_review_events;
CREATE POLICY evidence_bundle_review_events_tenant_isolation
  ON public.evidence_bundle_review_events
  FOR ALL
  TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

-- Índices optimizados
CREATE INDEX IF NOT EXISTS idx_eb_review_events_bundle
  ON public.evidence_bundle_review_events(tenant_id, evidence_bundle_id, created_at DESC);

-- Vista de estado actual del bundle
-- security_invoker = true: la vista respeta el RLS de evidence_bundle_review_events
-- (sin esto, en PG15+ leería con permisos del owner y filtraría entre tenants).
CREATE OR REPLACE VIEW public.evidence_bundle_review_state_current
WITH (security_invoker = true) AS
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
FROM public.evidence_bundle_review_events
ORDER BY tenant_id, evidence_bundle_id, created_at DESC, id DESC;

GRANT SELECT, INSERT ON public.evidence_bundle_review_events TO authenticated;
GRANT SELECT ON public.evidence_bundle_review_state_current TO authenticated;
