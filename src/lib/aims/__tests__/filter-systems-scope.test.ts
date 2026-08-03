import { describe, expect, it } from "vitest";
import { filterSystemsByScope } from "@/lib/aims/readiness";

const systems = [{ name: "Copiloto siniestros auto" }, { name: "Harvey legal" }] as never[];

describe("filterSystemsByScope — multi-tenant", () => {
  it("cualquier scope '(Global)' devuelve todo (ARGA y Garrigues)", () => {
    expect(filterSystemsByScope(systems, "Grupo ARGA (Global)").length).toBe(2);
    expect(filterSystemsByScope(systems, "Grupo Garrigues (Global)").length).toBe(2);
  });
  it("scope desconocido NO oculta en silencio", () => {
    expect(filterSystemsByScope(systems, "Marruecos").length).toBe(2);
  });
});
