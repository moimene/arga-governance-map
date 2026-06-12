-- ITEM-102 — Vocabulario canónico español para registry_filings.status.
--
-- El vocabulario de estado estaba bifurcado: el seed/UI español
-- (EN_TRAMITE/PREPARADA/PRESENTADA/SUBSANACION) convivía con escrituras del stepper
-- en inglés (ELEVATED, y SUBMITTED en código). Se canoniza al español; la única fila
-- inglesa en Cloud es ELEVATED → ELEVADA. Forward-only, idempotente. (El alineamiento
-- de las escrituras del stepper, hidratación y status-labels va en el cambio de código.)

UPDATE public.registry_filings SET status = 'ELEVADA'   WHERE status = 'ELEVATED';
UPDATE public.registry_filings SET status = 'PRESENTADA' WHERE status = 'SUBMITTED';
UPDATE public.registry_filings SET status = 'INSCRITA'   WHERE status = 'INSCRIBED';

-- Self-verify: no quedan claves inglesas.
DO $$
DECLARE v_en integer;
BEGIN
  SELECT count(*) INTO v_en FROM public.registry_filings WHERE status IN ('ELEVATED','SUBMITTED','INSCRIBED');
  IF v_en <> 0 THEN
    RAISE EXCEPTION 'ITEM-102 verificación fallida: quedan % filas con status inglés', v_en;
  END IF;
END $$;
