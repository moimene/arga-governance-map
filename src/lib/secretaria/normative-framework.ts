export type NormativeLayer =
  | "LEY"
  | "REGISTRO"
  | "ESTATUTOS"
  | "PACTO_PARASOCIAL"
  | "REGLAMENTO"
  | "POLITICA"
  | "SISTEMA";

export type NormativePlane =
  | "SOCIETARIO"
  | "REGISTRAL"
  | "CONTRACTUAL"
  | "OPERATIVO"
  | "SISTEMA";

export type NormativeSourceStatus = "ACTIVE" | "MISSING" | "WARNING" | "CONFLICT";
export type NormativeFrameworkStatus = "COMPLETO" | "INCOMPLETO" | "CONFLICTO" | "DESACTUALIZADO";

export type FormalizationRequirementKind =
  | "CERTIFICACION"
  | "ESCRITURA_PUBLICA"
  | "INSCRIPCION_REGISTRAL"
  | "LIBRO_ACTAS"
  | "PUBLICACION_SUPERVISOR"
  | "EVIDENCIA_QTSP";

export interface NormativeSource {
  id: string;
  layer: NormativeLayer;
  plane: NormativePlane;
  label: string;
  reference: string | null;
  version: string | number | null;
  status: NormativeSourceStatus;
  priority: number;
  source_id: string | null;
  materia: string | null;
  notes: string[];
}

export interface NormativeRuleSetInput {
  id: string;
  jurisdiction?: string | null;
  company_form?: string | null;
  typology_code?: string | null;
  rule_set_version?: string | number | null;
  legal_reference?: string | null;
  name?: string | null;
  is_active?: boolean | null;
  rule_config?: Record<string, unknown> | null;
}

export interface NormativeRulePackInput {
  id: string;
  rule_pack_id?: string | null;
  pack_id?: string | null;
  version_tag?: string | null;
  version?: string | number | null;
  version_number?: string | number | null;
  status?: string | null;
  is_active?: boolean | null;
  materia?: string | null;
  organo_tipo?: string | null;
}

export interface NormativeOverrideInput {
  id: string;
  entity_id?: string | null;
  materia?: string | null;
  clave?: string | null;
  valor?: unknown;
  fuente?: string | null;
  referencia?: string | null;
}

export interface NormativePactoInput {
  id: string;
  titulo?: string | null;
  tipo_clausula?: string | null;
  materias_aplicables?: string[] | null;
  descripcion?: string | null;
  estado?: string | null;
}

export interface NormativeEntityInput {
  id: string;
  common_name?: string | null;
  legal_name?: string | null;
  jurisdiction?: string | null;
  legal_form?: string | null;
  tipo_social?: string | null;
  forma_administracion?: string | null;
  tipo_organo_admin?: string | null;
  es_unipersonal?: boolean | null;
  es_cotizada?: boolean | null;
}

export interface EntityNormativeProfileInput {
  tenantId?: string | null;
  entity: NormativeEntityInput;
  jurisdictionRuleSets?: NormativeRuleSetInput[];
  rulePacks?: NormativeRulePackInput[];
  overrides?: NormativeOverrideInput[];
  pactos?: NormativePactoInput[];
  now?: Date | string;
}

export interface EntityNormativeProfile {
  schema_version: "entity-normative-profile.v1";
  profile_id: string;
  profile_hash: string;
  profile_version: string;
  tenant_id: string | null;
  entity_id: string;
  entity_name: string | null;
  jurisdiction: string | null;
  company_form: string | null;
  rule_set_company_form: string | null;
  is_listed: boolean;
  is_unipersonal: boolean;
  status: NormativeFrameworkStatus;
  sources: NormativeSource[];
  warnings: string[];
  blockers: string[];
  rule_trace: {
    jurisdiction_rule_set_ids: string[];
    rule_pack_version_ids: string[];
    override_ids: string[];
    pacto_ids: string[];
  };
  effective_at: string;
}

export interface FormalizationRequirement {
  kind: FormalizationRequirementKind;
  status: "REQUIRED" | "CONDITIONAL" | "INFORMATIONAL";
  label: string;
  reason: string;
  source_layers: NormativeLayer[];
}

export interface AgreementNormativeSnapshot {
  schema_version: "agreement-normative-snapshot.v1";
  snapshot_id: string;
  profile_id: string;
  profile_hash: string;
  profile_version: string;
  entity_id: string | null;
  agreement_id: string | null;
  agreement_kind: string | null;
  matter_class: string | null;
  adoption_mode: string | null;
  agreement_status: string | null;
  framework_status: NormativeFrameworkStatus;
  evaluated_at: string;
  sources: NormativeSource[];
  formalization_requirements: FormalizationRequirement[];
  warnings: string[];
  blockers: string[];
  rule_trace: EntityNormativeProfile["rule_trace"] & {
    meeting_rule_pack_id?: string | null;
    meeting_rule_pack_version?: string | null;
    meeting_ruleset_snapshot_id?: string | null;
    meeting_payload_hash?: string | null;
  };
}

export interface AgreementNormativeSnapshotInput {
  agreement: {
    id?: string | null;
    entity_id?: string | null;
    agreement_kind?: string | null;
    matter_class?: string | null;
    adoption_mode?: string | null;
    status?: string | null;
    inscribable?: boolean | null;
    compliance_snapshot?: Record<string, unknown> | null;
  };
  profile: EntityNormativeProfile;
  now?: Date | string;
}

function isoNow(now?: Date | string) {
  const date = now ? new Date(now) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function normativeFingerprint(value: unknown) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `nf_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function normalizeSocietyFormForNormative(
  value?: string | null,
  options: { listed?: boolean | null } = {},
) {
  const raw = cleanText(value)
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\s_-]+/g, "")
    .toUpperCase();
  if (options.listed) return "SA_COTIZADA";
  if (!raw) return null;
  if (raw.includes("SAU")) return "SAU";
  if (raw === "SA" || raw.includes("SOCIEDADANONIMA")) return "SA";
  if (raw.includes("SLU")) return "SLU";
  if (raw === "SL" || raw === "SRL" || raw.includes("SOCIEDADLIMITADA")) return "SL";
  return raw;
}

export function normalizeSocietyFormForRuleSet(value?: string | null, options: { listed?: boolean | null } = {}) {
  const normalized = normalizeSocietyFormForNormative(value, options);
  if (normalized === "SA_COTIZADA" || normalized === "SAU") return "SA";
  if (normalized === "SLU") return "SL";
  return normalized;
}

function source(input: Omit<NormativeSource, "id">): NormativeSource {
  return {
    ...input,
    id: normativeFingerprint({
      layer: input.layer,
      plane: input.plane,
      reference: input.reference,
      source_id: input.source_id,
      materia: input.materia,
      version: input.version,
    }),
  };
}

function activeRulePacks(packs: NormativeRulePackInput[]) {
  return packs.filter((pack) => {
    if (pack.is_active === false) return false;
    const status = cleanText(pack.status)?.toUpperCase();
    return !status || status === "ACTIVE" || status === "ACTIVA";
  });
}

function activeRuleSets(ruleSets: NormativeRuleSetInput[]) {
  return ruleSets.filter((ruleSet) => ruleSet.is_active !== false);
}

function fuenteIsEstatutos(override: NormativeOverrideInput) {
  return cleanText(override.fuente)?.toUpperCase().includes("ESTATUT") === true;
}

export function buildEntityNormativeProfile(input: EntityNormativeProfileInput): EntityNormativeProfile {
  const entity = input.entity;
  const effectiveAt = isoNow(input.now);
  const companyForm = normalizeSocietyFormForNormative(entity.tipo_social ?? entity.legal_form, {
    listed: entity.es_cotizada,
  });
  const ruleSetCompanyForm = normalizeSocietyFormForRuleSet(entity.tipo_social ?? entity.legal_form, {
    listed: entity.es_cotizada,
  });
  const ruleSets = activeRuleSets(input.jurisdictionRuleSets ?? []);
  const packs = activeRulePacks(input.rulePacks ?? []);
  const overrides = input.overrides ?? [];
  const statutoryOverrides = overrides.filter(fuenteIsEstatutos);
  const pactos = (input.pactos ?? []).filter((pacto) => cleanText(pacto.estado)?.toUpperCase() !== "ARCHIVADO");

  const warnings: string[] = [];
  const blockers: string[] = [];
  const sources: NormativeSource[] = [];

  if (!entity.jurisdiction) blockers.push("La sociedad no tiene jurisdiccion informada.");
  if (!companyForm) blockers.push("La sociedad no tiene tipo social/forma juridica normalizada.");

  if (ruleSets.length > 0) {
    for (const ruleSet of ruleSets) {
      sources.push(source({
        layer: "LEY",
        plane: "SOCIETARIO",
        label: ruleSet.name ?? "Regimen societario aplicable",
        reference: ruleSet.legal_reference ?? "LSC",
        version: ruleSet.rule_set_version ?? null,
        status: "ACTIVE",
        priority: 10,
        source_id: ruleSet.id,
        materia: ruleSet.typology_code ?? "GENERAL",
        notes: ["Regla legal base por jurisdiccion y tipo social."],
      }));
    }
  } else {
    const message = "No hay jurisdiction_rule_set activo para la sociedad.";
    warnings.push(message);
    sources.push(source({
      layer: "LEY",
      plane: "SOCIETARIO",
      label: "Regimen societario aplicable",
      reference: entity.jurisdiction ? `Jurisdiccion ${entity.jurisdiction}` : null,
      version: null,
      status: "MISSING",
      priority: 10,
      source_id: null,
      materia: "GENERAL",
      notes: [message],
    }));
  }

  sources.push(source({
    layer: "REGISTRO",
    plane: "REGISTRAL",
    label: "Control registral y formalizacion",
    reference: entity.jurisdiction ? `Registro Mercantil ${entity.jurisdiction}` : null,
    version: null,
    status: entity.jurisdiction ? "ACTIVE" : "MISSING",
    priority: 20,
    source_id: null,
    materia: "FORMALIZACION",
    notes: ["Determina escritura, inscripcion y evidencia de presentacion cuando proceda."],
  }));

  if (statutoryOverrides.length > 0) {
    sources.push(source({
      layer: "ESTATUTOS",
      plane: "SOCIETARIO",
      label: "Estatutos sociales parametrizados",
      reference: statutoryOverrides.map((override) => override.referencia).filter(Boolean).join("; ") || null,
      version: null,
      status: "ACTIVE",
      priority: 30,
      source_id: statutoryOverrides.map((override) => override.id).join(","),
      materia: "OVERRIDES",
      notes: [`${statutoryOverrides.length} regla(s) estatutaria(s) parametrizada(s).`],
    }));
  } else {
    const message = "Estatutos no versionados como fuente estructurada; se opera con LSC y overrides disponibles.";
    warnings.push(message);
    sources.push(source({
      layer: "ESTATUTOS",
      plane: "SOCIETARIO",
      label: "Estatutos sociales",
      reference: null,
      version: null,
      status: "WARNING",
      priority: 30,
      source_id: null,
      materia: "GENERAL",
      notes: [message],
    }));
  }

  if (pactos.length > 0) {
    warnings.push("Existen pactos parasociales vigentes: control contractual paralelo, no invalida automaticamente el acuerdo societario.");
    for (const pacto of pactos) {
      sources.push(source({
        layer: "PACTO_PARASOCIAL",
        plane: "CONTRACTUAL",
        label: pacto.titulo ?? pacto.tipo_clausula ?? "Pacto parasocial",
        reference: pacto.tipo_clausula ?? null,
        version: null,
        status: "ACTIVE",
        priority: 40,
        source_id: pacto.id,
        materia: ((pacto.materias_aplicables ?? []).join(", ") || pacto.tipo_clausula) ?? null,
        notes: [pacto.descripcion ?? "Control contractual paralelo al plano societario."],
      }));
    }
  } else {
    sources.push(source({
      layer: "PACTO_PARASOCIAL",
      plane: "CONTRACTUAL",
      label: "Pactos parasociales",
      reference: null,
      version: null,
      status: "MISSING",
      priority: 40,
      source_id: null,
      materia: "GENERAL",
      notes: ["Sin pacto vigente registrado para esta sociedad."],
    }));
  }

  sources.push(source({
    layer: "REGLAMENTO",
    plane: "OPERATIVO",
    label: "Reglamento de organo",
    reference: null,
    version: null,
    status: "WARNING",
    priority: 50,
    source_id: null,
    materia: entity.tipo_organo_admin ?? entity.forma_administracion ?? "ORGANO",
    notes: ["No existe repositorio estructurado de reglamentos; se conserva como fuente esperada."],
  }));

  for (const pack of packs) {
    sources.push(source({
      layer: "POLITICA",
      plane: "SISTEMA",
      label: `Rule pack ${pack.materia ?? pack.rule_pack_id ?? pack.pack_id ?? pack.id}`,
      reference: pack.rule_pack_id ?? pack.pack_id ?? pack.id,
      version: pack.version_tag ?? pack.version_number ?? pack.version ?? null,
      status: "ACTIVE",
      priority: 60,
      source_id: pack.id,
      materia: pack.materia ?? null,
      notes: ["Parametro operativo del motor LSC."],
    }));
  }

  sources.push(source({
    layer: "SISTEMA",
    plane: "SISTEMA",
    label: "Motor Acuerdo 360 + motor de plantillas",
    reference: "agreement-360.v1 / motor-plantillas@1.0.0-beta",
    version: "1",
    status: "ACTIVE",
    priority: 70,
    source_id: null,
    materia: "TRAZABILIDAD",
    notes: ["Fachada tecnica que congela snapshot, borrador editable, DOCX y evidencia."],
  }));

  if (entity.es_cotizada) {
    warnings.push("Sociedad cotizada: se evalua LSC y se emiten advertencias LMV/CNMV sin bloqueo automatico.");
  }

  const hasMissingCore = sources.some(
    (s) => (s.layer === "LEY" || s.layer === "REGISTRO") && s.status === "MISSING",
  );
  const status: NormativeFrameworkStatus =
    blockers.length > 0 ? "CONFLICTO" : hasMissingCore ? "INCOMPLETO" : "COMPLETO";

  const ruleTrace = {
    jurisdiction_rule_set_ids: ruleSets.map((ruleSet) => ruleSet.id),
    rule_pack_version_ids: packs.map((pack) => pack.id),
    override_ids: overrides.map((override) => override.id),
    pacto_ids: pactos.map((pacto) => pacto.id),
  };
  const profileHash = normativeFingerprint({
    entity_id: entity.id,
    jurisdiction: entity.jurisdiction ?? null,
    companyForm,
    ruleSetCompanyForm,
    sources: sources.map((s) => ({
      layer: s.layer,
      reference: s.reference,
      version: s.version,
      status: s.status,
      source_id: s.source_id,
      materia: s.materia,
    })),
    ruleTrace,
  });

  return {
    schema_version: "entity-normative-profile.v1",
    profile_id: `normative-profile:${entity.id}:${profileHash}`,
    profile_hash: profileHash,
    profile_version: "1",
    tenant_id: input.tenantId ?? null,
    entity_id: entity.id,
    entity_name: entity.common_name ?? entity.legal_name ?? null,
    jurisdiction: entity.jurisdiction ?? null,
    company_form: companyForm,
    rule_set_company_form: ruleSetCompanyForm,
    is_listed: entity.es_cotizada === true,
    is_unipersonal: entity.es_unipersonal === true,
    status,
    sources: sources.sort((a, b) => a.priority - b.priority),
    warnings,
    blockers,
    rule_trace: ruleTrace,
    effective_at: effectiveAt,
  };
}

export function summarizeFormalizationForAgreement(input: {
  agreement_kind?: string | null;
  matter_class?: string | null;
  adoption_mode?: string | null;
  inscribable?: boolean | null;
  is_listed?: boolean | null;
}): FormalizationRequirement[] {
  const matterClass = cleanText(input.matter_class)?.toUpperCase();
  const adoptionMode = cleanText(input.adoption_mode)?.toUpperCase();
  const inscribable = input.inscribable === true || matterClass === "ESTRUCTURAL" || matterClass === "ESTATUTARIA";
  const requirements: FormalizationRequirement[] = [
    {
      kind: "CERTIFICACION",
      status: "REQUIRED",
      label: "Certificacion del acuerdo",
      reason: "Todo acuerdo promovido debe poder certificarse desde el expediente.",
      source_layers: ["LEY", "ESTATUTOS"],
    },
    {
      kind: "LIBRO_ACTAS",
      status: "REQUIRED",
      label: "Incorporacion al libro de actas",
      reason: adoptionMode === "MEETING"
        ? "El acuerdo nace de una sesion y debe quedar reflejado en acta."
        : "El acuerdo sin sesion o decision unipersonal debe documentarse y conservarse.",
      source_layers: ["LEY", "SISTEMA"],
    },
    {
      kind: "EVIDENCIA_QTSP",
      status: "REQUIRED",
      label: "Evidencia tecnica y firma/sello cuando proceda",
      reason: "El entorno conserva hash, borrador configurado y evidencias DEMO_OPERATIVA.",
      source_layers: ["SISTEMA"],
    },
  ];

  if (inscribable) {
    requirements.push(
      {
        kind: "ESCRITURA_PUBLICA",
        status: "REQUIRED",
        label: "Elevacion a publico",
        reason: "La materia es inscribible, estructural o estatutaria.",
        source_layers: ["LEY", "REGISTRO"],
      },
      {
        kind: "INSCRIPCION_REGISTRAL",
        status: "REQUIRED",
        label: "Inscripcion registral",
        reason: "El acuerdo requiere tracto registral tras su formalizacion.",
        source_layers: ["REGISTRO"],
      },
    );
  }

  if (input.is_listed) {
    requirements.push({
      kind: "PUBLICACION_SUPERVISOR",
      status: "CONDITIONAL",
      label: "Control LMV/CNMV",
      reason: "La sociedad es cotizada; el sistema advierte, no bloquea automaticamente.",
      source_layers: ["LEY"],
    });
  }

  return requirements;
}

function meetingTrace(snapshot?: Record<string, unknown> | null) {
  const trace = snapshot?.rule_trace;
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) return {};
  const record = trace as Record<string, unknown>;
  return {
    meeting_rule_pack_id: cleanText(record.rule_pack_id),
    meeting_rule_pack_version: cleanText(record.rule_pack_version),
    meeting_ruleset_snapshot_id: cleanText(record.ruleset_snapshot_id),
    meeting_payload_hash: cleanText(record.payload_hash),
  };
}

export function buildAgreementNormativeSnapshot(
  input: AgreementNormativeSnapshotInput,
): AgreementNormativeSnapshot {
  const agreement = input.agreement;
  const profile = input.profile;
  const formalization = summarizeFormalizationForAgreement({
    agreement_kind: agreement.agreement_kind,
    matter_class: agreement.matter_class,
    adoption_mode: agreement.adoption_mode,
    inscribable: agreement.inscribable,
    is_listed: profile.is_listed,
  });
  const evaluatedAt = isoNow(input.now);
  const snapshotHash = normativeFingerprint({
    agreement_id: agreement.id ?? null,
    agreement_kind: agreement.agreement_kind ?? null,
    matter_class: agreement.matter_class ?? null,
    adoption_mode: agreement.adoption_mode ?? null,
    status: agreement.status ?? null,
    profile_hash: profile.profile_hash,
    formalization: formalization.map((item) => item.kind),
  });

  return {
    schema_version: "agreement-normative-snapshot.v1",
    snapshot_id: `normative-snapshot:${agreement.id ?? "draft"}:${snapshotHash}`,
    profile_id: profile.profile_id,
    profile_hash: profile.profile_hash,
    profile_version: profile.profile_version,
    entity_id: agreement.entity_id ?? profile.entity_id ?? null,
    agreement_id: agreement.id ?? null,
    agreement_kind: agreement.agreement_kind ?? null,
    matter_class: agreement.matter_class ?? null,
    adoption_mode: agreement.adoption_mode ?? null,
    agreement_status: agreement.status ?? null,
    framework_status: profile.status,
    evaluated_at: evaluatedAt,
    sources: profile.sources,
    formalization_requirements: formalization,
    warnings: profile.warnings,
    blockers: profile.blockers,
    rule_trace: {
      ...profile.rule_trace,
      ...meetingTrace(agreement.compliance_snapshot),
    },
  };
}

export function compactAgreementNormativeSnapshot(snapshot: AgreementNormativeSnapshot | null | undefined) {
  if (!snapshot) return null;
  return {
    schema_version: snapshot.schema_version,
    snapshot_id: snapshot.snapshot_id,
    profile_id: snapshot.profile_id,
    profile_hash: snapshot.profile_hash,
    profile_version: snapshot.profile_version,
    framework_status: snapshot.framework_status,
    entity_id: snapshot.entity_id,
    agreement_id: snapshot.agreement_id,
    agreement_kind: snapshot.agreement_kind,
    matter_class: snapshot.matter_class,
    adoption_mode: snapshot.adoption_mode,
    evaluated_at: snapshot.evaluated_at,
    source_layers: snapshot.sources.map((source) => source.layer),
    formalization: snapshot.formalization_requirements.map((item) => item.kind),
    warnings: snapshot.warnings,
    blockers: snapshot.blockers,
    rule_trace: snapshot.rule_trace,
  };
}
