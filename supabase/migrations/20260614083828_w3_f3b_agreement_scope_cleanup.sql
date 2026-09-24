-- W3-F3b — Limpieza de acuerdos sin scope (body_id NULL) en filiales (2026-06-14).
-- ============================================================================
-- Tras F3a quedan 4 acuerdos UNIPERSONAL_SOCIO con body_id NULL en filiales
-- (AGREEMENT_MISSING_SCOPE):
--  - ace30b81 (ARGA México Seguros, APROBACION_CUENTAS, REGISTERED, 1 hijo): tiene
--    valor (flujo registral completo) -> se le asigna el órgano cda-arga-mexico.
--  - bdd49f12 (ARGA Alemania, NOMBRAMIENTO, ADOPTED, sin órgano en la entidad,
--    2 hijos stub): incoherente (unipersonal sobre AG no unipersonal, sin órgano)
--    -> se borra con su decisión y evidencia.
--  - 000…053 / 000…054 (México/Portugal, NOMBRAMIENTO, DRAFT, 0 hijos): debris -> borrar.
-- Backup: w3_backup_20260614. Forward-only, idempotente.

-- (1) asignar órgano al acuerdo REGISTERED de México (conserva el flujo)
UPDATE public.agreements SET body_id='6b1884e0-29e6-4b72-b407-2ef543db6569'
WHERE id='ace30b81-9038-43ee-be91-2bb937be76b1' AND body_id IS NULL;

-- (2) borrar debris (replica para evidencia/decisiones)
SET LOCAL session_replication_role = replica;
CREATE TEMP TABLE _del ON COMMIT DROP AS SELECT unnest(ARRAY[
  'bdd49f12-58f6-42a5-9c47-ac63258695c0',
  '00000000-0000-0000-0000-000000000053',
  '00000000-0000-0000-0000-000000000054']::uuid[]) AS id;
CREATE TEMP TABLE _deldec ON COMMIT DROP AS
  SELECT unipersonal_decision_id AS id FROM public.agreements WHERE id IN (SELECT id FROM _del) AND unipersonal_decision_id IS NOT NULL;
DELETE FROM public.evidence_bundle_review_events WHERE agreement_id IN (SELECT id FROM _del);
DELETE FROM public.evidence_bundles WHERE agreement_id IN (SELECT id FROM _del);
DELETE FROM public.registry_filings WHERE agreement_id IN (SELECT id FROM _del);
DELETE FROM public.rule_evaluation_results WHERE agreement_id IN (SELECT id FROM _del);
DELETE FROM public.agreements WHERE id IN (SELECT id FROM _del);
DELETE FROM public.unipersonal_decisions ud WHERE ud.id IN (SELECT id FROM _deldec)
  AND NOT EXISTS (SELECT 1 FROM public.agreements a WHERE a.unipersonal_decision_id=ud.id);
SET LOCAL session_replication_role = DEFAULT;

-- (3) verify: 0 acuerdos con entity o body NULL
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM public.agreements WHERE entity_id IS NULL OR body_id IS NULL;
  IF v <> 0 THEN RAISE EXCEPTION 'W3-F3b: aun hay % acuerdos sin entity/body', v; END IF;
  RAISE NOTICE 'W3-F3b OK: 0 acuerdos sin scope';
END $$;
