import { describe, it, expect } from "bun:test";
import { findingStatusToStep, findingStatusLabel } from "@/hooks/useFindings";

// MOI-149 P1: /hallazgos/nuevo persiste el status real "En remediación"
// (minúscula, tal como exige el CHECK de Cloud). findingStatusToStep debía
// reconocer esa forma exacta para que el WorkflowStepper no lo congele en
// el paso 1.
describe("findingStatusToStep — En remediación (forma real persistida)", () => {
  it("mapea la forma real 'En remediación' al paso 4, no al 1 por defecto", () => {
    expect(findingStatusToStep("En remediación")).toBe(4);
  });

  it("sigue aceptando los alias legacy", () => {
    expect(findingStatusToStep("EnRemediacion")).toBe(4);
    expect(findingStatusToStep("En Remediación")).toBe(4);
  });

  it("findingStatusLabel también reconoce la forma real", () => {
    expect(findingStatusLabel("En remediación")).toBe("EN REMEDIACIÓN");
  });
});
