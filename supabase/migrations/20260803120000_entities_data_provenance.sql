-- 20260803120000_entities_data_provenance.sql
-- G1 espejo societario Garrigues (spec 2026-08-02-garrigues-tenant-gobernanza-design.md §4 G1, H9).
-- Procedencia del dato por entidad: fuentes, confianza, cobertura del motor e incidencias
-- señaladas (§3.5). NULL = sin procedencia registrada = comportamiento actual (ARGA intacta).
-- Es el enganche que el Carril B (históricos BORME) rellenará después sin re-sembrar.
-- Lectura/escritura: policies RLS existentes de entities (tenant-scoped). Forward-only.

ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS data_provenance jsonb;

COMMENT ON COLUMN public.entities.data_provenance IS
  'Procedencia del dato: {fuentes[], confianza: CONFIRMADO|A_CONFIRMAR|PENDIENTE, cobertura_motor: bool, cobertura_motivo?, incidencias?[], notas?[]}. NULL = sin registrar (default histórico).';
