import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260504214500_000055_secretaria_http_service_role_detection.sql"),
  "utf8",
);

describe("Secretaria P0 HTTP service_role detection hotfix", () => {
  it("detects service_role from both SQL smoke settings and PostgREST JWT claims", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_is_service_role/i);
    expect(migration).toMatch(/current_setting\('request\.jwt\.claim\.role', true\)/i);
    expect(migration).toMatch(/auth\.jwt\(\) ->> 'role'/i);
    expect(migration).toMatch(/current_setting\('request\.jwt\.claims', true\)/i);
    expect(migration).toMatch(/= 'service_role'/i);
  });

  it("uses the shared service role helper before tenant comparison", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_assert_tenant_access/i);
    expect(migration).toMatch(/IF fn_secretaria_is_service_role\(\) THEN\s+RETURN;/i);
    expect(migration).toMatch(/tenant access denied for %/i);
  });
});
