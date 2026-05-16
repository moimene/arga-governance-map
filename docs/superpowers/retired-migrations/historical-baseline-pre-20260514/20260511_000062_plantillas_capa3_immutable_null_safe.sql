-- ============================================================================
-- Migration: 20260511_000062_plantillas_capa3_immutable_null_safe
-- Purpose: Cierra bypass NULL-array en trigger 000061 (Codex P2 round 7).
-- Context:
--   La función `prevent_capa3_change_with_active_overrides` (000061) construye
--   `v_old_campos` y `v_new_campos` con `array_agg(elem->>'campo')`. Si algún
--   elemento JSON tiene `"campo": null` (o el operador `->>` devuelve NULL por
--   otra razón), el array resultante contiene NULL. Después:
--
--     WHERE o.campo <> ALL(array_con_null)
--
--   evalúa a NULL en lugar de TRUE (SQL three-valued logic). La fila no
--   matchea, `v_orphaned_campos` queda vacío y el trigger NO bloquea —
--   permitiendo dejar overrides huérfanos.
--
--   Codex confirmó: "If an admin updates capa3_editables to an array that
--   contains any object with 'campo': null while removing a field that has
--   overrides, v_new_campos contains NULL and o.campo <> ALL(...) evaluates
--   to NULL rather than true."
--
-- Fix:
--   1. Filtrar `elem->>'campo' IS NOT NULL` al construir los arrays.
--   2. Defensa extra: `array_remove(..., NULL)` en las comparaciones.
--
-- Idempotente vía CREATE OR REPLACE FUNCTION; el trigger existente sigue
-- attachado a la función actualizada.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION prevent_capa3_change_with_active_overrides()
RETURNS TRIGGER AS $$
DECLARE
  v_override_count int;
  v_orphaned_campos text[];
  v_old_campos text[];
  v_new_campos text[];
BEGIN
  -- Skip si capa3_editables no cambió
  IF NEW.capa3_editables IS NOT DISTINCT FROM OLD.capa3_editables THEN
    RETURN NEW;
  END IF;
  IF OLD.capa3_editables IS NULL AND NEW.capa3_editables IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_override_count
  FROM plantilla_capa3_overrides_por_entidad
  WHERE plantilla_id = NEW.id;

  IF v_override_count = 0 THEN
    RETURN NEW;
  END IF;

  -- R1: rechazar NULL si hay overrides
  IF NEW.capa3_editables IS NULL THEN
    RAISE EXCEPTION 'No se puede setear capa3_editables a NULL en plantilla % porque existen % override(s) activos.', NEW.id, v_override_count;
  END IF;

  -- R2 (null-safe): filtrar NULL al construir los arrays para evitar bypass
  -- vía elementos JSON con campo:null.
  SELECT array_agg(elem->>'campo') INTO v_old_campos
  FROM jsonb_array_elements(COALESCE(OLD.capa3_editables, '[]'::jsonb)) AS elem
  WHERE elem ? 'campo' AND elem->>'campo' IS NOT NULL;

  SELECT array_agg(elem->>'campo') INTO v_new_campos
  FROM jsonb_array_elements(COALESCE(NEW.capa3_editables, '[]'::jsonb)) AS elem
  WHERE elem ? 'campo' AND elem->>'campo' IS NOT NULL;

  -- array_remove(..., NULL) como defensa extra contra three-valued logic
  SELECT array_agg(DISTINCT o.campo) INTO v_orphaned_campos
  FROM plantilla_capa3_overrides_por_entidad o
  WHERE o.plantilla_id = NEW.id
    AND o.campo = ANY(array_remove(COALESCE(v_old_campos, ARRAY[]::text[]), NULL))
    AND o.campo <> ALL(array_remove(COALESCE(v_new_campos, ARRAY[]::text[]), NULL));

  IF v_orphaned_campos IS NOT NULL AND array_length(v_orphaned_campos, 1) > 0 THEN
    RAISE EXCEPTION 'No se pueden eliminar de capa3_editables campos con overrides activos en plantilla %: %.', NEW.id, array_to_string(v_orphaned_campos, ', ');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_capa3_change_with_active_overrides() IS
  '000062 (Codex P2 round 7): null-safe filtering of capa3 array elements para evitar bypass via JSON con campo:null.';

COMMIT;
