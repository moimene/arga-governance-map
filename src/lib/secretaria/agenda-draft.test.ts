import { describe, it, expect } from "vitest";
import {
  nextAgendaDraftEstado,
  availableAgendaDraftActions,
} from "./agenda-draft";

// W9 — máquina de estados del borrador de punto de agenda (cross-módulo):
// PENDIENTE → APROBADO | POSPUESTO | RECHAZADO; POSPUESTO → APROBADO | RECHAZADO;
// APROBADO → CONVOCADO. RECHAZADO y CONVOCADO son terminales. El Secretario es el
// garante: ningún evento externo salta directo a CONVOCADO.
describe("nextAgendaDraftEstado", () => {
  it("PENDIENTE + APROBAR → APROBADO", () => {
    expect(nextAgendaDraftEstado("PENDIENTE", "APROBAR")).toBe("APROBADO");
  });
  it("PENDIENTE + POSPONER → POSPUESTO", () => {
    expect(nextAgendaDraftEstado("PENDIENTE", "POSPONER")).toBe("POSPUESTO");
  });
  it("PENDIENTE + RECHAZAR → RECHAZADO", () => {
    expect(nextAgendaDraftEstado("PENDIENTE", "RECHAZAR")).toBe("RECHAZADO");
  });
  it("POSPUESTO + APROBAR → APROBADO", () => {
    expect(nextAgendaDraftEstado("POSPUESTO", "APROBAR")).toBe("APROBADO");
  });
  it("APROBADO + CONVOCAR → CONVOCADO", () => {
    expect(nextAgendaDraftEstado("APROBADO", "CONVOCAR")).toBe("CONVOCADO");
  });
  it("no se puede convocar un PENDIENTE (el Secretario aprueba primero)", () => {
    expect(nextAgendaDraftEstado("PENDIENTE", "CONVOCAR")).toBeNull();
  });
  it("RECHAZADO y CONVOCADO son terminales", () => {
    expect(nextAgendaDraftEstado("RECHAZADO", "APROBAR")).toBeNull();
    expect(nextAgendaDraftEstado("CONVOCADO", "RECHAZAR")).toBeNull();
  });
});

describe("availableAgendaDraftActions", () => {
  it("PENDIENTE → aprobar/posponer/rechazar", () => {
    expect(availableAgendaDraftActions("PENDIENTE")).toEqual([
      "APROBAR",
      "POSPONER",
      "RECHAZAR",
    ]);
  });
  it("APROBADO → convocar", () => {
    expect(availableAgendaDraftActions("APROBADO")).toEqual(["CONVOCAR"]);
  });
  it("POSPUESTO → aprobar/rechazar", () => {
    expect(availableAgendaDraftActions("POSPUESTO")).toEqual(["APROBAR", "RECHAZAR"]);
  });
  it("terminales → sin acciones", () => {
    expect(availableAgendaDraftActions("RECHAZADO")).toEqual([]);
    expect(availableAgendaDraftActions("CONVOCADO")).toEqual([]);
  });
});
