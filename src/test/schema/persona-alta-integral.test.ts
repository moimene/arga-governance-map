import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260515022621_persona_alta_integral.sql"),
  "utf8",
);

describe("persona alta integral schema", () => {
  it("adds a tenant-scoped 1:1 persona profile table with RLS", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.persona_profiles/);
    expect(migration).toMatch(/person_id uuid NOT NULL REFERENCES public\.persons\(id\) ON DELETE CASCADE/);
    expect(migration).toMatch(/CONSTRAINT persona_profiles_unique_person UNIQUE \(tenant_id, person_id\)/);
    expect(migration).toMatch(/ALTER TABLE public\.persona_profiles ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/CREATE POLICY persona_profiles_select_tenant/);
    expect(migration).toMatch(/tenant_id = public\.fn_secretaria_current_tenant_id\(\)/);
  });

  it("creates the complete onboarding RPC with production hardening", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_create_persona_completa/);
    expect(migration).toMatch(/SECURITY DEFINER/);
    expect(migration).toMatch(/SET search_path = public, extensions/);
    expect(migration).toMatch(/fn_secretaria_assert_tenant_access\(p_tenant_id\)/);
    expect(migration).toMatch(/fn_secretaria_assert_capability\(p_tenant_id, 'PERSON_WRITE'\)/);
    expect(migration).toMatch(/fn_secretaria_assert_caller_authority_rm\(p_tenant_id, NULL, NULL\)/);
    expect(migration).toMatch(/pg_advisory_xact_lock/);
    expect(migration).toMatch(/operation = 'fn_create_persona_completa'/);
  });

  it("stores complete identity, contact, registry and evidence fields", () => {
    for (const column of [
      "document_type",
      "document_country",
      "nationality",
      "birth_date",
      "legal_form",
      "registry_name",
      "registry_number",
      "lei_code",
      "phone",
      "address_line1",
      "notification_address_same",
      "governance_role",
      "kyc_status",
      "evidence_summary",
    ]) {
      expect(migration).toContain(column);
    }
  });
});
