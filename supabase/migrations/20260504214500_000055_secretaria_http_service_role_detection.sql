-- ============================================================
-- Migration 000055: secretaria P0 HTTP service_role detection hotfix
--
-- PostgREST exposes JWT role reliably through auth.jwt()->>'role' and
-- request.jwt.claims. SQL smoke tests set request.jwt.claim.role manually.
-- SECURITY DEFINER helpers must support both paths.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_secretaria_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(auth.jwt() ->> 'role', ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '')
  ) = 'service_role'
$$;

CREATE OR REPLACE FUNCTION fn_secretaria_assert_tenant_access(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_current_tenant_id uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF fn_secretaria_is_service_role() THEN
    RETURN;
  END IF;

  SELECT fn_secretaria_current_tenant_id() INTO v_current_tenant_id;
  IF v_current_tenant_id IS NULL OR v_current_tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'tenant access denied for %', p_tenant_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_secretaria_is_service_role()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_secretaria_assert_tenant_access(uuid)
  TO authenticated, service_role;
