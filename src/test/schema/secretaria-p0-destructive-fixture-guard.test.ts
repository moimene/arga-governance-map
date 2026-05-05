import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fixture = readFileSync(
  join(process.cwd(), "e2e/fixtures/secretaria-destructive.ts"),
  "utf8",
);

describe("Secretaria destructive E2E guard", () => {
  it("is opt-in and requires explicit fixture tenant ids", () => {
    expect(fixture).toMatch(/SECRETARIA_E2E_DESTRUCTIVE/);
    expect(fixture).toMatch(/SECRETARIA_E2E_TENANT_IDS/);
    expect(fixture).toMatch(/Set SECRETARIA_E2E_DESTRUCTIVE=1/);
  });

  it("blocks writes to the shared ARGA demo tenant and entity", () => {
    expect(fixture).toMatch(/DEMO_TENANT_ID/);
    expect(fixture).toMatch(/DEMO_ENTITY_ID/);
    expect(fixture).toMatch(/Blocked destructive Secretaría E2E write against ARGA demo tenant/);
  });

  it("requires every mutating Supabase request to include an allowed tenant marker", () => {
    expect(fixture).toMatch(/MUTATING_METHODS/);
    expect(fixture).toMatch(/SUPABASE_REST_OR_RPC/);
    expect(fixture).toMatch(/allowedTenantIds\.some/);
    expect(fixture).toMatch(/without allowed tenant marker/);
  });
});
