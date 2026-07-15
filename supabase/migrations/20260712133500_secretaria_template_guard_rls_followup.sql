-- Oleada 3A — los guards de integridad deben observar la fila real aunque la
-- RLS de UPDATE oculte plantillas no BORRADOR al ADMIN_TENANT invocante.
--
-- Ambos triggers son funciones cerradas (sin EXECUTE directo) y solo leen la
-- plantilla exacta para validar tenant/estado y tomar FOR KEY SHARE.

BEGIN;

ALTER FUNCTION public.fn_secretaria_guard_active_template_binding()
  SECURITY DEFINER;
ALTER FUNCTION public.fn_secretaria_guard_template_changelog_tenant()
  SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_active_template_binding()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_secretaria_guard_template_changelog_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

DO $verify_guard_rls_followup$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'fn_secretaria_guard_active_template_binding',
         'fn_secretaria_guard_template_changelog_tenant'
       )
       AND (
         p.prosecdef IS NOT TRUE
         OR (
           COALESCE(p.proconfig, '{}'::text[])
             @> ARRAY['search_path=pg_catalog, public']
         ) IS NOT TRUE
       )
  ) OR (
    SELECT count(*)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'fn_secretaria_guard_active_template_binding',
         'fn_secretaria_guard_template_changelog_tenant'
       )
  ) <> 2 THEN
    RAISE EXCEPTION 'Oleada 3A follow-up: guards sin SECURITY DEFINER/search_path esperado';
  END IF;

  IF has_function_privilege(
       'authenticated',
       'public.fn_secretaria_guard_active_template_binding()',
       'EXECUTE'
     ) OR has_function_privilege(
       'authenticated',
       'public.fn_secretaria_guard_template_changelog_tenant()',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Oleada 3A follow-up: un guard sigue expuesto a invocación directa';
  END IF;
END;
$verify_guard_rls_followup$;

COMMIT;
