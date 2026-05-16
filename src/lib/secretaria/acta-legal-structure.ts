import {
  renderActaAgendaItemsText,
  validateActaLegalStructure,
  type ActaAgendaItemRow,
  type ActaAgendaItemViewModel,
  type ActaAgreementRow,
  type ActaLegalStructureIssue,
} from "./acta-agenda";

export type ActaOrganKind = "JUNTA" | "CONSEJO" | "OTRO";
export type ActaMeetingCharacter = "ORDINARIA" | "EXTRAORDINARIA" | "UNIVERSAL" | "NO_UNIVERSAL" | "OTRA";

export interface ActaLegalAttendee {
  name: string;
  role?: string | null;
  attendance: "PRESENTE" | "REPRESENTADO" | "AUSENTE" | "INVITADO";
  representedBy?: string | null;
  capitalPercentage?: string | null;
  signed?: boolean | null;
}

export interface ActaLegalStructureInput {
  meetingId: string;
  minuteId?: string | null;
  entityName: string;
  organName: string;
  organKind: ActaOrganKind;
  meetingCharacter?: ActaMeetingCharacter | string | null;
  entityType?: string | null;
  isUniversal?: boolean;
  date: string;
  startTime: string;
  endTime?: string | null;
  place: string;
  convocationText?: string | null;
  convocationPublicationText?: string | null;
  president: string;
  secretary: string;
  attendees: ActaLegalAttendee[];
  quorumText?: string | null;
  capitalPresentText?: string | null;
  agendaItems: ActaAgendaItemViewModel[];
  agendaRows?: ActaAgendaItemRow[];
  agreementRows?: ActaAgreementRow[];
  canonicalMinutesHash?: string | null;
  approvalMode?: string | null;
  approvalDate?: string | null;
  notarialAct?: boolean;
  annexes?: Array<{ title: string; description: string }>;
  certificationCircumstancesText?: string | null;
}

export interface ActaComposerSourceMapEntry {
  section: string;
  agendaItemId?: string;
  orderNumber?: number;
  source: "LEGAL_STRUCTURE" | "AGENDA_ITEM" | "DECISION" | "CONSTANCIA" | "SYSTEM";
}

export interface ActaDocumentComposerDraft {
  provider: "DETERMINISTIC_LOCAL";
  promptVersion: "acta-document-composer.v1";
  inputHash: string | null;
  humanReviewRequired: true;
  text: string;
  sourceMap: ActaComposerSourceMapEntry[];
}

export interface ActaLegalStructureViewModel {
  schema_version: "acta-legal-structure.v1";
  meeting_id: string;
  minute_id: string | null;
  entity_name: string;
  organ_name: string;
  organ_kind: ActaOrganKind;
  meeting_character: string;
  is_universal: boolean;
  sections: {
    heading: string;
    constitution: string;
    agenda: string;
    development: string;
    agreementsAndVotes: string;
    approval: string;
    signatures: string;
    annexes: string;
    certificationCircumstances: string;
  };
  agenda_items: ActaAgendaItemViewModel[];
  attendees: ActaLegalAttendee[];
  canonical_minutes_hash: string | null;
  composer: ActaDocumentComposerDraft;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUpper(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function inferOrganKind(value: ActaOrganKind | string | null | undefined): ActaOrganKind {
  const raw = normalizeUpper(value);
  if (raw.includes("JUNTA") || raw.includes("ASAMBLEA")) return "JUNTA";
  if (raw.includes("CONSEJO") || raw.includes("CDA") || raw.includes("COMISION")) return "CONSEJO";
  return value === "JUNTA" || value === "CONSEJO" ? value : "OTRO";
}

function isSociedadAnonima(entityType?: string | null) {
  const raw = normalizeUpper(entityType);
  return raw === "SA" || raw === "SAU" || raw.includes("S.A") || raw.includes("SOCIEDAD ANONIMA");
}

function presentAttendees(attendees: ActaLegalAttendee[]) {
  return attendees.filter((attendee) => attendee.attendance !== "AUSENTE");
}

function attendeesText(attendees: ActaLegalAttendee[], organKind: ActaOrganKind) {
  const rows = presentAttendees(attendees);
  if (rows.length === 0) return "La lista de asistentes consta en el expediente de la reunión.";
  return rows
    .map((attendee, index) => {
      const attendance =
        attendee.attendance === "REPRESENTADO"
          ? `representado${attendee.representedBy ? ` por ${attendee.representedBy}` : ""}`
          : attendee.attendance === "INVITADO"
            ? "invitado, con voz y sin voto salvo indicación estatutaria"
            : "presente";
      const capital = organKind === "JUNTA" && attendee.capitalPercentage ? `, ${attendee.capitalPercentage} del capital` : "";
      const role = attendee.role ? `, ${attendee.role}` : "";
      return `${index + 1}. ${attendee.name}${role} (${attendance}${capital})`;
    })
    .join("\n");
}

function agendaText(points: ActaAgendaItemViewModel[]) {
  return points.map((point) => `${point.order_number}. ${point.title}`).join("\n");
}

function agreementsText(points: ActaAgendaItemViewModel[]) {
  const decisionPoints = points.filter((point) => point.kind === "DECISORIO");
  if (decisionPoints.length === 0) {
    return "No se adoptan acuerdos en sentido societario, sin perjuicio de las constancias reflejadas en el desarrollo de la sesión.";
  }
  return decisionPoints
    .map((point) => {
      const status = point.status === "ADOPTED" ? "aprobado" : point.status === "REJECTED" ? "no aprobado" : "pendiente";
      const majority = point.decisorio?.majorityApplied ? ` Mayoría aplicada: ${point.decisorio.majorityApplied}.` : "";
      const proclamation = point.decisorio?.proclamation ? ` ${point.decisorio.proclamation}` : "";
      const vote = point.decisorio?.voteResult
        ? ` Votos a favor ${point.decisorio.voteResult.favor}, en contra ${point.decisorio.voteResult.contra}, abstenciones ${point.decisorio.voteResult.abstenciones}.`
        : "";
      return `${point.order_number}. ${point.decisorio?.adoptedText ?? point.resolution_text ?? point.title} Resultado: ${status}.${vote}${majority}${proclamation}`;
    })
    .join("\n");
}

function annexesText(input: ActaLegalStructureInput) {
  const annexes = input.annexes ?? [
    {
      title: "Anexo I. Lista de asistentes",
      description: "Relación de asistentes firmada por la Secretaría con el visto bueno de la Presidencia, o incorporada en soporte habilitado con la diligencia correspondiente.",
    },
  ];
  return annexes.map((annex) => `${annex.title}: ${annex.description}`).join("\n");
}

function buildSections(input: ActaLegalStructureInput) {
  const organKind = inferOrganKind(input.organKind);
  const meetingCharacter = normalizeText(input.meetingCharacter) || (input.isUniversal ? "UNIVERSAL" : "NO_UNIVERSAL");
  const convocation =
    input.isUniversal
      ? "La reunión se celebra con carácter universal, con aceptación unánime del orden del día por los asistentes."
      : normalizeText(input.convocationText) || "La reunión fue convocada en la forma legal y estatutariamente prevista, según consta en el expediente.";
  const publication = normalizeText(input.convocationPublicationText);
  const attendeesBlock = attendeesText(input.attendees, organKind);
  const quorum =
    normalizeText(input.quorumText) ||
    normalizeText(input.capitalPresentText) ||
    (organKind === "JUNTA"
      ? "El porcentaje de capital presente o representado consta en la lista de asistentes."
      : "Verificado el quórum de constitución exigido legal o estatutariamente.");
  const approvalMode = normalizeText(input.approvalMode) || "aprobación por el propio órgano al final de la reunión";
  const approvalDate = normalizeText(input.approvalDate) || input.date;

  return {
    heading: [
      `Órgano: ${input.organName}.`,
      `Sociedad: ${input.entityName}.`,
      `Clase y carácter de la reunión: ${meetingCharacter}.`,
      `Fecha, hora y lugar: ${input.date}, ${input.startTime}, ${input.place}.`,
      publication ? `Datos de publicación o comunicación de convocatoria: ${publication}.` : "",
    ].filter(Boolean).join("\n"),
    constitution: [
      convocation,
      `Preside la reunión ${input.president} y actúa como secretario ${input.secretary}.`,
      organKind === "JUNTA"
        ? `Constitución: ${quorum}. Asistentes:\n${attendeesBlock}`
        : `Constitución del órgano colegiado: ${quorum}. Miembros concurrentes:\n${attendeesBlock}`,
    ].join("\n"),
    agenda: agendaText(input.agendaItems),
    development: renderActaAgendaItemsText(input.agendaItems),
    agreementsAndVotes: agreementsText(input.agendaItems),
    approval: `El acta se somete a ${approvalMode}. Fecha de aprobación: ${approvalDate}.`,
    signatures: [
      `Firma de la Secretaría: ${input.secretary}.`,
      `Visto bueno de la Presidencia: ${input.president}.`,
      input.isUniversal && organKind === "JUNTA"
        ? "Al tratarse de junta universal, la relación de asistentes debe incorporar la firma de todos ellos junto a su nombre."
        : "",
    ].filter(Boolean).join("\n"),
    annexes: annexesText(input),
    certificationCircumstances:
      normalizeText(input.certificationCircumstancesText) ||
      "Si se certifican acuerdos inscribibles, la certificación deberá trasladar las circunstancias del acta necesarias para la calificación registral, incluido el sistema y fecha de aprobación del acta.",
  };
}

function sourceMapFor(points: ActaAgendaItemViewModel[]): ActaComposerSourceMapEntry[] {
  return [
    { section: "ENCABEZADO", source: "LEGAL_STRUCTURE" },
    { section: "CONSTITUCION", source: "LEGAL_STRUCTURE" },
    { section: "ORDEN_DEL_DIA", source: "LEGAL_STRUCTURE" },
    ...points.map((point) => ({
      section: "DESARROLLO_SESION",
      agendaItemId: point.id,
      orderNumber: point.order_number,
      source: point.kind === "DECISORIO" ? "DECISION" as const : "CONSTANCIA" as const,
    })),
    { section: "APROBACION", source: "LEGAL_STRUCTURE" },
    { section: "FIRMAS", source: "LEGAL_STRUCTURE" },
  ];
}

export function renderActaLegalStructureText(model: ActaLegalStructureViewModel) {
  return [
    "ACTA",
    "",
    "ENCABEZADO",
    model.sections.heading,
    "",
    "CONSTITUCIÓN DE LA REUNIÓN",
    model.sections.constitution,
    "",
    "ORDEN DEL DÍA",
    model.sections.agenda,
    "",
    "DESARROLLO DE LA SESIÓN",
    model.sections.development,
    "",
    "ACUERDOS Y VOTACIONES",
    model.sections.agreementsAndVotes,
    "",
    "APROBACIÓN DEL ACTA",
    model.sections.approval,
    "",
    "FIRMAS",
    model.sections.signatures,
    "",
    "ANEXOS",
    model.sections.annexes,
    "",
    "CIRCUNSTANCIAS CERTIFICABLES",
    model.sections.certificationCircumstances,
  ].join("\n");
}

function buildComposerDraft(
  sections: ReturnType<typeof buildSections>,
  input: ActaLegalStructureInput,
): ActaDocumentComposerDraft {
  const sourceMap = sourceMapFor(input.agendaItems);
  return {
    provider: "DETERMINISTIC_LOCAL",
    promptVersion: "acta-document-composer.v1",
    inputHash: input.canonicalMinutesHash ?? null,
    humanReviewRequired: true,
    text: [
      "ACTA",
      "",
      "ENCABEZADO",
      sections.heading,
      "",
      "CONSTITUCIÓN DE LA REUNIÓN",
      sections.constitution,
      "",
      "ORDEN DEL DÍA",
      sections.agenda,
      "",
      "DESARROLLO DE LA SESIÓN",
      sections.development,
      "",
      "ACUERDOS Y VOTACIONES",
      sections.agreementsAndVotes,
      "",
      "APROBACIÓN DEL ACTA",
      sections.approval,
      "",
      "FIRMAS",
      sections.signatures,
      "",
      "ANEXOS",
      sections.annexes,
    ].join("\n"),
    sourceMap,
  };
}

export function buildActaLegalStructureViewModel(input: ActaLegalStructureInput): ActaLegalStructureViewModel {
  const organKind = inferOrganKind(input.organKind);
  const meetingCharacter = normalizeText(input.meetingCharacter) || (input.isUniversal ? "UNIVERSAL" : "NO_UNIVERSAL");
  const sections = buildSections({ ...input, organKind, meetingCharacter });
  const composer = buildComposerDraft(sections, input);
  return {
    schema_version: "acta-legal-structure.v1",
    meeting_id: input.meetingId,
    minute_id: input.minuteId ?? null,
    entity_name: input.entityName,
    organ_name: input.organName,
    organ_kind: organKind,
    meeting_character: meetingCharacter,
    is_universal: input.isUniversal === true,
    sections,
    agenda_items: input.agendaItems,
    attendees: input.attendees,
    canonical_minutes_hash: input.canonicalMinutesHash ?? null,
    composer,
  };
}

function pushIssue(
  target: ActaLegalStructureIssue[],
  code: string,
  message: string,
  field?: string,
) {
  target.push({
    code,
    severity: "BLOCKING",
    message: field ? `${message} (${field})` : message,
  });
}

export function validateActaRrmStructure(input: ActaLegalStructureInput) {
  const base = validateActaLegalStructure({
    meetingId: input.meetingId,
    puntos: input.agendaItems,
    agendaItems: input.agendaRows,
    agreementRows: input.agreementRows,
  });
  const blockingIssues = [...base.blockingIssues];
  const warnings = [...base.warnings];
  const organKind = inferOrganKind(input.organKind);
  const universal = input.isUniversal === true;

  if (!normalizeText(input.entityName)) pushIssue(blockingIssues, "rrm_heading_entity_missing", "Falta la sociedad del acta", "entityName");
  if (!normalizeText(input.organName)) pushIssue(blockingIssues, "rrm_heading_organ_missing", "Falta el órgano que celebra la reunión", "organName");
  if (!normalizeText(input.date)) pushIssue(blockingIssues, "rrm_heading_date_missing", "Falta la fecha de celebración", "date");
  if (!normalizeText(input.place)) pushIssue(blockingIssues, "rrm_heading_place_missing", "Falta el lugar de celebración", "place");
  if (!normalizeText(input.president)) pushIssue(blockingIssues, "rrm_president_missing", "Falta la identidad de la Presidencia", "president");
  if (!normalizeText(input.secretary)) pushIssue(blockingIssues, "rrm_secretary_missing", "Falta la identidad de la Secretaría", "secretary");
  if (input.agendaItems.length === 0) pushIssue(blockingIssues, "rrm_agenda_missing", "Falta orden del día", "agendaItems");

  if (!universal && !normalizeText(input.convocationText)) {
    pushIssue(blockingIssues, "rrm_convocation_missing", "Falta fecha y modo de convocatoria en reunión no universal", "convocationText");
  }

  if (organKind === "JUNTA" && !universal && isSociedadAnonima(input.entityType) && !normalizeText(input.convocationPublicationText)) {
    pushIssue(
      blockingIssues,
      "rrm_sa_publication_missing",
      "En junta de sociedad anónima no universal debe constar BORME y diario o medio de convocatoria aplicable",
      "convocationPublicationText",
    );
  }

  if (organKind === "JUNTA") {
    if (!normalizeText(input.quorumText) && !normalizeText(input.capitalPresentText)) {
      pushIssue(blockingIssues, "rrm_junta_quorum_missing", "Falta número de socios concurrentes y porcentaje de capital presente o representado", "quorumText");
    }
    if (universal && presentAttendees(input.attendees).some((attendee) => attendee.signed !== true)) {
      pushIssue(blockingIssues, "rrm_universal_signatures_missing", "En junta universal deben constar las firmas de todos los asistentes junto a su nombre", "attendees.signed");
    }
  }

  if (organKind === "CONSEJO" && presentAttendees(input.attendees).length === 0) {
    pushIssue(blockingIssues, "rrm_board_attendees_missing", "En órgano colegiado de administración deben constar los miembros concurrentes", "attendees");
  }

  if (!normalizeText(input.approvalMode)) {
    pushIssue(blockingIssues, "rrm_approval_mode_missing", "Falta el sistema de aprobación del acta conforme al art. 99 RRM", "approvalMode");
  }
  if (!normalizeText(input.approvalDate)) {
    pushIssue(blockingIssues, "rrm_approval_date_missing", "Falta la fecha de aprobación del acta", "approvalDate");
  }

  return {
    ok: blockingIssues.length === 0,
    blockingIssues,
    warnings,
  };
}

export function isActaLegalStructureViewModel(value: unknown): value is ActaLegalStructureViewModel {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { schema_version?: unknown }).schema_version === "acta-legal-structure.v1"
  );
}

export function actaLegalStructureFromVariables(
  variables?: Record<string, unknown> | null,
): ActaLegalStructureViewModel | null {
  const direct = variables?.acta_legal_structure;
  return isActaLegalStructureViewModel(direct) ? direct : null;
}

export function buildActaLegalTemplateVariables(model: ActaLegalStructureViewModel) {
  return {
    acta_legal_structure: model,
    encabezado_acta_texto: model.sections.heading,
    convocatoria_acta_texto: model.sections.heading,
    constitucion_acta_texto: model.sections.constitution,
    mesa_acta_texto: model.sections.constitution
      .split("\n")
      .find((line) => line.includes("Preside la reunión")) ?? "",
    orden_dia_texto: model.sections.agenda,
    desarrollo_sesion_texto: model.sections.development,
    acuerdos_y_votaciones_texto: model.sections.agreementsAndVotes,
    aprobacion_acta_texto: model.sections.approval,
    firmas_acta_texto: model.sections.signatures,
    anexos_acta_texto: model.sections.annexes,
    circunstancias_certificacion_texto: model.sections.certificationCircumstances,
    acta_composer_borrador_texto: model.composer.text,
    document_composer_draft: model.composer,
    document_composer_source_map: model.composer.sourceMap,
    acta_rrm_texto_completo: renderActaLegalStructureText(model),
  };
}

export function validateRenderedActaAgainstLegalStructure(renderedText: string, model: ActaLegalStructureViewModel): ActaLegalStructureIssue[] {
  const issues: ActaLegalStructureIssue[] = [];
  const normalized = normalizeUpper(renderedText);
  const requiredMarkers = [
    "ENCABEZADO",
    "CONSTITUCION DE LA REUNION",
    "ORDEN DEL DIA",
    "DESARROLLO DE LA SESION",
    "ACUERDOS Y VOTACIONES",
    "APROBACION DEL ACTA",
    "FIRMAS",
  ];
  for (const marker of requiredMarkers) {
    if (!normalized.includes(marker)) {
      pushIssue(issues, "rrm_render_section_missing", `El DOCX renderizado no contiene la sección obligatoria ${marker}`);
    }
  }

  let lastIndex = -1;
  for (const point of model.agenda_items) {
    const marker = normalizeUpper(`${point.order_number}. ${point.title}`);
    const index = normalized.indexOf(marker);
    if (index < 0) {
      pushIssue(issues, "rrm_render_agenda_item_missing", `El DOCX renderizado omite el punto ${point.order_number}`, `agenda_items.${point.order_number}`);
      continue;
    }
    if (index < lastIndex) {
      pushIssue(issues, "rrm_render_agenda_order_mismatch", "El DOCX renderizado altera el orden del día", `agenda_items.${point.order_number}`);
    }
    lastIndex = index;
  }

  if (model.canonical_minutes_hash && !renderedText.includes(model.canonical_minutes_hash)) {
    pushIssue(issues, "rrm_render_hash_missing", "El DOCX renderizado no contiene el hash canónico del acta", "canonical_minutes_hash");
  }

  return issues;
}
