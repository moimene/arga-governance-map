import { downloadDocx } from "@/lib/doc-gen/docx-generator";
import {
  archiveProcessDocx,
  buildProcessAgreementTrace,
  generateProcessDocx,
  inferProcessTemplateCriteria,
  persistProcessArchiveLink,
  selectProcessTemplate,
  type ProcessDocumentArchiveResult,
  type ProcessDocumentGenerationInput,
  type ProcessDocumentGenerationResult,
  type ProcessDocumentKind,
} from "@/lib/doc-gen/process-documents";
import { mergeVariables } from "@/lib/doc-gen/variable-resolver";
import { expandLegalStructuredVariables } from "@/lib/secretaria/legal-template-normalizer";
import {
  buildSecretariaDocumentGenerationRequest,
  type SecretariaAdoptionMode,
  type SecretariaDocumentType,
  type SecretariaOrganoTipo,
} from "@/lib/secretaria/document-generation-boundary";
import { resolveDocumentEvidencePosture } from "@/lib/secretaria/agreement-document-contract";
import { resolveProcessDocumentFinalEvidenceReadiness } from "@/lib/doc-gen/process-document-readiness";
import { composeDocument } from "./composer";

const MOTOR_PROCESS_KINDS = new Set<ProcessDocumentKind>([
  "CONVOCATORIA",
  "ACTA",
  "CERTIFICACION",
  "INFORME_PRECEPTIVO",
  "INFORME_DOCUMENTAL_PRE",
  "ACUERDO_SIN_SESION",
  "DECISION_UNIPERSONAL",
]);

function isMotorProcessKind(kind: ProcessDocumentKind) {
  return MOTOR_PROCESS_KINDS.has(kind);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function arrayStringValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nestedStringValue(
  variables: Record<string, unknown>,
  objectKey: string,
  fieldKeys: string[],
) {
  const object = objectValue(variables[objectKey]);
  if (!object) return null;
  for (const fieldKey of fieldKeys) {
    const value = stringValue(object[fieldKey]);
    if (value) return value;
  }
  return null;
}

function firstStringValue(variables: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(variables[key]);
    if (value) return value;
  }
  return null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => !!value && value.trim().length > 0)));
}

function agreementIdsFromProcessInput(
  input: ProcessDocumentGenerationInput,
  variables: Record<string, unknown>,
) {
  const archiveOptions = input.archive && typeof input.archive === "object" ? input.archive : {};
  const ids = [
    archiveOptions.agreementId,
    ...(archiveOptions.agreementIds ?? []),
    stringValue(variables.agreement_id),
    stringValue(variables.agreementId),
    ...arrayStringValues(variables.agreement_ids),
    ...arrayStringValues(variables.agreementIds),
    ...arrayStringValues(variables.canonical_agreement_ids),
    ...arrayStringValues(variables.certified_agreement_ids),
    ...arrayStringValues(variables.agreements_certified),
  ];
  if (input.kind === "DOCUMENTO_REGISTRAL" || input.kind === "SUBSANACION_REGISTRAL") {
    ids.push(input.recordId);
  }
  return uniqueStrings(ids);
}

function entityIdFromProcessVariables(variables: Record<string, unknown>) {
  return (
    firstStringValue(variables, ["entity_id", "entityId"]) ??
    nestedStringValue(variables, "convocatoria", ["entity_id", "entityId"]) ??
    nestedStringValue(variables, "meeting", ["entity_id", "entityId"]) ??
    nestedStringValue(variables, "acta", ["entity_id", "entityId"]) ??
    nestedStringValue(variables, "decision", ["entity_id", "entityId"]) ??
    nestedStringValue(variables, "agreement", ["entity_id", "entityId"])
  );
}

function recordReferencesForKind(
  kind: ProcessDocumentKind,
  recordId: string,
  variables: Record<string, unknown>,
) {
  return {
    convocatoriaId:
      kind === "CONVOCATORIA" || kind === "INFORME_PRECEPTIVO"
        ? firstStringValue(variables, ["convocatoria_id", "convocatoriaId"]) ?? recordId
        : null,
    meetingId: firstStringValue(variables, ["meeting_id", "meetingId"]),
    minuteId:
      kind === "ACTA"
        ? firstStringValue(variables, ["minute_id", "minuteId"]) ?? recordId
        : null,
    certificationId:
      kind === "CERTIFICACION"
        ? firstStringValue(variables, ["certification_id", "certificationId"]) ?? recordId
        : null,
    tramitadorId:
      kind === "DOCUMENTO_REGISTRAL" || kind === "SUBSANACION_REGISTRAL"
        ? firstStringValue(variables, ["tramitador_id", "tramitadorId"]) ?? recordId
        : null,
  };
}

async function buildMotorRequestForProcess(
  input: ProcessDocumentGenerationInput,
  variables: Record<string, unknown>,
  templateId: string | null,
  templateProfileId: string | null,
) {
  const references = recordReferencesForKind(input.kind, input.recordId, variables);
  return buildSecretariaDocumentGenerationRequest({
    documentType: input.kind as SecretariaDocumentType,
    tenantId: input.tenantId,
    entityId: entityIdFromProcessVariables(variables),
    agreementIds: agreementIdsFromProcessInput(input, variables),
    convocatoriaId: references.convocatoriaId,
    meetingId: references.meetingId,
    minuteId: references.minuteId,
    certificationId: references.certificationId,
    tramitadorId: references.tramitadorId,
    templateProfileId,
    templateId,
    expectedOrganoTipo: input.templateCriteria?.organoTipo as SecretariaOrganoTipo | null | undefined,
    expectedAdoptionMode: input.templateCriteria?.adoptionMode as SecretariaAdoptionMode | null | undefined,
  });
}

function emptyArchiveResult(reason: string): ProcessDocumentArchiveResult {
  return {
    attempted: true,
    archived: false,
    skippedReason: reason,
    documentUrls: [],
    evidenceBundleIds: [],
    attachmentIds: [],
    agreementIds: [],
    errors: [],
  };
}

async function legacyFallback(input: ProcessDocumentGenerationInput) {
  return generateProcessDocx(input);
}

export async function generateProcessDocxWithMotor(
  input: ProcessDocumentGenerationInput,
): Promise<ProcessDocumentGenerationResult> {
  if (!isMotorProcessKind(input.kind)) {
    return legacyFallback(input);
  }

  const templateCriteria = inferProcessTemplateCriteria(input);
  const plantilla = selectProcessTemplate(
    input.plantillas,
    input.templateTypes,
    templateCriteria,
    input.preferredTemplateId,
  );
  if (!plantilla) {
    return legacyFallback(input);
  }

  const capa3Values = input.capa3Values ?? {};
  const variables = expandLegalStructuredVariables(mergeVariables(input.variables ?? {}, capa3Values));
  const req = await buildMotorRequestForProcess(input, variables, plantilla.id, plantilla.tipo).catch(() => null);
  if (!req) {
    return legacyFallback(input);
  }

  const composition = await composeDocument(req, capa3Values, {
    plantilla,
    baseVariables: variables,
    resolveCapa2: false,
    archiveDraft: false,
    resolverContext: {
      tenantId: req.tenant_id,
      entityId: req.entity_id ?? undefined,
      agreementId: req.agreement_ids[0],
      meetingId: req.meeting_id ?? undefined,
    },
    title: input.title,
    subtitle: input.subtitle,
    entityName: input.entityName,
    filenamePrefix: input.filenamePrefix ?? input.kind,
  });

  const archive = await archiveProcessDocx({
    input,
    buffer: composition.docxBuffer,
    filename: composition.filename,
    contentHash: composition.contentHash,
    template: plantilla,
  }).catch((error): ProcessDocumentArchiveResult => ({
    ...emptyArchiveResult("archive_failed"),
    errors: [error instanceof Error ? error.message : String(error)],
  }));

  await persistProcessArchiveLink(input, archive).catch(() => undefined);
  downloadDocx(composition.docxBuffer, composition.filename);

  const agreementTrace = buildProcessAgreementTrace(input, variables);
  const evidencePosture = resolveDocumentEvidencePosture(agreementTrace, archive);
  const finalEvidenceReadiness = resolveProcessDocumentFinalEvidenceReadiness({
    agreementTrace,
    evidencePosture,
    archive,
    contentHash: composition.contentHash,
  });

  return {
    filename: composition.filename,
    contentHash: composition.contentHash,
    templateId: plantilla.id,
    templateTipo: plantilla.tipo,
    templateVersion: plantilla.version,
    usedFallback: false,
    unresolvedVariables: composition.unresolvedVariables,
    archive,
    agreementTrace,
    evidencePosture,
    finalEvidenceReadiness,
  };
}
