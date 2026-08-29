-- G5 — evaluación por bandas de color para riesgos que la fuente NO descompone
-- en probabilidad x impacto.
--
-- Las tres columnas son NULLABLE a propósito: ARGA las deja en NULL y su
-- comportamiento no cambia en ningún punto. Mismo patrón que
-- entities.data_provenance (G1) y policies.owner_body_id (G4).
--
-- Se llama assessed_band y NO score/severity/nivel: el nombre tiene que impedir
-- que se confunda con la escala 1-25 de risks.inherent_score o con las cuatro
-- bandas con nombre de grc_risks.inherent_severity.

ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS assessed_band         text,
  ADD COLUMN IF NOT EXISTS assessment_breakdown  jsonb,
  ADD COLUMN IF NOT EXISTS assessment_provenance jsonb;

-- Los dos verdes de la fuente se colapsan en VERDE: su orden relativo no está
-- publicado, y una banda a nivel de riesgo tiene que estar totalmente ordenada.
ALTER TABLE public.risks
  DROP CONSTRAINT IF EXISTS risks_assessed_band_check;
ALTER TABLE public.risks
  ADD CONSTRAINT risks_assessed_band_check
  CHECK (assessed_band IS NULL OR assessed_band IN
         ('ROJO','NARANJA','AMARILLO','VERDE','NO_EVALUADA'));

-- Un riesgo evaluado por banda no tiene ejes de probabilidad/impacto. Si alguien
-- rellena los ejes de una fila con banda, está fabricando el dato que el diseño
-- prohíbe fabricar, y la base lo rechaza.
ALTER TABLE public.risks
  DROP CONSTRAINT IF EXISTS risks_banda_sin_ejes_check;
ALTER TABLE public.risks
  ADD CONSTRAINT risks_banda_sin_ejes_check
  CHECK (assessed_band IS NULL
         OR (probability IS NULL AND impact IS NULL AND residual_score IS NULL));

CREATE INDEX IF NOT EXISTS idx_risks_tenant_band
  ON public.risks (tenant_id, assessed_band)
  WHERE assessed_band IS NOT NULL;

COMMENT ON COLUMN public.risks.assessed_band IS
  'Banda de color evaluada en origen, para riesgos que la fuente no descompone en probabilidad x impacto. NULL = el riesgo usa los ejes clásicos.';
COMMENT ON COLUMN public.risks.assessment_breakdown IS
  'Desglose por columna del mapa de origen. nivel:null + motivo:NO_EVALUADA para las celdas sin evaluar (nunca 0, que es un valor de la escala).';
COMMENT ON COLUMN public.risks.assessment_provenance IS
  'Fuente, método de extracción y límites declarados de la escala.';
