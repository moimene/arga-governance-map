import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260504203000_000054_secretaria_capital_movement_audit_uuid.sql"),
  "utf8",
);

describe("Secretaria P0 capital movement audit hotfix", () => {
  it("keeps audit_log.object_id as a uuid value", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_registrar_movimiento_capital/i);
    expect(migration).toMatch(/SET search_path = public, extensions/i);
    expect(migration).toMatch(/object_id/i);
    expect(migration).toMatch(/'capital_movement',\s*p_agreement_id,/i);
    expect(migration).not.toMatch(/p_agreement_id::text\s*,\s*'INSERT'/i);
  });

  it("preserves the agreement id in the audit delta for traceability", () => {
    expect(migration).toMatch(/'agreement_id', p_agreement_id/i);
    expect(migration).toMatch(/audit_worm_id/i);
    expect(migration).toMatch(/RETURNING id INTO v_audit_id/i);
  });
});
