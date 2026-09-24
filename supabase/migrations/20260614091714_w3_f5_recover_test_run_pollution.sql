-- ⚠️ ONE-SHOT — NO REPLAYABLE en DB limpia. Depende del schema transitorio
-- `w3_backup_20260614` (snapshot puntual del incidente). En un replay limpio
-- (supabase db reset / staging desde cero) ese schema NO existe y esta migración
-- fallaría; NO forma parte de la secuencia lógica de saneamiento W3 (eso es F1-F4,
-- que no usan backup). Es una recuperación de incidente ya aplicada en Cloud; si se
-- replaya en otro entorno, OMITIR esta migración y la 20260614110000.
-- ----------------------------------------------------------------------------
-- W3-F5 — Recuperación de polución introducida al ejecutar la suite vitest con
-- credencial admin contra Cloud (2026-06-14). LECCIÓN: el gate canónico es
-- `bun test` (anon, salta los tests que mutan); vitest con SERVICE_ROLE inserta
-- fixtures y, peor, un test de entity_capital_profile BORRÓ los 2 perfiles de ARGA.
-- ============================================================================
-- Esta migración: (1) borra la polución del test-run (filas presentes ahora pero
-- ausentes del backup pre-F1 w3_backup_20260614: 15 meetings + hijos, 8 persons,
-- 4 share_classes, censos/parte_votante de fixtures), y (2) RESTAURA los 2 perfiles
-- de capital de ARGA desde el backup. Bajo replica; self-verify de 6 paridades +
-- golden path que RAISE (rollback) ante cualquier desviación. Forward-only.

SET LOCAL session_replication_role = replica;

-- meetings creadas por el test-run (no en backup) + cascada
CREATE TEMP TABLE _tm ON COMMIT DROP AS
  SELECT id FROM public.meetings m WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.meetings b WHERE b.id=m.id);
DELETE FROM public.meeting_votes WHERE attendee_id IN (SELECT id FROM public.meeting_attendees WHERE meeting_id IN (SELECT id FROM _tm)) OR resolution_id IN (SELECT id FROM public.meeting_resolutions WHERE meeting_id IN (SELECT id FROM _tm));
DELETE FROM public.agenda_item_kind_changelog WHERE agenda_item_id IN (SELECT id FROM public.agenda_items WHERE meeting_id IN (SELECT id FROM _tm));
DELETE FROM public.agenda_item_constancias WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.agenda_items WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.meeting_resolutions WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.meeting_attendees WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.minutes WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.conflicts_of_interest WHERE related_meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.decisions WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.representaciones WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.communications WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.censo_snapshot WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.meetings WHERE id IN (SELECT id FROM _tm);

-- proyección regenerable: borrar parte_votante del test-run; se regenera ARGA abajo
DELETE FROM public.parte_votante_current pv WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.parte_votante_current b WHERE b.id=pv.id) AND pv.entity_id <> '6d7ed736-f263-4531-a59d-c6ca0cd41602';

-- censos de fixtures que no cuelguen de un meeting real (los 4 míos cuelgan de meetings del backup)
DELETE FROM public.censo_snapshot cs WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.censo_snapshot b WHERE b.id=cs.id)
  AND NOT EXISTS (SELECT 1 FROM public.meetings m WHERE m.id=cs.meeting_id);

-- share_classes y holdings de fixtures
DELETE FROM public.capital_holdings ch WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.capital_holdings b WHERE b.id=ch.id)
  AND ch.share_class_id IN (SELECT id FROM public.share_classes sc WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.share_classes b WHERE b.id=sc.id));
DELETE FROM public.share_classes sc WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.share_classes b WHERE b.id=sc.id);

-- persons de fixtures (no creé personas en F1-F5; cualquiera no-en-backup es del test-run)
DELETE FROM public.condiciones_persona cp WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.condiciones_persona b WHERE b.id=cp.id)
  AND (cp.person_id IN (SELECT p.id FROM public.persons p WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.persons bp WHERE bp.id=p.id))
    OR cp.representative_person_id IN (SELECT p.id FROM public.persons p WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.persons bp WHERE bp.id=p.id)));
DELETE FROM public.persons p WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.persons b WHERE b.id=p.id);

-- RESTAURAR los perfiles de capital de ARGA borrados por el test
INSERT INTO public.entity_capital_profile
  SELECT * FROM w3_backup_20260614.entity_capital_profile bcp
  WHERE bcp.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602'
    AND NOT EXISTS (SELECT 1 FROM public.entity_capital_profile cp WHERE cp.id=bcp.id);

SET LOCAL session_replication_role = DEFAULT;

-- regenerar proyección de ARGA
SELECT public.fn_refresh_parte_votante_entity('6d7ed736-f263-4531-a59d-c6ca0cd41602');

-- self-verify: golden path + sin polución
DO $$
DECLARE v int; v_pct numeric;
BEGIN
  IF (SELECT count(*) FROM public.entities e WHERE NOT EXISTS (SELECT 1 FROM public.entity_capital_profile cp WHERE cp.entity_id=e.id AND cp.estado='VIGENTE')) <> 0
    THEN RAISE EXCEPTION 'recover: hay entities sin capital_profile VIGENTE'; END IF;
  SELECT count(*) INTO v FROM public.condiciones_persona cp JOIN public.governing_bodies gb ON gb.id=cp.body_id
    WHERE gb.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND gb.body_type='CDA' AND cp.estado='VIGENTE';
  IF v <> 17 THEN RAISE EXCEPTION 'recover: CdA ARGA != 17 (=%)', v; END IF;
  SELECT round(COALESCE(sum(porcentaje_capital) FILTER (WHERE NOT is_treasury),0),2) INTO v_pct
    FROM public.capital_holdings WHERE entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND effective_to IS NULL;
  IF abs(v_pct-100) > 0.01 THEN RAISE EXCEPTION 'recover: cap table ARGA != 100 (=%)', v_pct; END IF;
  -- sin polución: no quedan meetings/persons/share_classes ausentes del backup
  IF (SELECT count(*) FROM public.meetings m WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.meetings b WHERE b.id=m.id)) <> 0
    THEN RAISE EXCEPTION 'recover: quedan meetings de fixture'; END IF;
  IF (SELECT count(*) FROM public.persons p WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.persons b WHERE b.id=p.id)) <> 0
    THEN RAISE EXCEPTION 'recover: quedan persons de fixture'; END IF;
  IF (SELECT count(*) FROM public.share_classes s WHERE NOT EXISTS (SELECT 1 FROM w3_backup_20260614.share_classes b WHERE b.id=s.id)) <> 0
    THEN RAISE EXCEPTION 'recover: quedan share_classes de fixture'; END IF;
  RAISE NOTICE 'recover OK: golden path restaurado, polución de test-run eliminada';
END $$;
