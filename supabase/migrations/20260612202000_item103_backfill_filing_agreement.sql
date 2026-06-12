-- ITEM-103 — Backfill de agreement_id en filings de seed sin acuerdo trazable.
--
-- Los 2 filings demo (486b9f21 SUBSANACION, ad6718b1 EN_TRAMITE) tenían
-- agreement_id NULL, por lo que la hidratación del stepper (query por agreement_id)
-- nunca los encontraba: la subsanación era imposible de responder desde la UI. Se
-- enlazan a acuerdos CERTIFIED inscribibles para que el ciclo de respuesta de
-- subsanación sea ejercitable end-to-end (junto con el CTA 'Responder subsanación'
-- en TramitacionDetalle). Forward-only, idempotente.

UPDATE public.registry_filings
   SET agreement_id = '3c217750-e2bd-4ef3-8d9f-f2c0e6062dd0'
 WHERE id = '486b9f21-e76e-46fa-b0ff-5d600f49cf7e' AND agreement_id IS NULL;

UPDATE public.registry_filings
   SET agreement_id = '1e017412-b37c-5dc8-810d-475bb181b6ad'
 WHERE id = 'ad6718b1-fdea-40dd-87eb-345938f2060b' AND agreement_id IS NULL;

-- Self-verify: ya no quedan los 2 filings de seed sin agreement.
DO $$
DECLARE v_null integer;
BEGIN
  SELECT count(*) INTO v_null FROM public.registry_filings
   WHERE id IN ('486b9f21-e76e-46fa-b0ff-5d600f49cf7e','ad6718b1-fdea-40dd-87eb-345938f2060b')
     AND agreement_id IS NULL;
  IF v_null <> 0 THEN
    RAISE EXCEPTION 'ITEM-103 verificación fallida: % filings sin agreement', v_null;
  END IF;
END $$;
