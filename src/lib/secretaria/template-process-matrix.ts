import type { ProcessDocumentKind } from "@/lib/doc-gen/process-documents";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import {
  buildInitialCapa3Values,
  isRequiredCapa3Field,
  normalizeCapa3Draft,
  normalizeCapa3Fields,
  type NormalizedCapa3Draft,
  type NormalizedCapa3Field,
} from "./capa3-fields";

export type TemplateProcessId =
  | "convocatoria"
  | "tramitador_acuerdo"
  | "acta"
  | "certificacion"
  | "decision_unipersonal"
  | "acuerdo_sin_sesion"
  | "tramitador_registral"
  | "informe_pre";

export type TemplateVariableSource = "capa3" | "template" | "derived";
export type TemplateSource = "cloud" | "fixture";
export type PreTemplateKind = "INFORME_PRECEPTIVO" | "INFORME_DOCUMENTAL_PRE";
export type PreTemplateParityStatus =
  | "CLOUD_ACTIVE"
  | "CLOUD_ACTIVE_WITH_WARNINGS"
  | "CLOUD_MISSING"
  | "CLOUD_NOT_APPROVED"
  | "FIXTURE_ONLY"
  | "INPUTS_INCOMPLETE"
  | "NOT_PRE";

export interface TemplateVariableSpec {
  variable: string;
  source: TemplateVariableSource;
  required?: boolean;
  from?: string;
  fallback?: unknown;
}

export interface TemplateProcessMatrixEntry {
  key: string;
  processId: TemplateProcessId;
  templateTypes: string[];
  adoptionModes?: string[];
  documentKinds: ProcessDocumentKind[];
  variables: TemplateVariableSpec[];
}

export interface TemplateProcessContext {
  processHint?: TemplateProcessId | ProcessDocumentKind | string | null;
  variables?: Record<string, unknown> | null;
  derived?: Record<string, unknown> | null;
  capa3Values?: Record<string, unknown> | null;
}

export interface TemplateProcessResolution {
  entry: TemplateProcessMatrixEntry;
  templateId: string;
  templateSource: TemplateSource;
  processId: TemplateProcessId;
  documentKinds: ProcessDocumentKind[];
  capa3Fields: NormalizedCapa3Field[];
  capa3Draft: NormalizedCapa3Draft;
  initialCapa3Values: Record<string, string>;
  variables: Record<string, unknown>;
  sources: Record<string, TemplateVariableSource>;
  missingRequired: string[];
}

export interface PreTemplateParityContract {
  kind: PreTemplateKind | null;
  expectedTemplateId?: string | null;
  templateId: string | null;
  templateSource: TemplateSource | "none";
  status: PreTemplateParityStatus;
  canGenerate: boolean;
  canClaimLegalTemplate: boolean;
  canClaimFinalEvidence: false;
  missingRequired: string[];
  warnings: string[];
}

export interface TemplateTraceEvidence {
  schema_version: "secretaria-template-flow-trace.v1";
  template: {
    id: string | null;
    tipo: string | null;
    nombre: string | null;
    materia: string | null;
    version: string | null;
    estado: string | null;
    source: TemplateSource | "none";
    source_of_truth: "cloud" | "fixture_fallback_non_persistent" | "none";
    fixture_fallback_used: boolean;
    fixture_persisted_as_source_of_truth: false;
    contrato_variables_version: string | null;
    snapshot_rule_pack_required: boolean | null;
  };
  process: {
    id: TemplateProcessId | null;
    matrix_key: string | null;
    document_kinds: ProcessDocumentKind[];
  };
  variables: {
    resolved: Record<string, unknown>;
    sources: Record<string, TemplateVariableSource>;
    missing_required: string[];
  };
  capa3: {
    normalized_values: Record<string, string>;
    empty_keys: string[];
    ignored_keys: string[];
    legacy_key_map: Record<string, string>;
  };
  pre_parity: PreTemplateParityContract;
  evidence: {
    posture: "GENERATED_TRACE_ONLY";
    storage_ref: null;
    evidence_bundle_id: null;
  };
}

export const CLOUD_PRE_TEMPLATE_IDS: Record<PreTemplateKind, string> = {
  INFORME_PRECEPTIVO: "b2b3b741-d2d6-4c8a-bb00-7b519854d39e",
  INFORME_DOCUMENTAL_PRE: "d6c6fa3e-8c5c-417a-8cbb-0f5b681375d3",
};

const MATRIX: TemplateProcessMatrixEntry[] = [
  {
    key: "modelo-acuerdo",
    processId: "tramitador_acuerdo",
    templateTypes: ["MODELO_ACUERDO"],
    documentKinds: ["DOCUMENTO_REGISTRAL"],
    variables: [
      { variable: "materia_acuerdo", source: "template", from: "materia_acuerdo", required: true },
      { variable: "modo_adopcion", source: "template", from: "adoption_mode" },
      { variable: "estado_acuerdo", source: "derived", from: "estado_acuerdo" },
    ],
  },
  {
    key: "convocatoria",
    processId: "convocatoria",
    templateTypes: ["CONVOCATORIA", "CONVOCATORIA_SL_NOTIFICACION"],
    documentKinds: ["CONVOCATORIA", "INFORME_PRECEPTIVO", "INFORME_DOCUMENTAL_PRE"],
    variables: [
      { variable: "denominacion_social", source: "derived", required: true },
      { variable: "organo_nombre", source: "derived" },
      { variable: "materia_acuerdo", source: "derived", required: true },
      { variable: "tipo_junta", source: "derived", from: "tipo_convocatoria" },
      { variable: "fecha_primera_convocatoria", source: "derived", from: "fecha_junta" },
      { variable: "hora_primera_convocatoria", source: "derived", from: "hora_junta" },
    ],
  },
  {
    key: "acta-unipersonal",
    processId: "decision_unipersonal",
    templateTypes: ["ACTA_CONSIGNACION"],
    adoptionModes: ["UNIPERSONAL_SOCIO", "UNIPERSONAL_ADMIN"],
    documentKinds: ["DECISION_UNIPERSONAL"],
    variables: [
      { variable: "denominacion_social", source: "derived", required: true },
      { variable: "materia_acuerdo", source: "derived" },
      { variable: "modo_adopcion", source: "template", from: "adoption_mode", required: true },
    ],
  },
  {
    key: "acta-sin-sesion",
    processId: "acuerdo_sin_sesion",
    templateTypes: ["ACTA_ACUERDO_ESCRITO"],
    adoptionModes: ["NO_SESSION"],
    documentKinds: ["ACUERDO_SIN_SESION"],
    variables: [
      { variable: "denominacion_social", source: "derived", required: true },
      { variable: "materia_acuerdo", source: "derived" },
      { variable: "modo_adopcion", source: "template", from: "adoption_mode", required: true },
    ],
  },
  {
    key: "acta-decision-conjunta",
    processId: "acuerdo_sin_sesion",
    templateTypes: ["ACTA_DECISION_CONJUNTA"],
    adoptionModes: ["CO_APROBACION"],
    documentKinds: ["ACUERDO_SIN_SESION"],
    variables: [
      { variable: "denominacion_social", source: "derived", required: true },
      { variable: "materia_acuerdo", source: "derived" },
      { variable: "modo_adopcion", source: "template", from: "adoption_mode", required: true },
      { variable: "administradores_firmantes", source: "derived" },
      { variable: "ventana_consenso", source: "derived" },
    ],
  },
  {
    key: "acta-organo-admin-solidario",
    processId: "acuerdo_sin_sesion",
    templateTypes: ["ACTA_ORGANO_ADMIN"],
    adoptionModes: ["SOLIDARIO"],
    documentKinds: ["ACUERDO_SIN_SESION"],
    variables: [
      { variable: "denominacion_social", source: "derived", required: true },
      { variable: "materia_acuerdo", source: "derived" },
      { variable: "modo_adopcion", source: "template", from: "adoption_mode", required: true },
      { variable: "administrador_actuante", source: "derived" },
      { variable: "restricciones_estatutarias", source: "derived" },
    ],
  },
  {
    key: "acta",
    processId: "acta",
    templateTypes: ["ACTA_SESION", "ACTA_CONSIGNACION", "ACTA_ACUERDO_ESCRITO", "INFORME_GESTION"],
    documentKinds: ["ACTA"],
    variables: [
      { variable: "denominacion_social", source: "derived", required: true },
      { variable: "materia_acuerdo", source: "derived" },
      { variable: "modo_adopcion", source: "template", from: "adoption_mode" },
    ],
  },
  {
    key: "certificacion",
    processId: "certificacion",
    templateTypes: ["CERTIFICACION"],
    documentKinds: ["CERTIFICACION"],
    variables: [
      { variable: "denominacion_social", source: "derived", required: true },
      { variable: "certificacion_id", source: "derived" },
      { variable: "contenido_certificacion", source: "derived" },
    ],
  },
  {
    key: "documento-registral",
    processId: "tramitador_registral",
    templateTypes: ["DOCUMENTO_REGISTRAL", "SUBSANACION_REGISTRAL"],
    documentKinds: ["DOCUMENTO_REGISTRAL", "SUBSANACION_REGISTRAL"],
    variables: [
      { variable: "denominacion_social", source: "derived", required: true },
      { variable: "materia_acuerdo", source: "derived", required: true },
      { variable: "modo_adopcion", source: "derived", from: "adoption_mode" },
      { variable: "estado_acuerdo", source: "derived" },
      { variable: "instrumento_requerido", source: "derived" },
      { variable: "tipo_presentacion", source: "derived" },
    ],
  },
  {
    key: "informe-pre",
    processId: "informe_pre",
    templateTypes: ["INFORME_PRECEPTIVO", "INFORME_DOCUMENTAL_PRE"],
    documentKinds: ["INFORME_PRECEPTIVO", "INFORME_DOCUMENTAL_PRE"],
    variables: [
      { variable: "denominacion_social", source: "derived", required: true },
      { variable: "organo_nombre", source: "derived" },
      { variable: "materia_acuerdo", source: "derived", required: true },
      { variable: "resultado_gate", source: "derived" },
      { variable: "snapshot_hash", source: "derived" },
    ],
  },
];

const TEMPLATE_METADATA: TemplateVariableSpec[] = [
  { variable: "template_id", source: "template", from: "id", required: true },
  { variable: "template_tipo", source: "template", from: "tipo", required: true },
  { variable: "template_version", source: "template", from: "version" },
  { variable: "template_estado", source: "template", from: "estado" },
  { variable: "template_jurisdiccion", source: "template", from: "jurisdiccion" },
  { variable: "template_materia", source: "template", from: "materia" },
  { variable: "template_materia_acuerdo", source: "template", from: "materia_acuerdo" },
  { variable: "template_adoption_mode", source: "template", from: "adoption_mode" },
  { variable: "template_organo_tipo", source: "template", from: "organo_tipo" },
];

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function getValue(source: Record<string, unknown>, key: string) {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function processFromDocumentKind(kind?: string | null): TemplateProcessId | null {
  if (!kind) return null;
  if (kind === "CONVOCATORIA") return "convocatoria";
  if (kind === "ACTA") return "acta";
  if (kind === "CERTIFICACION") return "certificacion";
  if (kind === "DOCUMENTO_REGISTRAL" || kind === "SUBSANACION_REGISTRAL") return "tramitador_registral";
  if (kind === "INFORME_PRECEPTIVO" || kind === "INFORME_DOCUMENTAL_PRE") return "informe_pre";
  if (kind === "ACUERDO_SIN_SESION") return "acuerdo_sin_sesion";
  if (kind === "DECISION_UNIPERSONAL") return "decision_unipersonal";
  return null;
}

export function isPreTemplateKind(value: unknown): value is PreTemplateKind {
  return value === "INFORME_PRECEPTIVO" || value === "INFORME_DOCUMENTAL_PRE";
}

function sortRecord<T>(record: Record<string, T>) {
  return Object.keys(record)
    .sort()
    .reduce<Record<string, T>>((acc, key) => {
      acc[key] = record[key];
      return acc;
    }, {});
}

export function templateSource(template: PlantillaProtegidaRow): TemplateSource {
  const protections = template.protecciones as Record<string, unknown> | null;
  return template.tenant_id === "local-legal-fixture" || protections?.source === "legal-team-fixture"
    ? "fixture"
    : "cloud";
}

export function validatePreTemplateParity(
  template: PlantillaProtegidaRow | null | undefined,
  resolution?: Pick<TemplateProcessResolution, "missingRequired"> | null,
): PreTemplateParityContract {
  if (!template) {
    return {
      kind: null,
      templateId: null,
      templateSource: "none",
      status: "CLOUD_MISSING",
      canGenerate: false,
      canClaimLegalTemplate: false,
      canClaimFinalEvidence: false,
      missingRequired: resolution?.missingRequired ?? [],
      warnings: ["No se ha resuelto una plantilla PRE."],
    };
  }

  const kind = normalizeCode(template.tipo);
  const source = templateSource(template);
  const missingRequired = resolution?.missingRequired ?? [];

  if (!isPreTemplateKind(kind)) {
    return {
      kind: null,
      templateId: template.id,
      templateSource: source,
      status: "NOT_PRE",
      canGenerate: true,
      canClaimLegalTemplate: source === "cloud",
      canClaimFinalEvidence: false,
      missingRequired,
      warnings: [],
    };
  }

  if (source === "fixture") {
    return {
      kind,
      expectedTemplateId: CLOUD_PRE_TEMPLATE_IDS[kind],
      templateId: template.id,
      templateSource: source,
      status: "FIXTURE_ONLY",
      canGenerate: true,
      canClaimLegalTemplate: false,
      canClaimFinalEvidence: false,
      missingRequired,
      warnings: ["Plantilla PRE local: no se persiste como fuente de verdad Cloud."],
    };
  }

  const warnings: string[] = [];
  const active = ["ACTIVA", "APROBADA"].includes(normalizeCode(template.estado));
  const hasLegalBody = !!template.capa1_inmutable?.trim();
  const expectedTemplateId = CLOUD_PRE_TEMPLATE_IDS[kind];

  if (template.id !== expectedTemplateId) {
    warnings.push("ID PRE compatible con Cloud, pendiente de confirmar contra el identificador canonico.");
  }
  if (!hasLegalBody) warnings.push("La plantilla PRE no tiene capa1_inmutable utilizable.");

  if (!active || !hasLegalBody) {
    return {
      kind,
      expectedTemplateId,
      templateId: template.id,
      templateSource: source,
      status: "CLOUD_NOT_APPROVED",
      canGenerate: false,
      canClaimLegalTemplate: false,
      canClaimFinalEvidence: false,
      missingRequired,
      warnings,
    };
  }

  if (missingRequired.length > 0) {
    return {
      kind,
      expectedTemplateId,
      templateId: template.id,
      templateSource: source,
      status: "INPUTS_INCOMPLETE",
      canGenerate: false,
      canClaimLegalTemplate: true,
      canClaimFinalEvidence: false,
      missingRequired,
      warnings,
    };
  }

  return {
    kind,
    expectedTemplateId,
    templateId: template.id,
    templateSource: source,
    status: warnings.length > 0 ? "CLOUD_ACTIVE_WITH_WARNINGS" : "CLOUD_ACTIVE",
    canGenerate: true,
    canClaimLegalTemplate: true,
    canClaimFinalEvidence: false,
    missingRequired,
    warnings,
  };
}

export function selectTemplateProcessEntry(
  template: PlantillaProtegidaRow,
  context: TemplateProcessContext = {},
) {
  const processHint = normalizeCode(context.processHint);
  const normalizedProcessHint = processFromDocumentKind(processHint) ?? processHint.toLowerCase();
  const templateType = normalizeCode(template.tipo);
  const mode = normalizeCode(template.adoption_mode);

  return (
    MATRIX.find((entry) =>
      entry.templateTypes.includes(templateType) &&
      (!entry.adoptionModes || entry.adoptionModes.includes(mode)) &&
      (!normalizedProcessHint || entry.processId === normalizedProcessHint || entry.documentKinds.includes(processHint as ProcessDocumentKind))
    ) ??
    MATRIX.find((entry) =>
      entry.templateTypes.includes(templateType) &&
      (!entry.adoptionModes || entry.adoptionModes.includes(mode))
    ) ??
    null
  );
}

export function templateMatchesProcess(
  template: PlantillaProtegidaRow | null | undefined,
  processHint?: TemplateProcessContext["processHint"],
) {
  if (!template) return false;
  const entry = selectTemplateProcessEntry(template, { processHint });
  if (!entry) return false;
  const hint = normalizeCode(processHint);
  const normalizedHint = processFromDocumentKind(hint) ?? hint.toLowerCase();
  if (!normalizedHint) return true;
  return entry.processId === normalizedHint || entry.documentKinds.includes(hint as ProcessDocumentKind);
}

function resolveSpec(
  spec: TemplateVariableSpec,
  template: PlantillaProtegidaRow,
  context: TemplateProcessContext,
) {
  const variables = context.variables ?? {};
  const derived = { ...variables, ...(context.derived ?? {}) };
  const capa3 = context.capa3Values ?? {};
  const key = spec.from ?? spec.variable;

  if (spec.source === "capa3") return capa3[spec.variable] ?? getValue(variables, key) ?? spec.fallback;
  if (spec.source === "template") return getValue(template as unknown as Record<string, unknown>, key) ?? spec.fallback;
  return getValue(derived, key) ?? spec.fallback;
}

export function resolveTemplateProcessMatrix(
  template: PlantillaProtegidaRow | null | undefined,
  context: TemplateProcessContext = {},
): TemplateProcessResolution | null {
  if (!template) return null;

  const entry = selectTemplateProcessEntry(template, context);
  if (!entry) return null;

  const capa3Fields = normalizeCapa3Fields(template.capa3_editables);
  const capa3Draft = normalizeCapa3Draft(capa3Fields, context.capa3Values ?? {});
  const normalizedContext = { ...context, capa3Values: capa3Draft.values };
  const specs = [
    ...TEMPLATE_METADATA,
    ...entry.variables,
    ...capa3Fields.map((field): TemplateVariableSpec => ({
      variable: field.campo,
      source: "capa3",
      required: isRequiredCapa3Field(field),
    })),
  ];
  const variables: Record<string, unknown> = {};
  const sources: Record<string, TemplateVariableSource> = {};
  const missingRequired = new Set<string>();

  for (const spec of specs) {
    const value = resolveSpec(spec, template, normalizedContext);
    if (hasValue(value)) {
      variables[spec.variable] = value;
      sources[spec.variable] = spec.source;
      missingRequired.delete(spec.variable);
    } else if (spec.required) {
      missingRequired.add(spec.variable);
      sources[spec.variable] = spec.source;
    }
  }

  return {
    entry,
    templateId: template.id,
    templateSource: templateSource(template),
    processId: entry.processId,
    documentKinds: entry.documentKinds,
    capa3Fields,
    capa3Draft,
    initialCapa3Values: buildInitialCapa3Values(capa3Fields, {
      ...variables,
      ...(context.variables ?? {}),
      ...capa3Draft.values,
    }),
    variables,
    sources,
    missingRequired: Array.from(missingRequired),
  };
}

export function buildTemplateTraceEvidence(
  template: PlantillaProtegidaRow | null | undefined,
  resolution: TemplateProcessResolution | null | undefined,
): TemplateTraceEvidence {
  const source = template ? templateSource(template) : "none";
  const fixtureFallbackUsed = source === "fixture";

  return {
    schema_version: "secretaria-template-flow-trace.v1",
    template: {
      id: template?.id ?? null,
      tipo: template?.tipo ?? null,
      nombre: template?.tipo ?? null,
      materia: template?.materia_acuerdo ?? template?.materia ?? null,
      version: template?.version ?? null,
      estado: template?.estado ?? null,
      source,
      source_of_truth: source === "cloud" ? "cloud" : source === "fixture" ? "fixture_fallback_non_persistent" : "none",
      fixture_fallback_used: fixtureFallbackUsed,
      fixture_persisted_as_source_of_truth: false,
      contrato_variables_version: template?.contrato_variables_version ?? null,
      snapshot_rule_pack_required: template?.snapshot_rule_pack_required ?? null,
    },
    process: {
      id: resolution?.processId ?? null,
      matrix_key: resolution?.entry.key ?? null,
      document_kinds: resolution?.documentKinds ?? [],
    },
    variables: {
      resolved: sortRecord(resolution?.variables ?? {}),
      sources: sortRecord(resolution?.sources ?? {}),
      missing_required: [...(resolution?.missingRequired ?? [])].sort(),
    },
    capa3: {
      normalized_values: sortRecord(resolution?.capa3Draft.values ?? {}),
      empty_keys: [...(resolution?.capa3Draft.emptyKeys ?? [])].sort(),
      ignored_keys: [...(resolution?.capa3Draft.ignoredKeys ?? [])].sort(),
      legacy_key_map: sortRecord(resolution?.capa3Draft.legacyKeyMap ?? {}),
    },
    pre_parity: validatePreTemplateParity(template, resolution),
    evidence: {
      posture: "GENERATED_TRACE_ONLY",
      storage_ref: null,
      evidence_bundle_id: null,
    },
  };
}

export function buildTemplateProcessMatrixIndex(
  templates: PlantillaProtegidaRow[],
  context: TemplateProcessContext = {},
) {
  return templates.reduce<Record<string, TemplateProcessResolution>>((acc, template) => {
    const resolution = resolveTemplateProcessMatrix(template, context);
    if (resolution) acc[template.id] = resolution;
    return acc;
  }, {});
}

export const TEMPLATE_PROCESS_MATRIX = MATRIX;
