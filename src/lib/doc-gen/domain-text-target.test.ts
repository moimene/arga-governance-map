import { describe, it, expect } from "vitest";
import { domainTextTargetForKind } from "./domain-text-target";

// W0 #1/#8 — política de unificación de la fuente de verdad de texto: al
// archivar un DOCX, el cuerpo revisado se reescribe a la columna de texto de
// dominio para los kinds que la tienen y son seguros. Este test es el guard de
// regresión de esa política (si se añade un kind, hay que decidir explícitamente
// si sincroniza).
describe("domainTextTargetForKind", () => {
  it("convocatoria → convocatorias.convocatoria_text", () => {
    expect(domainTextTargetForKind("CONVOCATORIA")).toEqual({
      table: "convocatorias",
      column: "convocatoria_text",
    });
  });

  it("decisión unipersonal → unipersonal_decisions.content", () => {
    expect(domainTextTargetForKind("DECISION_UNIPERSONAL")).toEqual({
      table: "unipersonal_decisions",
      column: "content",
    });
  });

  it("acta NO se reescribe aquí (la gobierna el editor de borrador + lock guard)", () => {
    expect(domainTextTargetForKind("ACTA")).toBeNull();
  });

  it("certificación NO se reescribe aquí (la gobierna EmitirCertificacionButton)", () => {
    expect(domainTextTargetForKind("CERTIFICACION")).toBeNull();
  });

  it("kinds registrales no tienen columna de dominio de texto → null", () => {
    expect(domainTextTargetForKind("DOCUMENTO_REGISTRAL")).toBeNull();
    expect(domainTextTargetForKind("SUBSANACION_REGISTRAL")).toBeNull();
  });
});
