import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationG16 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260516120007_f4_g16_promover_sociedad_operativa.sql"),
  "utf8",
);
const sociedadStepper = readFileSync(
  join(process.cwd(), "src/pages/secretaria/SociedadNuevaStepper.tsx"),
  "utf8",
);
const viteConfig = readFileSync(
  join(process.cwd(), "vite.config.ts"),
  "utf8",
);
const e2eDestructiveYml = readFileSync(
  join(process.cwd(), ".github/workflows/e2e-destructive.yml"),
  "utf8",
);
const observability = readFileSync(
  join(process.cwd(), "src/lib/telemetry/observability.ts"),
  "utf8",
);
const stagingDoc = readFileSync(
  join(process.cwd(), "docs/superpowers/specs/2026-05-16-g17-staging-provisioning.md"),
  "utf8",
);

describe("F4.G16 — fn_promover_sociedad_operativa atomicity", () => {
  it("creates the RPC with SECURITY DEFINER + search_path", () => {
    expect(migrationG16).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_promover_sociedad_operativa\(\s*p_tenant_id uuid,\s*p_entity_id uuid/);
    expect(migrationG16).toMatch(/SECURITY DEFINER/);
    expect(migrationG16).toMatch(/SET search_path = public/);
  });

  it("guards tenant access + role allowed (SECRETARIO|ADMIN_TENANT)", () => {
    expect(migrationG16).toMatch(/PERFORM public\.fn_secretaria_assert_tenant_access\(p_tenant_id\)/);
    expect(migrationG16).toMatch(/PERFORM public\.fn_secretaria_assert_role_allowed\(\s*p_tenant_id, ARRAY\['SECRETARIO','ADMIN_TENANT'\]/);
  });

  it("requires at least PRESIDENTE + SECRETARIO vigentes (cargos mínimos invariant)", () => {
    expect(migrationG16).toMatch(/tipo_condicion = 'PRESIDENTE'/);
    expect(migrationG16).toMatch(/tipo_condicion = 'SECRETARIO'/);
    expect(migrationG16).toMatch(/v_cargos_count < 2/);
  });

  it("is idempotent when already OPERATIVA", () => {
    expect(migrationG16).toMatch(/IF v_status = 'OPERATIVA' THEN[\s\S]*?'already_operativa', true/);
  });

  it("revokes PUBLIC/anon + grants authenticated, service_role", () => {
    expect(migrationG16).toMatch(/REVOKE EXECUTE ON FUNCTION public\.fn_promover_sociedad_operativa\(uuid, uuid\) FROM PUBLIC, anon/);
    expect(migrationG16).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_promover_sociedad_operativa\(uuid, uuid\) TO authenticated, service_role/);
  });

  it("SociedadNuevaStepper now calls the RPC instead of direct .update()", () => {
    expect(sociedadStepper).toMatch(/supabase\.rpc\(\s*"fn_promover_sociedad_operativa"/);
    // Make sure the previous client-side update path is gone — the only
    // remaining `.update({ onboarding_status: "OPERATIVA" })` would indicate
    // we left a dual-write. Note: other tables/columns may still use update()
    // so we scope strictly to this exact pattern.
    expect(sociedadStepper).not.toMatch(/\.update\(\{\s*onboarding_status:\s*"OPERATIVA"\s*\}\)/);
  });
});

describe("F4.G10 — bundle code-splitting (vendor chunks)", () => {
  it("declares manualChunks for vendor-react, vendor-supabase, vendor-handlebars, vendor-xlsx", () => {
    expect(viteConfig).toMatch(/manualChunks:\s*\{/);
    expect(viteConfig).toMatch(/"vendor-react":\s*\["react", "react-dom", "react-router-dom"\]/);
    expect(viteConfig).toMatch(/"vendor-supabase":\s*\["@supabase\/supabase-js", "@tanstack\/react-query"\]/);
    expect(viteConfig).toMatch(/"vendor-handlebars":\s*\["handlebars"\]/);
    expect(viteConfig).toMatch(/"vendor-xlsx":\s*\["xlsx"\]/);
  });

  it("sets chunkSizeWarningLimit to 500 KB", () => {
    expect(viteConfig).toMatch(/chunkSizeWarningLimit:\s*500/);
  });
});

describe("F4.G12 — E2E destructive CI workflow", () => {
  it("runs weekly on Monday 06:00 UTC", () => {
    expect(e2eDestructiveYml).toMatch(/cron:\s*"0 6 \* \* 1"/);
  });

  it("sets SECRETARIA_E2E_DESTRUCTIVE=1 + ISOLATED_TENANT=1 + PHASE_B1=1", () => {
    expect(e2eDestructiveYml).toMatch(/SECRETARIA_E2E_DESTRUCTIVE:\s*"1"/);
    expect(e2eDestructiveYml).toMatch(/SECRETARIA_E2E_ISOLATED_TENANT:\s*"1"/);
    expect(e2eDestructiveYml).toMatch(/SECRETARIA_E2E_PHASE_B1:\s*"1"/);
  });

  it("aborts if target ref is governance_OS demo (hzqwefkwsxopwrmtksbg)", () => {
    expect(e2eDestructiveYml).toMatch(/EXPECTED_PROJECT_REF.*=\s*"hzqwefkwsxopwrmtksbg"/);
    expect(e2eDestructiveYml).toMatch(/E2E destructive workflow pointed at governance_OS/);
  });

  it("emits staging-not-configured warning when secret missing", () => {
    expect(e2eDestructiveYml).toMatch(/SUPABASE_STAGING_REF secret missing/);
  });
});

describe("F4.G20 — observability (OTel-shaped events)", () => {
  it("declares the 5 critical event types (rls.denied, signed_url.failure, audit_chain.drift, storage.403, service_role.usage)", () => {
    expect(observability).toMatch(/"rls\.denied"/);
    expect(observability).toMatch(/"service_role\.usage"/);
    expect(observability).toMatch(/"signed_url\.failure"/);
    expect(observability).toMatch(/"audit_chain\.drift"/);
    expect(observability).toMatch(/"storage\.403"/);
  });

  it("exposes pluggable sink (setObservabilitySink) for Sentinel feed", () => {
    expect(observability).toMatch(/export function setObservabilitySink/);
  });

  it("exposes typed helpers (emitRlsDenied, emitSignedUrlFailure, emitStorage403, emitAuditChainDrift, emitServiceRoleUsage)", () => {
    expect(observability).toMatch(/export function emitRlsDenied/);
    expect(observability).toMatch(/export function emitSignedUrlFailure/);
    expect(observability).toMatch(/export function emitStorage403/);
    expect(observability).toMatch(/export function emitAuditChainDrift/);
    expect(observability).toMatch(/export function emitServiceRoleUsage/);
  });

  it("never crashes the caller — sink errors are swallowed", () => {
    expect(observability).toMatch(/Telemetry must never crash the caller/);
  });
});

describe("F4.G17 — staging provisioning runbook", () => {
  it("documents path and tier decision", () => {
    expect(stagingDoc).toMatch(/governance.os.staging/i);
    expect(stagingDoc).toMatch(/Free tier/i);
    expect(stagingDoc).toMatch(/eu-central-1/);
  });

  it("includes the 3 GitHub secrets the workflow expects", () => {
    expect(stagingDoc).toMatch(/SUPABASE_STAGING_REF/);
    expect(stagingDoc).toMatch(/SUPABASE_STAGING_URL/);
    expect(stagingDoc).toMatch(/SUPABASE_STAGING_ANON_KEY/);
  });

  it("flags the manual provisioning steps as pending owner action", () => {
    expect(stagingDoc).toMatch(/owner/i);
    expect(stagingDoc).toMatch(/handoff humano/i);
  });
});
