import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Secretaria demo readiness routes", () => {
  it("redirects the legacy simulated no-session expediente route without mounting the demo component", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

    expect(app).toContain('path="/secretaria/acuerdos-sin-sesion/expediente"');
    expect(app).toContain('to="/secretaria/acuerdos-sin-sesion"');
    expect(app).not.toContain("ExpedienteSinSesionStepper");
    expect(existsSync(join(process.cwd(), "src/pages/secretaria/ExpedienteSinSesionStepper.tsx"))).toBe(false);
  });

  it("keeps mandatory books navigable without unavailable-content placeholders", () => {
    const libros = readFileSync(join(process.cwd(), "src/pages/secretaria/LibrosObligatorios.tsx"), "utf8");

    expect(libros).toContain("function getBookContentRoute");
    expect(libros).toContain("SOCIO_UNICO");
    expect(libros).not.toContain("Vista no disponible");
  });
});
