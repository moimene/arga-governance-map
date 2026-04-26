-- ============================================================
-- Migration 000034: fn_validar_no_rebaja_ley
-- SQL function that verifies a majority code does not fall below
-- the LSC minimum for a given materia. Used by the agreements trigger.
-- ============================================================

-- Majority hierarchy: SIMPLE < REFORZADA_2_3 < UNANIMIDAD
CREATE OR REPLACE FUNCTION fn_majority_level(p_code text)
RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE p_code
    WHEN 'SIMPLE'         THEN 1
    WHEN 'REFORZADA_2_3'  THEN 2
    WHEN 'UNANIMIDAD'     THEN 3
    ELSE 0
  END;
END;
$$;

-- Returns false if p_majority_code is below the LSC minimum for the materia
CREATE OR REPLACE FUNCTION fn_validar_no_rebaja_ley(
  p_majority_code text,
  p_materia       text,
  p_tipo_social   text DEFAULT 'SA'
) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_min_code text;
BEGIN
  SELECT min_majority_code INTO v_min_code
    FROM materia_catalog
   WHERE materia = p_materia;

  -- If materia not in catalog, allow (conservative: unknown materia passes)
  IF NOT FOUND OR v_min_code IS NULL THEN
    RETURN true;
  END IF;

  -- Verify proposed majority is >= minimum
  RETURN fn_majority_level(p_majority_code) >= fn_majority_level(v_min_code);
END;
$$;

-- Trigger function: raises exception if an agreement would violate the minimum
CREATE OR REPLACE FUNCTION fn_agreements_majority_check()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_tipo_social text;
BEGIN
  -- Only validate when majority code is explicitly provided
  IF NEW.required_majority_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve tipo_social from entity if available
  SELECT UPPER(legal_form) INTO v_tipo_social
    FROM entities
   WHERE id = NEW.entity_id
   LIMIT 1;

  IF NOT fn_validar_no_rebaja_ley(
    NEW.required_majority_code,
    NEW.agreement_kind,
    COALESCE(v_tipo_social, 'SA')
  ) THEN
    RAISE EXCEPTION
      'La mayoría requerida (%) está por debajo del mínimo LSC para la materia % (%). Consulta materia_catalog para el mínimo aplicable.',
      NEW.required_majority_code, NEW.agreement_kind,
      (SELECT min_majority_code FROM materia_catalog WHERE materia = NEW.agreement_kind);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agreements_majority_check
  BEFORE INSERT OR UPDATE OF required_majority_code, agreement_kind ON agreements
  FOR EACH ROW EXECUTE FUNCTION fn_agreements_majority_check();
