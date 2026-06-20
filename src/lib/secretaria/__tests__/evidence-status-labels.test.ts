import { describe, expect, it } from "vitest";
import { evidenceStatusDescriptor } from "../evidence-status-labels";

describe("evidenceStatusDescriptor", () => {
  it("marca el entorno de validación funcional como no cualificado y con disclaimer", () => {
    const d = evidenceStatusDescriptor("DEMO_OPERATIVA");
    expect(d.label).toBe("Entorno de validación funcional");
    expect(d.isQualified).toBe(false);
    expect(d.disclaimer).toContain("sin eficacia jurídica cualificada productiva");
  });

  it("trata valores desconocidos o nulos como entorno de validación funcional (fallback seguro)", () => {
    expect(evidenceStatusDescriptor(null).isQualified).toBe(false);
    expect(evidenceStatusDescriptor(undefined).isQualified).toBe(false);
    expect(evidenceStatusDescriptor("LO_QUE_SEA").label).toBe("Entorno de validación funcional");
  });

  it("reconoce evidencia cualificada productiva (sellada/verificada)", () => {
    expect(evidenceStatusDescriptor("SEALED").isQualified).toBe(true);
    expect(evidenceStatusDescriptor("VERIFIED").isQualified).toBe(true);
  });

  it("distingue pendiente y error de evidencia", () => {
    expect(evidenceStatusDescriptor("PENDING").label).toBe("Pendiente de evidencia");
    expect(evidenceStatusDescriptor("FAILED").tone).toBe("error");
  });
});
