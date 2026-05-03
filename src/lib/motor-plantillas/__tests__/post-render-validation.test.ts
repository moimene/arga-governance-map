import { describe, expect, it } from "vitest";
import { validatePostRenderDocument } from "../post-render-validation";

describe("post-render validation", () => {
  it("bloquea variables huerfanas y detecta capa1 demasiado corta", () => {
    const result = validatePostRenderDocument({
      documentType: "ACTA",
      renderedText: "ACTA {{pendiente}}",
      capa1Template: "ACTA {{pendiente}}",
      agreementIds: ["agreement-1"],
      unresolvedVariables: ["pendiente"],
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["ORPHAN_TEMPLATE_VARIABLES", "CAPA1_TOO_SHORT"]),
    );
    expect(result.issues.find((issue) => issue.code === "CAPA1_TOO_SHORT")?.severity).toBe("WARNING");
  });

  it("advierte si no se ve el agreement_id, sin bloquear el render", () => {
    const result = validatePostRenderDocument({
      documentType: "CERTIFICACION",
      renderedText: "CERTIFICACION DE ACUERDOS\nTexto certificado suficiente para pasar la validacion minima.",
      capa1Template: "CERTIFICACION DE ACUERDOS\nTexto de plantilla suficientemente largo para no bloquear.",
      agreementIds: ["00000000-0000-4000-8000-000000000001"],
      unresolvedVariables: [],
    });

    expect(result.ok).toBe(true);
    expect(result.issues.some((issue) => issue.code === "AGREEMENT_REFERENCE_NOT_RENDERED")).toBe(true);
  });
});
