import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260712133500_secretaria_template_guard_rls_followup.sql",
  ),
  "utf8",
);

describe("Oleada 3A — guards compatibles con RLS", () => {
  it("eleva solo los dos guards de lectura exacta y conserva search_path fijo", () => {
    expect(migration.match(/ALTER FUNCTION public\.fn_secretaria_guard_/g)).toHaveLength(2);
    expect(migration.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("search_path=pg_catalog, public");
  });

  it("mantiene ambos helpers fuera de la API directa", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_guard_active_template_binding\(\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_guard_template_changelog_tenant\(\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/,
    );
    expect(migration).toContain("has_function_privilege(");
  });
});
