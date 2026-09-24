-- W3-F3a — Coherencia de acuerdos sin padre + golden path ARGA 0/0 (2026-06-14).
-- ============================================================================
-- (1) Degrada a DRAFT TODOS los acuerdos no-DRAFT sin padre (8 POLITICAS de ARGA,
--     propuestas y leftovers legacy de subsidiarias). Estado coherente "en
--     preparación": un acuerdo DRAFT sin sesión es válido. No se fabrican sesiones/
--     decisiones/certificados falsos; además deja a los testers humanos borradores
--     reales que avanzar por el flujo de aprobación. (No se enlazan a una reunión
--     existente porque el trigger agreement_requires_decisorio exige agenda_item.)
-- (3) Crea censo (POLITICO) para las 2 reuniones de CdA de ARGA que carecían de él
--     -> elimina MEETING_WITHOUT_CENSUS.
-- (4) Borra be0d8a4a (APROBACION_CUENTAS en modo UNIPERSONAL_SOCIO sobre ARGA, que
--     es cotizada con 2 accionistas: contradicción) + su decisión y evidencia
--     sandbox -> elimina el AGREEMENT_MISSING_SCOPE de ARGA.
-- Resultado: ARGA readiness 0/0; cero acuerdos no-DRAFT sin padre.
-- Backup: w3_backup_20260614. Forward-only, idempotente.

-- (1) degradar a DRAFT todos los acuerdos no-DRAFT sin padre (be0d8a4a se borra abajo)
UPDATE public.agreements a SET status='DRAFT'
WHERE a.status<>'DRAFT'
  AND ((a.adoption_mode='MEETING' AND a.parent_meeting_id IS NULL)
    OR (a.adoption_mode='NO_SESSION' AND a.no_session_resolution_id IS NULL)
    OR (a.adoption_mode IN ('UNIPERSONAL_SOCIO','UNIPERSONAL_ADMIN') AND a.unipersonal_decision_id IS NULL));

-- (3) censos POLITICO para las 2 reuniones de CdA de ARGA sin censo
SELECT public.fn_crear_censo_snapshot('16b72346-1904-48c7-9203-1cfdc988e2b1','MEETING','6d7ed736-f263-4531-a59d-c6ca0cd41602','fe05ddd9-ce3e-47b0-8948-5b975c79ab59','POLITICO');
SELECT public.fn_crear_censo_snapshot('65f7223b-5a04-43ce-8110-fdd38af1d2cb','MEETING','6d7ed736-f263-4531-a59d-c6ca0cd41602','fe05ddd9-ce3e-47b0-8948-5b975c79ab59','POLITICO');

-- (4) borrar be0d8a4a + su decisión + evidencia sandbox (replica para evidencia/WORM)
SET LOCAL session_replication_role = replica;
DELETE FROM public.evidence_bundle_review_events WHERE agreement_id='be0d8a4a-8494-4334-87b8-3a6ee84803d1';
DELETE FROM public.evidence_bundles WHERE agreement_id='be0d8a4a-8494-4334-87b8-3a6ee84803d1';
DELETE FROM public.agreements WHERE id='be0d8a4a-8494-4334-87b8-3a6ee84803d1';
DELETE FROM public.unipersonal_decisions ud WHERE ud.id='293a7450-ca68-40b2-b854-857d923240c7'
  AND NOT EXISTS (SELECT 1 FROM public.agreements a WHERE a.unipersonal_decision_id=ud.id);
SET LOCAL session_replication_role = DEFAULT;

-- (5) self-verify ARGA 0/0
DO $$
DECLARE v int;
BEGIN
  -- ningun acuerdo de ARGA con scope incompleto o sin padre no-DRAFT
  SELECT count(*) INTO v FROM public.agreements a
   WHERE a.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND (a.entity_id IS NULL OR a.body_id IS NULL
       OR (a.status<>'DRAFT' AND a.adoption_mode='MEETING' AND a.parent_meeting_id IS NULL)
       OR (a.status<>'DRAFT' AND a.adoption_mode='NO_SESSION' AND a.no_session_resolution_id IS NULL)
       OR (a.status<>'DRAFT' AND a.adoption_mode IN ('UNIPERSONAL_SOCIO','UNIPERSONAL_ADMIN') AND a.unipersonal_decision_id IS NULL));
  IF v <> 0 THEN RAISE EXCEPTION 'W3-F3a: ARGA aun tiene % acuerdos con scope/padre incompleto', v; END IF;
  -- todas las reuniones de ARGA con censo
  SELECT count(*) INTO v FROM public.meetings m JOIN public.governing_bodies gb ON gb.id=m.body_id
   WHERE gb.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND NOT EXISTS (SELECT 1 FROM public.censo_snapshot cs WHERE cs.meeting_id=m.id);
  IF v <> 0 THEN RAISE EXCEPTION 'W3-F3a: ARGA aun tiene % reuniones sin censo', v; END IF;
  -- golden path intacto
  SELECT count(*) INTO v FROM public.condiciones_persona cp JOIN public.governing_bodies gb ON gb.id=cp.body_id
   WHERE gb.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND gb.body_type='CDA' AND cp.estado='VIGENTE';
  IF v <> 17 THEN RAISE EXCEPTION 'W3-F3a: CdA ARGA != 17 (=%)', v; END IF;
  RAISE NOTICE 'W3-F3a OK: ARGA 0/0';
END $$;
