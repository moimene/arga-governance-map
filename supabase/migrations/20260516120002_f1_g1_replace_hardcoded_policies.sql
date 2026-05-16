-- =============================================================
-- F1.G1 — Replace hardcoded tenant demo UUID in RLS policies
-- Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §3
-- Precondición: F1.G13 (fn_current_tenant_id) aplicado.
-- =============================================================
--
-- Pasa todas las policies cuya expresión USING/CHECK contiene el literal
-- '00000000-0000-0000-0000-000000000001' a usar `public.fn_current_tenant_id()`.
-- Bloque DO dinámico para cubrir 100% de policies en `public` sin tener que
-- enumerar manualmente y arriesgar omisiones — más seguro contra drift.
--
-- Reglas de transformación:
--   - DROP POLICY antigua
--   - CREATE POLICY <name>_v2 con USING/CHECK reescritos
--   - SCOPE: solo schema public, solo policies con literal demo UUID
--   - Las policies con `auth.uid()`, `auth.role()`, o ya basadas en
--     `fn_*tenant*` se ignoran (no contienen el literal demo)
--
-- Forward-only. Rollback = migración nueva que vuelva al literal (incidente).

DO $$
DECLARE
  r RECORD;
  v_using_new text;
  v_check_new text;
  v_cmd_text  text;
  v_drop_sql  text;
  v_create_sql text;
  v_using_clause text;
  v_check_clause text;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT
      c.relname  AS tablename,
      p.polname  AS policyname,
      p.polcmd   AS cmd,
      pg_get_expr(p.polqual,      p.polrelid) AS using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
      p.polpermissive AS permissive
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND (
        pg_get_expr(p.polqual,      p.polrelid) ILIKE '%00000000-0000-0000-0000-000000000001%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%00000000-0000-0000-0000-000000000001%'
      )
    ORDER BY c.relname, p.polname
  LOOP
    -- Reescribe el literal en ambos lados (regex cubre con o sin ::uuid cast).
    v_using_new := CASE
      WHEN r.using_expr IS NULL THEN NULL
      ELSE regexp_replace(
        r.using_expr,
        '''00000000-0000-0000-0000-000000000001''(::uuid)?',
        'public.fn_current_tenant_id()',
        'g'
      )
    END;
    v_check_new := CASE
      WHEN r.check_expr IS NULL THEN NULL
      ELSE regexp_replace(
        r.check_expr,
        '''00000000-0000-0000-0000-000000000001''(::uuid)?',
        'public.fn_current_tenant_id()',
        'g'
      )
    END;

    -- Map cmd char a texto SQL.
    v_cmd_text := CASE r.cmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
      ELSE 'ALL'
    END;

    -- DROP + CREATE atomic. Si USING NULL → omitir USING; mismo para CHECK.
    v_drop_sql := format('DROP POLICY %I ON public.%I',
      r.policyname, r.tablename);

    v_using_clause := CASE WHEN v_using_new IS NOT NULL
      THEN format('USING (%s)', v_using_new)
      ELSE ''
    END;
    v_check_clause := CASE WHEN v_check_new IS NOT NULL
      THEN format('WITH CHECK (%s)', v_check_new)
      ELSE ''
    END;

    v_create_sql := format(
      'CREATE POLICY %I ON public.%I FOR %s TO authenticated %s %s',
      r.policyname,
      r.tablename,
      v_cmd_text,
      v_using_clause,
      v_check_clause
    );

    EXECUTE v_drop_sql;
    EXECUTE v_create_sql;
    v_count := v_count + 1;

    RAISE NOTICE 'F1.G1 rewrote policy %.%', r.tablename, r.policyname;
  END LOOP;

  RAISE NOTICE 'F1.G1 — total policies rewritten: %', v_count;
END;
$$;

-- =============================================================
-- Cierre G1 — Probe mecánico
-- =============================================================
-- Probe 1: cero policies con literal demo UUID.
DO $$
DECLARE
  v_leftover integer;
BEGIN
  SELECT count(*) INTO v_leftover
  FROM pg_policy p
  JOIN pg_class c ON p.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND (
      pg_get_expr(p.polqual,      p.polrelid) ILIKE '%00000000-0000-0000-0000-000000000001%'
      OR pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%00000000-0000-0000-0000-000000000001%'
    );
  IF v_leftover > 0 THEN
    RAISE EXCEPTION 'F1.G1 verification failed: % policies still reference hardcoded tenant demo UUID', v_leftover;
  END IF;
  RAISE NOTICE 'F1.G1 verification OK: 0 policies with hardcoded tenant demo UUID';
END;
$$;

-- Probe 2: cero policies con DEFAULT literal en columnas tenant_id (no fatal).
DO $$
DECLARE
  v_defaults integer;
BEGIN
  SELECT count(*) INTO v_defaults
  FROM pg_attrdef ad
  JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND a.attname = 'tenant_id'
    AND pg_get_expr(ad.adbin, ad.adrelid) ILIKE '%00000000-0000-0000-0000-000000000001%';
  IF v_defaults > 0 THEN
    RAISE WARNING 'F1.G1: % tenant_id columns still have hardcoded DEFAULT (not policies — informational only)', v_defaults;
  END IF;
END;
$$;
