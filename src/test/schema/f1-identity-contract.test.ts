import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationG13 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260516120001_f1_g13_fn_current_tenant_id.sql"),
  "utf8",
);
const migrationG1 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260516120002_f1_g1_replace_hardcoded_policies.sql"),
  "utf8",
);
const migrationG18 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260516120003_f1_g18_intra_tenant_scope.sql"),
  "utf8",
);

describe("F1.G13 — fn_current_tenant_id contract", () => {
  it("creates the public helper with SECURITY DEFINER + search_path", () => {
    expect(migrationG13).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_current_tenant_id\(\)/);
    expect(migrationG13).toMatch(/SECURITY DEFINER/);
    expect(migrationG13).toMatch(/SET search_path = public/);
  });

  it("resolves tenant via root JWT claim first (Path A)", () => {
    expect(migrationG13).toMatch(/v_claims \?\? '\? *tenant_id|v_claims -> 'tenant_id'|v_claims ->> 'tenant_id'/);
  });

  it("falls back to app_metadata.tenant_id (Path B — owner decision 2026-05-16)", () => {
    expect(migrationG13).toMatch(/app_metadata.*tenant_id/i);
    expect(migrationG13).toMatch(/v_claims #>> '\{app_metadata,tenant_id\}'/);
  });

  it("falls back to user_profiles (Path C)", () => {
    expect(migrationG13).toMatch(/FROM public\.user_profiles up/);
    expect(migrationG13).toMatch(/WHERE up\.user_id = auth\.uid\(\)/);
  });

  it("revokes PUBLIC + anon, grants authenticated + service_role", () => {
    expect(migrationG13).toMatch(/REVOKE EXECUTE ON FUNCTION public\.fn_current_tenant_id\(\) FROM PUBLIC, anon/);
    expect(migrationG13).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_current_tenant_id\(\) TO authenticated, service_role/);
  });

  it("provides fn_assert_current_tenant_id with explicit RAISE EXCEPTION on NULL", () => {
    expect(migrationG13).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_assert_current_tenant_id\(\)/);
    expect(migrationG13).toMatch(/RAISE EXCEPTION 'fn_assert_current_tenant_id: no tenant_id resolved/);
  });
});

describe("F1.G1 — replace hardcoded tenant policies", () => {
  it("uses dynamic DO loop to rewrite policies matching literal demo UUID", () => {
    expect(migrationG1).toMatch(/FROM pg_policy p/);
    expect(migrationG1).toMatch(/ILIKE '%00000000-0000-0000-0000-000000000001%'/);
  });

  it("replaces literal with public.fn_current_tenant_id() in both USING and CHECK", () => {
    expect(migrationG1).toMatch(/regexp_replace\(\s*r\.using_expr/);
    expect(migrationG1).toMatch(/regexp_replace\(\s*r\.check_expr/);
    expect(migrationG1).toMatch(/'public\.fn_current_tenant_id\(\)'/);
  });

  it("includes post-apply assertion that no leftover policies retain literal", () => {
    expect(migrationG1).toMatch(/RAISE EXCEPTION 'F1\.G1 verification failed: % policies still reference hardcoded tenant demo UUID'/);
  });

  it("emits informational warning about residual tenant_id column defaults", () => {
    expect(migrationG1).toMatch(/RAISE WARNING 'F1\.G1: % tenant_id columns still have hardcoded DEFAULT/);
  });
});

describe("F1.G18 — intra-tenant scope (body_id granularity)", () => {
  it("adds scope_body_ids to user_profiles as uuid[]", () => {
    expect(migrationG18).toMatch(/ALTER TABLE public\.user_profiles\s+ADD COLUMN IF NOT EXISTS scope_body_ids uuid\[\]/);
  });

  it("creates fn_user_has_body_access with NULL = unrestricted semantics", () => {
    expect(migrationG18).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_user_has_body_access\(p_body_id uuid\)/);
    expect(migrationG18).toMatch(/up\.scope_body_ids IS NULL\s+-- sin restricción/);
    expect(migrationG18).toMatch(/p_body_id = ANY\(up\.scope_body_ids\)/);
  });

  it("creates tenant_features table for feature flag gating", () => {
    expect(migrationG18).toMatch(/CREATE TABLE IF NOT EXISTS public\.tenant_features/);
    expect(migrationG18).toMatch(/intra_tenant_scope_enabled boolean NOT NULL DEFAULT false/);
  });

  it("scopes tenant_features by fn_current_tenant_id() (depends on G13)", () => {
    expect(migrationG18).toMatch(/CREATE POLICY tenant_features_self ON public\.tenant_features/);
    expect(migrationG18).toMatch(/USING \(tenant_id = public\.fn_current_tenant_id\(\)\)/);
  });

  it("provides fn_intra_tenant_scope_enabled flag-reader helper", () => {
    expect(migrationG18).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_intra_tenant_scope_enabled\(\)/);
    expect(migrationG18).toMatch(/COALESCE\(\s*\(SELECT intra_tenant_scope_enabled FROM public\.tenant_features/);
  });

  it("revokes PUBLIC/anon on all 3 new functions", () => {
    expect(migrationG18).toMatch(/REVOKE EXECUTE ON FUNCTION public\.fn_user_has_body_access\(uuid\) FROM PUBLIC, anon/);
    expect(migrationG18).toMatch(/REVOKE EXECUTE ON FUNCTION public\.fn_intra_tenant_scope_enabled\(\) FROM PUBLIC, anon/);
  });
});
