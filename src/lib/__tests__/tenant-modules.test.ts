import { describe, expect, it } from "vitest";
import { isModuleEnabled } from "@/lib/tenant-modules";

describe("isModuleEnabled", () => {
  it("branding NULL (ARGA o cargando) habilita todo — falla abierto", () => {
    expect(isModuleEnabled(null, "dora")).toBe(true);
    expect(isModuleEnabled(null, "board-pack")).toBe(true);
    expect(isModuleEnabled(null, "cualquier-cosa")).toBe(true);
  });

  it("branding sin clave modules habilita todo", () => {
    expect(isModuleEnabled({ nombre: "Garrigues" }, "dora")).toBe(true);
  });

  it("modules presente actúa como lista blanca", () => {
    const b = { nombre: "Garrigues", modules: ["secretaria", "grc"] };
    expect(isModuleEnabled(b, "secretaria")).toBe(true);
    expect(isModuleEnabled(b, "dora")).toBe(false);
    expect(isModuleEnabled(b, "country-packs")).toBe(false);
  });

  it("modules vacío deshabilita todo lo gateado", () => {
    expect(isModuleEnabled({ modules: [] }, "dora")).toBe(false);
  });

  it("modules mal formado se ignora y falla abierto", () => {
    expect(isModuleEnabled({ modules: "dora" } as never, "dora")).toBe(true);
    expect(isModuleEnabled({ modules: [1, 2] } as never, "dora")).toBe(true);
  });
});
