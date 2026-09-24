import { describe, expect, it } from "vitest";
import {
  isModuleEnabled,
  resolveTenantModulesState,
} from "@/lib/tenant-modules";

describe("resolveTenantModulesState", () => {
  it("isLoading === true resuelve a 'loading'", () => {
    expect(resolveTenantModulesState(null, { isLoading: true })).toBe("loading");
    expect(
      resolveTenantModulesState(
        { nombre: "Garrigues", modules: ["secretaria"] },
        { isLoading: true },
      ),
    ).toBe("loading");
  });

  it("branding null, undefined o sin clave modules resuelve a 'unconfigured'", () => {
    expect(resolveTenantModulesState(null)).toBe("unconfigured");
    expect(resolveTenantModulesState(undefined)).toBe("unconfigured");
    expect(resolveTenantModulesState({ nombre: "Grupo Nuevo" })).toBe("unconfigured");
    expect(resolveTenantModulesState({ nombre: "Grupo Nuevo", modules: undefined })).toBe(
      "unconfigured",
    );
    expect(resolveTenantModulesState({ nombre: "Grupo Nuevo", modules: null })).toBe(
      "unconfigured",
    );
  });

  it("modules mal formado (no array o elementos no-string) resuelve a 'unconfigured'", () => {
    expect(resolveTenantModulesState({ modules: "secretaria" as unknown as string[] })).toBe(
      "unconfigured",
    );
    expect(resolveTenantModulesState({ modules: [123, 456] as unknown as string[] })).toBe(
      "unconfigured",
    );
  });

  it("modules: [] (array vacío deliberado) resuelve a 'empty'", () => {
    expect(resolveTenantModulesState({ modules: [] })).toBe("empty");
    expect(resolveTenantModulesState({ nombre: "Grupo Desactivado", modules: [] })).toBe(
      "empty",
    );
  });

  it("modules poblado con strings válidos resuelve a 'configured'", () => {
    expect(resolveTenantModulesState({ modules: ["secretaria"] })).toBe("configured");
    expect(
      resolveTenantModulesState({
        nombre: "Garrigues",
        modules: ["secretaria", "grc", "ai-governance"],
      }),
    ).toBe("configured");
  });
});

describe("isModuleEnabled", () => {
  it("carga en curso (isLoading = true) habilita todo — falla abierto", () => {
    expect(isModuleEnabled(null, "dora", { isLoading: true })).toBe(true);
    expect(
      isModuleEnabled({ modules: [] }, "secretaria", { isLoading: true }),
    ).toBe(true);
  });

  it("branding NULL (ARGA) habilita todo — falla abierto (contrato cero cambio)", () => {
    expect(isModuleEnabled(null, "dora")).toBe(true);
    expect(isModuleEnabled(null, "board-pack")).toBe(true);
    expect(isModuleEnabled(null, "cualquier-cosa")).toBe(true);
  });

  it("branding sin clave modules (Grupo Nuevo ...0003 T3) habilita todo — falla abierto", () => {
    expect(isModuleEnabled({ nombre: "Grupo Nuevo" }, "dora")).toBe(true);
    expect(isModuleEnabled({ nombre: "Grupo Nuevo" }, "secretaria")).toBe(true);
    expect(isModuleEnabled({ nombre: "Grupo Nuevo" }, "board-pack")).toBe(true);
  });

  it("modules: [] deliberadamente vacío deshabilita todos los módulos", () => {
    expect(isModuleEnabled({ modules: [] }, "dora")).toBe(false);
    expect(isModuleEnabled({ modules: [] }, "secretaria")).toBe(false);
    expect(isModuleEnabled({ nombre: "X", modules: [] }, "board-pack")).toBe(false);
  });

  it("modules presente actúa como lista blanca", () => {
    const b = { nombre: "Garrigues", modules: ["secretaria", "grc"] };
    expect(isModuleEnabled(b, "secretaria")).toBe(true);
    expect(isModuleEnabled(b, "grc")).toBe(true);
    expect(isModuleEnabled(b, "dora")).toBe(false);
    expect(isModuleEnabled(b, "country-packs")).toBe(false);
  });

  it("una lista blanca con un solo módulo sí gatea el resto", () => {
    expect(isModuleEnabled({ modules: ["secretaria"] }, "secretaria")).toBe(true);
    expect(isModuleEnabled({ modules: ["secretaria"] }, "dora")).toBe(false);
  });

  it("modules mal formado se ignora y falla abierto", () => {
    expect(isModuleEnabled({ modules: "dora" } as never, "dora")).toBe(true);
    expect(isModuleEnabled({ modules: [1, 2] } as never, "dora")).toBe(true);
  });
});
