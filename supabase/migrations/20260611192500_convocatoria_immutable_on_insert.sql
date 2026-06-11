-- ITEM-035 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- fn_convocatoria_immutable_guard solo asignaba immutable_at en la TRANSICIÓN
-- a 'EMITIDA' vía UPDATE, pero el único write path productivo
-- (useCreateConvocatoria) INSERTA directamente con estado='EMITIDA': las 11
-- convocatorias EMITIDA de Cloud tenían immutable_at NULL y sus campos
-- estructurales (body_id, fecha_1, fecha_2, publication_channels) seguían
-- siendo mutables tras la emisión — la garantía de inmutabilidad era papel
-- mojado y ConvocatoriaDetalle mostraba "Inmutable desde —".
--
-- Fix forward-only:
--   1. Guard unificado (TG_OP-aware): congela en INSERT y en UPDATE siempre
--      que NEW.estado='EMITIDA' y no haya sello previo; mantiene el bloqueo
--      de campos estructurales una vez sellada.
--   2. Trigger BEFORE INSERT nuevo (el de UPDATE ya existía).
--   3. Backfill de las EMITIDA existentes (sello con su updated_at/created_at
--      como mejor aproximación del momento de emisión).

CREATE OR REPLACE FUNCTION public.fn_convocatoria_immutable_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.immutable_at IS NOT NULL AND (
      NEW.body_id IS DISTINCT FROM OLD.body_id OR
      NEW.fecha_1 IS DISTINCT FROM OLD.fecha_1 OR
      NEW.fecha_2 IS DISTINCT FROM OLD.fecha_2 OR
      NEW.publication_channels IS DISTINCT FROM OLD.publication_channels
    ) THEN
      RAISE EXCEPTION 'Convocatoria emitida — los campos estructurales son inmutables. Use Cancelar/Rectificar.';
    END IF;
  END IF;

  -- ITEM-035: el sello se aplica tanto al emitir por UPDATE como al INSERT
  -- directo en EMITIDA (write path real del stepper).
  IF NEW.estado = 'EMITIDA' AND NEW.immutable_at IS NULL THEN
    NEW.immutable_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_convocatoria_immutable_insert ON public.convocatorias;
CREATE TRIGGER trg_convocatoria_immutable_insert
  BEFORE INSERT ON public.convocatorias
  FOR EACH ROW EXECUTE FUNCTION public.fn_convocatoria_immutable_guard();

-- Backfill: sellar las EMITIDA históricas (mejor aproximación disponible).
UPDATE public.convocatorias
   SET immutable_at = COALESCE(updated_at, created_at)
 WHERE estado = 'EMITIDA'
   AND immutable_at IS NULL;
