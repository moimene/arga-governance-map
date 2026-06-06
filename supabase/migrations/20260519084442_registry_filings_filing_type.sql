-- C1 — Añade `filing_type` a public.registry_filings.
ALTER TABLE public.registry_filings
  ADD COLUMN IF NOT EXISTS filing_type text;

COMMENT ON COLUMN public.registry_filings.filing_type IS
  'Tipo derivado de la regla registral aplicable (ej. ESCRITURA, INSTANCIA, NINGUNO o un código de plantilla). Lo poblamos desde el motor cliente cuando se eleva la escritura; permite filtrar/agrupar tramitaciones por vía exigida.';

UPDATE public.registry_filings
SET filing_type = 'ESCRITURA'
WHERE filing_type IS NULL
  AND status IN ('ELEVATED', 'SUBMITTED', 'INSCRIBED');;
