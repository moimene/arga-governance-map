import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Hardening de seguridad (revisión adversarial Codex, [critical] 2026-06-06).
// La RPC SECURITY DEFINER `fn_create_governance_evidence_bundle` (000045) confiaba en
// `p_tenant_id` del cliente y, al saltar RLS, permitía forjar evidencia SEALED cross-tenant.
// La migración 20260606165443 añade aserción de tenant + integridad de provenance.
// Este test bloquea el contrato en el repo (regresión: que no se reemplace la RPC sin el guard).
const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260606165443_harden_create_governance_evidence_bundle_tenant_assert.sql",
  ),
  "utf8",
);

describe("Evidence bundle RPC hardening (Codex [critical])", () => {
  it("reemplaza la RPC manteniendo SECURITY DEFINER y search_path", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_create_governance_evidence_bundle/i);
    expect(migration).toMatch(/SECURITY DEFINER/i);
    expect(migration).toMatch(/SET search_path TO 'public', 'extensions'/i);
  });

  it("añade aserción de tenant: un caller autenticado no puede forjar evidencia cross-tenant", () => {
    expect(migration).toMatch(/v_caller_tenant\s*:=\s*public\.fn_current_tenant_id\(\)/);
    // Solo bloquea cuando el JWT resuelve tenant (autenticado); NULL (service_role) pasa.
    expect(migration).toMatch(/IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> p_tenant_id THEN/);
    expect(migration).toMatch(/tenant mismatch/i);
    expect(migration).toMatch(/ERRCODE = '42501'/);
  });

  it("exige integridad de provenance (tenant y source_object_id)", () => {
    expect(migration).toMatch(/IF p_tenant_id IS NULL THEN[\s\S]*?p_tenant_id is required/);
    expect(migration).toMatch(/COALESCE\(p_source_object_id, ''\) = ''/);
    expect(migration).toMatch(/p_source_object_id is required/);
  });

  it("preserva el contrato de status (OPEN|SEALED|VERIFIED) y la firma original", () => {
    expect(migration).toMatch(/IF p_status NOT IN \('OPEN', 'SEALED', 'VERIFIED'\) THEN/);
    expect(migration).toMatch(/INSERT INTO evidence_bundles/i);
    expect(migration).toMatch(/RETURNING id INTO v_bundle_id/);
  });
});
