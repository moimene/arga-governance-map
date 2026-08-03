-- Secretaría — los poderes de representación requieren formalización registral.
--
-- Corrige la proyección de Acuerdo 360 para expedientes ya materializados antes
-- de que PODER_REPRESENTACION se incorporase al catálogo inscribible del cliente.

BEGIN;

UPDATE public.agreements
   SET inscribable = true
 WHERE agreement_kind = 'PODER_REPRESENTACION'
   AND inscribable IS DISTINCT FROM true;

COMMIT;
