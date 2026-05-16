import { describe, expect, it } from "vitest";
import {
  buildActaAgendaViewModel,
  type ActaAgendaItemRow,
} from "../acta-agenda";
import {
  buildActaLegalStructureViewModel,
  renderActaLegalStructureText,
  validateActaRrmStructure,
  validateRenderedActaAgainstLegalStructure,
} from "../acta-legal-structure";

const agendaRows: ActaAgendaItemRow[] = [
  {
    id: "ai-1",
    meeting_id: "m-1",
    order_number: 1,
    title: "Informe del presidente",
    description: "Se informa de la evolución del ejercicio.",
    kind: "INFORMATIVO",
    tenant_id: "t-1",
  },
  {
    id: "ai-2",
    meeting_id: "m-1",
    order_number: 2,
    title: "Aprobación de cuentas",
    description: "Propuesta de aprobación de cuentas.",
    kind: "DECISORIO",
    tenant_id: "t-1",
  },
  {
    id: "ai-3",
    meeting_id: "m-1",
    order_number: 3,
    title: "Ruegos y preguntas",
    description: "Intervenciones finales.",
    kind: "RUEGOS_PREGUNTAS",
    tenant_id: "t-1",
  },
];

function puntos() {
  return buildActaAgendaViewModel({
    agendaItems: agendaRows,
    resolutions: [
      {
        id: "r-2",
        meeting_id: "m-1",
        agenda_item_index: 2,
        kind_resolution: "DECISION",
        status: "PROPOSED",
        resolution_text: "Se someten a aprobación las cuentas anuales.",
      },
    ],
  });
}

function baseInput() {
  return {
    meetingId: "m-1",
    minuteId: "min-1",
    entityName: "ARGA Seguros, S.A.",
    organName: "Consejo de Administración",
    organKind: "CONSEJO" as const,
    meetingCharacter: "ORDINARIA",
    entityType: "SA",
    date: "15/05/2026",
    startTime: "10:00",
    endTime: "11:00",
    place: "Madrid",
    convocationText: "Convocatoria remitida por la Secretaría con la antelación estatutaria.",
    president: "Antonio Ríos",
    secretary: "Lucía Paredes",
    attendees: [
      { name: "Antonio Ríos", role: "Presidente", attendance: "PRESENTE" as const },
      { name: "Lucía Paredes", role: "Secretaria", attendance: "PRESENTE" as const },
    ],
    quorumText: "2 de 2 miembros concurrentes.",
    agendaItems: puntos(),
    agendaRows,
    canonicalMinutesHash: "hash-canónico-demo",
    approvalMode: "aprobación en el acto por el propio órgano",
    approvalDate: "15/05/2026",
  };
}

describe("acta-legal-structure — RRM + document composer", () => {
  it("compone un borrador determinista con secciones RRM y source map por punto", () => {
    const model = buildActaLegalStructureViewModel(baseInput());
    const rendered = renderActaLegalStructureText(model);

    expect(model.schema_version).toBe("acta-legal-structure.v1");
    expect(model.composer.provider).toBe("DETERMINISTIC_LOCAL");
    expect(model.composer.humanReviewRequired).toBe(true);
    expect(model.composer.sourceMap.filter((entry) => entry.section === "DESARROLLO_SESION")).toHaveLength(3);
    expect(rendered).toContain("ENCABEZADO");
    expect(rendered).toContain("CONSTITUCIÓN DE LA REUNIÓN");
    expect(rendered).toContain("ORDEN DEL DÍA");
    expect(rendered).toContain("ACUERDOS Y VOTACIONES");
  });

  it("bloquea junta SA no universal sin publicación o medio de convocatoria", () => {
    const result = validateActaRrmStructure({
      ...baseInput(),
      organKind: "JUNTA",
      organName: "Junta General",
      meetingCharacter: "NO_UNIVERSAL",
      convocationPublicationText: "",
      attendees: [
        { name: "Fundación ARGA", attendance: "PRESENTE", capitalPercentage: "69,69%" },
      ],
      quorumText: "Un socio presente que representa el 69,69% del capital social.",
    });

    expect(result.ok).toBe(false);
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("rrm_sa_publication_missing");
  });

  it("valida que el render DOCX conserve secciones, orden y hash canónico", () => {
    const model = buildActaLegalStructureViewModel(baseInput());
    const rendered = `${renderActaLegalStructureText(model)}\n\nHASH CANÓNICO DEL ACTA\nhash-canónico-demo`;

    expect(validateRenderedActaAgainstLegalStructure(rendered, model)).toEqual([]);
    expect(validateRenderedActaAgainstLegalStructure("ACTA\nORDEN DEL DÍA\n2. Aprobación de cuentas", model).map((issue) => issue.code))
      .toContain("rrm_render_section_missing");
  });
});
