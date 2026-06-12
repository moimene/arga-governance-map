-- ITEM-091a — Saneamiento de polución de datos QA/E2E en la entidad canónica ARGA.
--
-- 20 órganos de pura polución de test cuelgan de ARGA Seguros: 19 'Consejo QA
-- arga-real-<timestamp>' (CDA, creados por specs E2E) y 1 'Comité P2 Restauración
-- Demo' (COMITE smoke). Arrastran ~80 filas dependientes repartidas por muchas
-- tablas (agreements, no_session_*, meetings, censo_snapshot, authority_evidence,
-- condiciones, mandates, agenda_*, etc.), varias con guards WORM/inmutabilidad, que
-- ensucian los listados del demo.
--
-- Estos órganos NO tienen valor productivo (nombres con timestamp de spec). La
-- purga usa el patrón sancionado en CLAUDE.md para saneamientos controlados:
-- `SET LOCAL session_replication_role = replica` desactiva TODOS los triggers
-- (guards WORM + auditoría) y la enforcement de FK SOLO durante esta transacción
-- (se restaura sola al COMMIT). Por eso se borra explícitamente de cada tabla la
-- fila QA (sin depender de cascadas ni de orden FK) y no quedan huérfanos. Corre
-- en la transacción del CLI: cualquier error revierte todo. Forward-only,
-- idempotente. La dedup de la Junta General duplicada va en 091b.

SET LOCAL session_replication_role = replica;

-- Captura de ids QA antes de borrar (independiente del orden de borrado).
CREATE TEMP TABLE _pb ON COMMIT DROP AS
  SELECT id FROM public.governing_bodies
   WHERE entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND (name LIKE '%Consejo QA arga-real-%' OR name='Comité P2 Restauración Demo');
CREATE TEMP TABLE _pa ON COMMIT DROP AS
  SELECT id FROM public.agreements WHERE body_id IN (SELECT id FROM _pb);
CREATE TEMP TABLE _pm ON COMMIT DROP AS
  SELECT id FROM public.meetings WHERE body_id IN (SELECT id FROM _pb);
CREATE TEMP TABLE _pe ON COMMIT DROP AS
  SELECT id FROM public.no_session_expedientes
   WHERE body_id IN (SELECT id FROM _pb) OR agreement_id IN (SELECT id FROM _pa)
      OR no_session_resolution_id IN (SELECT id FROM public.no_session_resolutions WHERE body_id IN (SELECT id FROM _pb));

-- Vía meetings.
DELETE FROM public.meeting_votes WHERE attendee_id IN (SELECT id FROM public.meeting_attendees WHERE meeting_id IN (SELECT id FROM _pm))
                                    OR resolution_id IN (SELECT id FROM public.meeting_resolutions WHERE meeting_id IN (SELECT id FROM _pm));
DELETE FROM public.agenda_item_kind_changelog WHERE agenda_item_id IN (SELECT id FROM public.agenda_items WHERE meeting_id IN (SELECT id FROM _pm));
DELETE FROM public.agenda_item_constancias WHERE meeting_id IN (SELECT id FROM _pm);
DELETE FROM public.conflicts_of_interest WHERE related_meeting_id IN (SELECT id FROM _pm);
DELETE FROM public.decisions WHERE meeting_id IN (SELECT id FROM _pm);
DELETE FROM public.representaciones WHERE meeting_id IN (SELECT id FROM _pm);
DELETE FROM public.meeting_resolutions WHERE meeting_id IN (SELECT id FROM _pm) OR agreement_id IN (SELECT id FROM _pa);
DELETE FROM public.meeting_attendees WHERE meeting_id IN (SELECT id FROM _pm);
DELETE FROM public.agenda_items WHERE meeting_id IN (SELECT id FROM _pm);

-- Vía agreements.
DELETE FROM public.evidence_bundles WHERE agreement_id IN (SELECT id FROM _pa);
DELETE FROM public.communications WHERE agreement_id IN (SELECT id FROM _pa) OR meeting_id IN (SELECT id FROM _pm) OR body_id IN (SELECT id FROM _pb);
DELETE FROM public.rule_evaluation_results WHERE agreement_id IN (SELECT id FROM _pa);
DELETE FROM public.pacto_evaluacion_results WHERE agreement_id IN (SELECT id FROM _pa);
DELETE FROM public.capital_movements WHERE agreement_id IN (SELECT id FROM _pa);
DELETE FROM public.policy_agreements WHERE agreement_id IN (SELECT id FROM _pa);
DELETE FROM public.conflicto_interes WHERE agreement_id IN (SELECT id FROM _pa);

-- Vía no_session_expedientes.
DELETE FROM public.no_session_notificaciones WHERE expediente_id IN (SELECT id FROM _pe);
DELETE FROM public.no_session_respuestas WHERE expediente_id IN (SELECT id FROM _pe);
DELETE FROM public.no_session_expedientes WHERE id IN (SELECT id FROM _pe);

-- Vía convocatorias.
DELETE FROM public.attachments WHERE convocatoria_id IN (SELECT id FROM public.convocatorias WHERE body_id IN (SELECT id FROM _pb));

-- Padres directos del set QA.
DELETE FROM public.agreements WHERE id IN (SELECT id FROM _pa);
DELETE FROM public.no_session_resolutions WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.convocatorias WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.meetings WHERE id IN (SELECT id FROM _pm);
DELETE FROM public.censo_snapshot WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.parte_votante_current WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.mandatory_books WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.mandates WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.consejero_retribucion WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.authority_evidence WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.condiciones_persona WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.secretaria_organ_rules WHERE body_id IN (SELECT id FROM _pb);
DELETE FROM public.secretaria_role_assignments WHERE body_id IN (SELECT id FROM _pb);
UPDATE public.group_campaign_steps SET body_id = NULL WHERE body_id IN (SELECT id FROM _pb);

-- Finalmente los órganos.
DELETE FROM public.governing_bodies WHERE id IN (SELECT id FROM _pb);

-- Self-verify (aún en replica; la verificación de presencia es válida).
DO $$
DECLARE v_poll integer;
BEGIN
  SELECT count(*) INTO v_poll FROM public.governing_bodies
   WHERE entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND (name LIKE '%Consejo QA arga-real-%' OR name='Comité P2 Restauración Demo');
  IF v_poll <> 0 THEN
    RAISE EXCEPTION 'ITEM-091a verificación fallida: quedan % órganos de polución', v_poll;
  END IF;
END $$;
