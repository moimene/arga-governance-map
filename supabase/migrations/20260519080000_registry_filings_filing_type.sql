-- C1 — Añade `filing_type` a public.registry_filings.
--
-- El motor (`TramitadorStepper.handleRegisterDeed`) calculaba `filingType`
-- desde `registryRulePackData.payload` (`filing_type` o
-- `registry_filing_types[0]`) o, en su defecto, `instrumentoRequerido`. El
-- INSERT contra Cloud reventaba con `PGRST204 - schema cache miss` porque
-- la columna no existía; el campo se desactivó en el cliente con un
-- `void filingType` como deuda. Esta migración cierra esa deuda
-- introduciendo la columna y backfilleando los registros previos.

BEGIN;

ALTER TABLE public.registry_filings
  ADD COLUMN IF NOT EXISTS filing_type text;

COMMENT ON COLUMN public.registry_filings.filing_type IS
  'Tipo derivado de la regla registral aplicable (ej. ESCRITURA, INSTANCIA, NINGUNO o un código de plantilla). Lo poblamos desde el motor cliente cuando se eleva la escritura; permite filtrar/agrupar tramitaciones por vía exigida.';

UPDATE public.registry_filings
SET filing_type = 'ESCRITURA'
WHERE filing_type IS NULL
  AND status IN ('ELEVATED', 'SUBMITTED', 'INSCRIBED');

COMMIT;
