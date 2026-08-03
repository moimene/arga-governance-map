export const LEGAL_ARTIFACT_MANIFEST_SCHEMA = "legal-artifact-manifest.v1" as const;

export type LegalArtifactOrganKind = "BOARD" | "GENERAL_MEETING" | "SOLE_MEMBER" | "OTHER";
/**
 * PRE_SIGNATURE valida los hechos cerrados de la reunión que alimentan los
 * bytes a firmar. APPROVED_RECORD valida una proyección posterior que enlaza
 * esos bytes con aprobación, firmas y asiento; no se espera que esos efectos
 * posteriores estuvieran embebidos dentro del propio artefacto pre-firma.
 */
export type LegalArtifactValidationPhase = "PRE_SIGNATURE" | "APPROVED_RECORD";
export type LegalArtifactMeetingModality = "IN_PERSON" | "HYBRID" | "REMOTE" | "WRITTEN_WITHOUT_SESSION";
export type LegalArtifactPersonKind = "NATURAL_PERSON" | "LEGAL_PERSON";
export type LegalArtifactAttendance = "PRESENT" | "REPRESENTED" | "ABSENT" | "INVITED";
export type LegalArtifactEvidenceType =
  | "CONVOCATION"
  | "CENSUS"
  | "DELIBERATION"
  | "VOTE"
  | "APPROVAL"
  | "SIGNATURE"
  | "BOOK_ENTRY"
  | "ANNEX"
  | "OTHER";

export interface LegalArtifactIdentity {
  id: string;
  name: string;
  personKind: LegalArtifactPersonKind;
  role: string;
}

export interface LegalArtifactParticipant extends LegalArtifactIdentity {
  votingEligible: boolean;
  attendance: LegalArtifactAttendance;
  representedBy: LegalArtifactIdentity | null;
  capitalPercentage: number | null;
}

export interface LegalArtifactEvidence {
  id: string;
  type: LegalArtifactEvidenceType;
  hashAlgorithm: "SHA-256" | "SHA-512";
  hash: string;
  issuedAtISO: string;
  uri: string;
}

export interface LegalArtifactVote {
  eligibleVoters: number;
  favor: number;
  against: number;
  abstentions: number;
  excludedForConflict: number;
  majorityRule: string;
  adopted: boolean;
  proclamation: string;
  evidenceId: string;
}

export interface LegalArtifactConflict {
  personId: string;
  personName: string;
  reason: string;
  abstainedAndExcluded: boolean;
}

export interface LegalArtifactAgendaPoint {
  id: string;
  order: number;
  title: string;
  kind: "INFORMATIVE" | "DECISION" | "QUESTIONS";
  deliberation: string;
  interventionsStatus: "NONE_REQUESTED" | "RECORDED";
  requestedInterventions: string[];
  exactResolution: string | null;
  vote: LegalArtifactVote | null;
  conflicts: LegalArtifactConflict[];
  evidenceIds: string[];
}

export interface LegalArtifactManifest {
  schemaVersion: typeof LEGAL_ARTIFACT_MANIFEST_SCHEMA;
  artifactId: string;
  generatedAtISO: string;
  entity: {
    id: string;
    name: string;
    legalForm: string;
    listed: boolean;
  };
  organ: {
    id: string;
    name: string;
    kind: LegalArtifactOrganKind;
  };
  meeting: {
    id: string;
    modality: LegalArtifactMeetingModality;
    startAtISO: string;
    endAtISO: string;
    place: string;
  };
  convocation: {
    dateISO: string;
    mode: string;
    author: LegalArtifactIdentity;
    fullText: string;
    evidenceIds: string[];
  };
  census: {
    method: string;
    closedAtISO: string;
    evidenceId: string;
    participants: LegalArtifactParticipant[];
  };
  quorum: {
    denominatorKind: "BOARD_SEATS" | "VOTING_CAPITAL" | "SOLE_MEMBER";
    eligibleCount: number;
    presentCount: number;
    representedCount: number;
    absentCount: number;
    requiredCount: number;
    capitalPercentage: number | null;
  };
  chair: {
    president: LegalArtifactIdentity;
    secretary: LegalArtifactIdentity;
    appointmentBasis: string;
    evidenceIds: string[];
  };
  agenda: LegalArtifactAgendaPoint[];
  approval: {
    status: "PENDING" | "APPROVED" | "NOTARIAL";
    method: string;
    dateISO: string | null;
    approvedBy: string[];
    evidenceIds: string[];
  };
  signatures: Array<{
    person: LegalArtifactIdentity;
    capacity: "PRESIDENT" | "SECRETARY" | "ATTENDEE" | "NOTARY";
    status: "PENDING" | "SIGNED";
    signedAtISO: string | null;
    evidenceId: string | null;
  }>;
  bookEntry: {
    bookId: string;
    bookTitle: string;
    sectionId: string;
    entryId: string;
    ordinalNumber: number;
    recordedAtISO: string;
    sourceHash: string;
    evidenceId: string;
  } | null;
  annexes: Array<{
    id: string;
    order: number;
    title: string;
    type: "ATTENDANCE_LIST" | "CONVOCATION" | "REPORT" | "PRESENTATION" | "OTHER";
    hash: string;
    evidenceId: string;
  }>;
  evidences: LegalArtifactEvidence[];
}

export interface LegalArtifactValidationIssue {
  code: string;
  severity: "BLOCKING" | "WARNING";
  field: string;
  message: string;
}

export interface LegalArtifactValidationResult {
  ok: boolean;
  blockingIssues: LegalArtifactValidationIssue[];
  warnings: LegalArtifactValidationIssue[];
}

const PLACEHOLDER_PATTERNS = [
  /\bseg[uú]n (?:consta|el) expediente\b/iu,
  /\bconsta en el expediente\b/iu,
  /\ben la forma (?:legal|estatutaria|legal y estatutariamente) prevista\b/iu,
  /\bpor determinar\b/iu,
  /\bpendiente de (?:completar|confirmar|validar)\b/iu,
  /\b(?:texto|dato|informaci[oó]n) pendiente\b/iu,
  /\bsimulad[oa]\b/iu,
  /\bno disponible\b/iu,
  /^n\/?a$/iu,
  /^[-—]+$/u,
];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

export function isLegallySubstantiveText(value: unknown, minimumLength = 8) {
  const text = cleanText(value);
  return text.length >= minimumLength && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return "null";
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (typeof value === "string") return cleanText(value);
  if (Array.isArray(value)) return value.map(normalizeCanonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeCanonicalValue(item)]),
    );
  }
  return value;
}

export function normalizeLegalArtifactManifest(manifest: LegalArtifactManifest): LegalArtifactManifest {
  const normalized = normalizeCanonicalValue(manifest) as LegalArtifactManifest;
  normalized.census.participants = [...normalized.census.participants].sort((a, b) => a.id.localeCompare(b.id));
  normalized.agenda = [...normalized.agenda].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  normalized.agenda = normalized.agenda.map((point) => ({
    ...point,
    conflicts: [...point.conflicts].sort((a, b) => a.personId.localeCompare(b.personId)),
    evidenceIds: [...point.evidenceIds].sort(),
    requestedInterventions: [...point.requestedInterventions],
  }));
  normalized.convocation.evidenceIds = [...normalized.convocation.evidenceIds].sort();
  normalized.chair.evidenceIds = [...normalized.chair.evidenceIds].sort();
  normalized.approval.approvedBy = [...normalized.approval.approvedBy].sort();
  normalized.approval.evidenceIds = [...normalized.approval.evidenceIds].sort();
  normalized.signatures = [...normalized.signatures].sort((a, b) => {
    const capacity = a.capacity.localeCompare(b.capacity);
    return capacity || a.person.id.localeCompare(b.person.id);
  });
  normalized.annexes = [...normalized.annexes].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  normalized.evidences = [...normalized.evidences].sort((a, b) => a.id.localeCompare(b.id));
  return normalized;
}

export function canonicalizeLegalArtifactManifest(manifest: LegalArtifactManifest) {
  return stableStringify(normalizeLegalArtifactManifest(manifest));
}

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(value) && !Number.isNaN(Date.parse(value));
}

function time(value: string | null | undefined) {
  return value && validDate(value) ? Date.parse(value) : null;
}

function addIssue(
  issues: LegalArtifactValidationIssue[],
  code: string,
  field: string,
  message: string,
  severity: "BLOCKING" | "WARNING" = "BLOCKING",
) {
  issues.push({ code, severity, field, message });
}

function hasIdentity(identity: LegalArtifactIdentity | null | undefined) {
  return Boolean(identity && cleanText(identity.id) && isLegallySubstantiveText(identity.name, 3) && cleanText(identity.role));
}

function exactCount(manifest: LegalArtifactManifest, attendance: LegalArtifactAttendance) {
  return manifest.census.participants.filter((participant) => participant.votingEligible && participant.attendance === attendance).length;
}

function evidenceIdsReferenced(manifest: LegalArtifactManifest) {
  return [
    ...manifest.convocation.evidenceIds,
    manifest.census.evidenceId,
    ...manifest.chair.evidenceIds,
    ...manifest.agenda.flatMap((point) => [
      ...point.evidenceIds,
      ...(point.vote ? [point.vote.evidenceId] : []),
    ]),
    ...manifest.approval.evidenceIds,
    ...manifest.signatures.flatMap((signature) => signature.evidenceId ? [signature.evidenceId] : []),
    ...(manifest.bookEntry ? [manifest.bookEntry.evidenceId] : []),
    ...manifest.annexes.map((annex) => annex.evidenceId),
  ].filter(Boolean);
}

export function validateLegalArtifactManifest(
  manifest: LegalArtifactManifest,
  phase: LegalArtifactValidationPhase = "APPROVED_RECORD",
): LegalArtifactValidationResult {
  const issues: LegalArtifactValidationIssue[] = [];
  const normalized = normalizeLegalArtifactManifest(manifest);

  if (normalized.schemaVersion !== LEGAL_ARTIFACT_MANIFEST_SCHEMA) {
    addIssue(issues, "manifest_schema_invalid", "schemaVersion", "La versión del manifest no es reconocida.");
  }
  if (!cleanText(normalized.artifactId)) addIssue(issues, "manifest_artifact_id_missing", "artifactId", "Falta el identificador del artefacto.");
  if (!validDate(normalized.generatedAtISO)) addIssue(issues, "manifest_generated_at_invalid", "generatedAtISO", "La fecha de generación debe ser ISO y determinista.");
  if (!cleanText(normalized.entity.id) || !isLegallySubstantiveText(normalized.entity.name, 3) || !cleanText(normalized.entity.legalForm)) {
    addIssue(issues, "manifest_entity_incomplete", "entity", "Faltan identidad, denominación o forma social.");
  }
  if (!cleanText(normalized.organ.id) || !isLegallySubstantiveText(normalized.organ.name, 3)) {
    addIssue(issues, "manifest_organ_incomplete", "organ", "Faltan identidad o denominación del órgano.");
  }
  if (!cleanText(normalized.meeting.id) || !validDate(normalized.meeting.startAtISO) || !validDate(normalized.meeting.endAtISO)) {
    addIssue(issues, "manifest_meeting_time_incomplete", "meeting", "Faltan identificador, inicio o fin ISO de la reunión.");
  }
  if (!isLegallySubstantiveText(normalized.meeting.place, 3)) {
    addIssue(issues, "manifest_meeting_place_missing", "meeting.place", "Falta un lugar o canal de celebración concreto.");
  }

  const meetingStart = time(normalized.meeting.startAtISO);
  const meetingEnd = time(normalized.meeting.endAtISO);
  const generatedAt = time(normalized.generatedAtISO);
  if (meetingStart !== null && meetingEnd !== null && meetingEnd <= meetingStart) {
    addIssue(issues, "manifest_meeting_interval_invalid", "meeting.endAtISO", "El fin de la reunión debe ser posterior al inicio.");
  }

  if (!validDate(normalized.convocation.dateISO) || !isLegallySubstantiveText(normalized.convocation.mode)) {
    addIssue(issues, "manifest_convocation_metadata_missing", "convocation", "Faltan fecha o modo concreto de convocatoria.");
  }
  if (!hasIdentity(normalized.convocation.author)) {
    addIssue(issues, "manifest_convocation_author_missing", "convocation.author", "Falta la identidad y cargo del autor de la convocatoria.");
  }
  if (!isLegallySubstantiveText(normalized.convocation.fullText, 20)) {
    addIssue(issues, "manifest_convocation_text_placeholder", "convocation.fullText", "La convocatoria debe constar por su texto íntegro, no por remisión genérica.");
  }
  if (normalized.convocation.evidenceIds.length === 0) {
    addIssue(issues, "manifest_convocation_evidence_missing", "convocation.evidenceIds", "Falta evidencia de convocatoria.");
  }
  const convocationDate = time(normalized.convocation.dateISO);
  if (convocationDate !== null && meetingStart !== null && convocationDate >= meetingStart) {
    addIssue(issues, "manifest_convocation_not_prior", "convocation.dateISO", "La convocatoria debe ser anterior a la reunión.");
  }

  if (!isLegallySubstantiveText(normalized.census.method) || !validDate(normalized.census.closedAtISO) || !cleanText(normalized.census.evidenceId)) {
    addIssue(issues, "manifest_census_incomplete", "census", "Faltan método, cierre o evidencia del censo.");
  }
  if (normalized.census.participants.length === 0) {
    addIssue(issues, "manifest_census_empty", "census.participants", "El censo no puede estar vacío.");
  }
  const duplicatedIds = normalized.census.participants
    .map((participant) => participant.id)
    .filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicatedIds.length > 0) {
    addIssue(issues, "manifest_census_duplicate", "census.participants", "El censo contiene identidades duplicadas.");
  }
  normalized.census.participants.forEach((participant, index) => {
    const field = `census.participants.${index}`;
    if (!hasIdentity(participant)) addIssue(issues, "manifest_participant_incomplete", field, "Falta identidad, nombre o condición del concurrente.");
    if (participant.attendance === "REPRESENTED" && (!hasIdentity(participant.representedBy) || participant.representedBy?.personKind !== "NATURAL_PERSON")) {
      addIssue(issues, "manifest_representative_missing", `${field}.representedBy`, "La representación debe identificar a una persona física.");
    }
    if (participant.attendance !== "REPRESENTED" && participant.representedBy) {
      addIssue(issues, "manifest_representative_inconsistent", `${field}.representedBy`, "Solo un miembro representado puede tener representante.");
    }
  });

  const eligible = normalized.census.participants.filter((participant) => participant.votingEligible).length;
  const present = exactCount(normalized, "PRESENT");
  const represented = exactCount(normalized, "REPRESENTED");
  const absent = exactCount(normalized, "ABSENT");
  const declaredCounts = normalized.quorum;
  if (
    !Number.isInteger(declaredCounts.eligibleCount) ||
    !Number.isInteger(declaredCounts.presentCount) ||
    !Number.isInteger(declaredCounts.representedCount) ||
    !Number.isInteger(declaredCounts.absentCount) ||
    !Number.isInteger(declaredCounts.requiredCount) ||
    [declaredCounts.eligibleCount, declaredCounts.presentCount, declaredCounts.representedCount, declaredCounts.absentCount].some((count) => count < 0)
  ) {
    addIssue(issues, "manifest_quorum_count_invalid", "quorum", "Los cómputos de quórum deben ser enteros no negativos.");
  }
  if (
    declaredCounts.eligibleCount !== eligible ||
    declaredCounts.presentCount !== present ||
    declaredCounts.representedCount !== represented ||
    declaredCounts.absentCount !== absent ||
    present + represented + absent !== eligible
  ) {
    addIssue(issues, "manifest_quorum_counts_mismatch", "quorum", "Los denominadores y concurrentes no reconcilian con el censo elegible.");
  }
  if (declaredCounts.requiredCount <= 0 || present + represented < declaredCounts.requiredCount) {
    addIssue(issues, "manifest_quorum_not_met", "quorum.requiredCount", "El quórum declarado no se alcanza.");
  }

  const listedBoard = normalized.entity.listed && normalized.organ.kind === "BOARD";
  if (listedBoard) {
    if (normalized.quorum.denominatorKind !== "BOARD_SEATS") {
      addIssue(issues, "listed_board_denominator_invalid", "quorum.denominatorKind", "El Consejo de una cotizada computa el quórum por vocales, no por capital.");
    }
    if (normalized.quorum.capitalPercentage !== null || normalized.census.participants.some((participant) => participant.capitalPercentage !== null)) {
      addIssue(issues, "listed_board_capital_percentage_forbidden", "quorum.capitalPercentage", "No debe expresarse porcentaje de capital en el Consejo de una cotizada.");
    }
    if (normalized.census.participants.some((participant) => participant.personKind !== "NATURAL_PERSON")) {
      addIssue(issues, "listed_board_legal_person_forbidden", "census.participants", "Los vocales del Consejo de la cotizada deben ser personas físicas.");
    }
  }

  normalized.census.participants
    .filter((participant) => participant.attendance === "REPRESENTED" && participant.representedBy)
    .forEach((participant) => {
      const representative = normalized.census.participants.find((candidate) => candidate.id === participant.representedBy?.id);
      if (!representative || representative.personKind !== "NATURAL_PERSON" || representative.attendance !== "PRESENT") {
        addIssue(issues, "manifest_representative_not_present", "census.participants", `El representante de ${participant.name} no consta como persona física presente.`);
      }
    });

  if (!hasIdentity(normalized.chair.president) || !hasIdentity(normalized.chair.secretary) || !isLegallySubstantiveText(normalized.chair.appointmentBasis)) {
    addIssue(issues, "manifest_chair_incomplete", "chair", "Faltan la mesa, sus cargos o el título de designación.");
  }
  if (normalized.chair.president.id === normalized.chair.secretary.id) {
    addIssue(issues, "manifest_chair_roles_not_separated", "chair", "Presidencia y Secretaría deben quedar individualizadas.");
  }
  const presidentParticipant = normalized.census.participants.find((participant) => participant.id === normalized.chair.president.id);
  const secretaryParticipant = normalized.census.participants.find((participant) => participant.id === normalized.chair.secretary.id);
  if (!presidentParticipant || !presidentParticipant.votingEligible || presidentParticipant.attendance !== "PRESENT") {
    addIssue(issues, "manifest_president_not_present", "chair.president", "La Presidencia debe constar como vocal elegible y presente.");
  }
  if (!secretaryParticipant || !["PRESENT", "INVITED"].includes(secretaryParticipant.attendance)) {
    addIssue(issues, "manifest_secretary_not_present", "chair.secretary", "La Secretaría debe constar entre las personas concurrentes.");
  }

  if (normalized.agenda.length === 0) addIssue(issues, "manifest_agenda_empty", "agenda", "Falta orden del día.");
  const agendaOrders = normalized.agenda.map((point) => point.order);
  if (new Set(agendaOrders).size !== agendaOrders.length || agendaOrders.some((order) => !Number.isInteger(order) || order <= 0)) {
    addIssue(issues, "manifest_agenda_order_invalid", "agenda.order", "Los puntos deben tener ordinales positivos y únicos.");
  }
  normalized.agenda.forEach((point, index) => {
    const field = `agenda.${index}`;
    if (!cleanText(point.id) || !isLegallySubstantiveText(point.title, 3) || !isLegallySubstantiveText(point.deliberation, 12)) {
      addIssue(issues, "manifest_agenda_point_incomplete", field, "Faltan identidad, título o deliberación concreta del punto.");
    }
    if (point.interventionsStatus === "RECORDED" && point.requestedInterventions.length === 0) {
      addIssue(issues, "manifest_interventions_missing", `${field}.requestedInterventions`, "Se declaró que hubo intervenciones solicitadas, pero no constan.");
    }
    if (point.interventionsStatus === "NONE_REQUESTED" && point.requestedInterventions.length > 0) {
      addIssue(issues, "manifest_interventions_inconsistent", `${field}.requestedInterventions`, "La constancia de intervenciones es contradictoria.");
    }
    if (point.kind !== "DECISION") return;
    if (!isLegallySubstantiveText(point.exactResolution, 20)) {
      addIssue(issues, "manifest_exact_resolution_missing", `${field}.exactResolution`, "El acuerdo debe constar literalmente y sin remisiones genéricas.");
    }
    if (!point.vote) {
      addIssue(issues, "manifest_vote_missing", `${field}.vote`, "Falta el resultado exacto de la votación.");
      return;
    }
    const vote = point.vote;
    if ([vote.eligibleVoters, vote.favor, vote.against, vote.abstentions, vote.excludedForConflict].some((count) => !Number.isInteger(count) || count < 0)) {
      addIssue(issues, "manifest_vote_count_invalid", `${field}.vote`, "Los votos deben ser enteros no negativos.");
    }
    if (vote.favor + vote.against + vote.abstentions !== vote.eligibleVoters || vote.eligibleVoters + vote.excludedForConflict !== present + represented) {
      addIssue(issues, "manifest_vote_denominator_mismatch", `${field}.vote`, "La votación no reconcilia con los vocales concurrentes y excluidos.");
    }
    if (!isLegallySubstantiveText(vote.majorityRule) || !isLegallySubstantiveText(vote.proclamation, 12)) {
      addIssue(issues, "manifest_vote_rule_missing", `${field}.vote`, "Faltan mayoría aplicada o proclamación del resultado.");
    }
    if (point.conflicts.length !== vote.excludedForConflict) {
      addIssue(issues, "manifest_conflicts_count_mismatch", `${field}.conflicts`, "Los conflictos documentados no coinciden con las exclusiones de voto.");
    }
    point.conflicts.forEach((conflict) => {
      if (!cleanText(conflict.personId) || !isLegallySubstantiveText(conflict.personName, 3) || !isLegallySubstantiveText(conflict.reason) || !conflict.abstainedAndExcluded) {
        addIssue(issues, "manifest_conflict_incomplete", `${field}.conflicts`, "Cada conflicto debe identificar interesado, causa y abstención/exclusión efectiva.");
      }
    });
  });

  const approvalDate = time(normalized.approval.dateISO);
  if (phase === "APPROVED_RECORD" && normalized.approval.status === "PENDING") {
    addIssue(issues, "manifest_approval_pending", "approval.status", "La proyección aprobada no puede mantener el acta pendiente.");
  }
  if (
    phase === "APPROVED_RECORD" &&
    (!isLegallySubstantiveText(normalized.approval.method) || approvalDate === null || normalized.approval.approvedBy.length === 0 || normalized.approval.evidenceIds.length === 0)
  ) {
    addIssue(issues, "manifest_approval_incomplete", "approval", "Faltan método, fecha, aprobantes o evidencia de aprobación real.");
  }
  if (
    phase === "PRE_SIGNATURE" &&
    normalized.approval.status === "PENDING" &&
    (normalized.approval.dateISO !== null || normalized.approval.approvedBy.length > 0 || normalized.approval.evidenceIds.length > 0)
  ) {
    addIssue(issues, "manifest_pending_approval_has_effects", "approval", "Una aprobación pendiente no puede anticipar fecha, aprobantes ni evidencias.");
  }
  if (phase === "PRE_SIGNATURE" && !isLegallySubstantiveText(normalized.approval.method)) {
    addIssue(issues, "manifest_approval_plan_missing", "approval.method", "La proyección pre-firma debe indicar el método de aprobación previsto sin afirmar que ya ocurrió.");
  }
  if (
    phase === "PRE_SIGNATURE" &&
    normalized.approval.status !== "PENDING" &&
    (!isLegallySubstantiveText(normalized.approval.method) || approvalDate === null || normalized.approval.approvedBy.length === 0 || normalized.approval.evidenceIds.length === 0)
  ) {
    addIssue(issues, "manifest_approval_incomplete", "approval", "Una aprobación ya declarada debe incluir método, fecha, aprobantes y evidencia.");
  }
  if (approvalDate !== null && meetingEnd !== null && approvalDate < meetingEnd) {
    addIssue(issues, "manifest_approval_before_meeting_end", "approval.dateISO", "La aprobación no puede preceder al fin de la reunión.");
  }
  if (approvalDate !== null && generatedAt !== null && approvalDate > generatedAt) {
    addIssue(issues, "manifest_future_approval_asserted", "approval.dateISO", "El artefacto afirma una aprobación posterior a su generación.");
  }
  if (meetingStart !== null && generatedAt !== null && meetingStart > generatedAt) {
    addIssue(issues, "manifest_future_meeting_asserted", "meeting.startAtISO", "El artefacto narra como celebrada una reunión todavía futura.");
  }
  const knownParticipantIds = new Set(normalized.census.participants.map((participant) => participant.id));
  if (normalized.approval.approvedBy.some((personId) => !knownParticipantIds.has(personId))) {
    addIssue(issues, "manifest_approver_unknown", "approval.approvedBy", "La aprobación identifica personas ajenas al censo de la reunión.");
  }

  const requiredSignatureCapacities = normalized.organ.kind === "BOARD" ? ["PRESIDENT", "SECRETARY"] : ["SECRETARY"];
  requiredSignatureCapacities.forEach((capacity) => {
    const signature = normalized.signatures.find((item) => item.capacity === capacity);
    if (!signature) {
      addIssue(issues, "manifest_required_signature_slot_missing", "signatures", `Falta la posición de firma de ${capacity}.`);
      return;
    }
    if (phase === "APPROVED_RECORD" && (signature.status !== "SIGNED" || !validDate(signature.signedAtISO) || !cleanText(signature.evidenceId))) {
      addIssue(issues, "manifest_required_signature_missing", "signatures", `Falta firma efectiva de ${capacity}.`);
    }
    if (signature.status === "PENDING" && (signature.signedAtISO !== null || signature.evidenceId !== null)) {
      addIssue(issues, "manifest_pending_signature_has_effects", "signatures", `La firma pendiente de ${capacity} no puede anticipar fecha ni evidencia.`);
    }
  });
  normalized.signatures
    .forEach((signature, index) => {
      if (!hasIdentity(signature.person)) {
        addIssue(issues, "manifest_signature_identity_missing", `signatures.${index}.person`, "Cada posición de firma debe identificar a la persona y su cargo.");
      }
      if (signature.status === "SIGNED" && (!validDate(signature.signedAtISO) || !cleanText(signature.evidenceId))) {
        addIssue(issues, "manifest_signed_signature_incomplete", `signatures.${index}`, "Una firma declarada debe incluir fecha y evidencia.");
      }
      if (signature.status !== "SIGNED") return;
      const signedAt = time(signature.signedAtISO);
      if (signedAt !== null && approvalDate !== null && signedAt < approvalDate) {
        addIssue(issues, "manifest_signature_before_approval", `signatures.${index}.signedAtISO`, "La firma del acta no puede preceder a su aprobación.");
      }
      if (signedAt !== null && generatedAt !== null && signedAt > generatedAt) {
        addIssue(issues, "manifest_future_signature_asserted", `signatures.${index}.signedAtISO`, "El artefacto afirma una firma posterior a su generación.");
      }
    });

  if (phase === "APPROVED_RECORD" && !normalized.bookEntry) {
    addIssue(issues, "manifest_book_entry_missing", "bookEntry", "Falta el asiento de libro del acta aprobada.");
  } else if (normalized.bookEntry && (
    !cleanText(normalized.bookEntry.bookId) ||
    !isLegallySubstantiveText(normalized.bookEntry.bookTitle) ||
    !cleanText(normalized.bookEntry.sectionId) ||
    !cleanText(normalized.bookEntry.entryId) ||
    normalized.bookEntry.ordinalNumber <= 0 ||
    !validDate(normalized.bookEntry.recordedAtISO) ||
    !/^[a-f0-9]{64,128}$/iu.test(normalized.bookEntry.sourceHash) ||
    !cleanText(normalized.bookEntry.evidenceId)
  )) {
    addIssue(issues, "manifest_book_entry_incomplete", "bookEntry", "El asiento debe identificar libro, sección, ordinal, fecha, fuente y evidencia.");
  }
  const bookRecordedAt = time(normalized.bookEntry?.recordedAtISO);
  if (bookRecordedAt !== null && approvalDate !== null && bookRecordedAt < approvalDate) {
    addIssue(issues, "manifest_book_entry_before_approval", "bookEntry.recordedAtISO", "El asiento no puede preceder a la aprobación del acta.");
  }
  if (bookRecordedAt !== null && generatedAt !== null && bookRecordedAt > generatedAt) {
    addIssue(issues, "manifest_future_book_entry_asserted", "bookEntry.recordedAtISO", "El artefacto afirma un asiento posterior a su generación.");
  }

  if (normalized.annexes.length === 0 || !normalized.annexes.some((annex) => annex.type === "ATTENDANCE_LIST")) {
    addIssue(issues, "manifest_attendance_annex_missing", "annexes", "Falta el anexo de lista de asistentes.");
  }
  normalized.annexes.forEach((annex, index) => {
    if (!cleanText(annex.id) || annex.order <= 0 || !isLegallySubstantiveText(annex.title) || !/^[a-f0-9]{64,128}$/iu.test(annex.hash) || !cleanText(annex.evidenceId)) {
      addIssue(issues, "manifest_annex_incomplete", `annexes.${index}`, "Cada anexo debe tener identidad, ordinal, título, hash y evidencia.");
    }
  });

  const knownEvidenceIds = new Set(normalized.evidences.map((evidence) => evidence.id));
  if (knownEvidenceIds.size !== normalized.evidences.length) {
    addIssue(issues, "manifest_evidence_duplicate", "evidences", "El manifest contiene identificadores de evidencia duplicados.");
  }
  normalized.evidences.forEach((evidence, index) => {
    const expectedLength = evidence.hashAlgorithm === "SHA-512" ? 128 : 64;
    if (
      !cleanText(evidence.id) ||
      !validDate(evidence.issuedAtISO) ||
      !isLegallySubstantiveText(evidence.uri) ||
      !new RegExp(`^[a-f0-9]{${expectedLength}}$`, "iu").test(evidence.hash)
    ) {
      addIssue(issues, "manifest_evidence_incomplete", `evidences.${index}`, "La evidencia debe incluir identidad, fecha, URI y hash coherente.");
    }
    const evidenceTime = time(evidence.issuedAtISO);
    if (evidenceTime !== null && generatedAt !== null && evidenceTime > generatedAt) {
      addIssue(issues, "manifest_future_evidence_asserted", `evidences.${index}.issuedAtISO`, "El artefacto referencia una evidencia posterior a su generación.");
    }
  });
  const missingEvidenceIds = [...new Set(evidenceIdsReferenced(normalized))].filter((id) => !knownEvidenceIds.has(id));
  if (missingEvidenceIds.length > 0) {
    addIssue(issues, "manifest_evidence_reference_missing", "evidences", `Faltan evidencias referenciadas: ${missingEvidenceIds.join(", ")}.`);
  }

  const blockingIssues = issues.filter((issue) => issue.severity === "BLOCKING");
  const warnings = issues.filter((issue) => issue.severity === "WARNING");
  return { ok: blockingIssues.length === 0, blockingIssues, warnings };
}

function normalizeForSearch(value: string) {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("es-ES");
}

export function validateRenderedLegalArtifactAgainstManifest(
  renderedText: string,
  manifest: LegalArtifactManifest,
  phase: LegalArtifactValidationPhase = "APPROVED_RECORD",
): LegalArtifactValidationResult {
  const base = validateLegalArtifactManifest(manifest, phase);
  const issues = [...base.blockingIssues, ...base.warnings];
  const rendered = normalizeForSearch(renderedText);
  const normalized = normalizeLegalArtifactManifest(manifest);

  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(renderedText))) {
    addIssue(issues, "render_placeholder_forbidden", "renderedText", "El documento contiene una remisión genérica o un placeholder no probatorio.");
  }
  if (normalized.entity.listed && normalized.organ.kind === "BOARD" && /(?:\d+(?:[,.]\d+)?\s*%|PORCENTAJE\s+DE\s+CAPITAL|CAPITAL\s+(?:SOCIAL\s+)?(?:PRESENTE|REPRESENTADO))/u.test(rendered)) {
    addIssue(issues, "render_listed_board_capital_forbidden", "renderedText", "El documento expresa capital en un Consejo de cotizada.");
  }

  const requiredFacts = [
    normalized.entity.name,
    normalized.organ.name,
    normalized.meeting.place,
    normalized.convocation.author.name,
    normalized.convocation.fullText,
    normalized.census.method,
    normalized.chair.president.name,
    normalized.chair.secretary.name,
    normalized.chair.appointmentBasis,
    ...normalized.census.participants.filter((participant) => participant.votingEligible).map((participant) => participant.name),
    ...normalized.agenda.filter((point) => point.kind === "DECISION").flatMap((point) => [
      point.exactResolution ?? "",
      point.vote?.majorityRule ?? "",
      point.vote?.proclamation ?? "",
    ]),
    phase === "APPROVED_RECORD" || normalized.approval.status !== "PENDING" ? normalized.approval.method : "",
    ...normalized.approval.evidenceIds,
    ...normalized.signatures.filter((signature) => signature.status === "SIGNED").flatMap((signature) => [
      signature.person.name,
      signature.evidenceId ?? "",
    ]),
    normalized.bookEntry?.bookTitle ?? "",
    normalized.bookEntry?.entryId ?? "",
    normalized.bookEntry?.sourceHash ?? "",
    ...normalized.annexes.flatMap((annex) => [annex.title, annex.hash, annex.evidenceId]),
  ].filter(Boolean);
  const requiredCompositeFacts = [
    `${normalized.quorum.eligibleCount} vocales elegibles`,
    `${normalized.quorum.presentCount} presentes`,
    `${normalized.quorum.representedCount} representados`,
    `${normalized.quorum.absentCount} ausentes`,
    ...normalized.agenda
      .filter((point) => point.kind === "DECISION" && point.vote)
      .flatMap((point) => [
        `${point.vote!.favor} a favor`,
        `${point.vote!.against} en contra`,
        `${point.vote!.abstentions} abstenciones`,
        `${point.vote!.excludedForConflict} excluidos por conflicto`,
      ]),
  ];

  [...requiredFacts, ...requiredCompositeFacts].forEach((fact) => {
    if (!rendered.includes(normalizeForSearch(fact))) {
      addIssue(issues, "render_manifest_fact_missing", "renderedText", `El documento no traslada el hecho canónico: ${fact}.`);
    }
  });

  const blockingIssues = issues.filter((issue) => issue.severity === "BLOCKING");
  const warnings = issues.filter((issue) => issue.severity === "WARNING");
  return { ok: blockingIssues.length === 0, blockingIssues, warnings };
}

export function validatePreSignatureLegalArtifactManifest(manifest: LegalArtifactManifest) {
  return validateLegalArtifactManifest(manifest, "PRE_SIGNATURE");
}

export function validateApprovedRecordLegalArtifactManifest(manifest: LegalArtifactManifest) {
  return validateLegalArtifactManifest(manifest, "APPROVED_RECORD");
}
