import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationF6 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260516120008_f6_codex_review_fixes.sql"),
  "utf8",
);
const edgeFunction = readFileSync(
  join(process.cwd(), "supabase/functions/sign-evidence-url/index.ts"),
  "utf8",
);

describe("F6.§1 — P0 #1+#2 lock user_profiles.tenant_id + role_code", () => {
  it("creates BEFORE UPDATE trigger that blocks tenant_id mutation for non-service-role", () => {
    expect(migrationF6).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_user_profiles_lock_critical_cols\(\)/);
    expect(migrationF6).toMatch(/IF NEW\.tenant_id IS DISTINCT FROM OLD\.tenant_id/);
    expect(migrationF6).toMatch(/RAISE EXCEPTION 'user_profiles\.tenant_id is immutable for authenticated users/);
  });

  it("blocks role_code mutation for non-service-role", () => {
    expect(migrationF6).toMatch(/IF NEW\.role_code IS DISTINCT FROM OLD\.role_code/);
    expect(migrationF6).toMatch(/RAISE EXCEPTION 'user_profiles\.role_code is immutable for authenticated users/);
  });

  it("uses fn_secretaria_is_service_role() as bypass condition", () => {
    expect(migrationF6).toMatch(/IF public\.fn_secretaria_is_service_role\(\) THEN[\s\S]*?RETURN NEW;/);
  });

  it("installs trigger on user_profiles BEFORE UPDATE", () => {
    expect(migrationF6).toMatch(/CREATE TRIGGER trg_user_profiles_lock_critical_cols\s+BEFORE UPDATE ON public\.user_profiles/);
  });
});

describe("F6.§2 — P0 #3 evidence_bundles RLS", () => {
  it("enables RLS on evidence_bundles", () => {
    expect(migrationF6).toMatch(/ALTER TABLE public\.evidence_bundles ENABLE ROW LEVEL SECURITY/);
  });

  it("declares tenant_isolation policy using fn_current_tenant_id()", () => {
    expect(migrationF6).toMatch(/CREATE POLICY evidence_bundles_tenant_isolation ON public\.evidence_bundles/);
    expect(migrationF6).toMatch(/USING \(tenant_id = public\.fn_current_tenant_id\(\)\)/);
    expect(migrationF6).toMatch(/WITH CHECK \(tenant_id = public\.fn_current_tenant_id\(\)\)/);
  });

  it("re-creates evidence_bundles_latest with security_invoker=true", () => {
    expect(migrationF6).toMatch(/CREATE VIEW public\.evidence_bundles_latest\s+WITH \(security_invoker = true\)/);
  });
});

describe("F6.§3 — P0 #5 revoke fn_consolidate_person from authenticated", () => {
  it("revokes EXECUTE from authenticated (reverts G2 blanket re-grant regression)", () => {
    expect(migrationF6).toMatch(/REVOKE EXECUTE ON FUNCTION public\.fn_consolidate_person\(uuid, uuid, uuid, text, text\)\s+FROM authenticated/);
  });
});

describe("F6.§4 — P1 #10 fn_promover_sociedad_operativa TOCTOU close", () => {
  it("locks entity row with SELECT FOR UPDATE", () => {
    expect(migrationF6).toMatch(/SELECT onboarding_status INTO v_status\s+FROM public\.entities[\s\S]*?FOR UPDATE/);
  });

  it("uses pg_advisory_xact_lock on cargos:<entity_id> namespace", () => {
    expect(migrationF6).toMatch(/PERFORM pg_advisory_xact_lock\(hashtext\('cargos:' \|\| p_entity_id::text\)\)/);
  });
});

describe("F6 — Edge Function sign-evidence-url hardening (P0 #4 + P1 #9)", () => {
  it("selects bundle.status to enforce the gate P1 #9 promised", () => {
    expect(edgeFunction).toMatch(/\.select\("id, tenant_id, agreement_id, storage_path, document_url, legal_hold, source_module, status"\)/);
  });

  it("blocks non-releasable bundle statuses", () => {
    expect(edgeFunction).toMatch(/releasableStatuses = new Set\(\["OPEN", "PROMOTED", "ARCHIVED-RELEASED"\]\)/);
    expect(edgeFunction).toMatch(/bundle status does not permit download/);
  });

  it("requires storage_path to start with bundle.tenant_id (P0 #4 path-binding)", () => {
    expect(edgeFunction).toMatch(/storagePath\.startsWith\(`\$\{bundle\.tenant_id\}\/`\)/);
    expect(edgeFunction).toMatch(/storage_path does not belong to bundle tenant/);
  });

  it("path traversal defense covers %2e %2f case-insensitive + backslash", () => {
    expect(edgeFunction).toMatch(/lowered\.includes\("%2e%2e"\)/);
    expect(edgeFunction).toMatch(/lowered\.includes\("%2f"\)/);
    expect(edgeFunction).toMatch(/storagePath\.includes\("\\\\"\)/);
  });
});

describe("F6 — adversarial review findings disposition", () => {
  it("documents the rejection of P1 #8 (audit delta) with reason", () => {
    expect(migrationF6).toMatch(/P1 RECHAZADO:[\s\S]*?#8 fn_registrar_movimiento_capital.*audit delta perdió campos.*verificado/);
    expect(migrationF6).toMatch(/los campos son IDÉNTICOS\.\s+--      Codex se equivocó/);
  });

  it("documents the deferred follow-ups (P1 #6 #7 #11, P2 #12 #13)", () => {
    expect(migrationF6).toMatch(/P1 PENDIENTE \(follow-up\):/);
    expect(migrationF6).toMatch(/#6 G1 policy rewrite no preserva polpermissive\/polroles/);
    expect(migrationF6).toMatch(/#7 G2 scope solo public/);
    expect(migrationF6).toMatch(/#11 e2e-destructive workflow no realmente staging/);
    expect(migrationF6).toMatch(/P2 ACEPTADOS \(sprint posterior\):/);
    expect(migrationF6).toMatch(/#12 observability\.ts no llega a Sentinel/);
    expect(migrationF6).toMatch(/#13 contract tests validan stubs/);
  });
});
