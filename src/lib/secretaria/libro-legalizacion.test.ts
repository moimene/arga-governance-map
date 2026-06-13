import { describe, it, expect } from "vitest";
import {
  nextLegalizacionStatus,
  availableLegalizacionActions,
} from "./libro-legalizacion";

// W4 — máquina de estados de legalización de libros:
// PENDIENTE → (cierre de volumen) → PRESENTADO → LEGALIZADO | RECHAZADO;
// RECHAZADO se puede re-PRESENTAR; LEGALIZADO es terminal.
describe("nextLegalizacionStatus", () => {
  it("PENDIENTE + PRESENTAR → PRESENTADO", () => {
    expect(nextLegalizacionStatus("PENDIENTE", "PRESENTAR")).toBe("PRESENTADO");
  });
  it("PRESENTADO + LEGALIZAR → LEGALIZADO", () => {
    expect(nextLegalizacionStatus("PRESENTADO", "LEGALIZAR")).toBe("LEGALIZADO");
  });
  it("PRESENTADO + RECHAZAR → RECHAZADO", () => {
    expect(nextLegalizacionStatus("PRESENTADO", "RECHAZAR")).toBe("RECHAZADO");
  });
  it("RECHAZADO + PRESENTAR → PRESENTADO (re-presentación)", () => {
    expect(nextLegalizacionStatus("RECHAZADO", "PRESENTAR")).toBe("PRESENTADO");
  });
  it("LEGALIZADO es terminal", () => {
    expect(nextLegalizacionStatus("LEGALIZADO", "PRESENTAR")).toBeNull();
    expect(nextLegalizacionStatus("LEGALIZADO", "RECHAZAR")).toBeNull();
  });
  it("transición inválida → null", () => {
    expect(nextLegalizacionStatus("PENDIENTE", "LEGALIZAR")).toBeNull();
  });
});

describe("availableLegalizacionActions", () => {
  it("PENDIENTE con volumen cerrado → PRESENTAR disponible", () => {
    expect(availableLegalizacionActions("PENDIENTE", true)).toEqual(["PRESENTAR"]);
  });
  it("PENDIENTE con volumen abierto → sin acciones (cerrar primero)", () => {
    expect(availableLegalizacionActions("PENDIENTE", false)).toEqual([]);
  });
  it("PRESENTADO → LEGALIZAR y RECHAZAR", () => {
    expect(availableLegalizacionActions("PRESENTADO", true)).toEqual([
      "LEGALIZAR",
      "RECHAZAR",
    ]);
  });
  it("LEGALIZADO → sin acciones", () => {
    expect(availableLegalizacionActions("LEGALIZADO", true)).toEqual([]);
  });
});
