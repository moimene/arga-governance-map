import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260514174503_no_session_source_of_truth_close.sql"),
  "utf8",
);

describe("Secretaria NO_SESSION source-of-truth closeout migration", () => {
  it("allows documented secretary proxy responses while preserving target person WORM identity", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_no_session_cast_response/i);
    expect(migration).toMatch(/fn_secretaria_current_person_id\(\)/i);
    expect(migration).toMatch(/fn_secretaria_assert_role_allowed\(p_tenant_id, ARRAY\['SECRETARIO', 'ADMIN_TENANT'\]\)/i);
    expect(migration).toMatch(/p_person_id,\s+v_capital_participacion/i);
    expect(migration).toMatch(/recorded_by_proxy/i);
  });

  it("recomputes approval from no_session_respuestas and blocks client APROBADO when WORM votes are insufficient", () => {
    expect(migration).toMatch(/COUNT\(\*\) FILTER \(WHERE sentido = 'CONSENTIMIENTO'\)::integer/i);
    expect(migration).toMatch(/v_requested_resultado = 'APROBADO' AND v_resultado <> 'APROBADO'/i);
    expect(migration).toMatch(/cannot be approved from client result/i);
    expect(migration).not.toMatch(/v_resultado := upper\(trim\(COALESCE\(p_resultado, v_resolution\.status\)\)\)/i);
  });

  it("creates adopted agreements only after source-of-truth approval is established", () => {
    const insertAgreementIndex = migration.indexOf("INSERT INTO agreements");
    const clientApprovalGuardIndex = migration.indexOf("cannot be approved from client result");

    expect(clientApprovalGuardIndex).toBeGreaterThan(-1);
    expect(insertAgreementIndex).toBeGreaterThan(clientApprovalGuardIndex);
    expect(migration).toMatch(/'source_of_truth', 'no_session_respuestas'/i);
    expect(migration).toMatch(/'schema_version', 'no-session-idempotency\.v2'/i);
  });
});
