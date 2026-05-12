-- ============================================================================
-- Migration: 20260511_000061_plantillas_protegidas_capa3_immutable_with_overrides
-- Purpose: Cierra hallazgo adversarial CRÍTICO H1 (reviewer round 3).
-- Context:
--   La 000058 + 000060 protegen contra INSERT/UPDATE en
--   `plantilla_capa3_overrides_por_entidad` cuando el campo no existe o cuando
--   la plantilla tiene capa3_editables NULL. PERO no protegen la dirección
--   inversa: un admin que UPDATE `plantillas_protegidas.capa3_editables` a
--   NULL (o que elimine un campo del array) deja overrides existentes
--   referenciando campos que ya no existen → overrides huérfanos sin error.
--
-- Fix: trigger BEFORE UPDATE en `plantillas_protegidas` que rechaza:
--   1. Cambiar capa3_editables a NULL si hay overrides activos para esa plantilla
--   2. Eliminar del array un campo que tenga overrides activos
--
-- Defense in depth bidireccional con la 000060.
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

  -- Si ANTES no había capa3 y AHORA tampoco, nada que hacer
  IF OLD.capa3_editables IS NULL AND NEW.capa3_editables IS NULL THEN
    RETURN NEW;
  END IF;

  -- Contar overrides activos para esta plantilla
  SELECT COUNT(*) INTO v_override_count
  FROM plantilla_capa3_overrides_por_entidad
  WHERE plantilla_id = NEW.id;

  -- Si no hay overrides, cualquier cambio en capa3_editables es libre
  IF v_override_count = 0 THEN
    RETURN NEW;
  END IF;

  -- R1: rechazar NULL si hay overrides
  IF NEW.capa3_editables IS NULL THEN
    RAISE EXCEPTION 'No se puede setear capa3_editables a NULL en plantilla % porque existen % override(s) activos. Elimina los overrides primero o sustituye por array.', NEW.id, v_override_count;
  END IF;

  -- R2: detectar campos eliminados que tienen overrides
  -- OLD.campos = array de campo strings en OLD.capa3_editables
  -- NEW.campos = array de campo strings en NEW.capa3_editables
  -- Nota: el filtro NULL-safe se añade en migración 000062 (Codex P2 round 7).
  SELECT array_agg(elem->>'campo') INTO v_old_campos
  FROM jsonb_array_elements(COALESCE(OLD.capa3_editables, '[]'::jsonb)) AS elem
  WHERE elem ? 'campo';

  SELECT array_agg(elem->>'campo') INTO v_new_campos
  FROM jsonb_array_elements(COALESCE(NEW.capa3_editables, '[]'::jsonb)) AS elem
  WHERE elem ? 'campo';

  -- Campos que existían en OLD, fueron eliminados en NEW, y tienen overrides
  SELECT array_agg(DISTINCT o.campo) INTO v_orphaned_campos
  FROM plantilla_capa3_overrides_por_entidad o
  WHERE o.plantilla_id = NEW.id
    AND o.campo = ANY(COALESCE(v_old_campos, ARRAY[]::text[]))
    AND o.campo <> ALL(COALESCE(v_new_campos, ARRAY[]::text[]));

  IF v_orphaned_campos IS NOT NULL AND array_length(v_orphaned_campos, 1) > 0 THEN
    RAISE EXCEPTION 'No se pueden eliminar de capa3_editables campos con overrides activos en plantilla %: %. Elimina primero los overrides referenciados.', NEW.id, array_to_string(v_orphaned_campos, ', ');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger anterior si existe (idempotencia migración re-ejecutada)
DROP TRIGGER IF EXISTS tr_prevent_capa3_change_with_overrides ON plantillas_protegidas;

CREATE TRIGGER tr_prevent_capa3_change_with_overrides
  BEFORE UPDATE ON plantillas_protegidas
  FOR EACH ROW EXECUTE FUNCTION prevent_capa3_change_with_active_overrides();

COMMENT ON FUNCTION prevent_capa3_change_with_active_overrides() IS
  '000061: protege plantillas_protegidas.capa3_editables contra UPDATE→NULL o eliminación de campos con overrides activos. Defense in depth bidireccional con 000060 (que protege la dirección inversa: overrides con capa3 NULL).';

COMMIT;
