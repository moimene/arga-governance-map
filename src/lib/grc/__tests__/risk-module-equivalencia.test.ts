import { describe, expect, it } from "bun:test";
import { MODULO_RIESGO_EQUIVALENCIA, moduloEquivalente } from "../risk-module-equivalencia";

// Módulos que ARGA tiene declarados en `grc_modules` (medido en vivo el
// 2026-09-26). Esta lista es un espejo de control, no la fuente de verdad: si
// un valor de `equivalente` deja de estar aquí, avisa de que la tabla apunta a
// un módulo que no existía cuando se escribió, no de un cambio en Cloud.
const MODULOS_DECLARADOS_ARGA_2026_09_26 = [
  "abc",
  "ai",
  "aml",
  "audit",
  "competition",
  "cyber",
  "dora",
  "esg",
  "ethics",
  "gdpr",
  "hs",
  "risk",
  "sanctions",
  "tprm",
];

describe("MODULO_RIESGO_EQUIVALENCIA — mapa de equivalencias de módulo (MOI-189, decisión D-10.b)", () => {
  it("cada entrada apunta a un módulo que ARGA tenía declarado en la medición del 2026-09-26", () => {
    for (const [moduleId, { equivalente }] of Object.entries(MODULO_RIESGO_EQUIVALENCIA)) {
      expect(
        MODULOS_DECLARADOS_ARGA_2026_09_26.includes(equivalente),
        `${moduleId} → '${equivalente}' no es un módulo declarado conocido`,
      ).toBe(true);
    }
  });

  it("cada entrada trae su motivo, no solo el destino", () => {
    for (const [moduleId, { motivo }] of Object.entries(MODULO_RIESGO_EQUIVALENCIA)) {
      expect(motivo.trim().length, `${moduleId} sin motivo`).toBeGreaterThan(0);
    }
  });

  it("moduloEquivalente() resuelve los 11 valores medidos el 2026-09-26", () => {
    expect(moduloEquivalente("penal")).toBe("abc");
    expect(moduloEquivalente("solvency2")).toBe("risk");
    expect(moduloEquivalente("tech")).toBe("cyber");
    expect(moduloEquivalente("idd")).toBe("risk");
    expect(moduloEquivalente("labor")).toBe("hs");
    expect(moduloEquivalente("compliance")).toBe("audit");
    expect(moduloEquivalente("reporting")).toBe("audit");
    expect(moduloEquivalente("reputational")).toBe("risk");
    expect(moduloEquivalente("fraud")).toBe("abc");
    expect(moduloEquivalente("strategic")).toBe("risk");
    expect(moduloEquivalente("governance")).toBe("risk");
  });

  it("moduloEquivalente() no inventa una equivalencia para un módulo ya declarado o desconocido", () => {
    expect(moduloEquivalente("risk")).toBeNull();
    expect(moduloEquivalente("algo-nuevo-sin-declarar")).toBeNull();
    expect(moduloEquivalente(null)).toBeNull();
    expect(moduloEquivalente(undefined)).toBeNull();
  });
});
