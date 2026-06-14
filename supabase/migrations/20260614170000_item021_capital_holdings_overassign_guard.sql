-- ITEM-021 — Guard de integridad en BD: el libro de socios (capital_holdings) no
-- puede superar el capital emitido (entity_capital_profile.numero_titulos VIGENTE).
--
-- El guard solo vivía en la UI (AnadirSocioStepper), que además inserta directo en
-- capital_holdings sin RPC → eludible por insert/update directo o por carrera entre
-- dos usuarios. Este trigger BEFORE INSERT/UPDATE valida la suma de títulos VIGENTES
-- (effective_to IS NULL) por entidad contra el total emitido. Un CHECK no sirve (no
-- agrega cross-row); por eso trigger.
--
-- Degradación segura: no bloquea cuando no hay perfil de capital VIGENTE o el total
-- no es positivo (no se puede validar), ni a filas históricas (effective_to NOT NULL).
-- Forward-only. Verificado: 0 entidades sobreasignadas en el momento de aplicar.

CREATE OR REPLACE FUNCTION public.fn_capital_holdings_no_overassign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
  v_sum   numeric;
BEGIN
  -- Solo los títulos vigentes participan del invariante.
  IF NEW.effective_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT numero_titulos INTO v_total
  FROM public.entity_capital_profile
  WHERE entity_id = NEW.entity_id
    AND estado = 'VIGENTE'
    AND effective_to IS NULL
  ORDER BY effective_from DESC NULLS LAST
  LIMIT 1;

  -- Sin perfil de capital VIGENTE o sin total positivo no se puede validar → no bloquea.
  IF v_total IS NULL OR v_total <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(numero_titulos), 0) INTO v_sum
  FROM public.capital_holdings
  WHERE entity_id = NEW.entity_id
    AND effective_to IS NULL
    AND id <> NEW.id;  -- excluye la propia fila en UPDATE

  IF v_sum + COALESCE(NEW.numero_titulos, 0) > v_total + 0.0001 THEN
    RAISE EXCEPTION
      'Sobreasignación de capital: % títulos vigentes superarían el total emitido (%) de la entidad %',
      v_sum + COALESCE(NEW.numero_titulos, 0), v_total, NEW.entity_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_capital_holdings_no_overassign ON public.capital_holdings;
CREATE TRIGGER trg_capital_holdings_no_overassign
  BEFORE INSERT OR UPDATE ON public.capital_holdings
  FOR EACH ROW EXECUTE FUNCTION public.fn_capital_holdings_no_overassign();
