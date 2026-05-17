import { computeContentHash, downloadDocx, generateDocx } from "./docx-generator";
import type { EditableField } from "./docx-generator";
import { mergeVariables } from "./variable-resolver";
import { renderTemplate } from "./template-renderer";
import { archiveDocxToStorage } from "./storage-archiver";
import { resolveProcessDocumentFinalEvidenceReadiness } from "./process-document-readiness";
import { supabase } from "@/integrations/supabase/client";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import type { SecretariaAIAssist } from "@/lib/secretaria/document-generation-boundary";
import { isUuidReference } from "@/lib/secretaria/certification-registry-intake";
import {
  compareOperationalTemplateFreshness,
  isOperationalTemplate,
} from "./template-operability";
import {
  buildAgreementDocumentTraceFooterLines,
  buildDocumentEvidencePostureFooterLines,
  resolveDocumentEvidencePosture,
  resolveAgreementDocumentTrace,
} from "@/lib/secretaria/agreement-document-contract";
import type {
  AgreementDocumentTrace,
  DocumentEvidencePosture,
} from "@/lib/secretaria/agreement-document-contract";
import type { FinalEvidenceReadinessResult } from "@/lib/secretaria/final-evidence-readiness-contract";
import { expandLegalStructuredVariables } from "@/lib/secretaria/legal-template-normalizer";
import { capa3ValueToText, type Capa3Values } from "@/lib/secretaria/capa3-fields";

export type ProcessDocumentKind =
  | "CONVOCATORIA"
  | "ACTA"
  | "CERTIFICACION"
  | "INFORME_PRECEPTIVO"
  | "INFORME_DOCUMENTAL_PRE"
  | "ACUERDO_SIN_SESION"
  | "DECISION_UNIPERSONAL"
  | "DOCUMENTO_REGISTRAL"
  | "SUBSANACION_REGISTRAL";

export interface ProcessDocumentGenerationInput {
  kind: ProcessDocumentKind;
  recordId: string;
  title: string;
  subtitle?: string;
  entityName?: string | null;
  templateTypes: string[];
  plantillas: PlantillaProtegidaRow[];
  variables?: Record<string, unknown>;
  capa3Values?: Capa3Values;
  fallbackText: string;
  filenamePrefix?: string;
  tenantId?: string | null;
  archive?: ProcessDocumentArchiveOptions | false;
  templateCriteria?: ProcessDocumentTemplateCriteria;
  preferredTemplateId?: string | null;
  aiAssist?: SecretariaAIAssist;
}

export interface ProcessDocumentArchiveOptions {
  tenantId?: string | null;
  agreementId?: string | null;
  agreementIds?: string[] | null;
  enabled?: boolean;
  signedBy?: string;
}

export interface ProcessDocumentTemplateCriteria {
  jurisdiction?: string | null;
  materia?: string | null;
  adoptionMode?: string | null;
  organoTipo?: string | null;
  requireCriticalMetadata?: boolean;
}

export interface ProcessTemplateCandidate {
  templateId: string;
  tipo: string;
  version: string;
  estado: string;
  selectionReason: string;
  missingCriticalMetadata: string[];
}

export interface ProcessTemplateSelectionResult {
  selected: PlantillaProtegidaRow | null;
  selectionReason: string | null;
  candidates: ProcessTemplateCandidate[];
  blockingIssues: string[];
  warnings: string[];
}

export interface ProcessDocumentArchiveResult {
  attempted: boolean;
  archived: boolean;
  reused?: boolean;
  skippedReason?: string;
  documentUrls: string[];
  evidenceBundleIds: string[];
  attachmentIds: string[];
  agreementIds: string[];
  errors: string[];
}

export interface ProcessDocumentGenerationResult {
  filename: string;
  contentHash: string;
  templateId: string | null;
  templateTipo: string;
  templateVersion: string;
  templateSelectionReason?: string | null;
  templateSelectionWarnings?: string[];
  templateSelectionBlockingIssues?: string[];
  usedFallback: boolean;
  unresolvedVariables: string[];
  archive: ProcessDocumentArchiveResult;
  agreementTrace: AgreementDocumentTrace;
  evidencePosture: DocumentEvidencePosture;
  finalEvidenceReadiness: FinalEvidenceReadinessResult;
}

export class DocumentPreflightError extends Error {
  blockingVariables: string[];
  unresolvedVariables: string[];

  constructor(message: string, blockingVariables: string[], unresolvedVariables: string[]) {
    super(message);
    this.name = "DocumentPreflightError";
    this.blockingVariables = blockingVariables;
    this.unresolvedVariables = unresolvedVariables;
  }
}

const PROCESS_LABELS: Record<ProcessDocumentKind, string> = {
  CONVOCATORIA: "Convocatoria",
  ACTA: "Acta",
  CERTIFICACION: "Certificacion",
  INFORME_PRECEPTIVO: "Informe preceptivo",
  INFORME_DOCUMENTAL_PRE: "Informe documental PRE",
  ACUERDO_SIN_SESION: "Acuerdo sin sesion",
  DECISION_UNIPERSONAL: "Decision unipersonal",
  DOCUMENTO_REGISTRAL: "Documento registral",
  SUBSANACION_REGISTRAL: "Subsanacion registral",
};

function normalizeFilenamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || null;
}

function templateJurisdictionMatches(template: PlantillaProtegidaRow, jurisdiction?: string | null) {
  const expected = normalizeCode(jurisdiction);
  const actual = normalizeCode(template.jurisdiccion);
  if (!expected || !actual || actual === "GLOBAL" || actual === "MULTI") return true;
  return actual === expected;
}

function templateMetadataMatches(
  template: PlantillaProtegidaRow,
  criteria: ProcessDocumentTemplateCriteria,
) {
  if (!templateJurisdictionMatches(template, criteria.jurisdiction)) return false;

  const materia = normalizeCode(criteria.materia);
  const templateMateria = normalizeCode(template.materia_acuerdo ?? template.materia);
  if (materia && templateMateria && templateMateria !== materia) return false;

  const adoptionMode = normalizeCode(criteria.adoptionMode);
  const templateMode = normalizeCode(template.adoption_mode);
  if (adoptionMode && templateMode && templateMode !== adoptionMode) return false;

  const organoTipo = normalizeCode(criteria.organoTipo);
  const templateOrgano = normalizeCode(template.organo_tipo);
  if (organoTipo && templateOrgano && !organoTipoMatches(templateOrgano, organoTipo)) return false;

  return true;
}

function templateCriticalMetadataMissing(
  template: PlantillaProtegidaRow,
  criteria: ProcessDocumentTemplateCriteria,
) {
  const missing: string[] = [];
  if (normalizeCode(criteria.jurisdiction) && !normalizeCode(template.jurisdiccion)) {
    missing.push("jurisdiccion");
  }
  if (normalizeCode(criteria.materia) && !normalizeCode(template.materia_acuerdo ?? template.materia)) {
    missing.push("materia_acuerdo");
  }
  if (normalizeCode(criteria.adoptionMode) && !normalizeCode(template.adoption_mode)) {
    missing.push("adoption_mode");
  }
  if (normalizeCode(criteria.organoTipo) && !normalizeCode(template.organo_tipo)) {
    missing.push("organo_tipo");
  }
  return missing;
}

function organoFamily(value?: string | null) {
  const code = normalizeCode(value);
  if (!code) return null;
  if (code.includes("CDA") || code.includes("CONSEJO")) return "CONSEJO";
  if (code.includes("JUNTA") || code.includes("ASAMBLEA")) return "JUNTA";
  if (code.includes("ADMIN")) return "ADMIN";
  return code;
}

function organoTipoMatches(templateOrgano: string, criteriaOrgano: string) {
  if (templateOrgano === criteriaOrgano) return true;
  return organoFamily(templateOrgano) === organoFamily(criteriaOrgano);
}

function templateSpecificityScore(
  template: PlantillaProtegidaRow,
  criteria: ProcessDocumentTemplateCriteria,
) {
  let score = 0;
  if (normalizeCode(template.jurisdiccion) === normalizeCode(criteria.jurisdiction)) score -= 8;
  if (normalizeCode(template.materia_acuerdo ?? template.materia) === normalizeCode(criteria.materia)) score -= 6;
  if (normalizeCode(template.adoption_mode) === normalizeCode(criteria.adoptionMode)) score -= 4;
  const templateOrgano = normalizeCode(template.organo_tipo);
  const organoTipo = normalizeCode(criteria.organoTipo);
  if (templateOrgano && organoTipo && organoTipoMatches(templateOrgano, organoTipo)) score -= 2;
  return score;
}

function templateSelectionReason(
  template: PlantillaProtegidaRow,
  criteria: ProcessDocumentTemplateCriteria,
  preferred: boolean,
) {
  const parts = [
    preferred ? "plantilla preferida compatible" : "mejor candidata operativa",
    `tipo ${template.tipo}`,
    `estado ${template.estado}`,
    `version ${template.version}`,
  ];
  if (normalizeCode(template.jurisdiccion) === normalizeCode(criteria.jurisdiction)) parts.push("jurisdiccion exacta");
  if (normalizeCode(template.materia_acuerdo ?? template.materia) === normalizeCode(criteria.materia)) parts.push("materia exacta");
  if (normalizeCode(template.adoption_mode) === normalizeCode(criteria.adoptionMode)) parts.push("modo de adopcion exacto");
  const templateOrgano = normalizeCode(template.organo_tipo);
  const organoTipo = normalizeCode(criteria.organoTipo);
  if (templateOrgano && organoTipo && organoTipoMatches(templateOrgano, organoTipo)) parts.push("organo compatible");
  return parts.join("; ");
}

function readStringVariable(variables: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = variables?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export function inferProcessTemplateCriteria(
  input: ProcessDocumentGenerationInput,
): ProcessDocumentTemplateCriteria {
  return {
    jurisdiction:
      input.templateCriteria?.jurisdiction ??
      readStringVariable(input.variables, ["jurisdiccion", "jurisdiction"]),
    materia:
      input.templateCriteria?.materia ??
      readStringVariable(input.variables, ["materia_acuerdo", "materia", "clase_materia"]),
    adoptionMode:
      input.templateCriteria?.adoptionMode ??
      readStringVariable(input.variables, ["modo_adopcion", "adoption_mode"]),
    organoTipo:
      input.templateCriteria?.organoTipo ??
      readStringVariable(input.variables, ["organo_tipo", "tipo_organo"]),
  };
}

export function selectProcessTemplate(
  plantillas: PlantillaProtegidaRow[],
  templateTypes: string[],
  criteria: ProcessDocumentTemplateCriteria = {},
  preferredTemplateId?: string | null,
): PlantillaProtegidaRow | null {
  return resolveProcessTemplateSelection(plantillas, templateTypes, criteria, preferredTemplateId).selected;
}

export function resolveProcessTemplateSelection(
  plantillas: PlantillaProtegidaRow[],
  templateTypes: string[],
  criteria: ProcessDocumentTemplateCriteria = {},
  preferredTemplateId?: string | null,
): ProcessTemplateSelectionResult {
  const typePriority = new Map(templateTypes.map((type, index) => [type, index]));
  const requireCriticalMetadata = criteria.requireCriticalMetadata === true;
  const usableCandidates = plantillas
    .filter((template) =>
      typePriority.has(template.tipo) &&
      isOperationalTemplate(template) &&
      templateMetadataMatches(template, criteria)
    );
  const candidates = usableCandidates.map((template) => ({
    templateId: template.id,
    tipo: template.tipo,
    version: template.version,
    estado: template.estado,
    selectionReason: templateSelectionReason(template, criteria, template.id === preferredTemplateId),
    missingCriticalMetadata: templateCriticalMetadataMissing(template, criteria),
  }));
  const criticalCompatible = (template: PlantillaProtegidaRow) =>
    !requireCriticalMetadata || templateCriticalMetadataMissing(template, criteria).length === 0;
  const preferredTemplate = preferredTemplateId
    ? plantillas.find((template) =>
      template.id === preferredTemplateId &&
      typePriority.has(template.tipo) &&
      isOperationalTemplate(template) &&
      templateMetadataMatches(template, criteria) &&
      criticalCompatible(template)
    ) ?? null
    : null;

  const selected = preferredTemplate ?? (
    usableCandidates
      .filter(criticalCompatible)
      .sort((a, b) => {
        const typeDiff = (typePriority.get(a.tipo) ?? 99) - (typePriority.get(b.tipo) ?? 99);
        if (typeDiff !== 0) return typeDiff;
        const specificityDiff = templateSpecificityScore(a, criteria) - templateSpecificityScore(b, criteria);
        if (specificityDiff !== 0) return specificityDiff;
        return compareOperationalTemplateFreshness(a, b);
      })[0] ?? null
  );

  const warnings: string[] = [];
  const blockingIssues: string[] = [];
  if (selected) {
    const missing = templateCriticalMetadataMissing(selected, criteria);
    if (missing.length > 0) {
      warnings.push(`Plantilla seleccionada con metadatos criticos incompletos: ${missing.join(", ")}.`);
    }
  } else if (requireCriticalMetadata && candidates.some((candidate) => candidate.missingCriticalMetadata.length > 0)) {
    blockingIssues.push("template_critical_metadata_missing");
  }

  return {
    selected,
    selectionReason: selected ? templateSelectionReason(selected, criteria, selected.id === preferredTemplateId) : null,
    candidates,
    blockingIssues,
    warnings,
  };
}

function templateEditableFields(
  plantilla: PlantillaProtegidaRow | null,
  values: Capa3Values,
): EditableField[] | undefined {
  const fields = (plantilla?.capa3_editables ?? []).map((field) => ({
    key: field.campo,
    label: field.descripcion || field.campo,
    value: capa3ValueToText(values[field.campo]) || undefined,
  }));
  return fields.length > 0 ? fields : undefined;
}

function isRequiredCapa3(obligatoriedad?: string | null) {
  return obligatoriedad === "OBLIGATORIO";
}

function isRequiredCapa2(variable: { variable: string; fuente: string; condicion: string }) {
  const source = variable.fuente?.toUpperCase();
  const condition = variable.condicion?.toUpperCase();
  return source !== "USUARIO" || condition.includes("OBLIG");
}

function requiredTemplateVariables(plantilla: PlantillaProtegidaRow | null) {
  const required = new Set<string>();
  (plantilla?.capa2_variables ?? [])
    .filter(isRequiredCapa2)
    .forEach((variable) => required.add(variable.variable));
  (plantilla?.capa3_editables ?? [])
    .filter((field) => isRequiredCapa3(field.obligatoriedad))
    .forEach((field) => required.add(field.campo));
  return required;
}

function variableIsRequired(varName: string, required: Set<string>) {
  const root = varName.split(".")[0];
  return required.has(varName) || required.has(root);
}

function withTraceFooter(
  text: string,
  input: ProcessDocumentGenerationInput,
  template: PlantillaProtegidaRow | null,
  variables: Record<string, unknown>,
) {
  return [
    text.trim() || input.fallbackText.trim(),
    "",
    ...buildProcessDocumentTraceFooterLines(input, template, variables),
  ].join("\n");
}

export function buildProcessDocumentTraceFooterLines(
  input: ProcessDocumentGenerationInput,
  template: PlantillaProtegidaRow | null,
  variables: Record<string, unknown>,
  archive?: ProcessDocumentArchiveResult | null,
) {
  const agreementTrace = buildProcessAgreementTrace(input, variables);
  const evidencePosture = resolveDocumentEvidencePosture(agreementTrace, archive);

  return [
    "TRAZABILIDAD DOCUMENTAL",
    `Proceso: ${PROCESS_LABELS[input.kind]}`,
    `Registro: ${input.recordId}`,
    ...buildAgreementDocumentTraceFooterLines(agreementTrace),
    ...buildDocumentEvidencePostureFooterLines(evidencePosture),
    `Plantilla: ${template ? `${template.tipo} v${template.version}` : "Plantilla tecnica del sistema"}`,
    `Generado: ${new Date().toISOString()}`,
  ];
}

export function buildProcessAgreementTrace(
  input: ProcessDocumentGenerationInput,
  variables: Record<string, unknown>,
) {
  const archiveOptions = input.archive && typeof input.archive === "object" ? input.archive : {};
  return resolveAgreementDocumentTrace({
    kind: input.kind,
    recordId: input.recordId,
    templateTypes: input.templateTypes,
    explicitAgreementIds: [
      archiveOptions.agreementId,
      ...(archiveOptions.agreementIds ?? []),
    ],
    variables,
  });
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => !!value)));
}

function uniqueUuidReferences(values: Array<string | null | undefined>) {
  return uniqueNonEmpty(values).filter(isUuidReference);
}

function toExactArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function resolveAgreementIdsForProcess(
  input: ProcessDocumentGenerationInput,
): Promise<{ tenantId: string | null; agreementIds: string[]; skippedReason?: string }> {
  const archiveOptions = input.archive && typeof input.archive === "object" ? input.archive : {};
  const explicitAgreementIds = uniqueNonEmpty([
    archiveOptions.agreementId,
    ...(archiveOptions.agreementIds ?? []),
  ]).filter(isUuidReference);
  if (explicitAgreementIds.length > 0) {
    return { tenantId: archiveOptions.tenantId ?? input.tenantId ?? null, agreementIds: explicitAgreementIds };
  }

  if (input.kind === "CERTIFICACION") {
    const { data, error } = await supabase
      .from("certifications")
      .select("tenant_id, agreement_id, agreements_certified")
      .eq("id", input.recordId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { tenantId: input.tenantId ?? null, agreementIds: [], skippedReason: "certification_not_found" };

    return {
      tenantId: archiveOptions.tenantId ?? input.tenantId ?? data.tenant_id ?? null,
      agreementIds: uniqueUuidReferences([data.agreement_id, ...((data.agreements_certified as string[] | null) ?? [])]),
    };
  }

  if (input.kind === "ACTA") {
    const { data: minute, error: minuteError } = await supabase
      .from("minutes")
      .select("tenant_id, meeting_id")
      .eq("id", input.recordId)
      .maybeSingle();
    if (minuteError) throw minuteError;
    if (!minute?.meeting_id) {
      return {
        tenantId: archiveOptions.tenantId ?? input.tenantId ?? minute?.tenant_id ?? null,
        agreementIds: [],
        skippedReason: "minute_without_meeting",
      };
    }

    const { data: resolutions, error: resolutionsError } = await supabase
      .from("meeting_resolutions")
      .select("agreement_id")
      .eq("meeting_id", minute.meeting_id);
    if (resolutionsError) throw resolutionsError;

    return {
      tenantId: archiveOptions.tenantId ?? input.tenantId ?? minute.tenant_id ?? null,
      agreementIds: uniqueNonEmpty((resolutions ?? []).map((resolution) => resolution.agreement_id)),
    };
  }

  if (input.kind === "ACUERDO_SIN_SESION") {
    const { data, error } = await supabase
      .from("agreements")
      .select("id, tenant_id")
      .eq("no_session_resolution_id", input.recordId);
    if (error) throw error;

    const rows = (data ?? []) as Array<{ id: string; tenant_id: string | null }>;
    return {
      tenantId: archiveOptions.tenantId ?? input.tenantId ?? rows[0]?.tenant_id ?? null,
      agreementIds: uniqueNonEmpty(rows.map((row) => row.id)),
      skippedReason: rows.length === 0 ? "agreement_context_not_available" : undefined,
    };
  }

  if (input.kind === "DECISION_UNIPERSONAL") {
    const { data, error } = await supabase
      .from("agreements")
      .select("id, tenant_id")
      .eq("unipersonal_decision_id", input.recordId);
    if (error) throw error;

    const rows = (data ?? []) as Array<{ id: string; tenant_id: string | null }>;
    return {
      tenantId: archiveOptions.tenantId ?? input.tenantId ?? rows[0]?.tenant_id ?? null,
      agreementIds: uniqueNonEmpty(rows.map((row) => row.id)),
      skippedReason: rows.length === 0 ? "agreement_context_not_available" : undefined,
    };
  }

  if (input.kind === "DOCUMENTO_REGISTRAL" || input.kind === "SUBSANACION_REGISTRAL") {
    const { data, error } = await supabase
      .from("agreements")
      .select("id, tenant_id")
      .eq("id", input.recordId)
      .maybeSingle();
    if (error) throw error;

    return {
      tenantId: archiveOptions.tenantId ?? input.tenantId ?? data?.tenant_id ?? null,
      agreementIds: data?.id ? [data.id] : [],
      skippedReason: data?.id ? undefined : "agreement_context_not_available",
    };
  }

  return {
    tenantId: archiveOptions.tenantId ?? input.tenantId ?? null,
    agreementIds: [],
    skippedReason: "agreement_context_not_available",
  };
}

export async function archiveProcessDocx(params: {
  input: ProcessDocumentGenerationInput;
  buffer: Uint8Array;
  filename: string;
  contentHash: string;
  template: PlantillaProtegidaRow | null;
}): Promise<ProcessDocumentArchiveResult> {
  if (params.input.archive === false || params.input.archive?.enabled === false) {
    return {
      attempted: false,
      archived: false,
      reused: false,
      skippedReason: "archive_disabled",
      documentUrls: [],
      evidenceBundleIds: [],
      attachmentIds: [],
      agreementIds: [],
      errors: [],
    };
  }

  if (
    params.input.kind === "CONVOCATORIA" ||
    params.input.kind === "INFORME_PRECEPTIVO" ||
    params.input.kind === "INFORME_DOCUMENTAL_PRE"
  ) {
    return archiveConvocatoriaDocx(params);
  }

  const resolved = await resolveAgreementIdsForProcess(params.input);
  if (!resolved.tenantId) {
    return {
      attempted: false,
      archived: false,
      reused: false,
      skippedReason: "tenant_context_not_available",
      documentUrls: [],
      evidenceBundleIds: [],
      attachmentIds: [],
      agreementIds: resolved.agreementIds,
      errors: [],
    };
  }

  if (resolved.agreementIds.length === 0) {
    return {
      attempted: false,
      archived: false,
      reused: false,
      skippedReason: resolved.skippedReason ?? "agreement_context_not_available",
      documentUrls: [],
      evidenceBundleIds: [],
      attachmentIds: [],
      agreementIds: [],
      errors: [],
    };
  }

  const filenameWithoutExtension = params.filename.replace(/\.docx$/i, "");
  const archiveTimestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const archiveFilename = `${filenameWithoutExtension}_${archiveTimestamp}_${params.contentHash.slice(0, 12)}`;
  const documentUrls: string[] = [];
  const evidenceBundleIds: string[] = [];
  const errors: string[] = [];
  let reused = false;

  for (const agreementId of resolved.agreementIds) {
    const result = await archiveDocxToStorage(
      toExactArrayBuffer(params.buffer),
      agreementId,
      archiveFilename,
      resolved.tenantId,
      {
        processKind: params.input.kind,
        recordId: params.input.recordId,
        templateId: params.template?.id ?? null,
        templateTipo: params.template?.tipo ?? params.input.kind,
        templateVersion: params.template?.version ?? "system",
        contentHash: params.contentHash,
        signedBy: params.input.archive && typeof params.input.archive === "object" ? params.input.archive.signedBy : undefined,
      },
    );

    if (result.ok) {
      if (result.documentUrl) documentUrls.push(result.documentUrl);
      if (result.evidenceBundleId) evidenceBundleIds.push(result.evidenceBundleId);
      if (result.reused) reused = true;
      if (result.error) errors.push(`${agreementId}: ${result.error}`);
    } else {
      errors.push(`${agreementId}: ${result.error ?? "Error desconocido"}`);
    }
  }

  return {
    attempted: true,
    archived: evidenceBundleIds.length > 0,
    reused,
    skippedReason: evidenceBundleIds.length > 0 ? undefined : "archive_failed",
    documentUrls,
    evidenceBundleIds,
    attachmentIds: [],
    agreementIds: resolved.agreementIds,
    errors,
  };
}

async function archiveConvocatoriaDocx(params: {
  input: ProcessDocumentGenerationInput;
  buffer: Uint8Array;
  filename: string;
  contentHash: string;
  template: PlantillaProtegidaRow | null;
}): Promise<ProcessDocumentArchiveResult> {
  const archiveOptions = params.input.archive && typeof params.input.archive === "object" ? params.input.archive : {};
  const tenantId = archiveOptions.tenantId ?? params.input.tenantId ?? null;
  if (!tenantId) {
    return {
      attempted: false,
      archived: false,
      reused: false,
      skippedReason: "tenant_context_not_available",
      documentUrls: [],
      evidenceBundleIds: [],
      attachmentIds: [],
      agreementIds: [],
      errors: [],
    };
  }

  const filenameWithoutExtension = params.filename.replace(/\.docx$/i, "");
  const archiveTimestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const archiveFilename = `${filenameWithoutExtension}_${archiveTimestamp}_${params.contentHash.slice(0, 12)}.docx`;
  const storagePath = `convocatorias/${params.input.recordId}/${archiveFilename}`;
  const buffer = toExactArrayBuffer(params.buffer);
  const { error: uploadError } = await supabase.storage
    .from("matter-documents")
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });

  if (uploadError) {
    return {
      attempted: true,
      archived: false,
      reused: false,
      skippedReason: "archive_failed",
      documentUrls: [],
      evidenceBundleIds: [],
      attachmentIds: [],
      agreementIds: [],
      errors: [`Upload fallido: ${uploadError.message}`],
    };
  }

  // F3.G3: getPublicUrl removed — bucket matter-documents es privado. La URL
  // legacy publicUrl devolvía 403 al accederla. Sentinel mantiene compat con
  // UI legacy que comprueba `if (document_url)`. Acceso real vía Edge
  // Function sign-evidence-url (hook useEvidenceBundleSignedUrl).
  const publicUrl = `evidence-bundle://${storagePath}`;
  if (!publicUrl) {
    return {
      attempted: true,
      archived: false,
      reused: false,
      skippedReason: "archive_failed",
      documentUrls: [],
      evidenceBundleIds: [],
      attachmentIds: [],
      agreementIds: [],
      errors: ["No se pudo obtener URL pública del documento"],
    };
  }

  const { data: attachment, error: insertError } = await supabase
    .from("attachments")
    .insert({
      tenant_id: tenantId,
      convocatoria_id: params.input.recordId,
      agenda_item_index: null,
      file_name: params.filename,
      file_url: publicUrl,
      file_hash: params.contentHash,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !attachment?.id) {
    return {
      attempted: true,
      archived: false,
      reused: false,
      skippedReason: "archive_failed",
      documentUrls: [publicUrl],
      evidenceBundleIds: [],
      attachmentIds: [],
      agreementIds: [],
      errors: [insertError ? `Adjunto no creado: ${insertError.message}` : "Adjunto no creado"],
    };
  }

  return {
    attempted: true,
    archived: true,
    reused: false,
    documentUrls: [publicUrl],
    evidenceBundleIds: [],
    attachmentIds: [attachment.id],
    agreementIds: [],
    errors: [],
  };
}

export async function persistProcessArchiveLink(
  input: ProcessDocumentGenerationInput,
  archive: ProcessDocumentArchiveResult,
) {
  if (!archive.archived) return;

  if (input.kind === "CERTIFICACION" && archive.evidenceBundleIds[0]) {
    await supabase
      .from("certifications")
      .update({ evidence_id: archive.evidenceBundleIds[0] })
      .eq("id", input.recordId);
  }

  if (!archive.documentUrls[0] || archive.agreementIds.length === 0) return;

  const writesAgreementDocumentUrl: ProcessDocumentKind[] = [
    "ACUERDO_SIN_SESION",
    "DECISION_UNIPERSONAL",
    "DOCUMENTO_REGISTRAL",
    "SUBSANACION_REGISTRAL",
    "CERTIFICACION",
  ];
  if (!writesAgreementDocumentUrl.includes(input.kind)) return;

  await supabase
    .from("agreements")
    .update({ document_url: archive.documentUrls[0] })
    .in("id", archive.agreementIds);
}

export async function generateProcessDocx(
  input: ProcessDocumentGenerationInput,
): Promise<ProcessDocumentGenerationResult> {
  const templateCriteria = inferProcessTemplateCriteria(input);
  const templateSelection = resolveProcessTemplateSelection(
    input.plantillas,
    input.templateTypes,
    templateCriteria,
    input.preferredTemplateId,
  );
  const plantilla = templateSelection.selected;
  const capa3Values = input.capa3Values ?? {};
  const variables = expandLegalStructuredVariables(mergeVariables(input.variables ?? {}, capa3Values));

  let renderedText = input.fallbackText;
  let unresolvedVariables: string[] = [];
  let usedFallback = true;

  if (plantilla?.capa1_inmutable) {
    const rendered = renderTemplate({
      template: plantilla.capa1_inmutable,
      variables,
    });

    if (rendered.ok && rendered.text.trim().length > 0) {
      const requiredVariables = requiredTemplateVariables(plantilla);
      const blockingVariables = rendered.unresolvedVariables.filter((varName) =>
        variableIsRequired(varName, requiredVariables)
      );
      if (blockingVariables.length > 0) {
        throw new DocumentPreflightError(
          `Faltan variables obligatorias para generar ${plantilla.tipo}.`,
          blockingVariables,
          rendered.unresolvedVariables,
        );
      }
      renderedText = rendered.text;
      unresolvedVariables = rendered.unresolvedVariables;
      usedFallback = false;
    } else if (!rendered.ok) {
      throw new Error(rendered.error || "Error al renderizar la plantilla.");
    }
  }

  // BATCH 14 (ronda 2 U-E) + corrección post-revisión adversarial:
  // El documento DOCX final contiene SOLO el body legal. La trazabilidad
  // (Request ID, hashes, plantilla, evidence_status) se mantiene como
  // metadata externa via evidence_bundles + audit_log.
  //
  // Inicialmente B14 calculaba `contentHash = SHA(tracedText)` (body+trace)
  // mientras el DOCX se generaba con `renderedText` (body limpio) — los
  // hashes registrados en evidence_bundles.manifest.contentHash NO
  // coincidían con el hash real del archivo DOCX archivado, rompiendo
  // verificación de integridad.
  //
  // Fix: contentHash se calcula sobre el MISMO texto que se inyecta en el
  // DOCX (`renderedText` body limpio). El `withTraceFooter` se conserva
  // para retrocompatibilidad de la firma pero NO se usa en el hash.
  const tracedText = withTraceFooter(renderedText, input, plantilla, variables);
  const contentHash = await computeContentHash(renderedText);
  const buffer = await generateDocx({
    renderedText: renderedText,
    title: input.title,
    subtitle: input.subtitle,
    templateTipo: plantilla?.tipo ?? input.kind,
    templateVersion: plantilla?.version ?? "system",
    contentHash,
    entityName: input.entityName ?? undefined,
    generatedAt: new Date().toISOString().split("T")[0],
    editableFields: templateEditableFields(plantilla, capa3Values),
  });

  const filename = `${normalizeFilenamePart(input.filenamePrefix ?? input.kind)}_${input.recordId.slice(0, 8)}_${new Date().toISOString().split("T")[0]}.docx`;
  const archive = await archiveProcessDocx({
    input,
    buffer,
    filename,
    contentHash,
    template: plantilla,
  }).catch((error): ProcessDocumentArchiveResult => ({
    attempted: true,
    archived: false,
    skippedReason: "archive_failed",
    documentUrls: [],
    evidenceBundleIds: [],
    attachmentIds: [],
    agreementIds: [],
    errors: [error instanceof Error ? error.message : String(error)],
  }));

  await persistProcessArchiveLink(input, archive).catch(() => undefined);

  downloadDocx(buffer, filename);
  const agreementTrace = buildProcessAgreementTrace(input, variables);
  const evidencePosture = resolveDocumentEvidencePosture(agreementTrace, archive);
  const finalEvidenceReadiness = resolveProcessDocumentFinalEvidenceReadiness({
    agreementTrace,
    evidencePosture,
    archive,
    contentHash,
  });

  return {
    filename,
    contentHash,
    templateId: plantilla?.id ?? null,
    templateTipo: plantilla?.tipo ?? input.kind,
    templateVersion: plantilla?.version ?? "system",
    templateSelectionReason: templateSelection.selectionReason,
    templateSelectionWarnings: templateSelection.warnings,
    templateSelectionBlockingIssues: templateSelection.blockingIssues,
    usedFallback,
    unresolvedVariables,
    archive,
    agreementTrace,
    evidencePosture,
    finalEvidenceReadiness,
  };
}
