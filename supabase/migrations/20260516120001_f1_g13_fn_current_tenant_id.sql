-- =============================================================
-- F1.G13 — Tenant Identity Contract (público)
-- Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §3
-- Owner decision (2026-05-16): Path B (app_metadata.tenant_id) — Free tier OK
-- =============================================================
--
-- Crea el helper público `fn_current_tenant_id()` que resuelve el tenant del
-- usuario autenticado. Se diferencia de `fn_secretaria_current_tenant_id()`
-- (introducido en 20260504193000_000052) en que es **público** y no scoped a
-- Secretaría — sirve para todas las policies multi-tenant del shell TGMS.
--
-- Cadena de resolución (fail-safe a NULL para que policies bloqueen en silencio):
--   Path A: `auth.jwt() ->> 'tenant_id'`         (custom Access Token hook)
--   Path B: `auth.jwt() #>> '{app_metadata,tenant_id}'`  (default Supabase admin)
--   Path C: `user_profiles.tenant_id WHERE user_id = auth.uid()`
--
-- Como complemento, `fn_assert_current_tenant_id()` lanza excepción cuando los
-- tres paths fallan — útil para RPCs que necesitan diagnóstico explícito.
--
-- Permisos: REVOKE PUBLIC,anon; GRANT authenticated, service_role.
-- Service role mantiene acceso para edge functions y backend jobs.

CREATE OR REPLACE FUNCTION public.fn_current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims jsonb;
  v_tenant_text text;
  v_tenant uuid;
BEGIN
  -- auth.jwt() devuelve jsonb con claims si hay sesión; vacío para anon.
  v_claims := COALESCE(auth.jwt(), '{}'::jsonb);

  -- Path A: root claim (custom Access Token hook si se configura).
  v_tenant_text := v_claims ->> 'tenant_id';
  IF v_tenant_text IS NOT NULL AND v_tenant_text <> '' THEN
    BEGIN
      RETURN v_tenant_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- Claim presente pero no parseable: log + caer al siguiente path.
      RAISE WARNING 'fn_current_tenant_id: root claim tenant_id no parseable: %', v_tenant_text;
    END;
  END IF;

  -- Path B: app_metadata.tenant_id (default Supabase admin enrichment).
  v_tenant_text := v_claims #>> '{app_metadata,tenant_id}';
  IF v_tenant_text IS NOT NULL AND v_tenant_text <> '' THEN
    BEGIN
      RETURN v_tenant_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE WARNING 'fn_current_tenant_id: app_metadata.tenant_id no parseable: %', v_tenant_text;
    END;
  END IF;

  -- Path C: fallback a user_profiles by auth.uid().
  SELECT up.tenant_id INTO v_tenant
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid()
  LIMIT 1;

  RETURN v_tenant;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_current_tenant_id() TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_current_tenant_id() IS
  'F1.G13: helper público que resuelve tenant del usuario autenticado. '
  'Cadena: JWT root claim → app_metadata → user_profiles. Devuelve NULL si '
  'ningún path resuelve, para que policies USING (tenant_id = fn_*) bloqueen '
  'en silencio. Para diagnóstico explícito usa fn_assert_current_tenant_id().';


CREATE OR REPLACE FUNCTION public.fn_assert_current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.fn_current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'fn_assert_current_tenant_id: no tenant_id resolved for user % (jwt, app_metadata and user_profiles all empty)', auth.uid()
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v_tenant;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_assert_current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_assert_current_tenant_id() TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_assert_current_tenant_id() IS
  'F1.G13: variante de fn_current_tenant_id() que RAISE EXCEPTION si los tres '
  'paths (jwt root, app_metadata, user_profiles) no resuelven. Para uso en '
  'RPCs que necesitan diagnóstico explícito en lugar de bloqueo silencioso.';

-- =============================================================
-- Cierre G13 — Probe mecánico (lista en spec §3 plan v1)
-- =============================================================
-- Ejecutar en Cloud post-apply:
--   SELECT to_regprocedure('public.fn_current_tenant_id()')        IS NOT NULL AS fn_exists;
--   SELECT to_regprocedure('public.fn_assert_current_tenant_id()') IS NOT NULL AS assert_exists;
--   SELECT polname FROM pg_policy p
--     JOIN pg_class c ON p.polrelid = c.oid
--    WHERE pg_get_expr(p.polqual, p.polrelid) ILIKE '%fn_current_tenant_id%';
--   -- Esperado: 0 antes de G1, >0 después.
