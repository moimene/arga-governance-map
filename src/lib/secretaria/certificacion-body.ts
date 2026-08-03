/**
 * Composición del cuerpo canónico de una certificación de acuerdos (W0 #4).
 *
 * Hasta ahora `fn_generar_certificacion` insertaba `content = NULL`: la
 * certificación quedaba sin texto canónico (solo metadatos + gate_hash), y el
 * cuerpo solo existía como DOCX efímero. Esta función compone un cuerpo
 * estructurado (art. 109 RRM) que se persiste en `certifications.content` tras
 * generar la certificación, de modo que el registro sea autodescriptivo.
 *
 * Determinista: no usa la fecha del sistema; recibe `fechaISO` y la formatea en
 * UTC para que el texto sea reproducible y testeable.
 */
import {
  isLegallySubstantiveText,
  normalizeLegalArtifactManifest,
  validateApprovedRecordLegalArtifactManifest,
  type LegalArtifactIdentity,
  type LegalArtifactManifest,
  type LegalArtifactValidationIssue,
  type LegalArtifactValidationResult,
} from "./legal-artifact-manifest";

export interface CertificacionBodyInput {
  certificanteCargoLabel: string;
  certificanteNombre?: string | null;
  vistoBuenoCargoLabel?: string | null;
  vistoBuenoNombre?: string | null;
  entidadNombre: string;
  organoNombre?: string | null;
  numAcuerdos: number;
  actaApprovalMethod: string;
  actaApprovalDateISO: string;
  fechaISO: string;
}

export interface CertificacionExtractInput {
  manifest: LegalArtifactManifest;
  agreementPointIds: string[];
  certifier: LegalArtifactIdentity & { evidenceId: string };
  seenBy: (LegalArtifactIdentity & { evidenceId: string }) | null;
  issuePlace: string;
  issueDateISO: string;
}

export class CertificacionManifestValidationError extends Error {
  readonly issues: LegalArtifactValidationIssue[];

  constructor(issues: LegalArtifactValidationIssue[]) {
    super(`La certificación no puede expedirse: ${issues.map((issue) => issue.code).join(", ")}.`);
    this.name = "CertificacionManifestValidationError";
    this.issues = issues;
  }
}

function fechaLarga(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/**
 * @deprecated Adaptador de compatibilidad para el flujo previo al manifest.
 * No acredita por sí solo un extracto expedible. Los flujos de expedición
 * deben usar `buildCertificacionExtractBody`, que valida el manifest aprobado.
 */
export function buildCertificacionBody(input: CertificacionBodyInput): string {
  const nombre = input.certificanteNombre?.trim() || "—";
  const organo = input.organoNombre?.trim();
  const fecha = fechaLarga(input.fechaISO);
  const fechaAprobacionActa = fechaLarga(input.actaApprovalDateISO);
  const plural =
    input.numAcuerdos === 1
      ? "el acuerdo adoptado"
      : `los ${input.numAcuerdos} acuerdos adoptados`;

  const lines: string[] = [];
  lines.push("CERTIFICACIÓN DE ACUERDOS");
  lines.push("");
  lines.push(
    `${nombre}, en su condición de ${input.certificanteCargoLabel} de ` +
      `${input.entidadNombre}${organo ? ` (${organo})` : ""}, cargo vigente y en ejercicio,`,
  );
  lines.push("");
  lines.push(
    `CERTIFICA que, conforme al art. 109 del Reglamento del Registro Mercantil, ` +
      `quedan certificados ${plural}${organo ? ` por ${organo}` : ""}, cuyo contenido ` +
      `íntegro consta en el acta correspondiente y en el expediente del acuerdo.`,
  );
  lines.push("");
  lines.push(
    `El acta fue aprobada mediante ${input.actaApprovalMethod.trim()} el ` +
      `${fechaAprobacionActa}.`,
  );
  lines.push("");
  if (input.vistoBuenoNombre?.trim()) {
    lines.push(
      `Visto bueno: ${input.vistoBuenoNombre.trim()}` +
        (input.vistoBuenoCargoLabel ? `, ${input.vistoBuenoCargoLabel}.` : "."),
    );
    lines.push("");
  }
  lines.push(`En ${input.entidadNombre}, a ${fecha}.`);
  return lines.join("\n");
}

function addCertificationIssue(
  issues: LegalArtifactValidationIssue[],
  code: string,
  field: string,
  message: string,
) {
  issues.push({ code, severity: "BLOCKING", field, message });
}

function validIsoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateCertificacionExtractInput(input: CertificacionExtractInput): LegalArtifactValidationResult {
  const base = validateApprovedRecordLegalArtifactManifest(input.manifest);
  const issues = [...base.blockingIssues, ...base.warnings];
  const manifest = normalizeLegalArtifactManifest(input.manifest);
  const evidenceIds = new Set(manifest.evidences.map((evidence) => evidence.id));
  const decisions = new Map(
    manifest.agenda
      .filter((point) => point.kind === "DECISION")
      .map((point) => [point.id, point]),
  );

  if (input.agreementPointIds.length === 0) {
    addCertificationIssue(issues, "cert_extract_empty", "agreementPointIds", "La certificación por extracto debe seleccionar al menos un acuerdo.");
  }
  const duplicateIds = input.agreementPointIds.filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    addCertificationIssue(issues, "cert_extract_duplicate", "agreementPointIds", "La selección de acuerdos contiene duplicados.");
  }
  input.agreementPointIds.forEach((id, index) => {
    const decision = decisions.get(id);
    if (!decision) {
      addCertificationIssue(issues, "cert_extract_agreement_unknown", `agreementPointIds.${index}`, `El punto ${id} no es un acuerdo decisorio del manifest aprobado.`);
    } else if (!decision.vote?.adopted) {
      addCertificationIssue(issues, "cert_extract_agreement_not_adopted", `agreementPointIds.${index}`, `El punto ${id} no contiene un acuerdo adoptado certificable.`);
    }
  });

  if (!isLegallySubstantiveText(input.certifier.id, 2) || !isLegallySubstantiveText(input.certifier.name, 3) || !isLegallySubstantiveText(input.certifier.role)) {
    addCertificationIssue(issues, "cert_certifier_incomplete", "certifier", "Faltan identidad, nombre o cargo del certificante.");
  }
  const certifierSignature = manifest.signatures.find(
    (signature) => signature.person.id === input.certifier.id && signature.status === "SIGNED",
  );
  if (
    !certifierSignature ||
    !input.certifier.evidenceId ||
    certifierSignature.evidenceId !== input.certifier.evidenceId ||
    !evidenceIds.has(input.certifier.evidenceId)
  ) {
    addCertificationIssue(issues, "cert_certifier_authority_unproven", "certifier", "El certificante no tiene firma y evidencia vigente en el manifest.");
  }

  if (manifest.organ.kind === "BOARD") {
    if (!input.seenBy) {
      addCertificationIssue(issues, "cert_seen_by_missing", "seenBy", "La certificación del Consejo requiere visto bueno de la Presidencia.");
    } else {
      const presidentSignature = manifest.signatures.find(
        (signature) => signature.capacity === "PRESIDENT" && signature.person.id === input.seenBy?.id && signature.status === "SIGNED",
      );
      if (
        !presidentSignature ||
        !input.seenBy.evidenceId ||
        presidentSignature.evidenceId !== input.seenBy.evidenceId ||
        !evidenceIds.has(input.seenBy.evidenceId)
      ) {
        addCertificationIssue(issues, "cert_seen_by_unproven", "seenBy", "El visto bueno no coincide con la Presidencia firmante y su evidencia.");
      }
    }
  }

  if (!isLegallySubstantiveText(input.issuePlace, 3) || !validIsoDate(input.issueDateISO)) {
    addCertificationIssue(issues, "cert_issue_metadata_missing", "issue", "Faltan lugar o fecha ISO de expedición.");
  }
  const issueTime = validIsoDate(input.issueDateISO) ? Date.parse(input.issueDateISO) : null;
  const approvalTime = manifest.approval.dateISO && validIsoDate(manifest.approval.dateISO)
    ? Date.parse(manifest.approval.dateISO)
    : null;
  const generatedTime = validIsoDate(manifest.generatedAtISO) ? Date.parse(manifest.generatedAtISO) : null;
  if (issueTime !== null && approvalTime !== null && issueTime < approvalTime) {
    addCertificationIssue(issues, "cert_issued_before_approval", "issueDateISO", "La certificación no puede expedirse antes de aprobarse el acta.");
  }
  if (issueTime !== null && generatedTime !== null && issueTime > generatedTime) {
    addCertificationIssue(issues, "cert_future_issue_asserted", "issueDateISO", "El manifest se generó antes de la expedición afirmada.");
  }

  const blockingIssues = issues.filter((issue) => issue.severity === "BLOCKING");
  const warnings = issues.filter((issue) => issue.severity === "WARNING");
  return { ok: blockingIssues.length === 0, blockingIssues, warnings };
}

function attendanceLabel(attendance: string) {
  if (attendance === "PRESENT") return "presente";
  if (attendance === "REPRESENTED") return "representado";
  if (attendance === "ABSENT") return "ausente";
  return "invitado sin voto";
}

function modalityLabel(modality: string) {
  const labels: Record<string, string> = {
    IN_PERSON: "presencial",
    HYBRID: "híbrida",
    REMOTE: "telemática",
    WRITTEN_WITHOUT_SESSION: "por escrito y sin sesión",
  };
  return labels[modality] ?? modality;
}

function renderParticipant(participant: LegalArtifactManifest["census"]["participants"][number]) {
  const representation = participant.representedBy ? ` por ${participant.representedBy.name}` : "";
  return `${participant.name} (${participant.role}; ${attendanceLabel(participant.attendance)}${representation})`;
}

export function buildCertificacionExtractBody(input: CertificacionExtractInput): string {
  const validation = validateCertificacionExtractInput(input);
  if (!validation.ok) throw new CertificacionManifestValidationError(validation.blockingIssues);

  const manifest = normalizeLegalArtifactManifest(input.manifest);
  const decisions = input.agreementPointIds.map((id) => manifest.agenda.find((point) => point.id === id)!);
  const eligible = manifest.census.participants.filter((participant) => participant.votingEligible);
  const invited = manifest.census.participants.filter((participant) => !participant.votingEligible);
  const approvalDate = fechaLarga(manifest.approval.dateISO!);
  const issueDate = fechaLarga(input.issueDateISO);
  const meetingDate = fechaLarga(manifest.meeting.startAtISO);

  const lines: string[] = [
    "CERTIFICACIÓN POR EXTRACTO DE ACUERDOS",
    "",
    `${input.certifier.name}, ${input.certifier.role} de ${manifest.entity.name}, con facultad certificante y firma acreditada por ${input.certifier.evidenceId},`,
    "",
    "CERTIFICA",
    "",
    "1. Circunstancias de la reunión (arts. 97, 109 y 112 RRM)",
    `Sociedad: ${manifest.entity.name} (${manifest.entity.legalForm}${manifest.entity.listed ? ", sociedad cotizada" : ""}).`,
    `Órgano: ${manifest.organ.name}. Modalidad: ${modalityLabel(manifest.meeting.modality)}.`,
    `Celebración: ${meetingDate}, de ${manifest.meeting.startAtISO} a ${manifest.meeting.endAtISO}, en ${manifest.meeting.place}.`,
    `Convocatoria: cursada el ${fechaLarga(manifest.convocation.dateISO)} mediante ${manifest.convocation.mode} por ${manifest.convocation.author.name}, ${manifest.convocation.author.role}.`,
    `Texto íntegro de convocatoria: ${manifest.convocation.fullText}`,
    "",
    "2. Lista, concurrencia y quórum",
    `Método de formación y comprobación de la lista: ${manifest.census.method}. Evidencia: ${manifest.census.evidenceId}.`,
    `Vocales elegibles (${manifest.quorum.eligibleCount}): ${eligible.map(renderParticipant).join("; ")}.`,
    invited.length > 0 ? `Asistentes no elegibles: ${invited.map(renderParticipant).join("; ")}.` : "Asistentes no elegibles: ninguno.",
    `Quórum por vocales: ${manifest.quorum.presentCount} presentes, ${manifest.quorum.representedCount} representados y ${manifest.quorum.absentCount} ausentes, sobre ${manifest.quorum.eligibleCount} vocales elegibles; mínimo exigible ${manifest.quorum.requiredCount}.`,
    `Mesa: preside ${manifest.chair.president.name}, ${manifest.chair.president.role}, y actúa como secretario ${manifest.chair.secretary.name}, ${manifest.chair.secretary.role}. Título: ${manifest.chair.appointmentBasis}.`,
    "",
    "3. Acuerdos certificados por extracto y votaciones",
  ];

  decisions.forEach((point, index) => {
    const vote = point.vote!;
    lines.push(`${index + 1}. ${point.title}`);
    lines.push(`Acuerdo literal: ${point.exactResolution}`);
    lines.push(
      `Votación: ${vote.favor} a favor, ${vote.against} en contra y ${vote.abstentions} abstenciones, sobre ${vote.eligibleVoters} vocales con derecho a voto; ${vote.excludedForConflict} excluidos por conflicto.`,
    );
    lines.push(`Mayoría aplicada: ${vote.majorityRule}. Proclamación: ${vote.proclamation}`);
    lines.push(
      point.conflicts.length > 0
        ? `Conflictos: ${point.conflicts.map((conflict) => `${conflict.personName}: ${conflict.reason}; abstención y exclusión efectivas`).join("; ")}.`
        : "Conflictos declarados: ninguno.",
    );
    lines.push("");
  });

  lines.push("4. Aprobación, firmas y asiento");
  lines.push(
    `El acta fue aprobada realmente mediante ${manifest.approval.method} el ${approvalDate} por ${manifest.approval.approvedBy.join(", ")}. Evidencias: ${manifest.approval.evidenceIds.join(", ")}.`,
  );
  lines.push(
    `Firmas: ${manifest.signatures
      .filter((signature) => signature.status === "SIGNED")
      .map((signature) => `${signature.person.name} (${signature.capacity}, ${signature.evidenceId})`)
      .join("; ")}.`,
  );
  lines.push(
    `Asiento: libro ${manifest.bookEntry!.bookTitle} [${manifest.bookEntry!.bookId}], sección ${manifest.bookEntry!.sectionId}, asiento ${manifest.bookEntry!.entryId}, ordinal ${manifest.bookEntry!.ordinalNumber}, registrado el ${manifest.bookEntry!.recordedAtISO}, hash fuente ${manifest.bookEntry!.sourceHash}.`,
  );
  lines.push("");
  lines.push("5. Anexos identificados");
  manifest.annexes.forEach((annex) => {
    lines.push(`${annex.order}. ${annex.title} [${annex.id}], hash ${annex.hash}, evidencia ${annex.evidenceId}.`);
  });
  lines.push("");
  lines.push("6. Expedición");
  lines.push(`Se expide en ${input.issuePlace}, a ${issueDate}, por ${input.certifier.name}, ${input.certifier.role}. Evidencia de firma: ${input.certifier.evidenceId}.`);
  if (input.seenBy) {
    lines.push(`Visto bueno de ${input.seenBy.name}, ${input.seenBy.role}. Evidencia de firma: ${input.seenBy.evidenceId}.`);
  }

  return lines.join("\n");
}
