-- W3-F5b — Cierre de hallazgo P0 de la 2ª revisión /codex (2026-06-14).
-- ============================================================================
-- La migración de recuperación (20260614111000) borró personas-fixture del test-run
-- pero NO llevaba el orphan-scan genérico que sí tenía F1; bajo replica (FK RESTRICT
-- desactivado) dejó 2 `authority_evidence` huérfanos (cargo VICESECRETARIO en el CdA
-- de ARGA, fixtures del test-run, ausentes del backup, apuntando a personas borradas).
-- Se borran y se re-verifica con un orphan-scan COMPLETO public->public que RAISE
-- (rollback) ante cualquier huérfano. Forward-only, idempotente.

SET LOCAL session_replication_role = replica;
DELETE FROM public.authority_evidence ae
  WHERE ae.person_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.persons p WHERE p.id=ae.person_id);
SET LOCAL session_replication_role = DEFAULT;

-- orphan-scan COMPLETO: cualquier FK mono-columna public->public con hijo colgando => rollback
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
  IF v_total > 0 THEN RAISE EXCEPTION 'W3-F5b: quedan % huerfanos:%', v_total, v_list; END IF;
  RAISE NOTICE 'W3-F5b OK: 0 huerfanos public->public en todo el esquema';
END $$;
