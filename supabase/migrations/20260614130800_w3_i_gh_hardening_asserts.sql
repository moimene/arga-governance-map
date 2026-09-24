-- W3-I — Cierre de la revisión adversarial /codex sobre W3-G y W3-H (2026-06-14).
-- ============================================================================
-- La revisión /codex de las migraciones G (20260614120000) y H (20260614121000)
-- emitió ROJO con 3 [major] + 1 [minor]. Tras verificación empírica contra Cloud:
--
--   · [major] G3 "demueve demasiado": FALSO empíricamente. El backup
--     w3_backup_gh_20260614 tenía exactamente 6 bundles SEALED, los 6 SIN token
--     (qseal+tsq NULL); G3 demovió exactamente esos 6. No existía ningún SEALED
--     legítimo (con token) que dañar. Se blinda con un guard permanente abajo.
--
--   · [major] fallback de titular en H crea ownership errónea para una entidad
--     parent-NULL que no sea Fundación: el ÚNICO caso real en datos es ARGA RE
--     (04d0a477), que es PRE-EXISTENTE (holding en backup, 20M títulos, no la firma
--     1M de H) y estaba EXCLUIDA de H. El code-path de fallback de H nunca se
--     ejecutó (toda filial nutrida resolvió la PJ de su matriz). No obstante, la
--     incoherencia es real: ARGA RE está participada 100% por ARGA Seguros pero
--     tenía parent_entity_id NULL (se renderiza como raíz del árbol). Se corrige
--     aquí fijando su matriz a ARGA Seguros (coherente con el holding existente).
--
--   · [major] el self-verify de H no comprobaba cap por filial, dirección de
--     ownership, authority_evidence generada ni proyección. Los datos YA son
--     correctos (verificado vía MCP: cap_tables_rotas=0, 0 self/ciclos, 0 cargos
--     sin authority). Se añaden esos asserts como guard PERMANENTE.
--
--   · [minor] H se describe como "idempotente": corrección de registro — H es
--     one-shot forward-only (salta entidades con cargos VIGENTE; un replay sobre
--     una entidad con holdings previos y sin cargos podría duplicar). H se deja
--     byte-idéntica a lo aplicado; este comentario es la corrección documental.
--
-- Esta migración: (1) corrige el parent de ARGA RE; (2) instala asserts que RAISE
-- (rollback transaccional) si cualquier invariante G/H se viola. Forward-only,
-- sin replica mode (solo un UPDATE + asserts). Idempotente y re-ejecutable.

-- (1) Coherencia del árbol: ARGA RE participada 100% por ARGA Seguros -> matriz ARGA.
UPDATE public.entities
  SET parent_entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602'
  WHERE id='04d0a477-3b0d-41af-b5e4-9a46195da272'
    AND parent_entity_id IS NULL
    AND EXISTS (SELECT 1 FROM public.capital_holdings ch
                WHERE ch.entity_id='04d0a477-3b0d-41af-b5e4-9a46195da272'
                  AND ch.holder_person_id='15fab4ff-2a1f-59c1-b2fd-e849cb4cf936'
                  AND ch.effective_to IS NULL AND ch.porcentaje_capital=100);

-- (2) Guards permanentes (todos pasan hoy; RAISE -> rollback si regresan)
DO $$
DECLARE v int; v_pct numeric; r record; v_orphans bigint; v_total bigint := 0; v_sql text;
BEGIN
  -- G3: trust-boundary — ningún SEALED puede carecer de token cualificado (qseal/tsq)
  SELECT count(*) INTO v FROM public.evidence_bundles
    WHERE status='SEALED' AND qseal_token IS NULL AND tsq_token IS NULL;
  IF v <> 0 THEN RAISE EXCEPTION 'W3-I: % bundle(s) SEALED sin token (sandbox sellado como final)', v; END IF;

  -- Ownership: nadie es titular de su propio capital
  SELECT count(*) INTO v FROM public.capital_holdings ch JOIN public.entities e ON e.id=ch.entity_id
    WHERE ch.effective_to IS NULL AND ch.holder_person_id = e.person_id;
  IF v <> 0 THEN RAISE EXCEPTION 'W3-I: % holding(s) de auto-propiedad', v; END IF;

  -- Ownership: sin ciclos (la entidad del titular no puede ser descendiente directa de la participada)
  SELECT count(*) INTO v FROM public.capital_holdings ch
    JOIN public.entities held ON held.id=ch.entity_id
    JOIN public.entities holderent ON holderent.person_id=ch.holder_person_id
    WHERE ch.effective_to IS NULL AND holderent.parent_entity_id = held.id;
  IF v <> 0 THEN RAISE EXCEPTION 'W3-I: % holding(s) cíclico(s) matriz<->filial', v; END IF;

  -- Árbol: las únicas raíces (parent NULL) admisibles son Fundación (ápex) y ARGA
  -- Seguros (cotizada, 30.31% free float; su control 69.69% queda en capital_holdings)
  SELECT count(*) INTO v FROM public.entities
    WHERE parent_entity_id IS NULL
      AND id NOT IN ('7b9dd701-1ed1-4911-88ba-e186a86083bc','6d7ed736-f263-4531-a59d-c6ca0cd41602');
  IF v <> 0 THEN RAISE EXCEPTION 'W3-I: % entidad(es) sin matriz (raíz inesperada)', v; END IF;

  -- Cap table: toda entidad no-fundacional suma 100% (no-treasury)
  SELECT count(*) INTO v FROM public.entities e
    WHERE e.common_name NOT ILIKE '%Fundaci%'
      AND round((SELECT COALESCE(sum(porcentaje_capital) FILTER (WHERE NOT is_treasury),0)
                 FROM public.capital_holdings ch WHERE ch.entity_id=e.id AND ch.effective_to IS NULL),2) <> 100;
  IF v <> 0 THEN RAISE EXCEPTION 'W3-I: % cap table(s) no suman 100%%', v; END IF;

  -- Authority: todo cargo certificante VIGENTE (PRES/SEC/ADMIN_UNICO) tiene authority_evidence
  SELECT count(*) INTO v FROM public.condiciones_persona cp
    WHERE cp.estado='VIGENTE' AND cp.tipo_condicion IN ('PRESIDENTE','SECRETARIO','ADMIN_UNICO')
      AND NOT EXISTS (SELECT 1 FROM public.authority_evidence ae
        WHERE ae.tenant_id=cp.tenant_id AND ae.entity_id=cp.entity_id
          AND COALESCE(ae.body_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(cp.body_id,'00000000-0000-0000-0000-000000000000'::uuid)
          AND ae.person_id=cp.person_id AND ae.cargo=cp.tipo_condicion AND ae.estado='VIGENTE');
  IF v <> 0 THEN RAISE EXCEPTION 'W3-I: % cargo(s) certificante(s) sin authority_evidence', v; END IF;

  -- Paridades canónicas
  IF (SELECT count(*) FROM public.entities WHERE person_id IS NULL) <> 0 THEN RAISE EXCEPTION 'W3-I: entity sin person_id'; END IF;
  IF (SELECT count(*) FROM public.entities e WHERE NOT EXISTS (SELECT 1 FROM public.entity_capital_profile cp WHERE cp.entity_id=e.id AND cp.estado='VIGENTE')) <> 0 THEN RAISE EXCEPTION 'W3-I: entity sin cprof VIGENTE'; END IF;
  IF (SELECT count(*) FROM public.condiciones_persona cp WHERE cp.tipo_condicion='SOCIO' AND cp.estado='VIGENTE'
        AND NOT EXISTS (SELECT 1 FROM public.capital_holdings ch WHERE ch.entity_id=cp.entity_id AND ch.holder_person_id=cp.person_id AND ch.effective_to IS NULL)) <> 0
    THEN RAISE EXCEPTION 'W3-I: SOCIO sin holding'; END IF;

  -- Golden path ARGA intacto
  SELECT count(*) INTO v FROM public.condiciones_persona cp JOIN public.governing_bodies gb ON gb.id=cp.body_id
    WHERE gb.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND gb.body_type='CDA' AND cp.estado='VIGENTE';
  IF v <> 17 THEN RAISE EXCEPTION 'W3-I: CdA ARGA != 17 (=%)', v; END IF;
  SELECT round(COALESCE(sum(porcentaje_capital) FILTER (WHERE NOT is_treasury),0),2) INTO v_pct
    FROM public.capital_holdings WHERE entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND effective_to IS NULL;
  IF abs(v_pct-100) > 0.01 THEN RAISE EXCEPTION 'W3-I: cap table ARGA != 100 (=%)', v_pct; END IF;

  -- Orphan-scan completo (todas las FK de una sola columna en public)
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
    EXECUTE v_sql INTO v_orphans; v_total := v_total + v_orphans;
  END LOOP;
  IF v_total > 0 THEN RAISE EXCEPTION 'W3-I: % huerfanos FK', v_total; END IF;

  RAISE NOTICE 'W3-I OK: revisión /codex cerrada, invariantes G/H blindadas, golden path intacto';
END $$;
