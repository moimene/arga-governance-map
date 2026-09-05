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

  // El mapa hablaba SEALED/VERIFIED/PENDING/FAILED mientras la única tabla que
  // alimenta el badge (secretaria_document_artifacts.evidence_status) solo
  // admite DEMO_OPERATIVA/EVIDENCE_*. Vocabularios disjuntos: TODO estado real
  // caía al fallback. Este bloque fija el vocabulario del CHECK.
  const CHECK_VOCABULARY = [
    "DEMO_OPERATIVA",
    "EVIDENCE_OPEN",
    "EVIDENCE_SEALED",
    "EVIDENCE_VERIFIED",
    "EVIDENCE_FAILED",
  ];

  it("habla el vocabulario del CHECK: ningún estado real cae al fallback", () => {
    // DEMO_OPERATIVA es la única excepción deliberada: SÍ es entorno de validación.
    for (const status of CHECK_VOCABULARY.filter((s) => s !== "DEMO_OPERATIVA")) {
      const d = evidenceStatusDescriptor(status);
      expect(d.label).not.toBe("Entorno de validación funcional");
    }
    expect(evidenceStatusDescriptor("DEMO_OPERATIVA").label).toBe("Entorno de validación funcional");
  });

  it("un fallo de evidencia se rotula como fallo, no como entorno de validación", () => {
    const d = evidenceStatusDescriptor("EVIDENCE_FAILED");
    expect(d.tone).toBe("error");
    expect(d.label).toBe("Error de evidencia");
  });

  it("ningún estado afirma firma, sello, envío ni entrega", () => {
    for (const status of CHECK_VOCABULARY) {
      const d = evidenceStatusDescriptor(status);
      expect(d.isQualified).toBe(false);
      expect(`${d.label} ${d.disclaimer ?? ""}`).not.toMatch(
        /QTSP productivo|firma cualificada|sello cualificado real|ERDS|entrega certificada/i,
      );
    }
  });
});
