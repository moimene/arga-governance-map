export type AgreementDocumentKind =
  | "CONVOCATORIA"
  | "ACTA"
  | "CERTIFICACION"
  | "INFORME_PRECEPTIVO"
  | "INFORME_DOCUMENTAL_PRE"
  | "MODELO_ACUERDO"
  | "ACUERDO_SIN_SESION"
  | "DECISION_UNIPERSONAL"
  | "DOCUMENTO_REGISTRAL"
  | "SUBSANACION_REGISTRAL"
  | string;

export type AgreementDocumentTraceStatus =
  | "AGREEMENT_LINKED"
  | "PRE_AGREEMENT_ALLOWED"
  | "PENDING_AGREEMENT_LINK"
  | "NOT_AGREEMENT_DOCUMENT";

export interface AgreementDocumentTraceInput {
  kind: AgreementDocumentKind;
  recordId?: string | null;
  templateTypes?: string[] | null;
  explicitAgreementIds?: Array<string | null | undefined>;
  variables?: Record<string, unknown> | null;
}

export interface AgreementDocumentTrace {
  status: AgreementDocumentTraceStatus;
  agreementIds: string[];
  requiresAgreementLink: boolean;
  canExistBeforeAgreement: boolean;
  isDispositiveDocument: boolean;
  reason: string;
}

export type DocumentEvidencePostureStatus =
  | "NOT_EVIDENCE"
  | "PRE_OPERATIVE_DOCUMENT"
  | "LINK_REQUIRED_NOT_FINAL"
  | "READY_TO_ARCHIVE"
  | "ARCHIVE_FAILED_NOT_FINAL"
  | "DEMO_EVIDENCE_BUNDLE_NOT_FINAL";

export interface DocumentEvidenceArchiveState {
  attempted?: boolean;
  archived?: boolean;
  evidenceBundleIds?: string[];
  skippedReason?: string;
  errors?: string[];
}

export interface DocumentEvidencePosture {
  status: DocumentEvidencePostureStatus;
  label: string;
  finalEvidence: boolean;
  canBeUsedOperationally: boolean;
  requiresAgreementLink: boolean;
  requiresArchive: boolean;
  reason: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRE_AGREEMENT_KINDS = new Set(["CONVOCATORIA", "INFORME_PRECEPTIVO", "INFORME_DOCUMENTAL_PRE"]);
const DISPOSITIVE_KINDS = new Set([
  "ACTA",
  "CERTIFICACION",
  "MODELO_ACUERDO",
  "ACUERDO_SIN_SESION",
  "DECISION_UNIPERSONAL",
  "DOCUMENTO_REGISTRAL",
  "SUBSANACION_REGISTRAL",
]);
const FINAL_LINK_REQUIRED_KINDS = new Set([
  "ACTA",
  "CERTIFICACION",
  "ACUERDO_SIN_SESION",
  "DECISION_UNIPERSONAL",
  "DOCUMENTO_REGISTRAL",
  "SUBSANACION_REGISTRAL",
]);

function normalizeKind(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function addId(target: Set<string>, value: unknown) {
  if (isUuid(value)) target.add(value.trim());
}

function addIds(target: Set<string>, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item) => addId(target, item));
    return;
  }
  addId(target, value);
}

export function collectAgreementDocumentIds(input: AgreementDocumentTraceInput) {
  const ids = new Set<string>();

  input.explicitAgreementIds?.forEach((id) => addId(ids, id));

  const variables = input.variables ?? {};
  addIds(ids, variables.agreement_id);
  addIds(ids, variables.agreementId);
  addIds(ids, variables.canonical_agreement_id);
  addIds(ids, variables.canonicalAgreementId);
  addIds(ids, variables.agreement_ids);
  addIds(ids, variables.agreementIds);
  addIds(ids, variables.certified_agreement_ids);
  addIds(ids, variables.certifiedAgreementIds);

  return Array.from(ids);
}

export function resolveAgreementDocumentTrace(input: AgreementDocumentTraceInput): AgreementDocumentTrace {
  const kind = normalizeKind(input.kind);
  const templateTypes = (input.templateTypes ?? []).map(normalizeKind);
  const agreementIds = collectAgreementDocumentIds(input);
  const canExistBeforeAgreement =
    PRE_AGREEMENT_KINDS.has(kind) || templateTypes.some((type) => PRE_AGREEMENT_KINDS.has(type));
  const isDispositiveDocument =
    DISPOSITIVE_KINDS.has(kind) || templateTypes.some((type) => DISPOSITIVE_KINDS.has(type));
  const requiresAgreementLink =
    FINAL_LINK_REQUIRED_KINDS.has(kind) || templateTypes.some((type) => FINAL_LINK_REQUIRED_KINDS.has(type));

  if (agreementIds.length > 0) {
    return {
      status: "AGREEMENT_LINKED",
      agreementIds,
      requiresAgreementLink,
      canExistBeforeAgreement,
      isDispositiveDocument,
      reason: "agreement_id linked",
    };
  }

  if (canExistBeforeAgreement && !requiresAgreementLink) {
    return {
      status: "PRE_AGREEMENT_ALLOWED",
      agreementIds,
      requiresAgreementLink,
      canExistBeforeAgreement,
      isDispositiveDocument,
      reason: "pre-agreement document may exist before agreement materialization",
    };
  }

  if (requiresAgreementLink || isDispositiveDocument) {
    return {
      status: "PENDING_AGREEMENT_LINK",
      agreementIds,
      requiresAgreementLink: true,
      canExistBeforeAgreement,
      isDispositiveDocument,
      reason: "final or dispositive document must link to agreement_id",
    };
  }

  return {
    status: "NOT_AGREEMENT_DOCUMENT",
    agreementIds,
    requiresAgreementLink,
    canExistBeforeAgreement,
    isDispositiveDocument,
    reason: "document kind does not participate in Agreement 360 lifecycle",
  };
}

export function buildAgreementDocumentTraceFooterLines(trace: AgreementDocumentTrace) {
  if (trace.status === "AGREEMENT_LINKED") {
    return [
      `Acuerdo canonico: ${trace.agreementIds.join(", ")}`,
      "Estado Agreement 360: enlazado",
    ];
  }

  if (trace.status === "PRE_AGREEMENT_ALLOWED") {
    return [
      "Acuerdo canonico: pendiente (fase PRE/propuesta permitida)",
      "Estado Agreement 360: debe enlazarse cuando el acuerdo se materialice",
    ];
  }

  if (trace.status === "PENDING_AGREEMENT_LINK") {
    return [
      "Acuerdo canonico: pendiente de enlace",
      "Estado Agreement 360: documento dispositivo/final; no considerar evidencia final productiva sin agreement_id",
    ];
  }

  return [
    "Acuerdo canonico: no aplica",
    "Estado Agreement 360: fuera del ciclo de acuerdo",
  ];
}

export function resolveDocumentEvidencePosture(
  trace: AgreementDocumentTrace,
  archive?: DocumentEvidenceArchiveState | null,
): DocumentEvidencePosture {
  if (trace.status === "NOT_AGREEMENT_DOCUMENT") {
    return {
      status: "NOT_EVIDENCE",
      label: "No probatorio",
      finalEvidence: false,
      canBeUsedOperationally: true,
      requiresAgreementLink: false,
      requiresArchive: false,
      reason: "documento fuera del ciclo de Acuerdo 360",
    };
  }

  if (trace.status === "PRE_AGREEMENT_ALLOWED") {
    return {
      status: "PRE_OPERATIVE_DOCUMENT",
      label: "Documento PRE operativo",
      finalEvidence: false,
      canBeUsedOperationally: true,
      requiresAgreementLink: false,
      requiresArchive: false,
      reason: "documento anterior a la adopcion del acuerdo",
    };
  }

  if (trace.status === "PENDING_AGREEMENT_LINK") {
    return {
      status: "LINK_REQUIRED_NOT_FINAL",
      label: "Sin evidencia final productiva",
      finalEvidence: false,
      canBeUsedOperationally: true,
      requiresAgreementLink: true,
      requiresArchive: true,
      reason: "falta agreement_id canonico",
    };
  }

  if (!archive) {
    return {
      status: "READY_TO_ARCHIVE",
      label: "Listo para archivo",
      finalEvidence: false,
      canBeUsedOperationally: true,
      requiresAgreementLink: false,
      requiresArchive: true,
      reason: "agreement_id enlazado; pendiente de generar y archivar",
    };
  }

  if (archive.archived && (archive.evidenceBundleIds?.length ?? 0) > 0) {
    return {
      status: "DEMO_EVIDENCE_BUNDLE_NOT_FINAL",
      label: "Evidencia demo archivada",
      finalEvidence: false,
      canBeUsedOperationally: true,
      requiresAgreementLink: false,
      requiresArchive: false,
      reason: "bundle operativo creado; no declarar evidencia final productiva sin audit/retention/legal hold completos",
    };
  }

  return {
    status: "ARCHIVE_FAILED_NOT_FINAL",
    label: "Archivo pendiente",
    finalEvidence: false,
    canBeUsedOperationally: true,
    requiresAgreementLink: false,
    requiresArchive: true,
    reason: archive.skippedReason ?? archive.errors?.[0] ?? "documento generado sin bundle probatorio",
  };
}

export function buildDocumentEvidencePostureFooterLines(posture: DocumentEvidencePosture) {
  return [
    `Postura probatoria: ${posture.label}`,
    `Evidencia final productiva: ${posture.finalEvidence ? "si" : "no"}`,
    `Razon probatoria: ${posture.reason}`,
  ];
}
