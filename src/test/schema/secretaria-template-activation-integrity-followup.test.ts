import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260712133000_secretaria_template_activation_integrity_advisor_followup.sql",
  ),
  "utf8",
);

describe("Oleada 3A — cierre de advisors del ledger", () => {
  it("cubre la FK por template_id y verifica que el índice sea válido", () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_template_transition_operations_template[\s\S]*\(template_id, tenant_id\)/,
    );
    expect(migration).toContain("i.indisvalid");
    expect(migration).toContain("i.indisready");
  });

  it("documenta deny-all autenticado como policy restrictiva", () => {
    expect(migration).toMatch(
      /CREATE POLICY template_transition_operations_deny_authenticated[\s\S]*AS RESTRICTIVE[\s\S]*TO authenticated[\s\S]*USING \(false\)[\s\S]*WITH CHECK \(false\)/,
    );
    expect(migration).toContain("pol.polpermissive = false");
  });
});
