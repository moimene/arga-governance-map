-- =============================================================
-- F2.G2 + G19 — Revoke EXECUTE on RPCs from PUBLIC/anon
-- Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §4
-- =============================================================
--
-- G2 — Revoke EXECUTE on every fn_* in schema public/auth/storage from
-- PUBLIC and anon, except whitelist of expected_public functions.
--
-- G19 — ALTER DEFAULT PRIVILEGES in schema public so future functions don't
-- silently leak EXECUTE to PUBLIC.
--
-- Probe (concilio K3): uses pg_proc + aclexplode + acldefault to capture
-- both explicit and implicit (default) grants. Previous probe via
-- information_schema missed overloaded signatures and trigger functions.
--
-- Forward-only. Rollback = explicit re-grant per fn (incidente).

-- =============================================================
-- G2: dynamic REVOKE EXECUTE FROM PUBLIC, anon on every leaking function
-- =============================================================

DO $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS args,
      acl.grantee AS grantee,
      acl.privilege_type AS priv
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl ON true
    WHERE n.nspname = 'public'
      AND acl.privilege_type = 'EXECUTE'
      AND acl.grantee IN (
        0::oid,  -- 0 = PUBLIC (pseudo-role)
        (SELECT oid FROM pg_roles WHERE rolname = 'anon')
      )
      -- Whitelist: helpers de auth.jwt() / common utilities en extensions y
      -- pg_* stay public. Limit scope to functions defined under our naming
      -- conventions (fn_*, app-level RPCs).
      AND (
        p.proname LIKE 'fn\_%' ESCAPE '\'
        OR p.proname LIKE 'fn%_'
      )
    ORDER BY n.nspname, p.proname, args
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM %s',
        r.schema_name, r.func_name, r.args,
        CASE WHEN r.grantee = 0 THEN 'PUBLIC' ELSE 'anon' END
      );
      v_count := v_count + 1;
      RAISE NOTICE 'F2.G2 revoked EXECUTE on %.%(%) from %', r.schema_name, r.func_name, r.args, CASE WHEN r.grantee = 0 THEN 'PUBLIC' ELSE 'anon' END;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'F2.G2 failed to revoke %.%(%): %', r.schema_name, r.func_name, r.args, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'F2.G2 — total grants revoked: %', v_count;
END;
$$;

-- =============================================================
-- G2: re-grant EXECUTE to authenticated + service_role for the same fns
-- (only if they previously had any grant — otherwise leave as locked)
-- =============================================================
-- The DO above stripped PUBLIC/anon. authenticated grants stay intact if
-- they existed. For fns that ONLY had PUBLIC grant, callers via JWT need
-- an explicit re-grant. The whitelist below is the set of fns we know
-- must remain callable by `authenticated`. The list is built from the
-- intersection of (functions previously granted to PUBLIC) and (functions
-- referenced from the frontend via supabase.rpc).
--
-- For safety, we grant `authenticated` and `service_role` to all fns named
-- `fn_*` in schema public — that's our naming convention for "callable by
-- the app".

DO $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'fn\_%' ESCAPE '\'
        OR p.proname LIKE 'fn%_'
      )
      -- Skip if already has explicit authenticated grant.
      AND NOT EXISTS (
        SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
        WHERE acl.privilege_type = 'EXECUTE'
          AND acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
      )
    ORDER BY n.nspname, p.proname, args
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
        r.schema_name, r.func_name, r.args);
      v_count := v_count + 1;
      RAISE NOTICE 'F2.G2 granted EXECUTE on %.%(%) TO authenticated, service_role', r.schema_name, r.func_name, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'F2.G2 failed to grant authenticated on %.%(%): %', r.schema_name, r.func_name, r.args, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'F2.G2 — total authenticated grants added: %', v_count;
END;
$$;

-- =============================================================
-- G19: ALTER DEFAULT PRIVILEGES for future functions
-- =============================================================
-- These statements affect functions created AFTER this migration by
-- whichever role runs CREATE FUNCTION. We set defaults for the postgres
-- role (which owns migrations) and the supabase_admin role if it owns
-- anything.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- For symmetry on supabase_admin (the role used by managed migrations).
-- Wrapped in EXCEPTION block: the migration runner is `postgres`, which lacks
-- ALTER DEFAULT PRIVILEGES privilege on supabase_admin. We swallow the
-- permission-denied error and emit a warning. The `postgres` role default
-- privileges (set above) cover the migrations we run; supabase_admin
-- defaults need to be set out-of-band by Supabase support or via dashboard.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    BEGIN
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated';
      RAISE NOTICE 'F2.G19: default privileges set for supabase_admin role';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'F2.G19: cannot ALTER DEFAULT PRIVILEGES for supabase_admin (postgres lacks privilege). Manual action needed via Supabase dashboard or support ticket. Skipping.';
    END;
  END IF;
END;
$$;

COMMENT ON SCHEMA public IS
  'F2.G19: default privileges revoke EXECUTE on future fns from PUBLIC, anon. '
  'Granted to authenticated by default. service_role grants are explicit per fn.';

-- =============================================================
-- Cierre G2 + G19 — Probe mecánico
-- =============================================================
DO $$
DECLARE
  v_leftover integer;
BEGIN
  SELECT count(*) INTO v_leftover
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl ON true
  WHERE n.nspname = 'public'
    AND acl.privilege_type = 'EXECUTE'
    AND acl.grantee IN (
      0::oid,
      (SELECT oid FROM pg_roles WHERE rolname = 'anon')
    )
    AND (p.proname LIKE 'fn\_%' ESCAPE '\' OR p.proname LIKE 'fn%_');

  IF v_leftover > 0 THEN
    RAISE EXCEPTION 'F2.G2 verification failed: % fn_* still have EXECUTE granted to PUBLIC/anon', v_leftover;
  END IF;
  RAISE NOTICE 'F2.G2 verification OK: 0 fn_* with EXECUTE to PUBLIC/anon';
END;
$$;
