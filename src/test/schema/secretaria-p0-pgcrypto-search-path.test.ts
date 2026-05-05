import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260504201000_000053_secretaria_p0_pgcrypto_search_path.sql"),
  "utf8",
);

describe("Secretaria P0 pgcrypto search path hotfix", () => {
  it("keeps pgcrypto available to SECURITY DEFINER RPCs in Supabase Cloud", () => {
    expect(migration).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
    expect(migration).toMatch(/SET search_path = public, extensions/i);
    expect(migration).not.toMatch(/SET search_path = public\s*\nAS \$\$/i);
    expect(migration.match(/digest\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("redefines the P0 RPCs that use digest or shared helpers", () => {
    for (const name of [
      "fn_no_session_cast_response",
      "fn_no_session_close_and_materialize_agreement",
      "fn_generar_certificacion_acuerdo_sin_sesion",
      "fn_registrar_transmision_capital",
    ]) {
      expect(migration).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION ${name}`, "i"));
    }
  });
});
