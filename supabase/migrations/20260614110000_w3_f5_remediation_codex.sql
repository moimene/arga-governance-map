-- W3-F5 — Remediación de hallazgos de la revisión adversarial /codex (2026-06-14).
-- ============================================================================
-- P0 (/codex): F3a degradó a DRAFT acuerdos no-DRAFT sin padre en todo el tenant;
-- colateral: 1 acuerdo quedó DRAFT conservando una evidencia (estado incoherente:
-- un borrador no debe tener artefactos terminales). Se limpia la evidencia colgante
-- de cualquier acuerdo DRAFT (un draft no tiene evidencia/cert/registro). Bajo
-- replica por la evidencia; self-verify de coherencia. Backup: w3_backup_20260614.

SET LOCAL session_replication_role = replica;
DELETE FROM public.evidence_bundle_review_events
  WHERE agreement_id IN (SELECT id FROM public.agreements WHERE status='DRAFT');
DELETE FROM public.evidence_bundles
  WHERE agreement_id IN (SELECT id FROM public.agreements WHERE status='DRAFT');
SET LOCAL session_replication_role = DEFAULT;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM public.agreements a
   WHERE a.status='DRAFT'
     AND (EXISTS(SELECT 1 FROM public.certifications c WHERE c.agreement_id=a.id)
       OR EXISTS(SELECT 1 FROM public.registry_filings rf WHERE rf.agreement_id=a.id)
       OR EXISTS(SELECT 1 FROM public.evidence_bundles eb WHERE eb.agreement_id=a.id)
       OR EXISTS(SELECT 1 FROM public.meeting_resolutions mr WHERE mr.agreement_id=a.id));
  IF v <> 0 THEN RAISE EXCEPTION 'W3-F5: aun hay % acuerdos DRAFT con artefactos terminales', v; END IF;
  RAISE NOTICE 'W3-F5 OK: 0 acuerdos DRAFT con artefactos terminales';
END $$;
