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

  it("mantiene el agreement_id fuera del cuerpo visible sin bloquear el render", () => {
    const result = validatePostRenderDocument({
      documentType: "CERTIFICACION",
      renderedText: "CERTIFICACION DE ACUERDOS\nDña. Lucía Paredes, Secretaria, cargo vigente y en ejercicio.\nEl acta fue aprobada mediante firma por la Secretaría el 3 de mayo de 2026.\nTexto certificado suficiente.\nFirma del certificante: Lucía Paredes.\nVisto bueno de la Presidencia: Antonio Ríos.",
      capa1Template: "CERTIFICACION DE ACUERDOS\nTexto de plantilla suficientemente largo para no bloquear.",
      agreementIds: ["00000000-0000-4000-8000-000000000001"],
      unresolvedVariables: [],
      outputContext: {
        meetingDateISO: "2026-05-03",
        approvalDateISO: "2026-05-03",
        emissionDateISO: "2026-05-03",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.issues.some((issue) => issue.code === "AGREEMENT_REFERENCE_NOT_RENDERED")).toBe(false);
  });

  it("bloquea tambien un modelo de acuerdo con variables del cuerpo sin resolver", () => {
    const result = validatePostRenderDocument({
      documentType: "MODELO_ACUERDO",
      renderedText: "ACUERDO DEL CONSEJO DE ADMINISTRACIÓN\nSe otorgan facultades a favor de .",
      capa1Template: "ACUERDO DEL CONSEJO DE ADMINISTRACIÓN con contenido legal suficiente y la variable {{apoderado_nombre}}.",
      agreementIds: [],
      unresolvedVariables: ["apoderado_nombre"],
    });

    expect(result.ok).toBe(false);
    expect(result.issues.find((issue) => issue.code === "UNRESOLVED_VARIABLES")?.severity).toBe("BLOCKING");
  });

  it("mantiene como advertencia los placeholders QTSP que nacen tras la firma", () => {
    const result = validatePostRenderDocument({
      documentType: "MODELO_ACUERDO",
      renderedText: "ACUERDO DEL CONSEJO DE ADMINISTRACIÓN\nDocumento preparado para firma cualificada posterior.",
      capa1Template: "ACUERDO DEL CONSEJO DE ADMINISTRACIÓN con contenido legal suficiente para firma cualificada posterior.",
      agreementIds: [],
      unresolvedVariables: ["QTSP.firma_qes_ref"],
    });

    expect(result.ok).toBe(true);
    expect(result.issues.find((issue) => issue.code === "UNRESOLVED_VARIABLES")?.severity).toBe("WARNING");
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
    expect(result.issues.map((issue) => issue.code)).not.toContain("rrm_render_hash_missing");
  });
});
