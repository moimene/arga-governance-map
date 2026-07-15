-- Oleada 3A — cierre de la fuente de autorización de gobierno de plantillas.
--
-- La RPC de transición confía en rbac_user_roles. Esa tabla no puede ser
-- automutable por el mismo rol authenticated cuya autorización decide.
-- Las asignaciones siguen siendo legibles por tenant, pero todo DML queda
-- reservado a owner/service_role hasta disponer de una RPC de administración
-- con SoD y auditoría explícitas.

BEGIN;

ALTER TABLE public.rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_user_roles ENABLE ROW LEVEL SECURITY;

-- Reconciliar tanto la policy histórica del repo como la policy ya saneada en
-- Cloud. Se eliminan todas las policies de estas dos tablas y se reconstruye el
-- contrato mínimo para que una instalación limpia no recupere el bypass.
DO $drop_legacy_rbac_policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('rbac_roles', 'rbac_user_roles')
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END;
$drop_legacy_rbac_policies$;

CREATE POLICY rbac_roles_authenticated_read
  ON public.rbac_roles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY rbac_user_roles_tenant_read
  ON public.rbac_user_roles
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

REVOKE ALL ON public.rbac_roles
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.rbac_user_roles
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.rbac_roles TO authenticated;
GRANT SELECT ON public.rbac_user_roles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_user_roles TO service_role;

-- SodGuard consume este helper desde authenticated. Se conserva la firma, pero
-- tenant y sujeto dejan de ser parámetros confiables: un usuario puede revisar
-- su propio SoD; revisar a terceros exige ADMIN_TENANT activo en ese tenant.
CREATE OR REPLACE FUNCTION public.fn_check_sod_violations(
  p_tenant_id uuid,
  p_user_id uuid,
  p_proposed_role text
) RETURNS TABLE(
  conflicting_role text,
  reason text,
  severity text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL OR NULLIF(btrim(p_proposed_role), '') IS NULL THEN
    RAISE EXCEPTION 'tenant, user and proposed role are required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(public.fn_secretaria_is_service_role(), false) THEN
    IF public.fn_current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
      RAISE EXCEPTION 'cross-tenant SoD lookup forbidden'
        USING ERRCODE = '42501';
    END IF;
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      PERFORM public.fn_secretaria_assert_active_template_admin(p_tenant_id);
    END IF;
  END IF;

  RETURN QUERY
  SELECT sp.role_a, sp.reason, sp.severity
    FROM public.sod_toxic_pairs sp
    JOIN public.rbac_roles existing_role ON existing_role.role_code = sp.role_a
    JOIN public.rbac_user_roles ur ON ur.role_id = existing_role.id
   WHERE ur.tenant_id = p_tenant_id
     AND ur.user_id = p_user_id
     AND ur.is_active = true
     AND (ur.expires_at IS NULL OR ur.expires_at > now())
     AND sp.role_b = upper(btrim(p_proposed_role))
  UNION
  SELECT sp.role_b, sp.reason, sp.severity
    FROM public.sod_toxic_pairs sp
    JOIN public.rbac_roles existing_role ON existing_role.role_code = sp.role_b
    JOIN public.rbac_user_roles ur ON ur.role_id = existing_role.id
   WHERE ur.tenant_id = p_tenant_id
     AND ur.user_id = p_user_id
     AND ur.is_active = true
     AND (ur.expires_at IS NULL OR ur.expires_at > now())
     AND sp.role_a = upper(btrim(p_proposed_role));
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_check_sod_violations(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_check_sod_violations(uuid, uuid, text)
  TO authenticated, service_role;

-- Es una función de trigger SECURITY DEFINER; el trigger no necesita que los
-- roles API puedan ejecutarla directamente.
REVOKE ALL ON FUNCTION public.tg_sync_scope_app_meta()
  FROM PUBLIC, anon, authenticated, service_role;

DO $verify_rbac_role_source_hardening$
DECLARE
  v_unexpected_policies integer;
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.rbac_roles', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.rbac_user_roles', 'SELECT') THEN
    RAISE EXCEPTION 'Oleada 3A RBAC: authenticated perdió lectura necesaria';
  END IF;

  IF has_table_privilege('authenticated', 'public.rbac_roles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.rbac_roles', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.rbac_roles', 'DELETE')
     OR has_table_privilege('authenticated', 'public.rbac_roles', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.rbac_roles', 'TRIGGER')
     OR has_table_privilege('authenticated', 'public.rbac_user_roles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.rbac_user_roles', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.rbac_user_roles', 'DELETE')
     OR has_table_privilege('authenticated', 'public.rbac_user_roles', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.rbac_user_roles', 'TRIGGER') THEN
    RAISE EXCEPTION 'Oleada 3A RBAC: authenticated conserva DML o privilegios de bypass';
  END IF;

  IF has_table_privilege('anon', 'public.rbac_roles', 'SELECT')
     OR has_table_privilege('anon', 'public.rbac_roles', 'INSERT')
     OR has_table_privilege('anon', 'public.rbac_roles', 'UPDATE')
     OR has_table_privilege('anon', 'public.rbac_roles', 'DELETE')
     OR has_table_privilege('anon', 'public.rbac_roles', 'TRUNCATE')
     OR has_table_privilege('anon', 'public.rbac_user_roles', 'SELECT')
     OR has_table_privilege('anon', 'public.rbac_user_roles', 'INSERT')
     OR has_table_privilege('anon', 'public.rbac_user_roles', 'UPDATE')
     OR has_table_privilege('anon', 'public.rbac_user_roles', 'DELETE')
     OR has_table_privilege('anon', 'public.rbac_user_roles', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Oleada 3A RBAC: anon conserva acceso a las fuentes de autorización';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.rbac_roles', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.rbac_roles', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.rbac_roles', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.rbac_roles', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.rbac_user_roles', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.rbac_user_roles', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.rbac_user_roles', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.rbac_user_roles', 'DELETE')
     OR has_table_privilege('service_role', 'public.rbac_roles', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.rbac_roles', 'TRIGGER')
     OR has_table_privilege('service_role', 'public.rbac_user_roles', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.rbac_user_roles', 'TRIGGER') THEN
    RAISE EXCEPTION 'Oleada 3A RBAC: privilegios de service_role inesperados';
  END IF;

  SELECT count(*)
    INTO v_unexpected_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('rbac_roles', 'rbac_user_roles')
     AND NOT (
       tablename = 'rbac_roles'
       AND policyname = 'rbac_roles_authenticated_read'
       AND cmd = 'SELECT'
       AND roles = ARRAY['authenticated']::name[]
     )
     AND NOT (
       tablename = 'rbac_user_roles'
       AND policyname = 'rbac_user_roles_tenant_read'
       AND cmd = 'SELECT'
       AND roles = ARRAY['authenticated']::name[]
     );

  IF v_unexpected_policies <> 0
     OR (SELECT count(*) FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename IN ('rbac_roles', 'rbac_user_roles')) <> 2 THEN
    RAISE EXCEPTION 'Oleada 3A RBAC: policies inesperadas en la fuente de autorización';
  END IF;

  IF has_function_privilege('anon', 'public.fn_check_sod_violations(uuid,uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.fn_check_sod_violations(uuid,uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.fn_check_sod_violations(uuid,uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.tg_sync_scope_app_meta()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.tg_sync_scope_app_meta()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.tg_sync_scope_app_meta()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Oleada 3A RBAC: ACL inesperada en helpers SoD/scope';
  END IF;
END;
$verify_rbac_role_source_hardening$;

COMMIT;
