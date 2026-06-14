-- W3-F4 — Auto-tagging de data_class='TEST' para artefactos E2E (cierre de W3).
-- ============================================================================
-- Cierra el flanco de durabilidad del filtrado por data_class: en vez de modificar
-- cada builder E2E (frágil, disperso), un trigger BEFORE INSERT etiqueta como TEST
-- las entities/persons cuyo nombre/tax_id encaja con patrones de test conocidos.
-- Así, todo artefacto E2E futuro nace data_class='TEST' y queda oculto de los
-- read-paths (applyVisibleDataClass / isProductionPerson) sin tocar los specs.
--
-- Respeta clasificaciones explícitas no-DEMO (PRE_RELEASE/PRODUCTION) y la TEST ya
-- puesta. No re-clasifica DEMO legítimo (los patrones son específicos de test).
-- Forward-only, idempotente.

CREATE OR REPLACE FUNCTION public.fn_autotag_entity_test_data_class()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_class IN ('PRE_RELEASE','PRODUCTION','TEST') THEN
    RETURN NEW;
  END IF;
  IF NEW.common_name ILIKE 'PHASE-B%' OR NEW.legal_name ILIKE 'PHASE-B%'
     OR NEW.common_name ILIKE '%arga test%' OR NEW.legal_name ILIKE '%arga test%'
     OR NEW.common_name ILIKE 'PRUEBA %' OR NEW.legal_name ILIKE 'PRUEBA %'
     OR NEW.common_name IN ('PRUEBA','SEGUROS TEST')
     OR NEW.legal_name ILIKE 'SEGUROS TEST%'
  THEN
    NEW.data_class := 'TEST';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_autotag_person_test_data_class()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_class IN ('PRE_RELEASE','PRODUCTION','TEST') THEN
    RETURN NEW;
  END IF;
  IF NEW.tax_id ILIKE 'E2E-%' OR NEW.tax_id ILIKE 'QA-%' OR NEW.tax_id ILIKE 'PHASE-B%'
     OR NEW.tax_id ILIKE 'Z-PB-%' OR NEW.tax_id ILIKE 'Z-AS-%'
     OR NEW.full_name ILIKE '[E2E REAL]%' OR NEW.full_name ILIKE '[ARCHIVED]%'
     OR NEW.full_name ILIKE 'PEDRO PRUEBA%' OR NEW.full_name = 'PRUEBA 1'
     OR NEW.full_name ILIKE 'QA %'
  THEN
    NEW.data_class := 'TEST';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autotag_entity_test_data_class ON public.entities;
CREATE TRIGGER trg_autotag_entity_test_data_class
  BEFORE INSERT ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.fn_autotag_entity_test_data_class();

DROP TRIGGER IF EXISTS trg_autotag_person_test_data_class ON public.persons;
CREATE TRIGGER trg_autotag_person_test_data_class
  BEFORE INSERT ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.fn_autotag_person_test_data_class();
