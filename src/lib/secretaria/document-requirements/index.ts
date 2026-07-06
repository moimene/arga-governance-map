export type DocumentRequirementLevel =
  | "OBLIGATORIO"
  | "OBLIGATORIO_SI_APLICA"
  | "RECOMENDADO"
  | "INFORMATIVO";

export type DocumentRequirementBlockingPolicy =
  | "BLOCKING"
  | "OVERRIDE_REQUIRED"
  | "WARNING"
  | "NO_BLOCK";

export type DocumentRequirementPhase =
  | "PRE_CONVOCATORIA"
  | "CONVOCATORIA"
  | "PRE_REUNION"
  | "REUNION"
  | "POST_ACUERDO"
  | "CERTIFICACION"
  | "REGISTRO"
  | "BOARD_PACK";

export type DocumentRequirementKind =
  | "INFORME_PRECEPTIVO"
  | "INFORME_DOCUMENTAL_PRE"
  | "INFORME_GESTION"
  | "PROYECTO"
  | "BALANCE"
  | "CERTIFICACION_SOPORTE"
  | "ANEXO_EXTERNO"
  | "DOCUMENTO_REGISTRAL"
  | "OTRO_SOPORTE";

export type DocumentRequirementSeverity = "OK" | "INFO" | "WARNING" | "BLOCKING";

export type DocumentAnnexTarget =
  | "CONVOCATORIA"
  | "REUNION"
  | "ACTA"
  | "CERTIFICACION"
  | "BOARD_PACK"
  | "REGISTRO"
  | "EXPEDIENTE";

export type DocumentRequirementCondition =
  | null
  | undefined
  | string
  | boolean
  | {
      flag?: string;
      field?: string;
      equals?: unknown;
      in?: unknown[];
      exists?: boolean;
      all?: DocumentRequirementCondition[];
      any?: DocumentRequirementCondition[];
      not?: DocumentRequirementCondition;
    };

export interface DocumentRequirementRule {
  requirement_code: string;
  document_kind: DocumentRequirementKind;
  title: string;
  fase: DocumentRequirementPhase;
  required_level: DocumentRequirementLevel;
  blocking_policy: DocumentRequirementBlockingPolicy;
  legal_basis?: string | null;
  condition?: DocumentRequirementCondition;
  annex_targets?: DocumentAnnexTarget[];
  evidence_policy?: Record<string, unknown>;
  template_binding_key?: string | null;
  dedup_key?: string | null;
  source_ref?: string | null;
  applies_to?: {
    jurisdiccion?: string[];
    tipo_social?: string[];
    organo_tipo?: string[];
    adoption_mode?: string[];
    cotizada?: boolean;
    sector_regulado?: string[];
  };
}

export interface DocumentRequirementTemplateCandidate {
  id: string;
  tipo: string;
  estado: string;
  materia?: string | null;
  template_binding_key?: string | null;
  organo_tipo?: string | null;
  adoption_mode?: string | null;
  tipo_social?: string | null;
  version?: string | null;
}

export interface DocumentRequirementContext {
  tenant_id?: string;
  agreement_id?: string | null;
  matter_code: string;
  jurisdiccion?: string | null;
  tipo_social?: string | null;
  organo_tipo?: string | null;
  adoption_mode?: string | null;
  cotizada?: boolean;
  sector_regulado?: string | null;
  flags?: Record<string, unknown>;
  values?: Record<string, unknown>;
}

export interface ResolveDocumentRequirementsInput {
  context: DocumentRequirementContext;
  rules: DocumentRequirementRule[];
  templates?: DocumentRequirementTemplateCandidate[];
  existingArtifacts?: Array<{
    requirement_code?: string | null;
    dedup_key?: string | null;
    status?: string | null;
  }>;
}

export interface ResolvedDocumentRequirement {
  requirement_code: string;
  dedup_key: string;
  matter_codes: string[];
  document_kind: DocumentRequirementKind;
  title: string;
  fase: DocumentRequirementPhase;
  required_level: DocumentRequirementLevel;
  blocking_policy: DocumentRequirementBlockingPolicy;
  legal_basis?: string | null;
  condition_met: boolean;
  annex_targets: DocumentAnnexTarget[];
  evidence_policy: Record<string, unknown>;
  template_binding_key?: string | null;
  template_id?: string | null;
  template_version?: string | null;
  template_status: "FOUND" | "MISSING" | "NOT_REQUIRED";
  artifact_status?: string | null;
  severity: DocumentRequirementSeverity;
  explanation: string;
  source_refs: string[];
}

export interface DocumentRequirementExplainNode {
  code: string;
  severity: DocumentRequirementSeverity;
  message: string;
  requirement_code: string;
  legal_basis?: string | null;
}

export interface DocumentAnnexManifestItem {
  artifact_id: string;
  artifact_kind?: string | null;
  title?: string | null;
  linked_domain: string;
  linked_id: string;
  annex_role: string;
  annex_order: number;
  is_mandatory_annex?: boolean;
  included_in_export?: boolean;
  included_in_certification_bundle?: boolean;
  evidence_status?: string | null;
  artifact_status?: string | null;
  source_hash?: string | null;
  content_hash?: string | null;
  hash_sha512?: string | null;
}

export interface DocumentAnnexManifest {
  linked_domain: string;
  linked_id: string;
  certification_bundle_only: boolean;
  count: number;
  items: DocumentAnnexManifestItem[];
}

function getPath(obj: Record<string, unknown>, path?: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function conditionValue(condition: DocumentRequirementCondition, context: DocumentRequirementContext): boolean {
  if (condition == null) return true;
  if (typeof condition === "boolean") return condition;
  if (typeof condition === "string") {
    const normalized = condition.trim().toUpperCase();
    if (!normalized || normalized === "SIEMPRE" || normalized === "ALWAYS") return true;
    return Boolean(context.flags?.[condition] ?? context.flags?.[normalized]);
  }

  if (condition.all) return condition.all.every((item) => conditionValue(item, context));
  if (condition.any) return condition.any.some((item) => conditionValue(item, context));
  if (condition.not) return !conditionValue(condition.not, context);

  const value = condition.flag
    ? context.flags?.[condition.flag]
    : condition.field
      ? getPath(context.values ?? {}, condition.field)
      : undefined;

  if (condition.exists !== undefined) {
    const exists = value !== null && value !== undefined && value !== "";
    if (exists !== condition.exists) return false;
  }
  if ("equals" in condition && value !== condition.equals) return false;
  if (condition.in && !condition.in.includes(value)) return false;
  return true;
}

function appliesTo(rule: DocumentRequirementRule, context: DocumentRequirementContext): boolean {
  const applies = rule.applies_to;
  if (!applies) return true;
  if (applies.jurisdiccion?.length && !applies.jurisdiccion.includes(context.jurisdiccion ?? "")) return false;
  if (applies.tipo_social?.length && !applies.tipo_social.includes(context.tipo_social ?? "")) return false;
  if (applies.organo_tipo?.length && !applies.organo_tipo.includes(context.organo_tipo ?? "")) return false;
  if (applies.adoption_mode?.length && !applies.adoption_mode.includes(context.adoption_mode ?? "")) return false;
  if (applies.cotizada !== undefined && applies.cotizada !== Boolean(context.cotizada)) return false;
  if (applies.sector_regulado?.length && !applies.sector_regulado.includes(context.sector_regulado ?? "")) return false;
  return true;
}

export function bindRequirementToTemplate(
  requirement: Pick<ResolvedDocumentRequirement, "document_kind" | "template_binding_key">,
  templates: DocumentRequirementTemplateCandidate[] = [],
) {
  const active = templates.filter((template) => template.estado === "ACTIVA");
  const byBinding = requirement.template_binding_key
    ? active.find((template) => template.template_binding_key === requirement.template_binding_key)
    : null;
  if (byBinding) return byBinding;
  return active.find((template) => template.tipo === requirement.document_kind) ?? null;
}

function baseSeverity(
  rule: DocumentRequirementRule,
  conditionMet: boolean,
  templateFound: boolean,
  artifactStatus?: string | null,
): DocumentRequirementSeverity {
  if (!conditionMet) return "INFO";
  if (artifactStatus && ["APPROVED", "ARCHIVED", "ATTACHED", "SIGNED"].includes(artifactStatus)) return "OK";
  if (!templateFound && rule.document_kind !== "ANEXO_EXTERNO") {
    return rule.blocking_policy === "BLOCKING" ? "BLOCKING" : "WARNING";
  }
  if (rule.blocking_policy === "BLOCKING" && ["OBLIGATORIO", "OBLIGATORIO_SI_APLICA"].includes(rule.required_level)) {
    return "BLOCKING";
  }
  if (rule.blocking_policy === "OVERRIDE_REQUIRED" || rule.blocking_policy === "WARNING") return "WARNING";
  return rule.required_level === "INFORMATIVO" ? "INFO" : "OK";
}

export function deduplicateDocumentRequirements(requirements: ResolvedDocumentRequirement[]) {
  const byKey = new Map<string, ResolvedDocumentRequirement>();
  requirements.forEach((requirement) => {
    const existing = byKey.get(requirement.dedup_key);
    if (!existing) {
      byKey.set(requirement.dedup_key, requirement);
      return;
    }
    existing.matter_codes = Array.from(new Set([...existing.matter_codes, ...requirement.matter_codes]));
    existing.source_refs = Array.from(new Set([...existing.source_refs, ...requirement.source_refs]));
    existing.annex_targets = Array.from(new Set([...existing.annex_targets, ...requirement.annex_targets]));
    if (requirement.severity === "BLOCKING" || existing.severity !== "BLOCKING") {
      existing.severity = requirement.severity === "BLOCKING" ? "BLOCKING" : existing.severity;
    }
  });
  return Array.from(byKey.values());
}

export function resolveDocumentRequirementsForAgreement(input: ResolveDocumentRequirementsInput) {
  const raw = input.rules
    .filter((rule) => appliesTo(rule, input.context))
    .map<ResolvedDocumentRequirement>((rule) => {
      const conditionMet = conditionValue(rule.condition, input.context);
      const dedupKey = rule.dedup_key ?? `${rule.requirement_code}:${rule.fase}`;
      const existing = input.existingArtifacts?.find(
        (artifact) => artifact.dedup_key === dedupKey || artifact.requirement_code === rule.requirement_code,
      );
      const skeleton: ResolvedDocumentRequirement = {
        requirement_code: rule.requirement_code,
        dedup_key: dedupKey,
        matter_codes: [input.context.matter_code],
        document_kind: rule.document_kind,
        title: rule.title,
        fase: rule.fase,
        required_level: rule.required_level,
        blocking_policy: rule.blocking_policy,
        legal_basis: rule.legal_basis,
        condition_met: conditionMet,
        annex_targets: rule.annex_targets ?? [],
        evidence_policy: rule.evidence_policy ?? {},
        template_binding_key: rule.template_binding_key,
        template_status: conditionMet ? "MISSING" : "NOT_REQUIRED",
        artifact_status: existing?.status ?? null,
        severity: "INFO",
        explanation: "",
        source_refs: rule.source_ref ? [rule.source_ref] : [],
      };
      const template = conditionMet ? bindRequirementToTemplate(skeleton, input.templates) : null;
      skeleton.template_id = template?.id ?? null;
      skeleton.template_version = template?.version ?? null;
      skeleton.template_status = conditionMet ? (template ? "FOUND" : "MISSING") : "NOT_REQUIRED";
      skeleton.severity = baseSeverity(rule, conditionMet, Boolean(template), existing?.status);
      skeleton.explanation = conditionMet
        ? template
          ? `${rule.title}: requisito aplicable con plantilla activa.`
          : `${rule.title}: requisito aplicable sin plantilla activa.`
        : `${rule.title}: requisito no aplicable por condicion.`;
      return skeleton;
    });
  return deduplicateDocumentRequirements(raw);
}

export function evaluateRequirementBlockingState(requirements: ResolvedDocumentRequirement[]) {
  const blocking = requirements.filter((requirement) => requirement.severity === "BLOCKING");
  const warnings = requirements.filter((requirement) => requirement.severity === "WARNING");
  return {
    ok: blocking.length === 0,
    blockingCount: blocking.length,
    warningCount: warnings.length,
    blocking,
    warnings,
  };
}

export function buildDocumentRequirementExplainNodes(
  requirements: ResolvedDocumentRequirement[],
): DocumentRequirementExplainNode[] {
  return requirements.map((requirement) => ({
    code: `DOC_${requirement.requirement_code}`,
    severity: requirement.severity,
    message: requirement.explanation,
    requirement_code: requirement.requirement_code,
    legal_basis: requirement.legal_basis,
  }));
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(null);
}

export function buildDocumentAnnexManifest(params: {
  linkedDomain: string;
  linkedId: string;
  items: DocumentAnnexManifestItem[];
  certificationBundleOnly?: boolean;
}): DocumentAnnexManifest {
  const items = params.items
    .filter((item) => !params.certificationBundleOnly || item.included_in_certification_bundle)
    .map((item) => ({
      ...item,
      annex_order: Number(item.annex_order || 1),
    }))
    .sort((a, b) => {
      if (a.annex_order !== b.annex_order) return a.annex_order - b.annex_order;
      const domain = a.linked_domain.localeCompare(b.linked_domain);
      if (domain !== 0) return domain;
      const role = a.annex_role.localeCompare(b.annex_role);
      if (role !== 0) return role;
      return a.artifact_id.localeCompare(b.artifact_id);
    });

  return {
    linked_domain: params.linkedDomain,
    linked_id: params.linkedId,
    certification_bundle_only: Boolean(params.certificationBundleOnly),
    count: items.length,
    items,
  };
}

export function canonicalizeDocumentAnnexManifest(manifest: DocumentAnnexManifest) {
  return stableStringify(manifest);
}

export async function computeDocumentAnnexManifestHash(manifest: DocumentAnnexManifest) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto (crypto.subtle) no disponible para calcular annex_manifest_hash.");
  }
  const encoded = new TextEncoder().encode(canonicalizeDocumentAnnexManifest(manifest));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
