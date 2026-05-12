import { describe, it, expect } from "vitest";
import { isTransitionAllowed } from "../template-admin-service";

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
});
