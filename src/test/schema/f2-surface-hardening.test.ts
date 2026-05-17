import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationG2 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260516120004_f2_g2_g19_revoke_public_execute.sql"),
  "utf8",
);
const migrationG14 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260516120005_f2_g14_definer_hardening.sql"),
  "utf8",
);

describe("F2.G2 — REVOKE EXECUTE on fn_* from PUBLIC/anon", () => {
  it("uses pg_proc + aclexplode probe (concilio K3) — not information_schema", () => {
    expect(migrationG2).toMatch(/FROM pg_proc p/);
    expect(migrationG2).toMatch(/aclexplode\(COALESCE\(p\.proacl, acldefault\('f', p\.proowner\)\)\)/);
    expect(migrationG2).not.toMatch(/FROM information_schema\.routine_privileges/);
  });

  it("revokes EXECUTE from grantee 0 (PUBLIC) and anon role oid", () => {
    expect(migrationG2).toMatch(/acl\.grantee IN \(/);
    expect(migrationG2).toMatch(/0::oid/);
    expect(migrationG2).toMatch(/SELECT oid FROM pg_roles WHERE rolname = 'anon'/);
  });

  it("re-grants EXECUTE to authenticated + service_role for fns that lost their only grant", () => {
    expect(migrationG2).toMatch(/GRANT EXECUTE ON FUNCTION %I\.%I\(%s\) TO authenticated, service_role/);
  });

  it("emits post-apply assertion: 0 fn_* with EXECUTE to PUBLIC/anon", () => {
    expect(migrationG2).toMatch(/RAISE EXCEPTION 'F2\.G2 verification failed: % fn_\* still have EXECUTE granted to PUBLIC\/anon'/);
  });
});

describe("F2.G19 — ALTER DEFAULT PRIVILEGES on future fns", () => {
  it("sets postgres role default privileges (revoke PUBLIC + grant authenticated)", () => {
    expect(migrationG2).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon/);
    expect(migrationG2).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+GRANT EXECUTE ON FUNCTIONS TO authenticated/);
  });

  it("attempts supabase_admin default privileges but swallows insufficient_privilege gracefully", () => {
    expect(migrationG2).toMatch(/IF EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin'\)/);
    expect(migrationG2).toMatch(/EXCEPTION WHEN insufficient_privilege THEN/);
    expect(migrationG2).toMatch(/RAISE WARNING 'F2\.G19: cannot ALTER DEFAULT PRIVILEGES for supabase_admin/);
  });
});

describe("F2.G14 — SECURITY DEFINER hardening (P0)", () => {
  it("re-creates handle_new_user with SET search_path = public", () => {
    expect(migrationG14).toMatch(/CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/);
    expect(migrationG14).toMatch(/SET search_path = public[\s\S]*?BEGIN[\s\S]*?INSERT INTO public\.profiles/);
  });

  it("re-creates fn_audit_worm with SET search_path = public, extensions + qualified table refs", () => {
    expect(migrationG14).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_audit_worm\(\)/);
    expect(migrationG14).toMatch(/SET search_path = public, extensions/);
    expect(migrationG14).toMatch(/FROM public\.audit_log/);
    expect(migrationG14).toMatch(/INSERT INTO public\.audit_log/);
  });

  it("re-creates fn_registrar_movimiento_capital with search_path + tenant guard", () => {
    expect(migrationG14).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_registrar_movimiento_capital/);
    expect(migrationG14).toMatch(/SET search_path = public, extensions/);
    expect(migrationG14).toMatch(/PERFORM public\.fn_secretaria_assert_tenant_access\(p_tenant_id\)/);
  });

  it("emits post-apply assertion that all 3 hardened fns carry SET search_path", () => {
    expect(migrationG14).toMatch(/AND p\.proname IN \('handle_new_user', 'fn_audit_worm', 'fn_registrar_movimiento_capital'\)/);
    expect(migrationG14).toMatch(/RAISE EXCEPTION 'F2\.G14 verification failed: % of 3 hardened fns still missing SET search_path'/);
  });
});
