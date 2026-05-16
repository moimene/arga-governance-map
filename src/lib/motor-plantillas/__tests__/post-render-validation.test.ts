import { describe, expect, it } from "vitest";
import { validatePostRenderDocument } from "../post-render-validation";
import {
  buildActaAgendaViewModel,
  type ActaAgendaItemRow,
} from "@/lib/secretaria/acta-agenda";
import { buildActaLegalStructureViewModel } from "@/lib/secretaria/acta-legal-structure";

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

  it("bloquea ACTA con contrato RRM si el texto final no respeta secciones legales", () => {
    const agendaItems: ActaAgendaItemRow[] = [
      {
        id: "ai-1",
        meeting_id: "m-1",
        order_number: 1,
        title: "Informe del presidente",
        description: "Constancia informativa.",
        kind: "INFORMATIVO",
        tenant_id: "t-1",
      },
    ];
    const puntos = buildActaAgendaViewModel({ agendaItems });
    const actaLegalStructure = buildActaLegalStructureViewModel({
      meetingId: "m-1",
      entityName: "ARGA Seguros, S.A.",
      organName: "Consejo de Administración",
      organKind: "CONSEJO",
      date: "15/05/2026",
      startTime: "10:00",
      place: "Madrid",
      convocationText: "Convocatoria documentada.",
      president: "Antonio Ríos",
      secretary: "Lucía Paredes",
      attendees: [{ name: "Antonio Ríos", attendance: "PRESENTE" }],
      quorumText: "Quórum suficiente.",
      agendaItems: puntos,
      canonicalMinutesHash: "hash-acta-demo",
      approvalMode: "aprobación en el acto",
      approvalDate: "15/05/2026",
    });

    const result = validatePostRenderDocument({
      documentType: "ACTA",
      renderedText: "ACTA\nORDEN DEL DÍA\n1. Informe del presidente",
      capa1Template: "ACTA con estructura RRM suficiente para la prueba de validación post-render.",
      agreementIds: [],
      unresolvedVariables: [],
      actaLegalStructure,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("rrm_render_section_missing");
    expect(result.issues.map((issue) => issue.code)).toContain("rrm_render_hash_missing");
  });
});
