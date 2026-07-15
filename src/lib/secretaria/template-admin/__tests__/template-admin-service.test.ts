import { describe, it, expect } from "vitest";
import { isTransitionAllowed } from "../template-admin-service";
import type { EstadoPlantilla } from "../types";

describe("template-admin-service — state machine", () => {
  it("BORRADOR → REVISADA permitido", () => {
    expect(isTransitionAllowed("BORRADOR", "REVISADA")).toBe(true);
  });
  it("REVISADA → APROBADA permitido", () => {
    expect(isTransitionAllowed("REVISADA", "APROBADA")).toBe(true);
  });
  it("APROBADA → ACTIVA permitido", () => {
    expect(isTransitionAllowed("APROBADA", "ACTIVA")).toBe(true);
  });
  it("ACTIVA → ARCHIVADA permitido", () => {
    expect(isTransitionAllowed("ACTIVA", "ARCHIVADA")).toBe(true);
  });
  it("ARCHIVADA → ACTIVA PROHIBIDO (terminal)", () => {
    expect(isTransitionAllowed("ARCHIVADA", "ACTIVA")).toBe(false);
  });
  it("BORRADOR → ACTIVA PROHIBIDO (saltar pasos)", () => {
    expect(isTransitionAllowed("BORRADOR", "ACTIVA")).toBe(false);
  });
  it("REVISADA → BORRADOR permitido (volver atrás)", () => {
    expect(isTransitionAllowed("REVISADA", "BORRADOR")).toBe(true);
  });
  it("APROBADA → BORRADOR permitido (volver atrás)", () => {
    expect(isTransitionAllowed("APROBADA", "BORRADOR")).toBe(true);
  });
  it("DEPRECADA se conserva como estado histórico terminal", () => {
    expect(isTransitionAllowed("DEPRECADA", "ARCHIVADA")).toBe(false);
  });

  it("matriz completa 6×6 coincide con el contrato del workflow", () => {
    const estados: EstadoPlantilla[] = [
      "BORRADOR",
      "REVISADA",
      "APROBADA",
      "ACTIVA",
      "ARCHIVADA",
      "DEPRECADA",
    ];
    const allowed = new Set([
      "BORRADOR->REVISADA",
      "BORRADOR->ARCHIVADA",
      "REVISADA->APROBADA",
      "REVISADA->BORRADOR",
      "REVISADA->ARCHIVADA",
      "APROBADA->ACTIVA",
      "APROBADA->BORRADOR",
      "APROBADA->ARCHIVADA",
      "ACTIVA->ARCHIVADA",
    ]);

    for (const from of estados) {
      for (const to of estados) {
        expect(isTransitionAllowed(from, to), `${from}->${to}`).toBe(
          allowed.has(`${from}->${to}`),
        );
      }
    }
  });
});
