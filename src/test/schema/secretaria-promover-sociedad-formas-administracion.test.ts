import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260925120000_secretaria_promover_sociedad_formas_administracion.sql"),
  "utf8",
);

describe("MOI-219 — fn_promover_sociedad_operativa formas_administracion", () => {
  it("creates the RPC with SECURITY DEFINER + search_path", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_promover_sociedad_operativa\(\s*p_tenant_id uuid,\s*p_entity_id uuid/);
    expect(migration).toMatch(/SECURITY DEFINER/);
    expect(migration).toMatch(/SET search_path = public/);
  });

  it("guards tenant access + role allowed (SECRETARIO|ADMIN_TENANT)", () => {
    expect(migration).toMatch(/PERFORM public\.fn_secretaria_assert_tenant_access\(p_tenant_id\)/);
    expect(migration).toMatch(/PERFORM public\.fn_secretaria_assert_role_allowed\(\s*p_tenant_id, ARRAY\['SECRETARIO','ADMIN_TENANT'\]/);
  });

  it("preserves TOCTOU locks (FOR UPDATE and pg_advisory_xact_lock)", () => {
    expect(migration).toMatch(/SELECT onboarding_status, forma_administracion\s+INTO v_status, v_forma_admin\s+FROM public\.entities[\s\S]*?FOR UPDATE/);
    expect(migration).toMatch(/PERFORM pg_advisory_xact_lock\(hashtext\('cargos:' \|\| p_entity_id::text\)\)/);
  });

  it("branches for ADMINISTRADOR_UNICO requiring at least 1 active admin", () => {
    expect(migration).toMatch(/v_forma_admin IN \('ADMINISTRADOR_UNICO', 'ADMIN_UNICO'\)/);
    expect(migration).toMatch(/tipo_condicion IN \('ADMIN_UNICO', 'ADMINISTRADOR_UNICO', 'ADMIN_PJ'\)/);
    expect(migration).toMatch(/v_cargos_count < 1/);
  });

  it("branches for ADMINISTRADORES_SOLIDARIOS requiring at least 2 active admins", () => {
    expect(migration).toMatch(/v_forma_admin IN \('ADMINISTRADORES_SOLIDARIOS', 'ADMIN_SOLIDARIO'\)/);
    expect(migration).toMatch(/tipo_condicion IN \('ADMIN_SOLIDARIO', 'ADMINISTRADOR_SOLIDARIO', 'ADMIN_PJ'\)/);
    expect(migration).toMatch(/v_cargos_count < 2/);
  });

  it("branches for ADMINISTRADORES_MANCOMUNADOS requiring at least 2 active admins", () => {
    expect(migration).toMatch(/v_forma_admin IN \('ADMINISTRADORES_MANCOMUNADOS', 'ADMIN_MANCOMUNADO'\)/);
    expect(migration).toMatch(/tipo_condicion IN \('ADMIN_MANCOMUNADO', 'ADMINISTRADOR_MANCOMUNADO', 'ADMIN_PJ'\)/);
  });

  it("maintains default colegiado requirements (PRESIDENTE + SECRETARIO)", () => {
    expect(migration).toMatch(/tipo_condicion = 'PRESIDENTE'/);
    expect(migration).toMatch(/tipo_condicion = 'SECRETARIO'/);
  });

  it("revokes PUBLIC/anon + grants authenticated, service_role", () => {
    expect(migration).toMatch(/REVOKE EXECUTE ON FUNCTION public\.fn_promover_sociedad_operativa\(uuid, uuid\) FROM PUBLIC, anon/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_promover_sociedad_operativa\(uuid, uuid\) TO authenticated, service_role/);
  });
});
