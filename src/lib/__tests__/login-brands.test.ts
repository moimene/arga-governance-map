import { describe, expect, it } from "vitest";
import { resolveLoginBrand } from "@/lib/login-brands";

describe("resolveLoginBrand", () => {
  it("sin parámetro → ARGA con credenciales demo actuales", () => {
    const b = resolveLoginBrand("");
    expect(b.key).toBe("arga");
    expect(b.nombre).toBe("ARGA");
    expect(b.demoEmail).toBe("demo@arga-seguros.com");
  });

  it("?tenant=garrigues → marca y credenciales Garrigues", () => {
    const b = resolveLoginBrand("?tenant=garrigues");
    expect(b.key).toBe("garrigues");
    expect(b.nombre).toBe("Garrigues");
    expect(b.panelBg).toBe("#004438");
    expect(b.demoEmail).toBe("demo@garrigues-demo.dev");
  });

  it("valor desconocido o mayúsculas → fallback ARGA / case-insensitive", () => {
    expect(resolveLoginBrand("?tenant=acme").key).toBe("arga");
    expect(resolveLoginBrand("?tenant=GARRIGUES").key).toBe("garrigues");
  });
});
