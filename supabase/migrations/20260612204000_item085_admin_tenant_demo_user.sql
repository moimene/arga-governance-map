-- ITEM-085 — Usuario ADMIN_TENANT logueable para la demo.
--
-- El usuario demo (demo@arga-seguros.com) es SECRETARIO, por lo que las pestañas del
-- gestor de plantillas que exigen ADMIN_TENANT (Importar, Validación) quedaban
-- ocultas/no demostrables. Existe un segundo usuario auth real
-- (juana.maria.pardo@garrigues.com) SIN roles: se le asigna ADMIN_TENANT para que el
-- camino ADMIN_TENANT sea demostrable iniciando sesión con esa cuenta. No se crea
-- ningún usuario auth nuevo (provisión sensible); solo se asigna el rol en
-- rbac_user_roles. Forward-only, idempotente.

INSERT INTO public.rbac_user_roles (tenant_id, user_id, role_id, assigned_by, is_active)
SELECT '00000000-0000-0000-0000-000000000001'::uuid,
       '9fcf6e58-852d-4c04-96d0-0c377b0951f3'::uuid,
       'aa167d05-f5ba-4f8d-87c8-b5fc682d4383'::uuid,
       '9fcf6e58-852d-4c04-96d0-0c377b0951f3'::uuid,
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.rbac_user_roles
   WHERE tenant_id='00000000-0000-0000-0000-000000000001'
     AND user_id='9fcf6e58-852d-4c04-96d0-0c377b0951f3'
     AND role_id='aa167d05-f5ba-4f8d-87c8-b5fc682d4383'
);

-- Self-verify: juana.maria.pardo tiene el rol ADMIN_TENANT activo.
DO $$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.rbac_user_roles
   WHERE user_id='9fcf6e58-852d-4c04-96d0-0c377b0951f3'
     AND role_id='aa167d05-f5ba-4f8d-87c8-b5fc682d4383' AND is_active=true;
  IF v_n < 1 THEN
    RAISE EXCEPTION 'ITEM-085 verificación fallida: ADMIN_TENANT no asignado';
  END IF;
END $$;
