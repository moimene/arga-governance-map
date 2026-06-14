import { describe, it, expect } from "vitest";
import { registryChannelsForJurisdiction } from "./registry-channels";

// ITEM-025 — el selector de canal de presentación registral debe ofrecer solo los
// canales de la jurisdicción de la entidad (no todos a la vez).
describe("registryChannelsForJurisdiction (ITEM-025)", () => {
  it("ES → solo Registro Mercantil", () => {
    const v = registryChannelsForJurisdiction("ES").map((c) => c.value);
    expect(v).toEqual(["REGISTRO_MERCANTIL"]);
  });

  it("MX → SIGER y PSM", () => {
    const v = registryChannelsForJurisdiction("MX").map((c) => c.value);
    expect(v).toEqual(["SIGER", "PSM"]);
  });

  it("BR → JUCERJA", () => {
    const v = registryChannelsForJurisdiction("BR").map((c) => c.value);
    expect(v).toEqual(["JUCERJA"]);
  });

  it("PT → Conservatória", () => {
    const v = registryChannelsForJurisdiction("PT").map((c) => c.value);
    expect(v).toEqual(["CONSERVATORIA"]);
  });

  it("normaliza minúsculas/espacios", () => {
    expect(registryChannelsForJurisdiction(" mx ").map((c) => c.value)).toEqual(["SIGER", "PSM"]);
  });

  it("jurisdicción desconocida/nula → fallback ES (no muestra canales de otros países)", () => {
    expect(registryChannelsForJurisdiction(null).map((c) => c.value)).toEqual(["REGISTRO_MERCANTIL"]);
    expect(registryChannelsForJurisdiction("XX").map((c) => c.value)).toEqual(["REGISTRO_MERCANTIL"]);
  });

  it("cada canal trae label no vacío", () => {
    for (const j of ["ES", "MX", "BR", "PT"]) {
      for (const c of registryChannelsForJurisdiction(j)) {
        expect(c.label.length).toBeGreaterThan(0);
      }
    }
  });
});
