-- ESTADO: PROPUESTO — NO APLICADO
-- Requiere autorizacion explicita antes de ejecutar.
-- Antes de aplicar: bun run db:check-target.
-- Cloud: governance_OS (hzqwefkwsxopwrmtksbg).

-- Proposito:
-- Persistir el borrador editable derivado de una plantilla, despues de Capa 3
-- y antes de DOCX/firma/archivo. No sustituye plantillas_protegidas ni
-- evidence_bundles; esos siguen siendo plantilla fuente y evidencia/archivo.

CREATE TABLE IF NOT EXISTS public.secretaria_document_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  document_request_id text NOT NULL,
  request_hash_sha256 text NOT NULL,
  document_type text NOT NULL,
  agreement_id uuid NULL REFERENCES public.agreements(id) ON DELETE SET NULL,
  template_id uuid NULL REFERENCES public.plantillas_protegidas(id) ON DELETE SET NULL,
  template_tipo text NULL,
  template_version text NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  draft_state text NOT NULL DEFAULT 'EDITABLE_DRAFT'
    CHECK (draft_state IN (
      'EDITABLE_DRAFT',
      'DRAFT_CONFIGURED',
      'PENDING_REVIEW',
      'IN_REVIEW',
      'APPROVED',
      'PROMOTED',
      'ARCHIVED',
      'REJECTED',
      'REGENERATION_NEEDED'
    )),
  rendered_body_text text NOT NULL,
  system_trace_text text NOT NULL,
  capa3_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  post_render_validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash_sha256 text NULL,
  configured_at timestamptz NULL,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, document_request_id, version)
);

CREATE INDEX IF NOT EXISTS idx_secretaria_document_drafts_tenant_state
  ON public.secretaria_document_drafts (tenant_id, draft_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_secretaria_document_drafts_agreement
  ON public.secretaria_document_drafts (agreement_id, updated_at DESC)
  WHERE agreement_id IS NOT NULL;

ALTER TABLE public.secretaria_document_drafts ENABLE ROW LEVEL SECURITY;

-- Ajustar al helper tenant real antes de aplicar si el proyecto ya expone una
-- funcion estandar. Patron esperado: tenant_id del JWT o tenant demo autorizado.
CREATE POLICY secretaria_document_drafts_select_tenant
  ON public.secretaria_document_drafts
  FOR SELECT
  USING (
    tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001')
  );

CREATE POLICY secretaria_document_drafts_insert_tenant
  ON public.secretaria_document_drafts
  FOR INSERT
  WITH CHECK (
    tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001')
  );

CREATE POLICY secretaria_document_drafts_update_tenant
  ON public.secretaria_document_drafts
  FOR UPDATE
  USING (
    tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001')
  )
  WITH CHECK (
    tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000001')
  );
