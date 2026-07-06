-- Cierre de gap documentado (run-log UX 2026-06-20): la cola documental
-- (secretaria_document_artifacts) es tenant-wide porque la tabla no tenía entity_id.
-- Se añade entity_id (nullable, FK entities) + índice para permitir el scope por
-- sociedad. Backfill best-effort desde la fuente 'agreement'. Additivo, forward-only.
ALTER TABLE public.secretaria_document_artifacts
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_secretaria_document_artifacts_entity
  ON public.secretaria_document_artifacts (tenant_id, entity_id)
  WHERE entity_id IS NOT NULL;

UPDATE public.secretaria_document_artifacts a
   SET entity_id = ag.entity_id
  FROM public.agreements ag
 WHERE a.source_domain = 'agreement' AND a.source_id = ag.id AND a.entity_id IS NULL;
