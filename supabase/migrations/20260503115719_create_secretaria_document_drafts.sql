-- Migration: 20260503115719_create_secretaria_document_drafts.sql
-- Purpose: Cloud persistence for editable Secretaria document drafts.
-- Applied target: governance_OS (hzqwefkwsxopwrmtksbg).
-- Guard: run `bun run db:check-target` before applying to any environment.

CREATE TABLE IF NOT EXISTS public.secretaria_document_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  document_request_id text NOT NULL,
  draft_key_sha256 text NOT NULL,
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
  UNIQUE (tenant_id, draft_key_sha256, version)
);

COMMENT ON TABLE public.secretaria_document_drafts IS
  'Borradores editables de documentos de Secretaria generados desde motor-plantillas antes de DOCX/firma/archivo.';
COMMENT ON COLUMN public.secretaria_document_drafts.draft_key_sha256 IS
  'Hash estable de request, plantilla y valores Capa 3; permite recuperar el ultimo borrador editable.';
COMMENT ON COLUMN public.secretaria_document_drafts.rendered_body_text IS
  'Cuerpo editable revisado por usuario, sin bloque de trazabilidad de sistema.';
COMMENT ON COLUMN public.secretaria_document_drafts.system_trace_text IS
  'Bloque no editable de trazabilidad documental que se recompone al configurar el borrador.';

CREATE INDEX IF NOT EXISTS idx_secretaria_document_drafts_tenant_state
  ON public.secretaria_document_drafts (tenant_id, draft_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_secretaria_document_drafts_key
  ON public.secretaria_document_drafts (tenant_id, draft_key_sha256, version DESC);

CREATE INDEX IF NOT EXISTS idx_secretaria_document_drafts_agreement
  ON public.secretaria_document_drafts (agreement_id, updated_at DESC)
  WHERE agreement_id IS NOT NULL;

ALTER TABLE public.secretaria_document_drafts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_secretaria_document_drafts
  ON public.secretaria_document_drafts;

CREATE TRIGGER set_updated_at_secretaria_document_drafts
  BEFORE UPDATE ON public.secretaria_document_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP POLICY IF EXISTS secretaria_document_drafts_select_tenant
  ON public.secretaria_document_drafts;
DROP POLICY IF EXISTS secretaria_document_drafts_insert_tenant
  ON public.secretaria_document_drafts;
DROP POLICY IF EXISTS secretaria_document_drafts_update_tenant
  ON public.secretaria_document_drafts;

CREATE POLICY secretaria_document_drafts_select_tenant
  ON public.secretaria_document_drafts
  FOR SELECT
  USING (
    tenant_id::text = COALESCE(NULLIF(auth.jwt() ->> 'tenant_id', ''), '00000000-0000-0000-0000-000000000001')
  );

CREATE POLICY secretaria_document_drafts_insert_tenant
  ON public.secretaria_document_drafts
  FOR INSERT
  WITH CHECK (
    tenant_id::text = COALESCE(NULLIF(auth.jwt() ->> 'tenant_id', ''), '00000000-0000-0000-0000-000000000001')
  );

CREATE POLICY secretaria_document_drafts_update_tenant
  ON public.secretaria_document_drafts
  FOR UPDATE
  USING (
    tenant_id::text = COALESCE(NULLIF(auth.jwt() ->> 'tenant_id', ''), '00000000-0000-0000-0000-000000000001')
  )
  WITH CHECK (
    tenant_id::text = COALESCE(NULLIF(auth.jwt() ->> 'tenant_id', ''), '00000000-0000-0000-0000-000000000001')
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.secretaria_document_drafts TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.secretaria_document_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.secretaria_document_drafts TO service_role;
