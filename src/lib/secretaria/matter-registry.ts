import type { SupabaseClient } from "@supabase/supabase-js";

export type MatterRegistryResolution =
  | "RESUELTA"
  | "PARCIAL"
  | "REQUIERE_SELECCION_MANUAL"
  | "SIN_COBERTURA"
  | "BORRADOR_PENDIENTE"
  | "INCOMPLETO"
  | "NO_APLICA";

export type MatrixOperationalStatus =
  | "OK"
  | "INCOMPLETO"
  | "REQUIERE_REVISION"
  | "CONFLICTO_JURISDICCIONAL";

export type MatterRegistryGapSeverity = "BLOQUEANTE" | "ALTA" | "MEDIA";

export interface MatterRegistryGap {
  campo: string;
  severidad: MatterRegistryGapSeverity;
  descripcion: string;
}

export interface MatterRegistryResolveQuery {
  tenantId: string;
  entityId?: string | null;
  materia: string;
  organoTipo?: string | null;
  adoptionMode?: string | null;
  docType?: string | null;
  jurisdiccion?: string | null;
  tipoSocial?: string | null;
  subtipo?: string | null;
  allowAdministrativeDefault?: boolean;
}

export interface MatterRegistryBindingRow {
  id: string;
  tenant_id: string;
  materia: string;
  organo_tipo: string | null;
  tipo_social: string | null;
  jurisdiccion: string | null;
  adoption_mode: string | null;
  doc_type: string;
  template_id: string;
  priority: number | null;
  active: boolean;
  selection_reason?: string | null;
  subtipo?: string | null;
}

export interface MatterRegistryTemplateRow {
  id: string;
  tenant_id?: string;
  tipo: string;
  materia?: string | null;
  materia_acuerdo?: string | null;
  jurisdiccion?: string | null;
  version?: string | null;
  estado: string;
  aprobada_por?: string | null;
  fecha_aprobacion?: string | null;
  referencia_legal?: string | null;
  organo_tipo?: string | null;
  adoption_mode?: string | null;
  capa3_editables?: Array<Record<string, unknown>> | null;
}

export interface MatterRegistryRulePackVersionRow {
  id: string;
  pack_id?: string | null;
  version?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
}

export interface MatterRegistryRulePackRow {
  id: string;
  tenant_id?: string;
  materia: string;
  organo_tipo?: string | null;
  descripcion?: string | null;
  created_at?: string | null;
  rule_pack_versions?: MatterRegistryRulePackVersionRow[] | null;
}

export interface MatterRegistryRulePackContext {
  rule_pack_id: string;
  rule_pack_name: string;
  rule_pack_version_id: string;
  rule_pack_version_label: string;
  rule_pack_organo?: string | null;
}

export interface MatterRegistryEffectiveRuleRow {
  id?: string;
  tenant_id?: string;
  entity_id?: string;
  matter_code: string;
  operational_status: MatrixOperationalStatus;
  confidence?: string;
  formalization?: Record<string, unknown> | null;
  source_layers?: Array<Record<string, unknown>> | null;
}

export interface MatterRegistryRows {
  bindings: MatterRegistryBindingRow[];
  templates: MatterRegistryTemplateRow[];
  rulePacks?: MatterRegistryRulePackRow[];
  effectiveRule?: MatterRegistryEffectiveRuleRow | null;
}

export interface MatterRegistryEntry {
  materia: string;
  organo_tipo?: string | null;
  adoption_mode?: string | null;
  doc_type: string;
  subtipo?: string | null;
  template_id?: string | null;
  template_version?: string | null;
  template_estado?: string | null;
  binding_id?: string | null;
  binding_priority?: number | null;
  rule_pack_id?: string | null;
  rule_pack_name?: string | null;
  rule_pack_version_id?: string | null;
  rule_pack_version_label?: string | null;
  rule_pack_organo?: string | null;
  matriz_p2_estado: MatrixOperationalStatus | "SIN_FILA";
  registry_status: MatterRegistryResolution;
  score: number;
  gaps: MatterRegistryGap[];
  alternativas?: MatterRegistryEntry[];
}

export const DEFAULT_MATTER_REGISTRY_WEIGHTS = {
  organoExact: 3,
  organoComposite: 2,
  organoMeta: 1,
  adoptionExact: 2,
  adoptionGeneric: 1,
  subtipoExact: 2,
  subtipoGeneric: 1,
} as const;

const DEFAULT_DOC_TYPE = "MODELO_ACUERDO";
const GENERIC_VALUES = new Set(["ANY", "GLOBAL", "MULTI", "DERIVADO_DEL_ACTO", "SOPORTE_INTERNO", "ORGANO_ADMIN"]);
const META_ORGANS = new Set(["ANY", "DERIVADO_DEL_ACTO", "SOPORTE_INTERNO", "ORGANO_ADMIN"]);
const OPERATIONAL_TEMPLATE_STATES = new Set(["ACTIVA", "APROBADA"]);
const ORGANO_ALIASES: Record<string, string> = {
  CONSEJO: "CONSEJO_ADMIN",
  CDA: "CONSEJO_ADMIN",
  CONSEJO_ADMINISTRACION: "CONSEJO_ADMIN",
  ADMIN_CONJUNTA: "ADMIN_CONJUNTA_O_COAPROBADORES",
  ADMIN_SOLIDARIO: "ADMIN_SOLIDARIOS",
};

export const COMPOSITE_ORGANS: Record<string, string[]> = {
  JUNTA_GENERAL_O_CONSEJO: ["JUNTA_GENERAL", "CONSEJO_ADMIN"],
  ADMIN_CONJUNTA_O_COAPROBADORES: ["ADMIN_CONJUNTA", "ADMIN_SOLIDARIOS", "CO_APROBADORES"],
};

interface ScoredBinding {
  binding: MatterRegistryBindingRow;
  template?: MatterRegistryTemplateRow | null;
  score: number;
}

function normalizeValue(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

function normalizeOrgano(value: string | null | undefined) {
  const normalized = normalizeValue(value);
  return normalized ? (ORGANO_ALIASES[normalized] ?? normalized) : null;
}

export function isCompositeOrganMatch(bindingOrgano: string | null | undefined, requestedOrgano: string | null | undefined) {
  const binding = normalizeOrgano(bindingOrgano);
  const requested = normalizeOrgano(requestedOrgano);
  if (!binding || !requested) return false;
  return COMPOSITE_ORGANS[binding]?.includes(requested) ?? false;
}

export function isMetaOrgan(organo: string | null | undefined) {
  const normalized = normalizeOrgano(organo);
  return normalized ? META_ORGANS.has(normalized) : true;
}

function isConcreteOrgan(organo: string | null | undefined) {
  const normalized = normalizeOrgano(organo);
  return Boolean(normalized && !isMetaOrgan(normalized) && !COMPOSITE_ORGANS[normalized]);
}

function isGenericValue(value: string | null | undefined) {
  const normalized = normalizeValue(value);
  return !normalized || GENERIC_VALUES.has(normalized);
}

function matchesJurisdiction(bindingValue: string | null | undefined, requested: string | null | undefined) {
  const requestedValue = normalizeValue(requested);
  const binding = normalizeValue(bindingValue);
  if (!requestedValue) return true;
  return !binding || binding === requestedValue || binding === "ANY" || binding === "GLOBAL" || binding === "MULTI";
}

function matchesTipoSocial(bindingValue: string | null | undefined, requested: string | null | undefined) {
  const requestedValue = normalizeValue(requested);
  const binding = normalizeValue(bindingValue);
  if (!requestedValue) return true;
  return !binding || binding === requestedValue || binding === "ANY";
}

function compareVersionsDesc(a?: string | null, b?: string | null) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (right[index] ?? 0) - (left[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function parseVersion(version?: string | null) {
  return (version ?? "")
    .split(".")
    .map((part) => Number.parseInt(part.replace(/\D+/g, ""), 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareIsoDesc(a?: string | null, b?: string | null) {
  const left = a ? Date.parse(a) : 0;
  const right = b ? Date.parse(b) : 0;
  return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
}

export function computeBindingScore(
  query: MatterRegistryResolveQuery,
  binding: MatterRegistryBindingRow,
  weights = DEFAULT_MATTER_REGISTRY_WEIGHTS,
) {
  let score = 0;
  const requestedOrgano = normalizeOrgano(query.organoTipo);
  const bindingOrgano = normalizeOrgano(binding.organo_tipo);
  const requestedAdoption = normalizeValue(query.adoptionMode);
  const bindingAdoption = normalizeValue(binding.adoption_mode);
  const requestedSubtipo = normalizeValue(query.subtipo);
  const bindingSubtipo = normalizeValue(binding.subtipo);

  if (requestedOrgano) {
    if (bindingOrgano === requestedOrgano) {
      score += weights.organoExact;
    } else if (isCompositeOrganMatch(bindingOrgano, requestedOrgano)) {
      score += weights.organoComposite;
    } else if (isMetaOrgan(bindingOrgano)) {
      score += weights.organoMeta;
    } else {
      return -1;
    }
  }

  if (requestedAdoption) {
    if (bindingAdoption === requestedAdoption) {
      score += weights.adoptionExact;
    } else if (isGenericValue(bindingAdoption)) {
      score += weights.adoptionGeneric;
    } else {
      return -1;
    }
  }

  if (requestedSubtipo) {
    if (bindingSubtipo === requestedSubtipo) {
      score += weights.subtipoExact;
    } else if (!bindingSubtipo) {
      score += weights.subtipoGeneric;
    } else {
      return -1;
    }
  }

  return score;
}

function expectedExactScore(query: MatterRegistryResolveQuery) {
  return (
    (normalizeValue(query.organoTipo) ? DEFAULT_MATTER_REGISTRY_WEIGHTS.organoExact : 0) +
    (normalizeValue(query.adoptionMode) ? DEFAULT_MATTER_REGISTRY_WEIGHTS.adoptionExact : 0) +
    (normalizeValue(query.subtipo) ? DEFAULT_MATTER_REGISTRY_WEIGHTS.subtipoExact : 0)
  );
}

function filterBindings(query: MatterRegistryResolveQuery, bindings: MatterRegistryBindingRow[]) {
  const docType = query.docType ?? DEFAULT_DOC_TYPE;
  return bindings.filter((binding) => {
    if (binding.active === false) return false;
    if (binding.tenant_id !== query.tenantId) return false;
    if (binding.materia !== query.materia) return false;
    if (binding.doc_type !== docType) return false;
    if (!matchesJurisdiction(binding.jurisdiccion, query.jurisdiccion)) return false;
    if (!matchesTipoSocial(binding.tipo_social, query.tipoSocial)) return false;
    return true;
  });
}

function templateMatter(template: MatterRegistryTemplateRow) {
  return template.materia_acuerdo ?? template.materia ?? null;
}

function filterTemplates(query: MatterRegistryResolveQuery, templates: MatterRegistryTemplateRow[]) {
  const docType = query.docType ?? DEFAULT_DOC_TYPE;
  return templates.filter((template) => {
    if (template.tenant_id && template.tenant_id !== query.tenantId) return false;
    if (template.tipo !== docType) return false;
    if (templateMatter(template) !== query.materia) return false;
    return true;
  });
}

function filterTemplatesForBinding(query: MatterRegistryResolveQuery, templates: MatterRegistryTemplateRow[]) {
  const docType = query.docType ?? DEFAULT_DOC_TYPE;
  return templates.filter((template) => {
    if (template.tenant_id && template.tenant_id !== query.tenantId) return false;
    return template.tipo === docType;
  });
}

function compareScoredBinding(a: ScoredBinding, b: ScoredBinding) {
  if (b.score !== a.score) return b.score - a.score;
  const priorityDiff = (a.binding.priority ?? 100) - (b.binding.priority ?? 100);
  if (priorityDiff !== 0) return priorityDiff;
  const versionDiff = compareVersionsDesc(a.template?.version, b.template?.version);
  if (versionDiff !== 0) return versionDiff;
  return compareIsoDesc(a.template?.fecha_aprobacion, b.template?.fecha_aprobacion);
}

function isIrreduciblyAmbiguous(query: MatterRegistryResolveQuery, candidates: ScoredBinding[]) {
  if (candidates.length < 2) return false;
  const topScore = candidates[0].score;
  const topCandidates = candidates.filter((candidate) => candidate.score === topScore);
  if (topCandidates.length < 2) return false;

  if (!normalizeValue(query.organoTipo) && query.allowAdministrativeDefault !== true) {
    const concreteOrgans = new Set(
      topCandidates
        .map((candidate) => normalizeOrgano(candidate.binding.organo_tipo))
        .filter((organo): organo is string => isConcreteOrgan(organo)),
    );
    if (concreteOrgans.size > 1) return true;
  }

  const first = topCandidates[0];
  return topCandidates.slice(1).some((candidate) => compareScoredBinding(first, candidate) === 0);
}

function selectRulePackContext(rulePacks: MatterRegistryRulePackRow[], materia: string, organoTipo?: string | null) {
  const requestedOrgano = normalizeOrgano(organoTipo);
  const candidates = rulePacks
    .filter((pack) => pack.materia === materia)
    .map((pack) => ({
      pack,
      score: requestedOrgano
        ? computeBindingScore(
            {
              tenantId: pack.tenant_id ?? "",
              materia,
              organoTipo: requestedOrgano,
            },
            {
              id: pack.id,
              tenant_id: pack.tenant_id ?? "",
              materia,
              organo_tipo: pack.organo_tipo ?? "ANY",
              tipo_social: "ANY",
              jurisdiccion: "ANY",
              adoption_mode: "ANY",
              doc_type: DEFAULT_DOC_TYPE,
              template_id: "",
              priority: 100,
              active: true,
            },
          )
        : 0,
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return compareIsoDesc(a.pack.created_at, b.pack.created_at);
    });

  const selected = candidates[0]?.pack;
  const activeVersion = selected?.rule_pack_versions
    ?.filter((version) => version.is_active !== false)
    .sort((a, b) => {
      const versionDiff = compareVersionsDesc(a.version, b.version);
      if (versionDiff !== 0) return versionDiff;
      return compareIsoDesc(a.created_at, b.created_at);
    })[0];

  if (!selected || !activeVersion) return null;
  return {
    rule_pack_id: selected.id,
    rule_pack_name: selected.descripcion ?? selected.materia,
    rule_pack_version_id: activeVersion.id,
    rule_pack_version_label: activeVersion.version ?? "1",
    rule_pack_organo: selected.organo_tipo ?? null,
  } satisfies MatterRegistryRulePackContext;
}

function buildEntry(
  query: MatterRegistryResolveQuery,
  candidate: ScoredBinding,
  rulePack: MatterRegistryRulePackContext | null,
  effectiveRule: MatterRegistryEffectiveRuleRow | null | undefined,
  registryStatus: MatterRegistryResolution,
  alternatives?: MatterRegistryEntry[],
): MatterRegistryEntry {
  const template = candidate.template ?? null;
  const gaps = computeGaps(candidate.binding, template, rulePack, effectiveRule);
  return {
    materia: query.materia,
    organo_tipo: candidate.binding.organo_tipo ?? template?.organo_tipo ?? null,
    adoption_mode: candidate.binding.adoption_mode ?? template?.adoption_mode ?? null,
    doc_type: candidate.binding.doc_type,
    subtipo: candidate.binding.subtipo ?? null,
    template_id: template?.id ?? candidate.binding.template_id,
    template_version: template?.version ?? null,
    template_estado: template?.estado ?? null,
    binding_id: candidate.binding.id,
    binding_priority: candidate.binding.priority ?? 100,
    rule_pack_id: rulePack?.rule_pack_id ?? null,
    rule_pack_name: rulePack?.rule_pack_name ?? null,
    rule_pack_version_id: rulePack?.rule_pack_version_id ?? null,
    rule_pack_version_label: rulePack?.rule_pack_version_label ?? null,
    rule_pack_organo: rulePack?.rule_pack_organo ?? null,
    matriz_p2_estado: effectiveRule?.operational_status ?? "SIN_FILA",
    registry_status: registryStatus,
    score: candidate.score,
    gaps,
    alternativas: alternatives,
  };
}

function computeGaps(
  binding: MatterRegistryBindingRow | null,
  template: MatterRegistryTemplateRow | null,
  rulePack: MatterRegistryRulePackContext | null,
  effectiveRule: MatterRegistryEffectiveRuleRow | null | undefined,
) {
  const gaps: MatterRegistryGap[] = [];
  if (!binding) {
    gaps.push({ campo: "binding", severidad: "BLOQUEANTE", descripcion: "No existe binding activo para esta materia y contexto." });
  }
  if (!template) {
    gaps.push({ campo: "template", severidad: "BLOQUEANTE", descripcion: "El binding no apunta a una plantilla disponible." });
  } else {
    if (!OPERATIONAL_TEMPLATE_STATES.has(template.estado)) {
      gaps.push({ campo: "estado", severidad: "BLOQUEANTE", descripcion: `La plantilla está en estado ${template.estado}.` });
    }
    if (!template.aprobada_por) {
      gaps.push({ campo: "firma_comite", severidad: "MEDIA", descripcion: "La plantilla no conserva aprobador legal formal." });
    }
    if (!template.referencia_legal) {
      gaps.push({ campo: "referencia_legal", severidad: "MEDIA", descripcion: "La plantilla no declara referencia legal." });
    }
  }
  if (!rulePack) {
    gaps.push({ campo: "rule_pack", severidad: "ALTA", descripcion: "No se ha resuelto rule pack activo para la materia y órgano." });
  }
  if (!effectiveRule) {
    gaps.push({ campo: "matriz_p2", severidad: "MEDIA", descripcion: "La matriz P2 no tiene fila materializada para esta materia." });
  } else if (effectiveRule.operational_status !== "OK") {
    gaps.push({
      campo: "matriz_p2",
      severidad: effectiveRule.operational_status === "REQUIERE_REVISION" ? "ALTA" : "MEDIA",
      descripcion: `La matriz P2 marca la materia como ${effectiveRule.operational_status}.`,
    });
  }
  return gaps;
}

function fallbackEntry(
  query: MatterRegistryResolveQuery,
  status: MatterRegistryResolution,
  effectiveRule: MatterRegistryEffectiveRuleRow | null | undefined,
  template?: MatterRegistryTemplateRow | null,
) {
  const gaps = computeGaps(null, template ?? null, null, effectiveRule);
  return {
    materia: query.materia,
    organo_tipo: query.organoTipo ?? template?.organo_tipo ?? null,
    adoption_mode: query.adoptionMode ?? template?.adoption_mode ?? null,
    doc_type: query.docType ?? DEFAULT_DOC_TYPE,
    subtipo: query.subtipo ?? null,
    template_id: template?.id ?? null,
    template_version: template?.version ?? null,
    template_estado: template?.estado ?? null,
    binding_id: null,
    binding_priority: null,
    rule_pack_id: null,
    rule_pack_name: null,
    rule_pack_version_id: null,
    rule_pack_version_label: null,
    rule_pack_organo: null,
    matriz_p2_estado: effectiveRule?.operational_status ?? "SIN_FILA",
    registry_status: status,
    score: -1,
    gaps,
  } satisfies MatterRegistryEntry;
}

export function resolveMatterRegistryFromRows(
  query: MatterRegistryResolveQuery,
  rows: MatterRegistryRows,
): MatterRegistryEntry {
  const templates = filterTemplates(query, rows.templates);
  const templatesById = new Map(filterTemplatesForBinding(query, rows.templates).map((template) => [template.id, template]));
  const scored = filterBindings(query, rows.bindings)
    .map((binding) => ({
      binding,
      template: templatesById.get(binding.template_id) ?? null,
      score: computeBindingScore(query, binding),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort(compareScoredBinding);

  if (scored.length === 0) {
    const activeTemplate = templates.find((template) => OPERATIONAL_TEMPLATE_STATES.has(template.estado));
    const draftTemplate = templates.find((template) => template.estado === "BORRADOR");
    if (activeTemplate) return fallbackEntry(query, "INCOMPLETO", rows.effectiveRule, activeTemplate);
    if (draftTemplate) return fallbackEntry(query, "BORRADOR_PENDIENTE", rows.effectiveRule, draftTemplate);
    return fallbackEntry(query, "SIN_COBERTURA", rows.effectiveRule);
  }

  if (isIrreduciblyAmbiguous(query, scored)) {
    const alternatives = scored.map((candidate) => {
      const rulePack = selectRulePackContext(rows.rulePacks ?? [], query.materia, candidate.binding.organo_tipo);
      return buildEntry(query, candidate, rulePack, rows.effectiveRule, "PARCIAL");
    });
    const top = alternatives[0];
    return {
      ...top,
      registry_status: "REQUIERE_SELECCION_MANUAL",
      alternativas: alternatives,
    };
  }

  const winner = scored[0];
  const rulePack = selectRulePackContext(rows.rulePacks ?? [], query.materia, winner.binding.organo_tipo);
  const status = winner.score < expectedExactScore(query) ? "PARCIAL" : "RESUELTA";
  return buildEntry(query, winner, rulePack, rows.effectiveRule, status);
}

const TEMPLATE_SELECT =
  "id, tenant_id, tipo, materia, materia_acuerdo, jurisdiccion, version, estado, aprobada_por, fecha_aprobacion, referencia_legal, organo_tipo, adoption_mode, capa3_editables";

export async function resolveMatterEntry(
  client: SupabaseClient,
  query: MatterRegistryResolveQuery,
): Promise<MatterRegistryEntry> {
  const docType = query.docType ?? DEFAULT_DOC_TYPE;
  let bindingsQuery = client
    .from("materia_template_binding")
    .select("*")
    .eq("tenant_id", query.tenantId)
    .eq("materia", query.materia)
    .eq("doc_type", docType)
    .eq("active", true)
    .order("priority", { ascending: true });

  if (query.jurisdiccion) bindingsQuery = bindingsQuery.in("jurisdiccion", [query.jurisdiccion, "ANY", "GLOBAL", "MULTI"]);
  if (query.tipoSocial) bindingsQuery = bindingsQuery.in("tipo_social", [query.tipoSocial, "ANY"]);

  const [bindingsResult, templatesResult, rulePacksResult, p2Result] = await Promise.all([
    bindingsQuery,
    client
      .from("plantillas_protegidas")
      .select(TEMPLATE_SELECT)
      .eq("tenant_id", query.tenantId)
      .eq("tipo", docType)
      .in("estado", ["BORRADOR", "REVISADA", "APROBADA", "ACTIVA"]),
    client
      .from("rule_packs")
      .select(
        `
        id,
        tenant_id,
        materia,
        organo_tipo,
        descripcion,
        created_at,
        rule_pack_versions!inner (
          id,
          pack_id,
          version,
          is_active,
          created_at
        )
      `,
      )
      .eq("tenant_id", query.tenantId)
      .eq("materia", query.materia)
      .eq("rule_pack_versions.is_active", true),
    query.entityId
      ? client
          .from("secretaria_effective_rule_matrix")
          .select("*")
          .eq("tenant_id", query.tenantId)
          .eq("entity_id", query.entityId)
          .eq("matter_code", query.materia)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (bindingsResult.error) throw bindingsResult.error;
  if (templatesResult.error) throw templatesResult.error;
  if (rulePacksResult.error) throw rulePacksResult.error;
  if (p2Result.error) throw p2Result.error;

  return resolveMatterRegistryFromRows(query, {
    bindings: (bindingsResult.data ?? []) as MatterRegistryBindingRow[],
    templates: (templatesResult.data ?? []) as MatterRegistryTemplateRow[],
    rulePacks: (rulePacksResult.data ?? []) as MatterRegistryRulePackRow[],
    effectiveRule: (p2Result.data ?? null) as MatterRegistryEffectiveRuleRow | null,
  });
}
