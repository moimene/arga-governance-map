-- W3-F2 — Saneamiento del dato DEMO recuperable en governance_OS (2026-06-14).
-- ============================================================================
-- (a) Poda de 91 acuerdos DRAFT sin padre (lote-ruido 2026-04-26; 88 MEETING + 3
--     UNIPERSONAL_SOCIO, todos con 0 hijos verificados) -> resuelve el síntoma
--     agreements 145 vs meetings.
-- (b) Borra 2 reuniones de test 'test-062-rpc-2-*' colgando de ARGA (polución E2E
--     sobre entidad DEMO; provocan MEETING_WITHOUT_CENSUS).
-- (c) Crea 5 entity_capital_profile VIGENTE para filiales DEMO sin perfil ->
--     parity #3 = 0.
-- (d) Backfill de ~24 tax_id 'PENDIENTE-*' de PJ de filiales DEMO con CIF demo
--     coherente y único (excluye la duplicada legacy 'Cartera ARGA, S.A.').
-- (e) Regenera parte_votante_current de ARGA.
-- Deletes bajo session_replication_role=replica + orphan-scan; inserts/updates con
-- triggers activos. Backup: w3_backup_20260614. Forward-only, idempotente.
-- Los 16 acuerdos NO-DRAFT sin padre (8 POLITICAS ARGA con órgano, NO_SESSION/
-- unipersonales) se reparan en F3 (enlace a sesión/decisión o borrado por caso).

-- ===== (a)+(b) deletes bajo replica =====
SET LOCAL session_replication_role = replica;

CREATE TEMP TABLE _draftnoise ON COMMIT DROP AS
  SELECT id FROM public.agreements a
  WHERE a.status='DRAFT'
    AND ((a.adoption_mode='MEETING' AND a.parent_meeting_id IS NULL)
      OR (a.adoption_mode IN ('UNIPERSONAL_SOCIO','UNIPERSONAL_ADMIN') AND a.unipersonal_decision_id IS NULL)
      OR (a.adoption_mode='NO_SESSION' AND a.no_session_resolution_id IS NULL))
    AND NOT EXISTS(SELECT 1 FROM evidence_bundles x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM evidence_bundle_review_events x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM bloque_insertions x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM certifications x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM registry_filings x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM meeting_resolutions x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM no_session_expedientes x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM rule_evaluation_results x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM pacto_evaluacion_results x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM policy_agreements x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM conflicto_interes x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM qtsp_signature_requests x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM capital_movements x WHERE x.agreement_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM communications x WHERE x.agreement_id=a.id);

CREATE TEMP TABLE _testmtg ON COMMIT DROP AS
  SELECT m.id FROM public.meetings m JOIN public.governing_bodies gb ON gb.id=m.body_id
  WHERE gb.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND m.slug ILIKE 'test-062-rpc-2-%';

-- drafts: limpiar refs SET NULL y borrar
UPDATE public.agenda_items SET legacy_source_agreement_id=NULL WHERE legacy_source_agreement_id IN (SELECT id FROM _draftnoise);
UPDATE public.secretaria_document_drafts SET agreement_id=NULL WHERE agreement_id IN (SELECT id FROM _draftnoise);
DELETE FROM public.agreements WHERE id IN (SELECT id FROM _draftnoise);

-- meetings de test: hijos -> meeting
DELETE FROM public.meeting_votes WHERE attendee_id IN (SELECT id FROM public.meeting_attendees WHERE meeting_id IN (SELECT id FROM _testmtg)) OR resolution_id IN (SELECT id FROM public.meeting_resolutions WHERE meeting_id IN (SELECT id FROM _testmtg));
DELETE FROM public.agenda_item_kind_changelog WHERE agenda_item_id IN (SELECT id FROM public.agenda_items WHERE meeting_id IN (SELECT id FROM _testmtg));
DELETE FROM public.agenda_item_constancias WHERE meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.agenda_items WHERE meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.conflicts_of_interest WHERE related_meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.decisions WHERE meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.representaciones WHERE meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.meeting_resolutions WHERE meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.meeting_attendees WHERE meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.minutes WHERE meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.communications WHERE meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.censo_snapshot WHERE meeting_id IN (SELECT id FROM _testmtg);
DELETE FROM public.meetings WHERE id IN (SELECT id FROM _testmtg);

-- orphan-scan acotado a los padres tocados
DO $$
DECLARE r record; v_orphans bigint; v_total bigint := 0; v_sql text; v_list text := '';
BEGIN
  FOR r IN
    SELECT cl.relname AS ct, att.attname AS cc, fcl.relname AS pt, fatt.attname AS pc
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid=con.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace
    JOIN pg_class fcl ON fcl.oid=con.confrelid
    JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
    JOIN unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord=ck.ord
    JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=ck.attnum
    JOIN pg_attribute fatt ON fatt.attrelid=con.confrelid AND fatt.attnum=fk.attnum
    WHERE con.contype='f' AND ns.nspname='public' AND array_length(con.conkey,1)=1
      AND fcl.relname IN ('agreements','meetings','meeting_resolutions','meeting_attendees','agenda_items','minutes')
  LOOP
    v_sql := format('SELECT count(*) FROM public.%I c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.%I=c.%I)', r.ct, r.cc, r.pt, r.pc, r.cc);
    EXECUTE v_sql INTO v_orphans;
    IF v_orphans > 0 THEN v_list := v_list || format(' %s.%s->%s(%s)', r.ct, r.cc, r.pt, v_orphans); v_total := v_total + v_orphans; END IF;
  END LOOP;
  IF v_total > 0 THEN RAISE EXCEPTION 'W3-F2 abort: % filas huerfanas:%', v_total, v_list; END IF;
END $$;

-- ===== (c)+(d)+(e) inserts/updates con triggers activos =====
SET LOCAL session_replication_role = DEFAULT;

-- (c) 5 entity_capital_profile VIGENTE para filiales DEMO sin perfil.
INSERT INTO public.entity_capital_profile (id, tenant_id, entity_id, currency, capital_escriturado, estado, effective_from, created_at)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001', v.entity_id, v.cur, v.cap, 'VIGENTE', DATE '2025-01-01', now()
FROM (VALUES
  ('00000000-0000-0000-0000-000000000030'::uuid, 'BRL', 5000000),
  ('00000000-0000-0000-0000-000000000031'::uuid, 'MXN', 50000000),
  ('00000000-0000-0000-0000-000000000032'::uuid, 'EUR', 50000),
  ('d0e36d02-032c-5eb4-9436-213cc92554de'::uuid, 'EUR', 3000),
  ('a375c963-3236-5056-b61e-c2314ce1ed25'::uuid, 'EUR', 3000)
) AS v(entity_id, cur, cap)
WHERE NOT EXISTS (SELECT 1 FROM public.entity_capital_profile cp WHERE cp.entity_id=v.entity_id AND cp.estado='VIGENTE');

-- (d) backfill tax_id PENDIENTE-* de PJ de filiales DEMO (excluye legacy Cartera S.A.).
WITH t AS (
  SELECT p.id, row_number() OVER (ORDER BY e.legal_name) AS rn,
    CASE WHEN e.tipo_social IN ('SA','SAU') THEN 'A'
         WHEN e.tipo_social IN ('SL','SLU') THEN 'B'
         ELSE 'N' END AS pref
  FROM public.persons p JOIN public.entities e ON e.person_id=p.id
  WHERE p.tax_id ILIKE 'PENDIENTE-%' AND e.data_class='DEMO'
    AND e.id <> '517522ab-60bf-4c41-9376-09c2948ca056'
)
UPDATE public.persons p
SET tax_id = t.pref || lpad((30000000 + t.rn)::text, 8, '0')
FROM t WHERE p.id = t.id;

-- (e) regenerar proyección de partes votantes de ARGA.
SELECT public.fn_refresh_parte_votante_entity('6d7ed736-f263-4531-a59d-c6ca0cd41602');

-- ===== self-verify =====
DO $$
DECLARE v int; v_pct numeric;
BEGIN
  IF (SELECT count(*) FROM public.entities e WHERE NOT EXISTS (SELECT 1 FROM public.entity_capital_profile cp WHERE cp.entity_id=e.id AND cp.estado='VIGENTE')) <> 0
    THEN RAISE EXCEPTION 'W3-F2: aun hay entities sin capital_profile VIGENTE'; END IF;
  IF (SELECT count(*) FROM public.persons WHERE tax_id ILIKE 'PENDIENTE-%' AND id IN (SELECT person_id FROM public.entities WHERE data_class='DEMO' AND id <> '517522ab-60bf-4c41-9376-09c2948ca056')) <> 0
    THEN RAISE EXCEPTION 'W3-F2: quedan PENDIENTE tax_id en PJ DEMO (no legacy)'; END IF;
  SELECT count(*) INTO v FROM public.condiciones_persona cp JOIN public.governing_bodies gb ON gb.id=cp.body_id
    WHERE gb.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND gb.body_type='CDA' AND cp.estado='VIGENTE';
  IF v <> 17 THEN RAISE EXCEPTION 'W3-F2: CdA ARGA != 17 (=%)', v; END IF;
  SELECT round(COALESCE(sum(porcentaje_capital) FILTER (WHERE NOT is_treasury),0),2) INTO v_pct
    FROM public.capital_holdings WHERE entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND effective_to IS NULL;
  IF abs(v_pct-100) > 0.01 THEN RAISE EXCEPTION 'W3-F2: cap table ARGA != 100 (=%)', v_pct; END IF;
  RAISE NOTICE 'W3-F2 OK';
END $$;
