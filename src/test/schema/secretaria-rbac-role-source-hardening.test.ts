import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260712140000_secretaria_rbac_role_source_hardening.sql",
  ),
  "utf8",
);
const probe = readFileSync(
  resolve(process.cwd(), "supabase/tests/secretaria_template_activation_integrity_probe.sql"),
  "utf8",
);

describe("Oleada 3A — fuente RBAC no automutable", () => {
  it("reconstruye todas las policies como lectura autenticada sin DML", () => {
    expect(migration).toMatch(/tablename IN \('rbac_roles', 'rbac_user_roles'\)/);
    expect(migration).toMatch(/CREATE POLICY rbac_roles_authenticated_read[\s\S]*FOR SELECT TO authenticated/);
    expect(migration).toMatch(/CREATE POLICY rbac_user_roles_tenant_read[\s\S]*FOR SELECT TO authenticated/);
    expect(migration).not.toMatch(/CREATE POLICY [^\n]+[\s\S]{0,180}FOR (?:ALL|INSERT|UPDATE|DELETE) TO authenticated/);
  });

  it("revoca por defecto y regranta únicamente lectura humana y CRUD de servicio", () => {
    expect(migration).toMatch(/REVOKE ALL ON public\.rbac_roles[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
    expect(migration).toMatch(/REVOKE ALL ON public\.rbac_user_roles[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
    expect(migration).toMatch(/GRANT SELECT ON public\.rbac_roles TO authenticated/);
    expect(migration).toMatch(/GRANT SELECT ON public\.rbac_user_roles TO authenticated/);
    expect(migration).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.rbac_user_roles TO service_role/);
    expect(migration).not.toMatch(/GRANT[^;]*(?:TRUNCATE|TRIGGER|REFERENCES)/);
  });

  it("gobierna SoD sin romper SodGuard y cierra el trigger a ejecución directa", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_check_sod_violations/);
    expect(migration).toMatch(/cross-tenant SoD lookup forbidden/);
    expect(migration).toMatch(/auth\.uid\(\) IS DISTINCT FROM p_user_id[\s\S]*fn_secretaria_assert_active_template_admin/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_check_sod_violations[\s\S]*TO authenticated, service_role/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.tg_sync_scope_app_meta/);
    expect(migration).toMatch(/has_table_privilege\('authenticated',[\s\S]*'INSERT'\)/);
    expect(migration).toMatch(/has_table_privilege\('anon',[\s\S]*'SELECT'\)/);
    expect(migration).toMatch(/v_unexpected_policies/);
    expect(migration).toMatch(/policies inesperadas en la fuente de autorización/);
  });

  it("prueba autoescalada, expiración, cruce de tenant, SoD y CRUD de servicio", () => {
    expect(probe).toMatch(/SECRETARIO pudo autoasignarse ADMIN_TENANT/);
    expect(probe).toMatch(/ADMIN_TENANT expirado fue tratado como activo/);
    expect(probe).toMatch(/cross-tenant SoD lookup forbidden/);
    expect(probe).toMatch(/SECRETARIO no pudo consultar su propio conflicto SoD/);
    expect(probe).toMatch(/ADMIN_TENANT no pudo revisar el SoD de un tercero del tenant/);
    expect(probe).toMatch(/service_role no pudo eliminar la asignación fixture/);
    expect(probe).toMatch(/ROLLBACK;/);
  });
});
