import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  join(process.cwd(), "scripts/consolidate-duplicate-persons.ts"),
  "utf8",
);

describe("consolidate-duplicate-persons Sprint 2 apply contract", () => {
  it("delegates apply writes to fn_consolidate_person RPC", () => {
    expect(script).toMatch(/supabase\.rpc\("fn_consolidate_person"/);
    expect(script).toMatch(/p_canonical_person_id:\s*pair\.canonical\.id/);
    expect(script).toMatch(/p_duplicate_person_id:\s*pair\.duplicate\.id/);
    expect(script).toMatch(/p_idempotency_key:\s*idempotencyKey/);
    expect(script).toMatch(/p_reason:\s*pair\.reason/);
  });

  it("does not keep the old client-side FK migration apply path", () => {
    expect(script).not.toMatch(/async function migrateFk/);
    expect(script).not.toMatch(/verifyNoRemainingRefs/);
    expect(script).not.toMatch(/\.update\(\{ \[ref\.column\]: pair\.canonical\.id \}\)/);
    expect(script).not.toMatch(/soft-archive failed/);
  });

  it("keeps dry-run FK inventory and WORM skip visibility", () => {
    expect(script).toMatch(/PERSONS_FK_REFERENCES/);
    expect(script).toMatch(/table: "no_session_expedientes"[\s\S]*column: "propuesta_firmada_por"[\s\S]*action: "migrate"/);
    expect(script).toMatch(/capital_movements/);
    expect(script).toMatch(/no_session_notificaciones/);
    expect(script).toMatch(/no_session_respuestas/);
    expect(script).toMatch(/skip WORM/);
  });
});
