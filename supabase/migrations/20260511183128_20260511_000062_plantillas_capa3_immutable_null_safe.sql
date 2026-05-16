-- Patch: filtrar NULL del array de campos para evitar bypass cuando
-- algún elemento JSON tiene `campo: null` o tipo no-string.
-- Codex P2 round 7. Idempotente (CREATE OR REPLACE FUNCTION).

CREATE OR REPLACE FUNCTION prevent_capa3_change_with_active_overrides()
RETURNS TRIGGER AS $$
DECLARE
  v_override_count int;
  v_orphaned_campos text[];
  v_old_campos text[];
  v_new_campos text[];
BEGIN
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
  IF NEW.capa3_editables IS NULL THEN
    RAISE EXCEPTION 'No se puede setear capa3_editables a NULL en plantilla % porque existen % override(s) activos.', NEW.id, v_override_count;
  END IF;
  SELECT array_agg(elem->>'campo') INTO v_old_campos
  FROM jsonb_array_elements(COALESCE(OLD.capa3_editables, '[]'::jsonb)) AS elem
  WHERE elem ? 'campo' AND elem->>'campo' IS NOT NULL;
  SELECT array_agg(elem->>'campo') INTO v_new_campos
  FROM jsonb_array_elements(COALESCE(NEW.capa3_editables, '[]'::jsonb)) AS elem
  WHERE elem ? 'campo' AND elem->>'campo' IS NOT NULL;
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
