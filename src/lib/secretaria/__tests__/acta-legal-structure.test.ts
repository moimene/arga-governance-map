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
import {
  buildCompleteArgaLegalArtifactManifest,
  buildDefectiveArgaLegalArtifactManifest,
  buildPreSignatureArgaLegalArtifactManifest,
} from "./legal-artifact-manifest.fixture";

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

  it("renderiza etiquetas y puntuación de negocio, sin códigos técnicos", () => {
    const model = buildActaLegalStructureViewModel({
      ...baseInput(),
      organKind: "JUNTA",
      meetingCharacter: "NO_UNIVERSAL",
      convocationPublicationText: "Publicación incorporada al expediente.",
    });

    expect(model.sections.heading).toContain("Clase y carácter de la reunión: No universal.");
    expect(model.sections.heading).toContain("Publicación incorporada al expediente.");
    expect(model.sections.heading).not.toContain("expediente..");
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

  it("no afirma aprobación ni fecha en un acta que sigue en borrador", () => {
    const input = { ...baseInput(), approvalMode: null, approvalDate: null };
    const model = buildActaLegalStructureViewModel(input);
    const rendered = renderActaLegalStructureText(model);
    const validation = validateActaRrmStructure(input);

    expect(model.sections.approval).toContain("Acta en borrador");
    expect(model.sections.approval).toContain("no acredita todavía la aprobación ni la firma");
    expect(rendered).not.toContain("Fecha de aprobación: 15/05/2026");
    expect(validation.blockingIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["rrm_approval_mode_missing", "rrm_approval_date_missing"]),
    );
  });

  it("incorpora el manifest canónico a las variables legales sin perder determinismo", () => {
    const manifest = buildCompleteArgaLegalArtifactManifest();
    const first = buildActaLegalStructureViewModel({ ...baseInput(), legalArtifactManifest: manifest });
    const second = buildActaLegalStructureViewModel({ ...baseInput(), legalArtifactManifest: manifest });

    expect(first.legal_artifact_manifest).toMatchObject({
      schemaVersion: "legal-artifact-manifest.v1",
      entity: { name: "ARGA Seguros, S.A.", listed: true },
      organ: { kind: "BOARD" },
    });
    expect(first.legal_artifact_manifest_canonical).toBe(second.legal_artifact_manifest_canonical);
    expect(first.legal_artifact_validation_phase).toBe("PRE_SIGNATURE");
  });

  it("permite que la proyección PRE_SIGNATURE mantenga aprobación, firmas y asiento pendientes", () => {
    const result = validateActaRrmStructure({
      ...baseInput(),
      approvalMode: null,
      approvalDate: null,
      legalArtifactManifest: buildPreSignatureArgaLegalArtifactManifest(),
      legalArtifactValidationPhase: "PRE_SIGNATURE",
    });
    const codes = result.blockingIssues.map((issue) => issue.code);

    expect(codes).not.toContain("rrm_approval_mode_missing");
    expect(codes).not.toContain("rrm_approval_date_missing");
    expect(codes).not.toContain("manifest_approval_pending");
    expect(codes).not.toContain("manifest_required_signature_missing");
    expect(codes).not.toContain("manifest_book_entry_missing");
  });

  it("propaga al gate del acta los defectos jurídicos del manifest ARGA observado", () => {
    const result = validateActaRrmStructure({
      ...baseInput(),
      legalArtifactManifest: buildDefectiveArgaLegalArtifactManifest(),
    });
    const codes = result.blockingIssues.map((issue) => issue.code);

    expect(result.ok).toBe(false);
    expect(codes).toEqual(expect.arrayContaining([
      "listed_board_legal_person_forbidden",
      "listed_board_capital_percentage_forbidden",
      "manifest_vote_denominator_mismatch",
      "manifest_future_meeting_asserted",
    ]));
  });

  it("no convierte una remisión genérica en una convocatoria válida", () => {
    const result = validateActaRrmStructure({
      ...baseInput(),
      convocationText: "Según consta en el expediente.",
    });

    expect(result.ok).toBe(false);
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("rrm_convocation_missing");
  });
});
