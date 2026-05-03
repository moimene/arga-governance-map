import { supabase } from "@/integrations/supabase/client";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import {
  assertSecretariaDocumentGenerationRequestReady,
  type SecretariaDocumentGenerationRequest,
  type SecretariaDocumentType,
} from "@/lib/secretaria/document-generation-boundary";
import { normalizeCapa3Draft, normalizeCapa3Fields } from "@/lib/secretaria/capa3-fields";
import { expandLegalStructuredVariables } from "@/lib/secretaria/legal-template-normalizer";
import { renderTemplate } from "@/lib/doc-gen/template-renderer";
import {
  mergeVariables,
  resolveVariables,
  type ResolverContext,
} from "@/lib/doc-gen/variable-resolver";
import type { Capa2Variable } from "@/lib/doc-gen/variable-resolver";
import { computeContentHash, generateDocx } from "@/lib/doc-gen/docx-generator";
import type { EditableField } from "@/lib/doc-gen/docx-generator";
import { archiveDocxToStorage } from "@/lib/doc-gen/storage-archiver";
import { selectProcessTemplate } from "@/lib/doc-gen/process-documents";
import {
  isOperationalTemplate,
  OPERATIONAL_TEMPLATE_QUERY_STATES,
} from "@/lib/doc-gen/template-operability";
import { validatePostRenderDocument } from "./post-render-validation";
import type {
  ComposeDocumentOptions,
  ComposeDocumentResult,
  GeneratedDocumentArtifact,
  MotorPlantillasArchiveResult,
  PreparedDocumentComposition,
} from "./types";

export function templateTypesForDocumentType(documentType: SecretariaDocumentType): string[] {
  switch (documentType) {
    case "CONVOCATORIA":
      return ["CONVOCATORIA", "CONVOCATORIA_SL_NOTIFICACION"];
    case "ACTA":
      return [
        "ACTA_SESION",
        "ACTA_CONSIGNACION",
        "ACTA_ACUERDO_ESCRITO",
        "ACTA_DECISION_CONJUNTA",
        "ACTA_ORGANO_ADMIN",
        "INFORME_GESTION",
      ];
    case "CERTIFICACION":
      return ["CERTIFICACION"];
    case "INFORME_PRECEPTIVO":
      return ["INFORME_PRECEPTIVO"];
    case "INFORME_DOCUMENTAL_PRE":
      return ["INFORME_DOCUMENTAL_PRE"];
    case "ACUERDO_SIN_SESION":
      return ["ACTA_ACUERDO_ESCRITO", "ACTA_DECISION_CONJUNTA", "ACTA_ORGANO_ADMIN"];
    case "DECISION_UNIPERSONAL":
      return ["ACTA_CONSIGNACION"];
    case "DOCUMENTO_REGISTRAL":
      return ["DOCUMENTO_REGISTRAL", "MODELO_ACUERDO"];
    case "SUBSANACION_REGISTRAL":
      return ["SUBSANACION_REGISTRAL"];
    default:
      return [documentType];
  }
}

function toFilenamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function toExactArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function titleFromRenderedText(renderedText: string, fallback: string) {
  return renderedText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? fallback;
}

function traceFooter(req: SecretariaDocumentGenerationRequest, template: PlantillaProtegidaRow) {
  return [
    "",
    "TRAZABILIDAD DOCUMENTAL",
    `Request ID: ${req.request_id}`,
    `Request hash SHA-256: ${req.request_hash_sha256}`,
    `Evidence status: ${req.evidence_status}`,
    `Generation lane: ${req.generation_lane}`,
    `Plantilla: ${template.tipo} v${template.version}`,
    `Agreement IDs: ${req.agreement_ids.length > 0 ? req.agreement_ids.join(", ") : "N/A"}`,
  ].join("\n");
}

function appendTraceFooter(bodyText: string, req: SecretariaDocumentGenerationRequest, template: PlantillaProtegidaRow) {
  return `${bodyText.trim()}${traceFooter(req, template)}`;
}

function capa3Issues(
  fields: ReturnType<typeof normalizeCapa3Fields>,
  values: Record<string, string>,
) {
  return fields
    .filter((field) => field.obligatoriedad === "OBLIGATORIO" && !values[field.campo]?.trim())
    .map((field) => ({
      code: "CAPA3_REQUIRED_MISSING",
      severity: "BLOCKING" as const,
      field_path: `capa3.${field.campo}`,
      message: `${field.descripcion || field.campo}: campo obligatorio.`,
    }));
}

function buildEditableFields(
  fields: ReturnType<typeof normalizeCapa3Fields>,
  values: Record<string, string>,
): EditableField[] | undefined {
  const editable = fields.map((field) => ({
    key: field.campo,
    label: field.descripcion || field.campo,
    value: values[field.campo] || undefined,
  }));
  return editable.length > 0 ? editable : undefined;
}

async function loadTemplateByRequest(
  req: SecretariaDocumentGenerationRequest,
  options: ComposeDocumentOptions,
): Promise<PlantillaProtegidaRow> {
  if (options.plantilla) return options.plantilla;

  const templateTypes = templateTypesForDocumentType(req.document_type);
  const criteria = {
    jurisdiction: null,
    materia: null,
    adoptionMode: req.expected_adoption_mode ?? null,
    organoTipo: req.expected_organo_tipo ?? null,
  };

  if (options.plantillas) {
    const byId = req.template_id
      ? options.plantillas.find((template) => template.id === req.template_id)
      : null;
    const selected =
      byId ??
      selectProcessTemplate(
        options.plantillas,
        req.template_profile_id
          ? [req.template_profile_id, ...templateTypes]
          : templateTypes,
        criteria,
        req.template_id,
      );
    if (selected && isOperationalTemplate(selected)) return selected;
    throw new Error("No hay plantilla utilizable para el request documental.");
  }

  if (req.template_id) {
    const { data, error } = await supabase
      .from("plantillas_protegidas")
      .select("*")
      .eq("id", req.template_id)
      .eq("tenant_id", req.tenant_id)
      .maybeSingle();
    if (error) throw error;
    if (data && isOperationalTemplate(data as PlantillaProtegidaRow)) {
      return data as PlantillaProtegidaRow;
    }
  }

  const { data, error } = await supabase
    .from("plantillas_protegidas")
    .select("*")
    .eq("tenant_id", req.tenant_id)
    .in("estado", [...OPERATIONAL_TEMPLATE_QUERY_STATES]);
  if (error) throw error;

  const selected = selectProcessTemplate(
    (data ?? []) as PlantillaProtegidaRow[],
    req.template_profile_id
      ? [req.template_profile_id, ...templateTypes]
      : templateTypes,
    criteria,
    req.template_id,
  );
  if (!selected) throw new Error("No hay plantilla utilizable para el request documental.");
  return selected;
}

async function contextFromBody(
  tenantId: string,
  bodyId?: string | null,
): Promise<Pick<ResolverContext, "bodyId" | "entityId">> {
  if (!bodyId) return {};
  const { data } = await supabase
    .from("governing_bodies")
    .select("id, entity_id")
    .eq("id", bodyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const body = data as { id: string; entity_id?: string | null } | null;
  return {
    bodyId: body?.id ?? bodyId,
    entityId: body?.entity_id ?? undefined,
  };
}

async function buildResolverContextForRequest(
  req: SecretariaDocumentGenerationRequest,
  options: ComposeDocumentOptions,
): Promise<ResolverContext> {
  if (options.resolverContext) {
    return {
      ...options.resolverContext,
      now: options.now ?? options.resolverContext.now,
    };
  }

  const agreementId = req.agreement_ids[0] ?? "";
  if (agreementId) {
    const { data } = await supabase
      .from("agreements")
      .select("id, entity_id, body_id, parent_meeting_id, compliance_snapshot")
      .eq("tenant_id", req.tenant_id)
      .eq("id", agreementId)
      .maybeSingle();
    const agreement = data as {
      id: string;
      entity_id?: string | null;
      body_id?: string | null;
      parent_meeting_id?: string | null;
      compliance_snapshot?: Record<string, unknown> | null;
    } | null;
    if (agreement) {
      return {
        agreementId,
        tenantId: req.tenant_id,
        entityId: agreement.entity_id ?? req.entity_id ?? undefined,
        bodyId: agreement.body_id ?? undefined,
        meetingId: req.meeting_id ?? agreement.parent_meeting_id ?? undefined,
        complianceSnapshot: agreement.compliance_snapshot ?? undefined,
        now: options.now,
      };
    }
  }

  if (req.meeting_id) {
    const { data } = await supabase
      .from("meetings")
      .select("id, body_id, quorum_data")
      .eq("tenant_id", req.tenant_id)
      .eq("id", req.meeting_id)
      .maybeSingle();
    const meeting = data as { id: string; body_id?: string | null; quorum_data?: Record<string, unknown> | null } | null;
    const bodyContext = await contextFromBody(req.tenant_id, meeting?.body_id);
    return {
      agreementId,
      tenantId: req.tenant_id,
      entityId: req.entity_id ?? bodyContext.entityId,
      bodyId: bodyContext.bodyId,
      meetingId: req.meeting_id,
      complianceSnapshot: meeting?.quorum_data ?? undefined,
      now: options.now,
    };
  }

  if (req.convocatoria_id) {
    const { data } = await supabase
      .from("convocatorias")
      .select("id, body_id")
      .eq("tenant_id", req.tenant_id)
      .eq("id", req.convocatoria_id)
      .maybeSingle();
    const convocatoria = data as { id: string; body_id?: string | null } | null;
    const bodyContext = await contextFromBody(req.tenant_id, convocatoria?.body_id);
    return {
      agreementId,
      tenantId: req.tenant_id,
      entityId: req.entity_id ?? bodyContext.entityId,
      bodyId: bodyContext.bodyId,
      now: options.now,
    };
  }

  return {
    agreementId,
    tenantId: req.tenant_id,
    entityId: req.entity_id ?? undefined,
    meetingId: req.meeting_id ?? undefined,
    now: options.now,
  };
}

function filenameFor(
  req: SecretariaDocumentGenerationRequest,
  template: PlantillaProtegidaRow,
  options: ComposeDocumentOptions,
) {
  const prefix = options.filenamePrefix ?? template.tipo ?? req.document_type;
  const recordId =
    req.agreement_ids[0] ??
    req.convocatoria_id ??
    req.meeting_id ??
    req.minute_id ??
    req.certification_id ??
    req.tramitador_id ??
    req.request_id;
  const datePart = (options.generatedAt ?? new Date().toISOString()).split("T")[0];
  return `${toFilenamePart(prefix)}_${recordId.slice(0, 8)}_${datePart}.docx`;
}

export async function prepareDocumentComposition(
  req: SecretariaDocumentGenerationRequest,
  capa3Values: Record<string, unknown> = {},
  options: ComposeDocumentOptions = {},
): Promise<PreparedDocumentComposition> {
  await assertSecretariaDocumentGenerationRequestReady(req);
  const template = await loadTemplateByRequest(req, options);
  if (!template.capa1_inmutable?.trim()) {
    throw new Error(`Plantilla ${template.id} sin capa1_inmutable.`);
  }

  const resolverContext = await buildResolverContextForRequest(req, options);
  const capa2 =
    options.resolveCapa2 === false
      ? { values: {}, resolved: [], unresolved: [], errors: [] }
      : await resolveVariables(
          (template.capa2_variables ?? []) as Capa2Variable[],
          resolverContext,
        );

  const fields = normalizeCapa3Fields(template.capa3_editables);
  const normalizedCapa3 = normalizeCapa3Draft(fields, capa3Values).values;
  const requiredCapa3Issues = capa3Issues(fields, normalizedCapa3);
  if (requiredCapa3Issues.length > 0) {
    const error = new Error(
      `Capa 3 incompleta: ${requiredCapa3Issues.map((issue) => issue.field_path).join(", ")}`,
    );
    (error as Error & { issues?: typeof requiredCapa3Issues }).issues = requiredCapa3Issues;
    throw error;
  }

  const mergedVariables = expandLegalStructuredVariables(
    mergeVariables(
      {
        ...(options.baseVariables ?? {}),
        ...capa2.values,
      },
      normalizedCapa3,
    ),
  );

  const rendered = renderTemplate({
    template: template.capa1_inmutable,
    variables: mergedVariables,
  });
  if (!rendered.ok) {
    throw new Error(rendered.error || "Error al renderizar la plantilla.");
  }

  const renderedBodyText = rendered.text.trim();
  const systemTraceText = traceFooter(req, template);
  const renderedWithTrace = `${renderedBodyText}${systemTraceText}`;
  const postRenderValidation = validatePostRenderDocument({
    documentType: req.document_type,
    renderedText: renderedWithTrace,
    capa1Template: template.capa1_inmutable,
    agreementIds: req.agreement_ids,
    unresolvedVariables: rendered.unresolvedVariables,
  });
  if (!postRenderValidation.ok) {
    const blocking = postRenderValidation.issues.filter((issue) => issue.severity === "BLOCKING");
    throw new Error(
      `Post-render validation blocked: ${blocking.map((issue) => `${issue.code}@${issue.field_path}`).join(", ")}`,
    );
  }

  return {
    request: req,
    template,
    templateTypes: templateTypesForDocumentType(req.document_type),
    resolverContext,
    capa2,
    capa3Values: normalizedCapa3,
    mergedVariables,
    renderedBodyText,
    systemTraceText,
    renderedText: renderedWithTrace,
    unresolvedVariables: rendered.unresolvedVariables,
    postRenderValidation,
    title: options.title ?? titleFromRenderedText(rendered.text, template.tipo),
    filename: filenameFor(req, template, options),
  };
}

async function archivePreparedDocument(
  prepared: PreparedDocumentComposition,
  buffer: Uint8Array,
  contentHash: string,
  options: ComposeDocumentOptions,
): Promise<MotorPlantillasArchiveResult> {
  if (options.archiveDraft !== true) {
    return {
      attempted: false,
      archived: false,
      skippedReason: "archive_disabled",
    };
  }

  const agreementId = prepared.request.agreement_ids[0];
  if (!agreementId) {
    return {
      attempted: false,
      archived: false,
      skippedReason: "agreement_context_not_available",
    };
  }
  if (!prepared.request.tenant_id) {
    return {
      attempted: false,
      archived: false,
      skippedReason: "tenant_context_not_available",
    };
  }

  const archive =
    options.archiveAdapter ??
    ((params) =>
      archiveDocxToStorage(
        params.buffer,
        params.agreementId,
        params.filename,
        params.tenantId,
        params.metadata,
      ));
  const archiveFilename = prepared.filename.replace(/\.docx$/i, "");
  const result = await archive({
    buffer: toExactArrayBuffer(buffer),
    agreementId,
    filename: archiveFilename,
    tenantId: prepared.request.tenant_id,
    metadata: {
      processKind: prepared.request.document_type,
      evidenceStatus: "DEMO_OPERATIVA",
      recordId: agreementId,
      templateId: prepared.template.id,
      templateTipo: prepared.template.tipo,
      templateVersion: prepared.template.version,
      contentHash,
      signedBy: "SISTEMA",
      archivedBufferKind: "ORIGINAL_DOCX",
    },
  });

  return {
    attempted: true,
    archived: result.ok,
    skippedReason: result.ok ? undefined : "archive_failed",
    documentUrl: result.documentUrl ?? null,
    evidenceBundleId: result.evidenceBundleId ?? null,
    hash512: result.hash512 ?? null,
    error: result.error ?? null,
  };
}

function buildGeneratedDocumentArtifact(
  prepared: PreparedDocumentComposition,
  buffer: Uint8Array,
  contentHash: string,
  options: ComposeDocumentOptions,
): GeneratedDocumentArtifact {
  return {
    documentId: `${prepared.request.request_id}:${contentHash.slice(0, 16)}`,
    filename: prepared.filename,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer,
    renderedText: prepared.renderedText,
    contentHash,
    templateId: prepared.template.id,
    templateTipo: prepared.template.tipo,
    templateVersion: prepared.template.version,
    evidenceStatus: "DEMO_OPERATIVA",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    status: "GENERATED",
  };
}

async function buildComposeResultFromPrepared(
  prepared: PreparedDocumentComposition,
  options: ComposeDocumentOptions = {},
  includeEditableFields = true,
): Promise<ComposeDocumentResult> {
  const contentHash = await computeContentHash(prepared.renderedText);
  const buffer = await generateDocx({
    renderedText: prepared.renderedText,
    title: prepared.title,
    subtitle: options.subtitle,
    templateTipo: prepared.template.tipo,
    templateVersion: prepared.template.version,
    contentHash,
    entityName:
      options.entityName ??
      (typeof prepared.mergedVariables.denominacion_social === "string"
        ? prepared.mergedVariables.denominacion_social
        : undefined),
    generatedAt: options.generatedAt ?? new Date().toISOString().split("T")[0],
    editableFields: includeEditableFields
      ? buildEditableFields(
          normalizeCapa3Fields(prepared.template.capa3_editables),
          prepared.capa3Values,
        )
      : undefined,
  });
  const document = buildGeneratedDocumentArtifact(prepared, buffer, contentHash, options);
  const archive = await archivePreparedDocument(prepared, buffer, contentHash, options);

  return {
    ...prepared,
    contentHash,
    docxBuffer: buffer,
    document,
    archive,
  };
}

export async function finalizeEditableDocumentDraft(
  prepared: PreparedDocumentComposition,
  editedBodyText: string,
  options: ComposeDocumentOptions = {},
): Promise<ComposeDocumentResult> {
  const renderedBodyText = editedBodyText.trim();
  if (!renderedBodyText) {
    throw new Error("El borrador editable esta vacio.");
  }

  const renderedText = appendTraceFooter(renderedBodyText, prepared.request, prepared.template);
  const postRenderValidation = validatePostRenderDocument({
    documentType: prepared.request.document_type,
    renderedText,
    capa1Template: prepared.template.capa1_inmutable,
    agreementIds: prepared.request.agreement_ids,
    unresolvedVariables: prepared.unresolvedVariables,
  });
  if (!postRenderValidation.ok) {
    const blocking = postRenderValidation.issues.filter((issue) => issue.severity === "BLOCKING");
    throw new Error(
      `Post-render validation blocked: ${blocking.map((issue) => `${issue.code}@${issue.field_path}`).join(", ")}`,
    );
  }

  const reviewedPrepared: PreparedDocumentComposition = {
    ...prepared,
    renderedBodyText,
    systemTraceText: traceFooter(prepared.request, prepared.template),
    renderedText,
    postRenderValidation,
    title: options.title ?? titleFromRenderedText(renderedBodyText, prepared.template.tipo),
  };

  return buildComposeResultFromPrepared(reviewedPrepared, options, false);
}

export async function composeDocument(
  req: SecretariaDocumentGenerationRequest,
  capa3Values: Record<string, unknown> = {},
  options: ComposeDocumentOptions = {},
): Promise<ComposeDocumentResult> {
  const prepared = await prepareDocumentComposition(req, capa3Values, options);
  return buildComposeResultFromPrepared(prepared, options, true);
}
