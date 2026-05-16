import { describe, expect, it } from "vitest";
import { computeContentHash, generateDocx } from "../docx-generator";
import { validateGeneratedDocxOpenXml } from "../openxml-validation";
import {
  buildActaAgendaViewModel,
  type ActaAgendaItemRow,
} from "@/lib/secretaria/acta-agenda";
import {
  buildActaLegalStructureViewModel,
  renderActaLegalStructureText,
} from "@/lib/secretaria/acta-legal-structure";

function actaModel() {
  const agendaItems: ActaAgendaItemRow[] = [
    {
      id: "ai-1",
      meeting_id: "m-1",
      order_number: 1,
      title: "Informe del presidente",
      description: "Informe presentado al Consejo.",
      kind: "INFORMATIVO",
      tenant_id: "tenant-1",
    },
    {
      id: "ai-2",
      meeting_id: "m-1",
      order_number: 2,
      title: "Aprobacion de cuentas",
      description: "Decision sobre cuentas anuales.",
      kind: "DECISORIO",
      tenant_id: "tenant-1",
    },
  ];
  const puntos = buildActaAgendaViewModel({ agendaItems });
  return buildActaLegalStructureViewModel({
    meetingId: "m-1",
    minuteId: "minute-1",
    entityName: "ARGA Seguros, S.A.",
    organName: "Consejo de Administracion",
    organKind: "CONSEJO",
    date: "15/05/2026",
    startTime: "10:00",
    place: "Madrid",
    convocationText: "Convocatoria documentada.",
    president: "Antonio Rios",
    secretary: "Lucia Paredes",
    attendees: [{ name: "Antonio Rios", attendance: "PRESENTE" }],
    quorumText: "Quorum suficiente.",
    agendaItems: puntos,
    canonicalMinutesHash: "hash-acta-openxml-demo",
    approvalMode: "aprobacion en el acto",
    approvalDate: "15/05/2026",
  });
}

async function docxFor(renderedText: string) {
  const contentHash = await computeContentHash(renderedText);
  const buffer = await generateDocx({
    renderedText,
    title: "Acta",
    templateTipo: "ACTA_SESION",
    templateVersion: "1.0.0",
    contentHash,
    generatedAt: "2026-05-15",
  });
  return { buffer, contentHash };
}

describe("openxml-validation", () => {
  it("valida el DOCX final contra estructura RRM y orden del dia", async () => {
    const model = actaModel();
    const renderedText = [
      renderActaLegalStructureText(model),
      "",
      "HASH CANONICO DEL ACTA",
      "hash-acta-openxml-demo",
    ].join("\n");
    const { buffer, contentHash } = await docxFor(renderedText);

    const result = await validateGeneratedDocxOpenXml({
      buffer,
      renderedText,
      documentType: "ACTA",
      contentHash,
      actaLegalStructure: model,
    });

    expect(result.ok).toBe(true);
    expect(result.documentText).toContain("ORDEN DEL DÍA");
    expect(result.documentText.indexOf("1. Informe del presidente")).toBeLessThan(
      result.documentText.indexOf("2. Aprobacion de cuentas"),
    );
  });

  it("bloquea un DOCX de acta que omite secciones obligatorias", async () => {
    const model = actaModel();
    const renderedText = [
      "ACTA",
      "ORDEN DEL DIA",
      "1. Informe del presidente",
      "2. Aprobacion de cuentas",
      "hash-acta-openxml-demo",
    ].join("\n");
    const { buffer, contentHash } = await docxFor(renderedText);

    const result = await validateGeneratedDocxOpenXml({
      buffer,
      renderedText,
      documentType: "ACTA",
      contentHash,
      actaLegalStructure: model,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("DOCX_rrm_render_section_missing");
  });
});
