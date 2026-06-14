-- W3-H — Nutrir al máximo los datos de prueba de todas las filiales (2026-06-14).
-- ============================================================================
-- Para cada sociedad demo aún sin gobierno poblado (cargos VIGENTE = 0; excluye las
-- 5 ya Completa), genera un dataset coherente y navegable, calcado del patrón de la
-- canónica Cartera ARGA S.L.U.:
--   · órgano CDA (reutiliza el existente o lo crea)
--   · clase de acción ORD (reutiliza o crea)
--   · cap table 100%: titular = la PJ de la matriz (o ARGA Seguros si no hay matriz)
--   · SOCIO (body NULL) para el titular
--   · cargos: PRESIDENTE + SECRETARIO en el CDA (certificantes RRM 109.4);
--     no-unipersonal -> +3 CONSEJERO; unipersonal -> +ADMIN_UNICO (body NULL)
--   · authority_evidence VIGENTE para los certificantes (+ ADMIN_UNICO si unipersonal)
-- Personas: pool de 12 ejecutivos demo (PF) reutilizados entre consejos (realista en
-- un grupo). Fundación ARGA recibe Patronato + cargos pero SIN cap table (no tiene
-- socios). Respeta chk_condicion_body_coherente. Idempotente (salta entidades que ya
-- tienen cargos). Backup: w3_backup_gh_20260614. Forward-only.

-- 1) Pool de personas demo (PF). data_class DEMO por defecto (nombres/NIF no-test).
INSERT INTO public.persons (id, tenant_id, full_name, person_type, tax_id) VALUES
 ('c0a1e000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','D. Gonzalo Herrera Marín','PF','50000001A'),
 ('c0a1e000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000001','Dña. Patricia Ferrer Lemos','PF','50000002B'),
 ('c0a1e000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000001','D. Raúl Castaño Vidal','PF','50000003C'),
 ('c0a1e000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000001','Dña. Beatriz Salas Ortega','PF','50000004D'),
 ('c0a1e000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000001','D. Hugo Ramírez Peña','PF','50000005E'),
 ('c0a1e000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000001','Dña. Lorena Gil Bravo','PF','50000006F'),
 ('c0a1e000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000001','D. Víctor Campos Soler','PF','50000007G'),
 ('c0a1e000-0000-4000-8000-000000000008','00000000-0000-0000-0000-000000000001','Dña. Natalia Vargas Cano','PF','50000008H'),
 ('c0a1e000-0000-4000-8000-000000000009','00000000-0000-0000-0000-000000000001','D. Andrés Mella Fuentes','PF','50000009I'),
 ('c0a1e000-0000-4000-8000-000000000010','00000000-0000-0000-0000-000000000001','Dña. Cristina Rey Pardo','PF','50000010J'),
 ('c0a1e000-0000-4000-8000-000000000011','00000000-0000-0000-0000-000000000001','D. Óscar Benítez Lara','PF','50000011K'),
 ('c0a1e000-0000-4000-8000-000000000012','00000000-0000-0000-0000-000000000001','Dña. Silvia Cortés Nava','PF','50000012L')
ON CONFLICT (id) DO NOTHING;

-- 2) tipo_organo_admin coherente donde falte (target de nutrición)
UPDATE public.entities e SET tipo_organo_admin = CASE WHEN COALESCE(e.es_unipersonal,false) THEN 'ADMIN_UNICO' ELSE 'CDA' END
WHERE e.person_id IS NOT NULL AND e.tipo_organo_admin IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.condiciones_persona cp WHERE cp.entity_id=e.id AND cp.estado='VIGENTE')
  AND e.id <> '7b9dd701-1ed1-4911-88ba-e186a86083bc';

-- 3) Generación por filial
DO $$
DECLARE
  v_t uuid := '00000000-0000-0000-0000-000000000001';
  v_arga_pj uuid := '15fab4ff-2a1f-59c1-b2fd-e849cb4cf936';
  v_fund uuid := '7b9dd701-1ed1-4911-88ba-e186a86083bc';
  v_pool uuid[] := ARRAY[
    'c0a1e000-0000-4000-8000-000000000001','c0a1e000-0000-4000-8000-000000000002','c0a1e000-0000-4000-8000-000000000003',
    'c0a1e000-0000-4000-8000-000000000004','c0a1e000-0000-4000-8000-000000000005','c0a1e000-0000-4000-8000-000000000006',
    'c0a1e000-0000-4000-8000-000000000007','c0a1e000-0000-4000-8000-000000000008','c0a1e000-0000-4000-8000-000000000009',
    'c0a1e000-0000-4000-8000-000000000010','c0a1e000-0000-4000-8000-000000000011','c0a1e000-0000-4000-8000-000000000012']::uuid[];
  rec record; v_seq int := 0; v_body uuid; v_sc uuid; v_holder uuid; v_uni boolean; v_isfund boolean;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;
BEGIN
  FOR rec IN
    SELECT e.id, e.legal_name, COALESCE(e.es_unipersonal,false) AS uni, e.parent_entity_id
    FROM public.entities e
    WHERE e.person_id IS NOT NULL
      AND e.id NOT IN ('00000000-0000-0000-0000-000000000020','04d0a477-3b0d-41af-b5e4-9a46195da272',
                       'a375c963-3236-5056-b61e-c2314ce1ed25','d0e36d02-032c-5eb4-9436-213cc92554de',
                       '6d7ed736-f263-4531-a59d-c6ca0cd41602')
      AND NOT EXISTS (SELECT 1 FROM public.condiciones_persona cp WHERE cp.entity_id=e.id AND cp.estado='VIGENTE')
    ORDER BY e.legal_name
  LOOP
    v_seq := v_seq + 1;
    v_uni := rec.uni;
    v_isfund := (rec.id = v_fund);
    p1 := v_pool[1 + (v_seq*5 + 0) % 12];
    p2 := v_pool[1 + (v_seq*5 + 1) % 12];
    p3 := v_pool[1 + (v_seq*5 + 2) % 12];
    p4 := v_pool[1 + (v_seq*5 + 3) % 12];
    p5 := v_pool[1 + (v_seq*5 + 4) % 12];

    -- titular = PJ de la matriz (o ARGA Seguros)
    SELECT person_id INTO v_holder FROM public.entities WHERE id = rec.parent_entity_id;
    IF v_holder IS NULL THEN v_holder := v_arga_pj; END IF;

    -- órgano CDA (reutiliza CDA existente; si no, crea)
    SELECT id INTO v_body FROM public.governing_bodies WHERE entity_id=rec.id AND body_type='CDA' ORDER BY created_at LIMIT 1;
    IF v_body IS NULL THEN
      v_body := gen_random_uuid();
      INSERT INTO public.governing_bodies(id, slug, tenant_id, entity_id, name, body_type)
        VALUES (v_body, 'cda-'||replace(rec.id::text,'-',''), v_t, rec.id,
                CASE WHEN v_isfund THEN 'Patronato' ELSE 'Consejo de Administración' END, 'CDA');
    END IF;

    -- clase de acción
    SELECT id INTO v_sc FROM public.share_classes WHERE entity_id=rec.id ORDER BY created_at LIMIT 1;
    IF v_sc IS NULL THEN
      v_sc := gen_random_uuid();
      INSERT INTO public.share_classes(id, tenant_id, entity_id, class_code, name, votes_per_title, economic_rights_coeff, voting_rights)
        VALUES (v_sc, v_t, rec.id, 'ORD', 'Acciones/participaciones ordinarias', 1, 1, true);
    END IF;

    -- cap table + SOCIO (excepto Fundación: no tiene socios)
    IF NOT v_isfund THEN
      INSERT INTO public.capital_holdings(id, tenant_id, entity_id, holder_person_id, share_class_id, numero_titulos, porcentaje_capital, voting_rights, is_treasury, effective_from)
        VALUES (gen_random_uuid(), v_t, rec.id, v_holder, v_sc, 1000000, 100, true, false, DATE '2025-01-01');
      INSERT INTO public.condiciones_persona(id, tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio, fuente_designacion)
        VALUES (gen_random_uuid(), v_t, v_holder, rec.id, NULL, 'SOCIO', 'VIGENTE', DATE '2025-01-01', 'BOOTSTRAP');
    END IF;

    -- certificantes en el CDA (RRM 109.4): PRESIDENTE + SECRETARIO.
    -- authority_evidence se crea AUTOMÁTICAMENTE por trg_sync_authority_evidence
    -- (AFTER INSERT en condiciones_persona) — NO insertar explícitamente (ux_authority_vigente).
    INSERT INTO public.condiciones_persona(id, tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio, fuente_designacion)
      VALUES (gen_random_uuid(), v_t, p1, rec.id, v_body, 'PRESIDENTE', 'VIGENTE', DATE '2025-01-01', 'BOOTSTRAP'),
             (gen_random_uuid(), v_t, p2, rec.id, v_body, 'SECRETARIO', 'VIGENTE', DATE '2025-01-01', 'BOOTSTRAP');

    -- forma de administración
    IF v_uni THEN
      INSERT INTO public.condiciones_persona(id, tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio, fuente_designacion)
        VALUES (gen_random_uuid(), v_t, p1, rec.id, NULL, 'ADMIN_UNICO', 'VIGENTE', DATE '2025-01-01', 'BOOTSTRAP');
    ELSE
      INSERT INTO public.condiciones_persona(id, tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio, fuente_designacion)
        VALUES (gen_random_uuid(), v_t, p3, rec.id, v_body, 'CONSEJERO', 'VIGENTE', DATE '2025-01-01', 'BOOTSTRAP'),
               (gen_random_uuid(), v_t, p4, rec.id, v_body, 'CONSEJERO', 'VIGENTE', DATE '2025-01-01', 'BOOTSTRAP'),
               (gen_random_uuid(), v_t, p5, rec.id, v_body, 'CONSEJERO', 'VIGENTE', DATE '2025-01-01', 'BOOTSTRAP');
    END IF;
  END LOOP;
  RAISE NOTICE 'W3-H: % filiales nutridas', v_seq;
END $$;

-- 4) regenerar proyección de partes votantes (best-effort, no aborta por entidad)
DO $$
DECLARE e record;
BEGIN
  FOR e IN SELECT id FROM public.entities WHERE person_id IS NOT NULL LOOP
    BEGIN
      PERFORM public.fn_refresh_parte_votante_entity(e.id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- 5) self-verify: orphan-scan + paridades + golden path
DO $$
DECLARE r record; v_orphans bigint; v_total bigint := 0; v_sql text;
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
    EXECUTE v_sql INTO v_orphans; v_total := v_total + v_orphans;
  END LOOP;
  IF v_total > 0 THEN RAISE EXCEPTION 'W3-H: % huerfanos tras nutrir', v_total; END IF;
END $$;
DO $$
DECLARE v int; v_pct numeric;
BEGIN
  IF (SELECT count(*) FROM public.entities WHERE person_id IS NULL) <> 0 THEN RAISE EXCEPTION 'W3-H: entity person_id NULL'; END IF;
  IF (SELECT count(*) FROM public.entities e WHERE NOT EXISTS (SELECT 1 FROM public.entity_capital_profile cp WHERE cp.entity_id=e.id AND cp.estado='VIGENTE')) <> 0 THEN RAISE EXCEPTION 'W3-H: entity sin cprof VIGENTE'; END IF;
  SELECT count(*) INTO v FROM public.condiciones_persona cp JOIN public.governing_bodies gb ON gb.id=cp.body_id
    WHERE gb.entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND gb.body_type='CDA' AND cp.estado='VIGENTE';
  IF v <> 17 THEN RAISE EXCEPTION 'W3-H: CdA ARGA != 17 (=%)', v; END IF;
  SELECT round(COALESCE(sum(porcentaje_capital) FILTER (WHERE NOT is_treasury),0),2) INTO v_pct
    FROM public.capital_holdings WHERE entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND effective_to IS NULL;
  IF abs(v_pct-100) > 0.01 THEN RAISE EXCEPTION 'W3-H: cap table ARGA != 100 (=%)', v_pct; END IF;
  RAISE NOTICE 'W3-H OK: filiales nutridas, golden path intacto, 0 huerfanos';
END $$;
