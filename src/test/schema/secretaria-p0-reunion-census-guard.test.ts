import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stepper = readFileSync(
  join(process.cwd(), "src/pages/secretaria/ReunionStepper.tsx"),
  "utf8",
);
const reunionHook = readFileSync(
  join(process.cwd(), "src/hooks/useReunionSecretaria.ts"),
  "utf8",
);

describe("Secretaria P0 reunion census guard", () => {
  it("does not allow prototype demo voters in the real meeting flow", () => {
    expect(stepper).not.toMatch(/DEMO_VOTERS/);
    expect(stepper).not.toMatch(/Censo demo/i);
    expect(stepper).toMatch(/No hay censo vigente/);
    expect(stepper).toMatch(/No hay lista de asistentes guardada/);
    expect(stepper).toMatch(/No hay asistentes persistidos con derecho a voto/);
  });

  it("uses explicit person FK aliases when reading the canonical body census", () => {
    expect(reunionHook).toMatch(/person:person_id\(full_name\)/);
    expect(reunionHook).not.toMatch(/persons\(full_name\)/);
  });
});
