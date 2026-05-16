import type { NormativeMaintenanceRole } from "@/lib/secretaria/mesa-control-societaria";

export type GovernanceSourceType = "LEY" | "ESTATUTOS" | "REGLAMENTO" | "PACTO_PARASOCIAL";
export type GovernanceStatus = "BORRADOR" | "ACTIVA" | "ARCHIVADA";
export type PublishedStatus = "BORRADOR" | "PUBLICADA" | "CERRADA";

export interface OrganRuleRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  body_id: string;
  matter_code: string;
  competence_type: "DECISION" | "INFORMACION" | "SUPERVISION" | "PROPUESTA";
  quorum_rule: string;
  majority_rule: string;
  source_type: GovernanceSourceType;
  source_ref: string;
  source_version_id: string | null;
  status: GovernanceStatus;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatuteVersionRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  version_label: string;
  status: "BORRADOR" | "PUBLICADA" | "ARCHIVADA";
  document_uri: string | null;
  document_hash: string | null;
  mapping_coverage: number;
  critical_mappings_complete: boolean;
  published_at: string | null;
  locked_at: string | null;
  created_at: string;
}

export interface StatuteClauseMappingRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  statute_version_id: string;
  clause_ref: string;
  matter_code: string;
  requirement_key: string;
  requirement_value: Record<string, unknown>;
  source_excerpt: string | null;
  confidence: "VALIDADO" | "PENDIENTE_REVISION" | "INFERIDO" | "INCOMPLETO";
  status: GovernanceStatus;
  created_at: string;
}

export interface NormativeOverrideRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  matter_code: string;
  requirement_key: string;
  requirement_value: Record<string, unknown>;
  source_type: "ESTATUTOS" | "REGLAMENTO";
  source_ref: string;
  justification: string;
  effective_from: string;
  effective_until: string | null;
  status: PublishedStatus;
  rule_param_override_id: string | null;
  published_at: string | null;
  created_at: string;
}

export interface PactoClauseMappingRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  pacto_id: string | null;
  clause_ref: string;
  matter_code: string;
  legal_effect: "CONTRACTUAL" | "ESTATUTARIZADO" | "VETO" | "CONSENTIMIENTO" | "MAYORIA_REFORZADA";
  status: GovernanceStatus;
  waiver_status: "NO_APLICA" | "PENDIENTE" | "OTORGADO" | "INCUMPLIDO";
  source_ref: string | null;
  created_at: string;
}

export interface TemplateBindingRow {
  id: string;
  tenant_id: string;
  materia: string;
  organo_tipo: string;
  tipo_social: string;
  jurisdiccion: string;
  adoption_mode: string;
  doc_type: string;
  template_id: string;
  priority: number;
  active: boolean;
  selection_reason: string;
  created_at: string;
}

export interface EffectiveRuleMatrixRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  matter_code: string;
  organo_tipo: string;
  majority_rule: string;
  quorum_rule: string;
  documents_required: string[];
  formalization: Record<string, unknown>;
  deadlines: Record<string, unknown>;
  source_layers: Array<{ type?: string; reference?: string; [key: string]: unknown }>;
  operational_status: "OK" | "INCOMPLETO" | "REQUIERE_REVISION" | "CONFLICTO_JURISDICCIONAL";
  confidence: "VALIDADO" | "PENDIENTE_REVISION" | "INFERIDO" | "INCOMPLETO";
  profile_hash: string;
  generated_at: string;
}

export interface UpsertOrganRuleInput {
  tenantId: string;
  entityId: string;
  bodyId: string;
  matterCode: string;
  competenceType?: OrganRuleRow["competence_type"];
  quorumRule: string;
  majorityRule: string;
  sourceType: GovernanceSourceType;
  sourceRef: string;
  sourceVersionId?: string | null;
  userRole: NormativeMaintenanceRole;
}

export interface PublishStatuteVersionInput {
  tenantId: string;
  entityId: string;
  versionLabel: string;
  documentUri?: string | null;
  documentHash?: string | null;
  mappingCoverage: number;
  criticalMappingsComplete?: boolean;
  userRole: NormativeMaintenanceRole;
  mappings?: Array<{
    clauseRef: string;
    matterCode: string;
    requirementKey: string;
    requirementValue?: Record<string, unknown>;
    sourceExcerpt?: string | null;
    confidence?: StatuteClauseMappingRow["confidence"];
  }>;
}

export interface PublishNormativeOverrideInput {
  tenantId: string;
  entityId: string;
  matterCode: string;
  requirementKey: string;
  requirementValue: Record<string, unknown>;
  sourceType: "ESTATUTOS" | "REGLAMENTO";
  sourceRef: string;
  justification: string;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  userRole: NormativeMaintenanceRole;
}

export interface AssignTemplateBindingInput {
  tenantId: string;
  materia: string;
  organoTipo?: string | null;
  tipoSocial?: string | null;
  jurisdiccion?: string | null;
  adoptionMode?: string | null;
  docType: string;
  templateId: string;
  priority?: number;
  selectionReason: string;
  userRole: NormativeMaintenanceRole;
}

type RpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function assertRpc(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(error.message ?? fallback);
}

export function buildOrganRulePayload(input: UpsertOrganRuleInput) {
  return {
    tenant_id: input.tenantId,
    entity_id: input.entityId,
    body_id: input.bodyId,
    matter_code: input.matterCode,
    competence_type: input.competenceType ?? "DECISION",
    quorum_rule: input.quorumRule,
    majority_rule: input.majorityRule,
    source_type: input.sourceType,
    source_ref: input.sourceRef,
    source_version_id: input.sourceVersionId ?? null,
    user_role: input.userRole,
  };
}

export function buildStatuteVersionPayload(input: PublishStatuteVersionInput) {
  return {
    tenant_id: input.tenantId,
    entity_id: input.entityId,
    version_label: input.versionLabel,
    status: "PUBLICADA",
    document_uri: input.documentUri ?? null,
    document_hash: input.documentHash ?? null,
    mapping_coverage: input.mappingCoverage,
    critical_mappings_complete: input.criticalMappingsComplete ?? input.mappingCoverage >= 80,
    user_role: input.userRole,
    mappings: (input.mappings ?? []).map((mapping) => ({
      clause_ref: mapping.clauseRef,
      matter_code: mapping.matterCode,
      requirement_key: mapping.requirementKey,
      requirement_value: mapping.requirementValue ?? {},
      source_excerpt: mapping.sourceExcerpt ?? null,
      confidence: mapping.confidence ?? "VALIDADO",
    })),
  };
}

export function buildNormativeOverridePayload(input: PublishNormativeOverrideInput) {
  return {
    tenant_id: input.tenantId,
    entity_id: input.entityId,
    matter_code: input.matterCode,
    requirement_key: input.requirementKey,
    requirement_value: input.requirementValue,
    source_type: input.sourceType,
    source_ref: input.sourceRef,
    justification: input.justification,
    effective_from: input.effectiveFrom ?? null,
    effective_until: input.effectiveUntil ?? null,
    user_role: input.userRole,
  };
}

export function buildTemplateBindingPayload(input: AssignTemplateBindingInput) {
  return {
    tenant_id: input.tenantId,
    materia: input.materia,
    organo_tipo: input.organoTipo ?? "ANY",
    tipo_social: input.tipoSocial ?? "ANY",
    jurisdiccion: input.jurisdiccion ?? "ES",
    adoption_mode: input.adoptionMode ?? "ANY",
    doc_type: input.docType,
    template_id: input.templateId,
    priority: input.priority ?? 100,
    active: true,
    selection_reason: input.selectionReason,
    user_role: input.userRole,
  };
}

export async function upsertOrganRule(client: RpcClient, input: UpsertOrganRuleInput) {
  const { data, error } = await client.rpc("fn_secretaria_upsert_organ_rule", {
    p_payload: buildOrganRulePayload(input),
  });
  assertRpc(error, "No se pudo publicar la competencia del órgano.");
  return String(data);
}

export async function publishStatuteVersion(client: RpcClient, input: PublishStatuteVersionInput) {
  const { data, error } = await client.rpc("fn_secretaria_publish_statute_version", {
    p_payload: buildStatuteVersionPayload(input),
  });
  assertRpc(error, "No se pudo publicar la versión de estatutos.");
  return String(data);
}

export async function publishNormativeOverride(client: RpcClient, input: PublishNormativeOverrideInput) {
  const { data, error } = await client.rpc("fn_secretaria_publish_normative_override", {
    p_payload: buildNormativeOverridePayload(input),
  });
  assertRpc(error, "No se pudo publicar el override normativo.");
  return String(data);
}

export async function assignTemplateBinding(client: RpcClient, input: AssignTemplateBindingInput) {
  const { data, error } = await client.rpc("fn_secretaria_assign_template_binding", {
    p_payload: buildTemplateBindingPayload(input),
  });
  assertRpc(error, "No se pudo asignar la plantilla a la materia.");
  return String(data);
}

export async function materializeEffectiveRuleMatrix(
  client: RpcClient,
  input: { tenantId: string; entityId?: string | null },
) {
  const { data, error } = await client.rpc("fn_secretaria_materialize_effective_rule_matrix", {
    p_tenant_id: input.tenantId,
    p_entity_id: input.entityId ?? null,
  });
  assertRpc(error, "No se pudo materializar la matriz de regla efectiva.");
  return data as { rows_materialized: number; tenant_id: string; entity_id: string | null; mode: string };
}

export function templateSelectionReason(input: {
  materia: string;
  docType: string;
  jurisdiction?: string | null;
  tipoSocial?: string | null;
  organoTipo?: string | null;
  adoptionMode?: string | null;
}) {
  return [
    `materia ${input.materia}`,
    `documento ${input.docType}`,
    input.jurisdiction ? `jurisdicción ${input.jurisdiction}` : null,
    input.tipoSocial ? `tipo social ${input.tipoSocial}` : null,
    input.organoTipo ? `órgano ${input.organoTipo}` : null,
    input.adoptionMode ? `forma de adopción ${input.adoptionMode}` : null,
  ].filter(Boolean).join(" · ");
}
