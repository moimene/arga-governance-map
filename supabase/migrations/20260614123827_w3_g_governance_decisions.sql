-- W3-G — Tres decisiones de gobierno resueltas (2026-06-14).
-- ============================================================================
-- G1: tax_id canónico de la PJ de ARGA Seguros. La entidad apunta a la PJ
--     `15fab4ff` con tax_id `A-00001001`; existe una PJ huérfana `2faafc8d` con el
--     tax_id documentado `A-99999903`. Decisión: borrar la huérfana (sin refs) y
--     fijar el tax_id de la PJ real a `A-99999903` (canónico en docs/constantes/test).
-- G2: retirar la duplicada legacy `Cartera ARGA, S.A.` (517522ab; 0 hijos, 0 socios,
--     0 cargos, solo libros+PJ) y rewire de la cadena de grupo: `Cartera ARGA S.L.U.`
--     (la canónica) pasa a tener parent=Fundación ARGA (la arista que tenía la legacy).
-- G3: degradar las 6 evidence_bundles SEALED de sandbox (qseal+tsq NULL, sin sello
--     cualificado real, GRC/GRC_PENAL) a OPEN — corrige la promoción indebida a "final
--     sellado" (trust-boundary; alinea con 000049 HOLD / no declarar evidencia final).
-- Backup: w3_backup_gh_20260614. Borrados/immutabilidad bajo replica; orphan-scan
-- completo + self-verify que RAISE (rollback). Forward-only.

SET LOCAL session_replication_role = replica;

-- G2: cascada de la legacy Cartera SA (517522ab) — hijos por entidad (la mayoría 0)
DELETE FROM public.mandatory_books WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.entity_capital_profile WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.share_classes WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.entity_settings WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.secretaria_effective_rule_matrix WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.secretaria_normative_framework_status WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.secretaria_normative_overrides WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.secretaria_organ_rules WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.secretaria_statute_clause_mappings WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.secretaria_statute_versions WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.secretaria_pacto_clause_mappings WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.plantilla_capa3_overrides_por_entidad WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.rule_param_overrides WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
UPDATE public.secretaria_normative_event_log SET entity_id=NULL WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.group_campaign_post_tasks WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.group_campaign_steps WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.group_campaign_expedientes WHERE entity_id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.entities WHERE id='517522ab-60bf-4c41-9376-09c2948ca056';
DELETE FROM public.persons WHERE id='17aa1e03-769b-49ad-9296-d41a8f3cbc51';  -- legacy Cartera SA PJ

-- G1: borrar PJ huérfana duplicada (A-99999903 queda libre para la PJ real)
DELETE FROM public.persons WHERE id='2faafc8d-e4ad-41e6-a51b-b1e73ebb0f3c';

-- G3: degradar sandbox SEALED -> OPEN (replica bypasea el guard de inmutabilidad)
UPDATE public.evidence_bundles SET status='OPEN'
  WHERE status='SEALED' AND qseal_token IS NULL AND tsq_token IS NULL AND COALESCE(legal_hold,false)=false;

SET LOCAL session_replication_role = DEFAULT;

-- G1: fijar tax_id canónico de la PJ real de ARGA (huérfana ya borrada -> índice único libre)
UPDATE public.persons SET tax_id='A-99999903' WHERE id='15fab4ff-2a1f-59c1-b2fd-e849cb4cf936';

-- G2: rewire de la cadena de grupo Fundación -> Cartera SLU canónica
UPDATE public.entities SET parent_entity_id='7b9dd701-1ed1-4911-88ba-e186a86083bc'
  WHERE id='00000000-0000-0000-0000-000000000020';

-- ===== orphan-scan completo + self-verify =====
DO $$
DECLARE r record; v_orphans bigint; v_total bigint := 0; v_sql text; v_list text := '';
BEGIN
  FOR r IN
    SELECT cl.relname AS ct, att.attname AS cc, fcl.relname AS pt, fatt.attname AS pc
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid=con.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace
    JOIN pg_class fcl ON fcl.oid=con.confrelid JOIN pg_namespace fns ON fns.oid=fcl.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
    JOIN unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord=ck.ord
    JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=ck.attnum
    JOIN pg_attribute fatt ON fatt.attrelid=con.confrelid AND fatt.attnum=fk.attnum
    WHERE con.contype='f' AND ns.nspname='public' AND fns.nspname='public' AND array_length(con.conkey,1)=1
  LOOP
    v_sql := format('SELECT count(*) FROM public.%I c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.%I=c.%I)', r.ct, r.cc, r.pt, r.pc, r.cc);
    EXECUTE v_sql INTO v_orphans;
    IF v_orphans > 0 THEN v_list := v_list || format(' %s.%s->%s(%s)', r.ct, r.cc, r.pt, v_orphans); v_total := v_total + v_orphans; END IF;
  END LOOP;
  IF v_total > 0 THEN RAISE EXCEPTION 'W3-G: % huerfanos:%', v_total, v_list; END IF;
END $$;
DO $$
DECLARE v_tax text; v int;
BEGIN
  SELECT pe.tax_id INTO v_tax FROM public.entities e JOIN public.persons pe ON pe.id=e.person_id WHERE e.id='6d7ed736-f263-4531-a59d-c6ca0cd41602';
  IF v_tax <> 'A-99999903' THEN RAISE EXCEPTION 'W3-G1: PJ ARGA tax_id=% (esperado A-99999903)', v_tax; END IF;
  IF EXISTS (SELECT 1 FROM public.entities WHERE id='517522ab-60bf-4c41-9376-09c2948ca056') THEN RAISE EXCEPTION 'W3-G2: legacy Cartera SA sigue existiendo'; END IF;
  IF (SELECT parent_entity_id FROM public.entities WHERE id='00000000-0000-0000-0000-000000000020') IS DISTINCT FROM '7b9dd701-1ed1-4911-88ba-e186a86083bc' THEN RAISE EXCEPTION 'W3-G2: Cartera SLU parent != Fundación'; END IF;
  SELECT count(*) INTO v FROM public.evidence_bundles WHERE status='SEALED' AND qseal_token IS NULL AND tsq_token IS NULL;
  IF v <> 0 THEN RAISE EXCEPTION 'W3-G3: quedan % SEALED sandbox', v; END IF;
  -- golden path ARGA intacto
  SELECT count(*) INTO v FROM public.condiciones_persona cp JOIN public.governing_bodies gb ON gb.id=cp.body_id
    WHERE gb.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND gb.body_type='CDA' AND cp.estado='VIGENTE';
  IF v <> 17 THEN RAISE EXCEPTION 'W3-G: CdA ARGA != 17 (=%)', v; END IF;
  RAISE NOTICE 'W3-G OK: gobierno resuelto, golden path intacto, 0 huerfanos';
END $$;
