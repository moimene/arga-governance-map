-- W3-F1 — Cuarentena/eliminación de contaminación TEST en governance_OS (2026-06-14).
-- ============================================================================
-- Purga de los artefactos de test (data_class='TEST') y su cascada completa, más
-- la contaminación TEST que cuelga de la entidad canónica ARGA (6d7ed736): 29
-- capital_holdings de holders E2E/QA (~0%), 16 condiciones SOCIO de personas TEST
-- y los movimientos/proyecciones asociados. NO toca el golden path (CdA 17, cap
-- table 100% Cartera+free float, pacto, voto de calidad).
--
-- BACKUP / ROLLBACK: schema `w3_backup_20260614` contiene una copia lógica completa
-- (CREATE TABLE AS SELECT *) de las 153 tablas base de `public`, tomada antes de
-- esta migración. Rollback de cualquier tabla vaciada:
--   SET LOCAL session_replication_role=replica;
--   INSERT INTO public.<t> SELECT * FROM w3_backup_20260614.<t> WHERE id IN (...);
--
-- PATRÓN (sancionado en CLAUDE.md, ya usado en 20260612190000_item091a):
--   `SET LOCAL session_replication_role=replica` desactiva TODOS los triggers
--   (guards WORM censo/capital_movements + auditoría) y la enforcement de FK SOLO
--   durante esta transacción (se restaura sola al COMMIT). Por eso se borra
--   explícitamente de CADA tabla hija (sin depender de cascadas) y al final hay:
--     (a) un ORPHAN-SCAN GENÉRICO sobre pg_constraint que detecta cualquier huérfano
--         creado por la purga (cubre tablas hijas que se hayan podido omitir) y
--     (b) un SELF-VERIFY del golden path ARGA.
--   Cualquiera de los dos RAISE EXCEPTION revierte toda la transacción. Esto
--   neutraliza el riesgo que /codex señaló del modo replica ("si un predicado omite
--   una tabla hija, cometes huérfanos"): el orphan-scan obliga a rollback ante
--   cualquier huérfano. Forward-only, idempotente (sin TEST que purgar => no-op).

SET LOCAL session_replication_role = replica;

-- 1) Capturar conjuntos de ids TEST (independiente del orden de borrado).
CREATE TEMP TABLE _te ON COMMIT DROP AS SELECT id FROM public.entities WHERE data_class='TEST';
CREATE TEMP TABLE _tp ON COMMIT DROP AS
  SELECT id FROM public.persons WHERE data_class='TEST'
  UNION SELECT person_id FROM public.entities WHERE data_class='TEST' AND person_id IS NOT NULL
  UNION SELECT id FROM public.persons WHERE full_name='PEDRO PRUEBA PRUEBA' AND tax_id='1111111111-A';
CREATE TEMP TABLE _tb ON COMMIT DROP AS SELECT id FROM public.governing_bodies WHERE entity_id IN (SELECT id FROM _te);
CREATE TEMP TABLE _ta ON COMMIT DROP AS SELECT id FROM public.agreements WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb);
CREATE TEMP TABLE _tm ON COMMIT DROP AS SELECT id FROM public.meetings WHERE body_id IN (SELECT id FROM _tb);
CREATE TEMP TABLE _tmin ON COMMIT DROP AS SELECT id FROM public.minutes WHERE entity_id IN (SELECT id FROM _te) OR meeting_id IN (SELECT id FROM _tm) OR body_id IN (SELECT id FROM _tb);
CREATE TEMP TABLE _tnsr ON COMMIT DROP AS SELECT id FROM public.no_session_resolutions WHERE body_id IN (SELECT id FROM _tb);
CREATE TEMP TABLE _tnse ON COMMIT DROP AS SELECT id FROM public.no_session_expedientes
  WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb)
     OR agreement_id IN (SELECT id FROM _ta) OR no_session_resolution_id IN (SELECT id FROM _tnsr);
CREATE TEMP TABLE _tc ON COMMIT DROP AS SELECT id FROM public.convocatorias WHERE body_id IN (SELECT id FROM _tb);
CREATE TEMP TABLE _tcert ON COMMIT DROP AS SELECT id FROM public.certifications
  WHERE minute_id IN (SELECT id FROM _tmin) OR agreement_id IN (SELECT id FROM _ta)
     OR certifier_id IN (SELECT id FROM _tp) OR visto_bueno_persona_id IN (SELECT id FROM _tp);

-- 2) Guardas previas.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.entities WHERE id IN (SELECT id FROM _te) AND COALESCE(legal_hold,false)=true) THEN
    RAISE EXCEPTION 'W3-F1 abort: una entidad TEST tiene legal_hold=true';
  END IF;
END $$;

-- 3) Borrado explícito hijo -> padre.
-- 3a) Grafo de reuniones.
DELETE FROM public.meeting_votes WHERE attendee_id IN (SELECT id FROM public.meeting_attendees WHERE meeting_id IN (SELECT id FROM _tm))
                                    OR resolution_id IN (SELECT id FROM public.meeting_resolutions WHERE meeting_id IN (SELECT id FROM _tm));
DELETE FROM public.agenda_item_kind_changelog WHERE agenda_item_id IN (SELECT id FROM public.agenda_items WHERE meeting_id IN (SELECT id FROM _tm));
DELETE FROM public.agenda_item_constancias WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.agenda_items WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.conflicts_of_interest WHERE related_meeting_id IN (SELECT id FROM _tm) OR person_id IN (SELECT id FROM _tp);
DELETE FROM public.decisions WHERE meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.representaciones WHERE entity_id IN (SELECT id FROM _te) OR meeting_id IN (SELECT id FROM _tm)
       OR represented_person_id IN (SELECT id FROM _tp) OR representative_person_id IN (SELECT id FROM _tp);
DELETE FROM public.meeting_resolutions WHERE meeting_id IN (SELECT id FROM _tm) OR agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.meeting_attendees WHERE meeting_id IN (SELECT id FROM _tm) OR person_id IN (SELECT id FROM _tp) OR represented_by_id IN (SELECT id FROM _tp);

-- 3b) Certificaciones / escrituras / registro (antes de minutes y agreements).
DELETE FROM public.deeds WHERE certification_id IN (SELECT id FROM _tcert);
DELETE FROM public.certifications WHERE id IN (SELECT id FROM _tcert);
DELETE FROM public.registry_filings WHERE agreement_id IN (SELECT id FROM _ta);

-- 3c) Hijos de agreements.
DELETE FROM public.evidence_bundle_review_events WHERE agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.evidence_bundles WHERE agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.bloque_insertions WHERE agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.rule_evaluation_results WHERE agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.pacto_evaluacion_results WHERE agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.policy_agreements WHERE agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.conflicto_interes WHERE agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.qtsp_signature_requests WHERE agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.capital_movements WHERE agreement_id IN (SELECT id FROM _ta) OR entity_id IN (SELECT id FROM _te) OR person_id IN (SELECT id FROM _tp);
UPDATE public.agenda_items SET legacy_source_agreement_id=NULL WHERE legacy_source_agreement_id IN (SELECT id FROM _ta);
UPDATE public.secretaria_document_drafts SET agreement_id=NULL WHERE agreement_id IN (SELECT id FROM _ta);
DELETE FROM public.communications WHERE agreement_id IN (SELECT id FROM _ta) OR meeting_id IN (SELECT id FROM _tm) OR body_id IN (SELECT id FROM _tb) OR entity_id IN (SELECT id FROM _te);

-- 3d) Acuerdos sin sesión.
DELETE FROM public.no_session_notificaciones WHERE expediente_id IN (SELECT id FROM _tnse) OR person_id IN (SELECT id FROM _tp);
DELETE FROM public.no_session_respuestas WHERE expediente_id IN (SELECT id FROM _tnse) OR person_id IN (SELECT id FROM _tp);
DELETE FROM public.no_session_expedientes WHERE id IN (SELECT id FROM _tnse);

-- 3e) Convocatorias + adjuntos.
DELETE FROM public.attachments WHERE convocatoria_id IN (SELECT id FROM _tc);
DELETE FROM public.convocatorias WHERE id IN (SELECT id FROM _tc);

-- 3f) Agreements, resoluciones sin sesión, unipersonales, actas, reuniones.
DELETE FROM public.agreements WHERE id IN (SELECT id FROM _ta);
DELETE FROM public.no_session_resolutions WHERE id IN (SELECT id FROM _tnsr);
DELETE FROM public.unipersonal_decisions WHERE entity_id IN (SELECT id FROM _te) OR decided_by_id IN (SELECT id FROM _tp);
DELETE FROM public.minutes WHERE id IN (SELECT id FROM _tmin);
DELETE FROM public.meetings WHERE id IN (SELECT id FROM _tm);

-- 3g) WORM censo (trigger desactivado por replica) + proyecciones.
DELETE FROM public.censo_snapshot WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb) OR meeting_id IN (SELECT id FROM _tm);
DELETE FROM public.parte_votante_current WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb) OR person_id IN (SELECT id FROM _tp);

-- 3h) Identidad / capital / cargos (incluye contaminación TEST sobre ARGA).
DELETE FROM public.capital_holdings WHERE entity_id IN (SELECT id FROM _te) OR holder_person_id IN (SELECT id FROM _tp);
DELETE FROM public.condiciones_persona WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb)
       OR person_id IN (SELECT id FROM _tp) OR representative_person_id IN (SELECT id FROM _tp);
DELETE FROM public.authority_evidence WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb) OR person_id IN (SELECT id FROM _tp);
DELETE FROM public.secretaria_role_assignments WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb) OR person_id IN (SELECT id FROM _tp);
DELETE FROM public.consejero_retribucion WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb);
DELETE FROM public.mandatory_books WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb);
DELETE FROM public.entity_capital_profile WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.share_classes WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.entity_settings WHERE entity_id IN (SELECT id FROM _te);

-- 3i) Tablas normativas/plantillas/campañas ligadas a la entidad (CASCADE en FK, explícitas bajo replica).
DELETE FROM public.secretaria_organ_rules WHERE entity_id IN (SELECT id FROM _te) OR body_id IN (SELECT id FROM _tb);
DELETE FROM public.secretaria_effective_rule_matrix WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.secretaria_normative_framework_status WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.secretaria_normative_overrides WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.secretaria_pacto_clause_mappings WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.secretaria_statute_clause_mappings WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.secretaria_statute_versions WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.plantilla_capa3_overrides_por_entidad WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.rule_param_overrides WHERE entity_id IN (SELECT id FROM _te);
UPDATE public.secretaria_normative_event_log SET entity_id=NULL WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.group_campaign_post_tasks WHERE entity_id IN (SELECT id FROM _te);
UPDATE public.group_campaign_steps SET body_id=NULL WHERE body_id IN (SELECT id FROM _tb);
DELETE FROM public.group_campaign_steps WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.group_campaign_expedientes WHERE entity_id IN (SELECT id FROM _te) OR responsable_id IN (SELECT id FROM _tp);

-- 3j) GRC/AIMS/portal/usuarios sobre entidades/personas TEST (deben ser 0; explícito por seguridad).
DELETE FROM public.risks WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.findings WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.incidents WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.bcm_bia WHERE entity_id IN (SELECT id FROM _te);
DELETE FROM public.delegations WHERE entity_id IN (SELECT id FROM _te) OR grantor_id IN (SELECT id FROM _tp) OR delegate_id IN (SELECT id FROM _tp);
DELETE FROM public.portal_memberships WHERE entity_id IN (SELECT id FROM _te) OR person_id IN (SELECT id FROM _tp);
DELETE FROM public.user_profiles WHERE entity_id IN (SELECT id FROM _te) OR person_id IN (SELECT id FROM _tp);
DELETE FROM public.user_roles WHERE scope_entity_id IN (SELECT id FROM _te);
DELETE FROM public.attestations WHERE person_id IN (SELECT id FROM _tp);
DELETE FROM public.persona_profiles WHERE person_id IN (SELECT id FROM _tp);
DELETE FROM public.communication_recipients WHERE person_id IN (SELECT id FROM _tp) OR delegacion_a_person_id IN (SELECT id FROM _tp);

-- 3k) Padres raíz.
DELETE FROM public.governing_bodies WHERE id IN (SELECT id FROM _tb);
DELETE FROM public.entities WHERE id IN (SELECT id FROM _te);
DELETE FROM public.persons WHERE id IN (SELECT id FROM _tp);

-- 3l) Limpieza de refs colgantes SET NULL pre-existentes (drafts cuyo agreement fue
--     borrado en una purga anterior sin nulear; FK es ON DELETE SET NULL).
UPDATE public.secretaria_document_drafts SET agreement_id=NULL
  WHERE agreement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.agreements a WHERE a.id=secretaria_document_drafts.agreement_id);

-- 4) ORPHAN-SCAN GENÉRICO: cualquier FK (mono-columna) cuyo padre esté en el set
--    purgado y que tenga hijos colgando => rollback. Cubre omisiones de §3.
DO $$
DECLARE r record; v_orphans bigint; v_total bigint := 0; v_sql text; v_list text := '';
BEGIN
  FOR r IN
    SELECT cl.relname AS child_table, att.attname AS child_col,
           fcl.relname AS parent_table, fatt.attname AS parent_col
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid=con.conrelid
    JOIN pg_namespace ns ON ns.oid=cl.relnamespace
    JOIN pg_class fcl ON fcl.oid=con.confrelid
    JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
    JOIN unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord=ck.ord
    JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=ck.attnum
    JOIN pg_attribute fatt ON fatt.attrelid=con.confrelid AND fatt.attnum=fk.attnum
    WHERE con.contype='f' AND ns.nspname='public' AND array_length(con.conkey,1)=1
      AND fcl.relname IN ('entities','persons','governing_bodies','meetings','agreements','minutes',
        'convocatorias','no_session_expedientes','no_session_resolutions','unipersonal_decisions',
        'certifications','capital_holdings','condiciones_persona','censo_snapshot','share_classes',
        'meeting_resolutions','meeting_attendees','agenda_items')
  LOOP
    v_sql := format('SELECT count(*) FROM public.%I c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.%I=c.%I)',
      r.child_table, r.child_col, r.parent_table, r.parent_col, r.child_col);
    EXECUTE v_sql INTO v_orphans;
    IF v_orphans > 0 THEN
      v_list := v_list || format(' %s.%s->%s(%s)', r.child_table, r.child_col, r.parent_table, v_orphans);
      v_total := v_total + v_orphans;
    END IF;
  END LOOP;
  IF v_total > 0 THEN
    RAISE EXCEPTION 'W3-F1 abort: % filas huerfanas:%', v_total, v_list;
  END IF;
END $$;

-- 5) SELF-VERIFY golden path ARGA + ausencia de TEST.
DO $$
DECLARE v int; v_pct numeric;
BEGIN
  IF (SELECT count(*) FROM public.entities WHERE data_class='TEST') <> 0 THEN RAISE EXCEPTION 'W3-F1: quedan entities TEST'; END IF;
  IF (SELECT count(*) FROM public.persons WHERE data_class='TEST') <> 0 THEN RAISE EXCEPTION 'W3-F1: quedan persons TEST'; END IF;
  SELECT count(*) INTO v FROM public.condiciones_persona cp JOIN public.governing_bodies gb ON gb.id=cp.body_id
    WHERE gb.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND gb.body_type='CDA' AND cp.estado='VIGENTE';
  IF v <> 17 THEN RAISE EXCEPTION 'W3-F1: CdA ARGA != 17 VIGENTE (=%)', v; END IF;
  SELECT count(*) INTO v FROM public.capital_holdings WHERE entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND effective_to IS NULL;
  IF v <> 2 THEN RAISE EXCEPTION 'W3-F1: holders actuales ARGA != 2 (=%)', v; END IF;
  SELECT round(COALESCE(sum(porcentaje_capital) FILTER (WHERE NOT is_treasury),0),2) INTO v_pct
    FROM public.capital_holdings WHERE entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND effective_to IS NULL;
  IF abs(v_pct-100) > 0.01 THEN RAISE EXCEPTION 'W3-F1: cap table ARGA != 100%% (=%)', v_pct; END IF;
  RAISE NOTICE 'W3-F1 OK: golden path ARGA intacto (CdA 17, holders 2, cap table 100%%)';
END $$;
