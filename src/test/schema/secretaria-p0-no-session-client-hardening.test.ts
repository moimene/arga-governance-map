import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hook = readFileSync(
  join(process.cwd(), "src/hooks/useAcuerdosSinSesion.ts"),
  "utf8",
);

describe("Secretaria P0 no-session client hardening", () => {
  it("does not fallback to direct client writes for vote or materialization RPCs", () => {
    expect(hook).toMatch(/fn_no_session_cast_response/);
    expect(hook).toMatch(/No se registra voto desde fallback cliente/);
    expect(hook).toMatch(/fn_no_session_close_and_materialize_agreement/);
    expect(hook).toMatch(/No se materializa desde fallback cliente/);
    expect(hook).not.toMatch(/from\("agreements"\)\s*\.insert\(/);
    expect(hook).not.toMatch(/from\("no_session_resolutions"\)\s*\.update\(\{ status: resultado/);
  });
});
