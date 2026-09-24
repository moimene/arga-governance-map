import { describe, expect, it } from "bun:test";
import { demoPassword, type CuentaDemo } from "../helpers/supabase-test-client";
import { NUEVO_DEMO_EMAIL, type Entorno } from "../../../e2e/fixtures/demo-credentials";

describe("MOI-135 — gestión de contraseñas demo y entorno nuevo", () => {
  it("demoPassword('NUEVO') lanza nombrando DEMO_PASSWORD_NUEVO cuando falta la variable", () => {
    expect(() => demoPassword("NUEVO", {})).toThrow(/DEMO_PASSWORD_NUEVO/);
    const original = process.env.DEMO_PASSWORD_NUEVO;
    try {
      delete process.env.DEMO_PASSWORD_NUEVO;
      expect(() => demoPassword("NUEVO")).toThrow(/DEMO_PASSWORD_NUEVO/);
    } finally {
      if (original !== undefined) {
        process.env.DEMO_PASSWORD_NUEVO = original;
      }
    }
  });

  it("demoPassword con cuenta NUEVO funciona cuando DEMO_PASSWORD_NUEVO está presente", () => {
    if (process.env.DEMO_PASSWORD_NUEVO) {
      const pwd = demoPassword("NUEVO");
      expect(typeof pwd).toBe("string");
      expect(pwd.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("e2e credentials exporta NUEVO_DEMO_EMAIL alineado con el tenant cero", () => {
    expect(NUEVO_DEMO_EMAIL).toBe("demo@grupo-nuevo-demo.dev");
  });

  it("el tipo Entorno incluye nuevo de forma estática", () => {
    const entornos: Entorno[] = ["arga", "garrigues", "nuevo"];
    expect(entornos).toContain("nuevo");
  });
});
