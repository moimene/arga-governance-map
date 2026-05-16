-- Migration 000039: Sprint C1 — add agenda_items, tipo_convocatoria, lugar, convocatoria_text
ALTER TABLE convocatorias
  ADD COLUMN IF NOT EXISTS tipo_convocatoria text DEFAULT 'ORDINARIA',
  ADD COLUMN IF NOT EXISTS agenda_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lugar text,
  ADD COLUMN IF NOT EXISTS convocatoria_text text;

COMMENT ON COLUMN convocatorias.tipo_convocatoria IS 'ORDINARIA | EXTRAORDINARIA | UNIVERSAL';
COMMENT ON COLUMN convocatorias.agenda_items IS 'Array of {titulo, tipo, inscribible} objects';
COMMENT ON COLUMN convocatorias.lugar IS 'Physical or virtual meeting location';
COMMENT ON COLUMN convocatorias.convocatoria_text IS 'Full text of the notice (optional, generated or typed)';
