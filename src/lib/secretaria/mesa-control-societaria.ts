import type { MateriaCatalogRow } from "@/hooks/useMateriaConfig";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import type { RuleParamOverrideRow } from "@/hooks/useRulePacks";
import { materiaPactoCoincide } from "@/lib/rules-engine/materia-pacto-mapping";
import { rulePackMateriaMatches } from "@/lib/rules-engine/rule-resolution";
import type { TipoSocial } from "@/lib/secretaria/sociedad-onboarding/types";
import {
  MATERIA_CANONICAL_ALIAS as CANONICAL_MATERIA_ALIAS,
  labelMateria,
  resolveMateriaAlias as resolveCanonicalMateriaAlias,
} from "./agenda-materias";
import {
  TIPO_LABEL,
  adoptionModeLabel,
  hasSpecificTemplateMetadata,
  isAdoptionMetadataRequired,
  jurisdictionLabel,
  organoLabel,
  templateMetadataPolicy,
  tipoLabel,
  tipoSocialLabel,
} from "./template-admin/labels";
import { normalizeOrganoTipo } from "./template-admin/organo-canonico";

export type FunctionalMatterGroupId =
  | "GOBIERNO_ORGANOS"
  | "CUENTAS_RESULTADO_AUDITORIA"
  | "CAPITAL_FINANCIACION"
  | "OPERACIONES_ESTRUCTURALES"
  | "ESTATUTOS_NORMATIVA_INTERNA"
  | "OPERACIONES_ESPECIALES_VINCULADAS"
  | "INFORMACION_SEGUIMIENTO_CONTROL";

export interface FunctionalMatterGroup {
  id: FunctionalMatterGroupId;
  title: string;
  description: string;
  complexity: "ordinaria" | "reforzada" | "estructural" | "especial" | "informativa";
}

export type EffectiveRuleOperationalStatus =
  | "OK"
  | "INCOMPLETO"
  | "REQUIERE_REVISION"
  | "CONFLICTO_JURISDICCIONAL";

export type RequirementOperationalState = "cumplido" | "pendiente" | "bloqueante" | "no_aplica";

export type SourceChipType = "Ley" | "Estatutos" | "Reglamento" | "Pacto parasocial" | "Override documental";

export interface SourceChipViewModel {
  type: SourceChipType;
  reference: string;
  version: string;
  validationState: "Validado" | "Pendiente revisión" | "Inferido" | "Incompleto";
  actionLabel: string;
}

export interface ConflictOfLawsResult {
  conflict_of_laws_flag: boolean;
  conflict_kind?: "law" | "social_form";
  expectedLawLabel: string;
  appliedLawLabel: string;
  explanation: string;
}

export interface SocietySocialTypeResolution {
  value: string | null;
  conflict: boolean;
  explanation: string | null;
}

export interface TemplateReadinessItem {
  stage: TemplateDocumentStage;
  status: "asignada" | "faltante" | "pendiente_revision" | "activa" | "no_aplica";
  criticality: TemplateStageCriticality;
  blocking: boolean;
  consequence: string;
  actionLabel: string;
}

export interface TemplateReadinessResult {
  canStartCase: boolean;
  openingStatus: TemplateOpeningStatus;
  openingMessage: string;
  blockingMessage: string | null;
  items: TemplateReadinessItem[];
}

export interface OrganCatalogContract {
  id: string;
  societyId: string;
  name: string;
  type: string;
  status: "activo" | "incompleto" | "sin_reglamento";
  competences: string[];
  quorum: string;
  majority: string;
  sourceReference: string;
}

export interface NormativeMaintenanceAuditEventContract {
  action:
    | "ruleset_activated"
    | "statute_version_published"
    | "clause_mapped"
    | "organ_changed"
    | "template_assigned"
    | "expediente_blocked"
    | "conflict_of_laws_flagged"
    | "effective_rule_viewed";
  societyId: string;
  matter?: string | null;
  userRole: "viewer" | "editor" | "admin" | "legal_ops";
  before?: unknown;
  after?: unknown;
  durationMs?: number;
}

export type NormativeMaintenanceRole = "viewer" | "editor" | "admin" | "legal_ops";

export type NormativeMaintenanceAction =
  | "activate_rule_set"
  | "publish_statutes"
  | "map_clause"
  | "change_organ"
  | "assign_template"
  | "resolve_conflict"
  | "revert_version"
  | "view_source";

export interface NormativeActionDecision {
  allowed: boolean;
  reason: string | null;
  ctaLabel: string;
}

export interface NormativeHistoryEntry {
  id: string;
  date: string;
  actor: string;
  action: string;
  before: string;
  after: string;
  comment: string;
}

export interface NormativeRolloutPlan {
  flags: typeof P1_OPERATIONAL_FEATURE_FLAGS;
  cohorts: Array<{ label: string; percentage: number; condition: string }>;
  killSwitch: string;
}

export const P1_OPERATIONAL_FEATURE_FLAGS = {
  ff_ruleset_wizard: true,
  ff_organs_catalog: true,
  ff_effective_rule_edit: false,
  ff_normative_cloud_p1: true,
  ff_organs_persistence: true,
  ff_statute_versions: true,
  ff_overrides_ui: true,
} as const;

export type P1OperationalFeatureFlag = keyof typeof P1_OPERATIONAL_FEATURE_FLAGS;

export interface NormativeFeatureFlagDecision {
  flag: P1OperationalFeatureFlag;
  enabled: boolean;
  label: string;
  reason: string;
}

export interface NormativeReadModelContract {
  table:
    | "governing_bodies"
    | "secretaria_organ_rules"
    | "secretaria_statute_versions"
    | "secretaria_statute_clause_mappings"
    | "secretaria_normative_overrides"
    | "materia_template_binding"
    | "secretaria_effective_rule_matrix"
    | "audit_log";
  purpose: string;
  keyFields: string[];
  requiredFields: string[];
  readiness: "implementado" | "contrato_front" | "requiere_backend";
}

export interface NormativeTelemetryEvent {
  name: NormativeMaintenanceAuditEventContract["action"];
  attributes: {
    society_id: string;
    matter: string | null;
    user_role: NormativeMaintenanceRole;
    before: unknown;
    after: unknown;
    duration_ms?: number;
    timestamp: string;
  };
}

export interface P1OperationalKpiContract {
  incompleteToOkMinutesP50: number;
  incompleteToOkMinutesP95: number;
  sourceCoverageTargetPct: number;
  expedienteMissingTemplatesAllowed: number;
  unexplainedJurisdictionMixesAllowed: number;
}

export interface P1PerformanceBudgetContract {
  ttfbP95Ms: number;
  renderP95Ms: number;
  wizardAdditionalBundleKbGzip: number;
}

export interface P1A11yI18nContract {
  wcag: "2.1 AA";
  languages: Array<"ES" | "EN" | "DE">;
  localizedLegalForms: boolean;
  requiredControlPatterns: string[];
}

export interface P1LegacyBackfillPlan {
  target: "sociedades_existentes";
  markIncompleteWhenMissing: string[];
  preserveExistingOverrides: boolean;
  cloudWriteRequired: boolean;
}

const ACTION_PERMISSIONS: Record<NormativeMaintenanceAction, NormativeMaintenanceRole[]> = {
  activate_rule_set: ["editor", "admin", "legal_ops"],
  publish_statutes: ["editor", "admin", "legal_ops"],
  map_clause: ["editor", "admin", "legal_ops"],
  change_organ: ["editor", "admin", "legal_ops"],
  assign_template: ["editor", "admin", "legal_ops"],
  resolve_conflict: ["admin", "legal_ops"],
  revert_version: ["admin", "legal_ops"],
  view_source: ["viewer", "editor", "admin", "legal_ops"],
};

export function normativeRoleFromAppRole(role?: string | null): NormativeMaintenanceRole {
  const normalized = normalizeCode(role);
  if (normalized === "ADMINTENANT" || normalized === "ADMIN") return "admin";
  if (normalized === "COMPLIANCE" || normalized === "LEGALOPS") return "legal_ops";
  if (normalized === "SECRETARIO" || normalized === "VICESECRETARIO") return "editor";
  return "viewer";
}

export function canPerformNormativeAction(
  role: NormativeMaintenanceRole,
  action: NormativeMaintenanceAction,
): NormativeActionDecision {
  const allowed = ACTION_PERMISSIONS[action].includes(role);
  return {
    allowed,
    reason: allowed ? null : "No tiene permiso para modificar fuentes normativas en esta sociedad.",
    ctaLabel: allowed ? actionLabel(action) : "Solicitar edición",
  };
}

function actionLabel(action: NormativeMaintenanceAction) {
  if (action === "activate_rule_set") return "Activar regla legal base";
  if (action === "publish_statutes") return "Publicar estatutos";
  if (action === "map_clause") return "Mapear cláusula";
  if (action === "change_organ") return "Cambiar órgano";
  if (action === "assign_template") return "Asignar plantilla";
  if (action === "resolve_conflict") return "Cerrar conflicto";
  if (action === "revert_version") return "Revertir versión";
  return "Ver fuente";
}

export function buildNormativeAuditEvent(input: {
  action: NormativeMaintenanceAuditEventContract["action"];
  societyId: string;
  matter?: string | null;
  userRole: NormativeMaintenanceRole;
  before?: unknown;
  after?: unknown;
  durationMs?: number;
}): NormativeMaintenanceAuditEventContract {
  return {
    action: input.action,
    societyId: input.societyId,
    matter: input.matter ?? null,
    userRole: input.userRole,
    before: input.before ?? null,
    after: input.after ?? null,
    durationMs: input.durationMs,
  };
}

export function buildNormativeHistoryEntries(input: {
  sources?: Array<{ layer?: string | null; label?: string | null; reference?: string | null; version?: string | number | null; status?: string | null }>;
  actor?: string | null;
  effectiveAt?: string | null;
}): NormativeHistoryEntry[] {
  const date = input.effectiveAt ?? new Date(0).toISOString();
  const actor = input.actor ?? "Sistema";
  return (input.sources ?? []).map((source, index) => ({
    id: `norm-history-${index}-${source.layer ?? "source"}`,
    date,
    actor,
    action: source.status === "ACTIVE" ? "Fuente validada" : "Fuente pendiente",
    before: "Sin fuente estructurada",
    after: `${source.layer ?? "Fuente"} · ${source.label ?? source.reference ?? "sin referencia"}`,
    comment: source.reference ? `Referencia: ${source.reference}. Versión: ${source.version ?? "vigente"}.` : "Referencia pendiente de completar.",
  }));
}

export function buildNormativeRolloutPlan(): NormativeRolloutPlan {
  return {
    flags: P1_OPERATIONAL_FEATURE_FLAGS,
    cohorts: [
      { label: "Piloto legal", percentage: 10, condition: "ADMIN_TENANT y COMPLIANCE" },
      { label: "Operativa ampliada", percentage: 50, condition: "sociedades con marco OK" },
      { label: "Despliegue completo", percentage: 100, condition: "sin conflictos jurisdiccionales abiertos" },
    ],
    killSwitch: "desactivar ff_effective_rule_edit, ff_overrides_ui y mutaciones P2; mantener Regla efectiva en solo lectura",
  };
}

export function resolveP1OperationalFeatureFlags(
  overrides: Partial<Record<P1OperationalFeatureFlag, boolean>> = {},
) {
  return {
    ...P1_OPERATIONAL_FEATURE_FLAGS,
    ...overrides,
  };
}

function featureFlagLabel(flag: P1OperationalFeatureFlag) {
  if (flag === "ff_ruleset_wizard") return "Wizard de activación normativa";
  if (flag === "ff_organs_catalog") return "Catálogo de órganos";
  if (flag === "ff_normative_cloud_p1") return "Persistencia Cloud del diagnóstico";
  if (flag === "ff_organs_persistence") return "Persistencia de reglas de órgano";
  if (flag === "ff_statute_versions") return "Versionado de estatutos";
  if (flag === "ff_overrides_ui") return "Overrides gobernados";
  return "Edición directa de regla efectiva";
}

export function buildFeatureFlagDecision(
  flag: P1OperationalFeatureFlag,
  overrides: Partial<Record<P1OperationalFeatureFlag, boolean>> = {},
): NormativeFeatureFlagDecision {
  const flags = resolveP1OperationalFeatureFlags(overrides);
  const enabled = flags[flag];
  return {
    flag,
    enabled,
    label: featureFlagLabel(flag),
    reason: enabled
      ? "Funcionalidad activa para el carril operativo."
      : "Funcionalidad mantenida en solo lectura hasta completar gobierno y despliegue.",
  };
}

export function buildNormativeTelemetryEvent(
  event: NormativeMaintenanceAuditEventContract,
  now: string = new Date(0).toISOString(),
): NormativeTelemetryEvent {
  return {
    name: event.action,
    attributes: {
      society_id: event.societyId,
      matter: event.matter ?? null,
      user_role: event.userRole,
      before: event.before ?? null,
      after: event.after ?? null,
      duration_ms: event.durationMs,
      timestamp: now,
    },
  };
}

export function buildNormativeReadModelContracts(): NormativeReadModelContract[] {
  return [
    {
      table: "governing_bodies",
      purpose: "Catálogo societario de órganos por sociedad.",
      keyFields: ["id", "entity_id"],
      requiredFields: ["body_type", "name", "status", "regulation_id", "created_at"],
      readiness: "implementado",
    },
    {
      table: "secretaria_organ_rules",
      purpose: "Competencias, quórum y mayorías del órgano por materia.",
      keyFields: ["organ_id", "matter_code"],
      requiredFields: ["quorum", "majority", "source_ref", "version_id"],
      readiness: "implementado",
    },
    {
      table: "secretaria_statute_versions",
      purpose: "Versionado y publicación de estatutos por sociedad.",
      keyFields: ["id", "society_id"],
      requiredFields: ["version", "status", "published_at", "mapping_coverage"],
      readiness: "implementado",
    },
    {
      table: "secretaria_statute_clause_mappings",
      purpose: "Fuente enlazada por cláusula estatutaria, materia y requisito.",
      keyFields: ["statute_version_id", "matter_code", "requirement_key"],
      requiredFields: ["clause_ref", "requirement_value", "confidence"],
      readiness: "implementado",
    },
    {
      table: "secretaria_normative_overrides",
      purpose: "Overrides estatutarios y reglamentarios publicados con referencia documental.",
      keyFields: ["entity_id", "matter_code", "requirement_key"],
      requiredFields: ["requirement_value", "source_ref", "justification", "status"],
      readiness: "implementado",
    },
    {
      table: "materia_template_binding",
      purpose: "Binding determinista materia, órgano, tipo social, jurisdicción y forma de adopción a plantilla.",
      keyFields: ["materia", "doc_type", "priority"],
      requiredFields: ["template_id", "selection_reason", "active"],
      readiness: "implementado",
    },
    {
      table: "secretaria_effective_rule_matrix",
      purpose: "Matriz materializada sociedad x materia con regla efectiva y fuentes.",
      keyFields: ["entity_id", "matter_code"],
      requiredFields: ["majority_rule", "quorum_rule", "source_layers", "profile_hash"],
      readiness: "implementado",
    },
    {
      table: "audit_log",
      purpose: "Trazabilidad WORM de cambios de fuente, plantilla, órgano y publicación.",
      keyFields: ["object_type", "object_id", "created_at"],
      requiredFields: ["action", "delta", "hash_sha512"],
      readiness: "implementado",
    },
  ];
}

export function buildP1OperationalKpiContract(): P1OperationalKpiContract {
  return {
    incompleteToOkMinutesP50: 15,
    incompleteToOkMinutesP95: 25,
    sourceCoverageTargetPct: 90,
    expedienteMissingTemplatesAllowed: 0,
    unexplainedJurisdictionMixesAllowed: 0,
  };
}

export function buildP1PerformanceBudgetContract(): P1PerformanceBudgetContract {
  return {
    ttfbP95Ms: 500,
    renderP95Ms: 700,
    wizardAdditionalBundleKbGzip: 200,
  };
}

export function buildP1A11yI18nContract(): P1A11yI18nContract {
  return {
    wcag: "2.1 AA",
    languages: ["ES", "EN", "DE"],
    localizedLegalForms: true,
    requiredControlPatterns: [
      "labels visibles en formularios",
      "aria-disabled en acciones bloqueadas",
      "focus visible con token Garrigues",
      "nomenclatura legal localizada por jurisdicción",
    ],
  };
}

export function buildP1LegacyBackfillPlan(): P1LegacyBackfillPlan {
  return {
    target: "sociedades_existentes",
    markIncompleteWhenMissing: [
      "regla legal base",
      "estatutos publicados si se declararon modelados",
      "órgano competente",
      "plantillas mínimas",
      "conflictos jurisdiccionales sin resolver",
    ],
    preserveExistingOverrides: true,
    cloudWriteRequired: true,
  };
}

export const FUNCTIONAL_MATTER_GROUPS: FunctionalMatterGroup[] = [
  {
    id: "GOBIERNO_ORGANOS",
    title: "Gobierno corporativo y órganos",
    description: "Composición, cargos, delegaciones, comisiones y políticas del órgano.",
    complexity: "ordinaria",
  },
  {
    id: "CUENTAS_RESULTADO_AUDITORIA",
    title: "Cuentas anuales, resultado y auditoría",
    description: "Ciclo contable societario, resultado, dividendos y auditor.",
    complexity: "ordinaria",
  },
  {
    id: "CAPITAL_FINANCIACION",
    title: "Capital y financiación",
    description: "Capital social, financiación, obligaciones y derechos de socios.",
    complexity: "reforzada",
  },
  {
    id: "OPERACIONES_ESTRUCTURALES",
    title: "Operaciones estructurales",
    description: "Fusión, escisión, transformación, disolución y operaciones equivalentes.",
    complexity: "estructural",
  },
  {
    id: "ESTATUTOS_NORMATIVA_INTERNA",
    title: "Estatutos y normativa interna",
    description: "Modificación estatutaria y reglas internas del funcionamiento societario.",
    complexity: "reforzada",
  },
  {
    id: "OPERACIONES_ESPECIALES_VINCULADAS",
    title: "Operaciones especiales y vinculadas",
    description: "Activos esenciales, conflictos, operaciones vinculadas y pactos.",
    complexity: "especial",
  },
  {
    id: "INFORMACION_SEGUIMIENTO_CONTROL",
    title: "Información, seguimiento y control",
    description: "Presentaciones, toma de razón, seguimiento y asuntos sin acuerdo formal.",
    complexity: "informativa",
  },
];

export const MATTER_GROUP_BY_MATERIA: Record<string, FunctionalMatterGroupId> = {
  NOMBRAMIENTO_CONSEJERO: "GOBIERNO_ORGANOS",
  CESE_CONSEJERO: "GOBIERNO_ORGANOS",
  DELEGACION_FACULTADES: "GOBIERNO_ORGANOS",
  REMUNERACION_CONSEJEROS: "GOBIERNO_ORGANOS",
  COMISION_DELEGADA: "GOBIERNO_ORGANOS",
  CONVOCATORIA_COMISION_DELEGADA: "GOBIERNO_ORGANOS",
  POLITICA_CORPORATIVA: "GOBIERNO_ORGANOS",

  APROBACION_CUENTAS: "CUENTAS_RESULTADO_AUDITORIA",
  FORMULACION_CUENTAS: "CUENTAS_RESULTADO_AUDITORIA",
  CUENTAS_CONSOLIDADAS: "CUENTAS_RESULTADO_AUDITORIA",
  DISTRIBUCION_DIVIDENDOS: "CUENTAS_RESULTADO_AUDITORIA",
  DIVIDENDO_A_CUENTA: "CUENTAS_RESULTADO_AUDITORIA",
  APLICACION_RESULTADO: "CUENTAS_RESULTADO_AUDITORIA",
  NOMBRAMIENTO_AUDITOR: "CUENTAS_RESULTADO_AUDITORIA",

  AUMENTO_CAPITAL: "CAPITAL_FINANCIACION",
  EJECUCION_AUMENTO_DELEGADO: "CAPITAL_FINANCIACION",
  REDUCCION_CAPITAL: "CAPITAL_FINANCIACION",
  SUPRESION_PREFERENTE: "CAPITAL_FINANCIACION",
  EMISION_OBLIGACIONES: "CAPITAL_FINANCIACION",
  EMISION_DEUDA_CONVERTIBLE: "CAPITAL_FINANCIACION",
  DELEGACION_CAPITAL: "CAPITAL_FINANCIACION",
  ADQUISICION_PROPIA: "CAPITAL_FINANCIACION",
  FINANCIACION: "CAPITAL_FINANCIACION",

  FUSION: "OPERACIONES_ESTRUCTURALES",
  ESCISION: "OPERACIONES_ESTRUCTURALES",
  TRANSFORMACION: "OPERACIONES_ESTRUCTURALES",
  DISOLUCION: "OPERACIONES_ESTRUCTURALES",
  LIQUIDACION: "OPERACIONES_ESTRUCTURALES",
  VENTA_ACTIVOS_ESENCIALES: "OPERACIONES_ESTRUCTURALES",

  MODIFICACION_ESTATUTOS: "ESTATUTOS_NORMATIVA_INTERNA",
  AMPLIACION_OBJETO_SOCIAL: "ESTATUTOS_NORMATIVA_INTERNA",
  CAMBIO_DOMICILIO_SOCIAL: "ESTATUTOS_NORMATIVA_INTERNA",
  CAMBIO_DENOMINACION_SOCIAL: "ESTATUTOS_NORMATIVA_INTERNA",
  PRORROGA_SOCIEDAD: "ESTATUTOS_NORMATIVA_INTERNA",

  OPERACION_VINCULADA: "OPERACIONES_ESPECIALES_VINCULADAS",
  CONTRATACION_RELEVANTE: "OPERACIONES_ESPECIALES_VINCULADAS",
  PACTO_PARASOCIAL: "OPERACIONES_ESPECIALES_VINCULADAS",
  EXCLUSION_SOCIO: "OPERACIONES_ESPECIALES_VINCULADAS",
  SEPARACION_SOCIO: "OPERACIONES_ESPECIALES_VINCULADAS",
  TRANSMISION_PARTICIPACIONES: "OPERACIONES_ESPECIALES_VINCULADAS",
  CONTRATOS_SOCIO_UNICO_SOCIEDAD: "OPERACIONES_ESPECIALES_VINCULADAS",

  INFORME_GESTION: "INFORMACION_SEGUIMIENTO_CONTROL",
  APROBACION_PLAN_NEGOCIO: "INFORMACION_SEGUIMIENTO_CONTROL",
  APROBACION_PRESUPUESTO: "INFORMACION_SEGUIMIENTO_CONTROL",
  APROBACION_PRESUPUESTOS: "INFORMACION_SEGUIMIENTO_CONTROL",
  ACUERDO_CONVOCATORIA_JUNTA: "INFORMACION_SEGUIMIENTO_CONTROL",
  APROBACION_REGLAMENTO_CONSEJO: "GOBIERNO_ORGANOS",
  PODER_REPRESENTACION: "GOBIERNO_ORGANOS",
  PRESTACIONES_ACCESORIAS: "ESTATUTOS_NORMATIVA_INTERNA",
  SEGUIMIENTO_PLAN_NEGOCIO: "INFORMACION_SEGUIMIENTO_CONTROL",
  INFORME_COMITE_AUDITORIA: "INFORMACION_SEGUIMIENTO_CONTROL",
  ESTADO_CUMPLIMIENTO_NORMATIVO: "INFORMACION_SEGUIMIENTO_CONTROL",

  // Materias de materia_catalog (Cloud) que caían en el fallback silencioso
  // hacia el primer grupo ("Gobierno corporativo y órganos").
  ACCION_SOCIAL_RESPONSABILIDAD: "GOBIERNO_ORGANOS",
  DISTRIBUCION_CARGOS: "GOBIERNO_ORGANOS",
  NOMBRAMIENTO_CESE: "GOBIERNO_ORGANOS",
  AMPLIACION_CAPITAL: "CAPITAL_FINANCIACION",
  EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE: "CAPITAL_FINANCIACION",
  AUTORIZACION_GARANTIA: "OPERACIONES_ESPECIALES_VINCULADAS",
  MOD_ESTATUTOS: "ESTATUTOS_NORMATIVA_INTERNA",
  TRASLADO_DOMICILIO_NACIONAL: "ESTATUTOS_NORMATIVA_INTERNA",
};

/**
 * Alias legacy de agreement_kind que coexisten en materia_catalog con su
 * materia canónica y duplicaban tarjetas en el catálogo. El colapso es SOLO
 * de presentación: las filas de BD no se tocan (los expedientes históricos
 * pueden seguir referenciándolas).
 */
export const MATERIA_CANONICAL_ALIAS = CANONICAL_MATERIA_ALIAS;

export function resolveMateriaAlias(code?: string | null): string {
  return resolveCanonicalMateriaAlias(code);
}

/**
 * Matching de pacto ↔ materia tolerante a alias/sinónimos (ITEM-113): las
 * cláusulas Cloud usan vocabulario legacy (p.ej. AMPLIACION_CAPITAL) mientras
 * el catálogo colapsa a la materia canónica (AUMENTO_CAPITAL). Nunca comparar
 * con `includes` crudo desde el catálogo.
 */
export function pactoApplicaAMateria(
  pacto: { materias_aplicables?: string[] | null },
  materia: string,
): boolean {
  return materiaPactoCoincide(
    resolveMateriaAlias(materia),
    (pacto.materias_aplicables ?? []).map(resolveMateriaAlias),
  );
}

/** Matching de override ↔ materia tolerante a alias legacy. */
export function overrideApplicaAMateria(
  override: { materia?: string | null },
  materia: string,
): boolean {
  return resolveMateriaAlias(override.materia) === resolveMateriaAlias(materia);
}

// Nota: el overlay ortográfico de materia_catalog que vivió aquí (2026-07-10)
// se retiró el 2026-07-11 tras aplicarse y registrarse en Cloud la migración
// 20260710103000_materia_catalog_orthography_fix.sql (verificado: 0 labels sin
// tilde). La fuente de verdad de los labels vuelve a ser exclusivamente la BD.

export const INFORMATIVE_MATTERS: MateriaCatalogRow[] = [
  {
    materia: "INFORME_GESTION",
    materia_label_es: "Presentación del informe de gestión",
    requires_notary: false,
    requires_registry: false,
    inscribable: false,
    matter_class: "ESPECIAL",
    min_majority_code: null,
    publication_required: false,
    plazo_inscripcion_dias: null,
    referencia_legal: "art. 253 LSC; constancia en acta conforme al art. 97 RRM",
  },
  {
    materia: "SEGUIMIENTO_PLAN_NEGOCIO",
    materia_label_es: "Seguimiento del plan de negocio",
    requires_notary: false,
    requires_registry: false,
    inscribable: false,
    matter_class: "ESPECIAL",
    min_majority_code: null,
    publication_required: false,
    plazo_inscripcion_dias: null,
    referencia_legal: "Funciones de supervisión del órgano; constancia en acta",
  },
  {
    materia: "ESTADO_CUMPLIMIENTO_NORMATIVO",
    materia_label_es: "Estado de cumplimiento normativo",
    requires_notary: false,
    requires_registry: false,
    inscribable: false,
    matter_class: "ESPECIAL",
    min_majority_code: null,
    publication_required: false,
    plazo_inscripcion_dias: null,
    referencia_legal: "Funciones de supervisión y control interno",
  },
];

const INFORMATIVE_MATTER_CODES = new Set(
  INFORMATIVE_MATTERS.map((matter) => resolveMateriaAlias(matter.materia)),
);

/**
 * Naturaleza informativa explícita del catálogo. El grupo funcional agrupa
 * materias afines para navegación, pero no determina si existe o no acuerdo:
 * presupuesto, plan de negocio y convocatoria de junta viven en el grupo de
 * seguimiento y siguen siendo materias decisorias.
 */
export function isInformativeMatter(materia?: string | null): boolean {
  return INFORMATIVE_MATTER_CODES.has(resolveMateriaAlias(materia));
}

export interface LegalBaseline {
  tipoSocial: TipoSocial;
  noticeDays: number;
  ordinaryMajorityPct: number;
  reinforcedMajorityPct: number;
  firstQuorumPct: number;
  secondQuorumPct: number;
  legalReference: string;
}

export const LEGAL_BASELINE_BY_TIPO_SOCIAL: Record<TipoSocial, LegalBaseline> = {
  SA: {
    tipoSocial: "SA",
    noticeDays: 30,
    ordinaryMajorityPct: 50,
    reinforcedMajorityPct: 66.67,
    firstQuorumPct: 25,
    secondQuorumPct: 0,
    legalReference: "LSC: juntas de sociedad anónima; mayorías reforzadas arts. 194 y 201 LSC",
  },
  SAU: {
    tipoSocial: "SAU",
    noticeDays: 30,
    ordinaryMajorityPct: 100,
    reinforcedMajorityPct: 100,
    firstQuorumPct: 100,
    secondQuorumPct: 100,
    legalReference: "Socio único; decisiones consignadas en acta y libro correspondiente",
  },
  SL: {
    tipoSocial: "SL",
    noticeDays: 15,
    ordinaryMajorityPct: 50,
    reinforcedMajorityPct: 66.67,
    firstQuorumPct: 33.34,
    secondQuorumPct: 0,
    legalReference: "LSC: juntas de sociedad limitada; mayorías legales arts. 198 y 199 LSC",
  },
  SLU: {
    tipoSocial: "SLU",
    noticeDays: 15,
    ordinaryMajorityPct: 100,
    reinforcedMajorityPct: 100,
    firstQuorumPct: 100,
    secondQuorumPct: 100,
    legalReference: "Socio único; decisiones consignadas en acta y libro correspondiente",
  },
};

const ES_FORMS = new Set(["SA", "SAU", "SL", "SLU", "SRL"]);

const LEGAL_FORM_LABELS_BY_JURISDICTION: Record<string, Record<string, string>> = {
  ES: {
    SA: "S.A.",
    SAU: "S.A.U.",
    SL: "S.L.",
    SLU: "S.L.U.",
  },
  DE: {
    AG: "AG",
    GMBH: "GmbH",
    UG: "UG",
    KG: "KG",
  },
  PT: {
    SA: "S.A.",
    LDA: "Lda.",
  },
  BR: {
    SA: "S.A.",
    LTDA: "Ltda.",
  },
  MX: {
    SADECV: "S.A. de C.V.",
    SABDECV: "S.A.B. de C.V.",
    SRLDECV: "S. de R.L. de C.V.",
  },
};

function normalizeCode(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\s_-]+/g, "")
    .toUpperCase();
}

function spanishSocialTypeFamily(value?: string | null) {
  const normalized = normalizeCode(value);
  if (
    [
      "SA",
      "SAU",
      "SOCIEDADANONIMA",
      "SOCIEDADANONIMAUNIPERSONAL",
      "SOCIEDADANONIMACOTIZADA",
    ].includes(normalized)
  ) {
    return "SA";
  }
  if (
    [
      "SL",
      "SLU",
      "SRL",
      "SOCIEDADLIMITADA",
      "SOCIEDADLIMITADAUNIPERSONAL",
      "SOCIEDADDERESPONSABILIDADLIMITADA",
    ].includes(normalized)
  ) {
    return "SL";
  }
  return null;
}

/**
 * Resuelve el tipo social que puede consumir el motor sin ocultar conflictos
 * entre `tipo_social` y `legal_form`. En sociedades españolas, dos familias
 * incompatibles dejan el valor sin resolver: escoger una por precedencia haría
 * que la UI declarase aplicable una rama distinta de la forma jurídica visible.
 */
export function resolveSocietySocialTypeForRules(input: {
  jurisdiction?: string | null;
  tipoSocial?: string | null;
  legalForm?: string | null;
}): SocietySocialTypeResolution {
  const jurisdiction = normalizeCode(input.jurisdiction) || "ES";
  const tipoFamily = spanishSocialTypeFamily(input.tipoSocial);
  const legalFamily = spanishSocialTypeFamily(input.legalForm);
  if (jurisdiction === "ES" && tipoFamily && legalFamily && tipoFamily !== legalFamily) {
    return {
      value: null,
      conflict: true,
      explanation:
        `El tipo social (${input.tipoSocial}) y la forma jurídica (${input.legalForm}) pertenecen a familias distintas. ` +
        "Debe corregirse la ficha societaria antes de resolver la rama S.A. o S.L.",
    };
  }
  return {
    value:
      jurisdiction === "ES"
        ? input.tipoSocial ?? input.legalForm ?? null
        : input.legalForm ?? input.tipoSocial ?? null,
    conflict: false,
    explanation: null,
  };
}

export function displaySocietyLegalForm(input: {
  jurisdiction?: string | null;
  tipoSocial?: string | null;
  legalForm?: string | null;
}) {
  const jurisdiction = normalizeCode(input.jurisdiction) || "ES";
  const preferred = jurisdiction === "ES" ? input.tipoSocial ?? input.legalForm : input.legalForm ?? input.tipoSocial;
  const normalized = normalizeCode(preferred);
  if (!normalized) return "Forma no informada";
  return LEGAL_FORM_LABELS_BY_JURISDICTION[jurisdiction]?.[normalized] ?? preferred ?? normalized;
}

export function expectedLawByJurisdiction(jurisdiction?: string | null) {
  const normalized = normalizeCode(jurisdiction);
  if (normalized === "DE") return "Derecho societario alemán (AktG/GmbHG)";
  if (normalized === "PT") return "Código das Sociedades Comerciais";
  if (normalized === "BR") return "Lei das S.A. / Código Civil";
  if (normalized === "MX") return "LGSM mexicana";
  return "Ley de Sociedades de Capital española";
}

function textMentionsSpanishCompanyLaw(value?: string | null) {
  const normalized = normalizeCode(value);
  return normalized.includes("LSC") || normalized.includes("LEYDESOCIEDADESDECAPITAL");
}

export function detectConflictOfLaws(input: {
  jurisdiction?: string | null;
  tipoSocial?: string | null;
  legalForm?: string | null;
  appliedReferences?: Array<string | null | undefined>;
}): ConflictOfLawsResult {
  const jurisdiction = normalizeCode(input.jurisdiction) || "ES";
  const expectedLawLabel = expectedLawByJurisdiction(jurisdiction);
  const appliedReferences = input.appliedReferences ?? [];
  const appliedMentionsLsc = appliedReferences.some(textMentionsSpanishCompanyLaw);
  const displayedForm = displaySocietyLegalForm(input);
  const normalizedTipo = normalizeCode(input.tipoSocial);
  const normalizedLegal = normalizeCode(input.legalForm);
  const socialTypeResolution = resolveSocietySocialTypeForRules(input);
  const spanishFormOnForeignEntity = jurisdiction !== "ES" && ES_FORMS.has(normalizedTipo) && normalizedLegal && normalizedLegal !== normalizedTipo;
  const lawConflict = (jurisdiction !== "ES" && appliedMentionsLsc) || spanishFormOnForeignEntity;
  const conflict = lawConflict || socialTypeResolution.conflict;
  return {
    conflict_of_laws_flag: conflict,
    conflict_kind: socialTypeResolution.conflict ? "social_form" : lawConflict ? "law" : undefined,
    expectedLawLabel,
    appliedLawLabel: appliedMentionsLsc ? "Ley de Sociedades de Capital española" : expectedLawLabel,
    explanation: socialTypeResolution.conflict
      ? socialTypeResolution.explanation!
      : lawConflict
      ? `La sociedad figura como ${displayedForm}/${jurisdiction}, pero alguna fuente aplicada remite a un marco distinto. Debe justificarse la ley aplicable antes de publicar el marco normativo.`
      : `La forma social ${displayedForm} es coherente con ${expectedLawLabel}.`,
  };
}

export interface NormativeOverrideDraftLike {
  tipoSocial: TipoSocial;
  estatutosModelados?: boolean;
  reglamentoModelado?: boolean;
  pactosModelados?: boolean;
  statutoryMajorityPct?: string | number | null;
  statutoryQuorumPct?: string | number | null;
  noticeDays?: string | number | null;
  sourceReference?: string | null;
  sourceJustification?: string | null;
}

export interface NormativeOverrideValidationIssue {
  field: string;
  message: string;
  severity: "BLOCK" | "WARN";
}

function toNumber(value: string | number | null | undefined) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateNormativeOverrideDraft(input: NormativeOverrideDraftLike) {
  const baseline = LEGAL_BASELINE_BY_TIPO_SOCIAL[input.tipoSocial] ?? LEGAL_BASELINE_BY_TIPO_SOCIAL.SL;
  const issues: NormativeOverrideValidationIssue[] = [];
  const majority = toNumber(input.statutoryMajorityPct);
  const quorum = toNumber(input.statutoryQuorumPct);
  const noticeDays = toNumber(input.noticeDays);
  const hasCustomRule = majority !== null || quorum !== null || noticeDays !== null;
  const hasReference = Boolean(input.sourceReference?.trim());
  const hasJustification = Boolean(input.sourceJustification?.trim());

  if (majority !== null && majority < baseline.reinforcedMajorityPct) {
    issues.push({
      field: "rules.override_mayoria_reforzada_pct",
      severity: "BLOCK",
      message: `Este requisito no puede rebajar el mínimo legal: ${baseline.reinforcedMajorityPct}% para materias reforzadas.`,
    });
  }
  if (quorum !== null && quorum < baseline.firstQuorumPct) {
    issues.push({
      field: "rules.override_quorum_primera_pct",
      severity: "BLOCK",
      message: `El quórum estatutario no puede quedar por debajo del mínimo legal de referencia (${baseline.firstQuorumPct}%).`,
    });
  }
  if (noticeDays !== null && noticeDays < baseline.noticeDays) {
    issues.push({
      field: "rules.override_convocatoria_dias",
      severity: "BLOCK",
      message: `El plazo de convocatoria no puede rebajar el mínimo legal de ${baseline.noticeDays} días.`,
    });
  }
  if (hasCustomRule && !hasReference) {
    issues.push({
      field: "rules.override_referencia",
      severity: "BLOCK",
      message: "Cada regla estatutaria o reglamentaria exige referencia documental.",
    });
  }
  if (hasCustomRule && !hasJustification) {
    issues.push({
      field: "rules.override_justificacion",
      severity: "BLOCK",
      message: "Cada regla estatutaria o reglamentaria exige justificación.",
    });
  }
  if (!input.estatutosModelados) {
    issues.push({
      field: "rules.estatutos_modelados",
      severity: "WARN",
      message: "Estatutos no modelados: aplican reglas legales por defecto hasta completar la fuente documental.",
    });
  }
  if (input.pactosModelados === false) {
    issues.push({
      field: "rules.pactos_modelados",
      severity: "WARN",
      message: "Pactos no modelados: se mostrará advertencia contractual hasta registrar cláusulas vigentes.",
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "BLOCK"),
    baseline,
    issues,
  };
}

export function getMateriaFunctionalGroup(materia: string | null | undefined): FunctionalMatterGroup {
  const canonicalMateria = resolveMateriaAlias(materia);
  const id = canonicalMateria ? MATTER_GROUP_BY_MATERIA[canonicalMateria] : undefined;
  return FUNCTIONAL_MATTER_GROUPS.find((group) => group.id === id) ?? FUNCTIONAL_MATTER_GROUPS[0];
}

export function matterComplexityLabel(row: Pick<MateriaCatalogRow, "materia" | "matter_class">) {
  if (isInformativeMatter(row.materia)) return "Informativa";
  if (row.matter_class === "ESTRUCTURAL") return "Estructural";
  if (row.matter_class === "ESTATUTARIA") return "Reforzada";
  if (row.matter_class === "ESPECIAL") return "Especial";
  return "Ordinaria";
}

export function majorityLabel(code?: string | null) {
  if (!code) return "No requiere mayoría societaria";
  if (code === "SIMPLE") return "Mayoría simple";
  if (code === "REFORZADA_2_3") return "Mayoría reforzada de dos tercios";
  if (code === "UNANIMIDAD") return "Unanimidad";
  return code.split("_").join(" ").toLowerCase();
}

export function competentBodyLabel(materia: string, tipoSocial?: string | null) {
  if (["DELEGACION_FACULTADES", "FORMULACION_CUENTAS", "COMISION_DELEGADA"].includes(materia)) {
    return "Órgano de administración";
  }
  if (["SEGUIMIENTO_PLAN_NEGOCIO", "ESTADO_CUMPLIMIENTO_NORMATIVO", "INFORME_COMITE_AUDITORIA"].includes(materia)) {
    return "Órgano que recibe la información";
  }
  if (materia === "INFORME_GESTION") return "Administradores formulan; junta recibe información";
  if (tipoSocial === "SAU" || tipoSocial === "SLU") return "Socio único";
  return "Junta General";
}

export function quorumLabel(row: MateriaCatalogRow, tipoSocial?: string | null) {
  if (isInformativeMatter(row.materia)) return "No aplica como requisito de votación";
  if (tipoSocial === "SAU" || tipoSocial === "SLU") return "Socio único";
  if (row.matter_class === "ESTATUTARIA" || row.matter_class === "ESTRUCTURAL") {
    return "Quórum reforzado o estatutario si resulta exigible";
  }
  return tipoSocial?.includes("SA")
    ? "Quórum ordinario de junta SA"
    : "Quórum ordinario de junta SL";
}

export function documentRequirements(row: MateriaCatalogRow) {
  const docs = ["Acta"];
  if (row.requires_notary) docs.push("Escritura pública");
  if (row.requires_registry || row.inscribable) docs.push("Certificación para Registro Mercantil");
  if (row.publication_required) docs.push("Publicación legal cuando proceda");
  if (isInformativeMatter(row.materia)) return ["Constancia en acta"];
  return docs;
}

export function formalizationLabel(row: MateriaCatalogRow) {
  if (isInformativeMatter(row.materia)) {
    return "Constancia documental en acta, sin expediente registral propio";
  }
  if (row.requires_notary && row.requires_registry) return "Elevación a público e inscripción registral";
  if (row.requires_registry || row.inscribable) return "Certificación e inscripción registral";
  if (row.requires_notary) return "Elevación a público";
  return "Archivo societario interno";
}

export function plazoLabel(row: MateriaCatalogRow) {
  if (row.plazo_inscripcion_dias) return `${row.plazo_inscripcion_dias} días para tramitación registral`;
  if (isInformativeMatter(row.materia)) return "Sin plazo registral propio";
  return "Sin plazo específico configurado";
}

export function buildMateriaCatalogRows(rows: MateriaCatalogRow[]) {
  const byMateria = new Map<string, MateriaCatalogRow>();
  for (const row of rows) byMateria.set(row.materia, row);
  for (const row of INFORMATIVE_MATTERS) {
    if (!byMateria.has(row.materia)) byMateria.set(row.materia, row);
  }
  for (const [alias, canonical] of Object.entries(MATERIA_CANONICAL_ALIAS)) {
    const aliasRow = byMateria.get(alias);
    if (!aliasRow) continue;
    byMateria.delete(alias);
    if (!byMateria.has(canonical)) {
      byMateria.set(canonical, { ...aliasRow, materia: canonical });
    }
  }
  return Array.from(byMateria.values()).map((row) => ({
    ...row,
    materia_label_es: labelMateria(row.materia, row.materia_label_es),
  })).sort((a, b) => {
    const groupA = getMateriaFunctionalGroup(a.materia).title;
    const groupB = getMateriaFunctionalGroup(b.materia).title;
    return groupA.localeCompare(groupB) || a.materia_label_es.localeCompare(b.materia_label_es);
  });
}

export function buildNormativeMatrixRows(
  rows: MateriaCatalogRow[],
  options: {
    tipoSocial?: string | null;
    overrides?: RuleParamOverrideRow[];
    pactos?: Array<{ materias_aplicables?: string[] | null; titulo?: string | null; tipo_clausula?: string | null }>;
  } = {},
) {
  return buildMateriaCatalogRows(rows).map((row) => {
    const overrides = (options.overrides ?? []).filter((override) => overrideApplicaAMateria(override, row.materia));
    const pactos = (options.pactos ?? []).filter((pacto) => pactoApplicaAMateria(pacto, row.materia));
    const source = [
      "Ley",
      overrides.some((override) => override.fuente === "ESTATUTOS") ? "Estatutos" : null,
      overrides.some((override) => override.fuente === "REGLAMENTO") ? "Reglamento" : null,
      pactos.length > 0 ? "Pacto parasocial" : null,
    ].filter(Boolean).join(" · ");
    return {
      materia: row.materia,
      label: row.materia_label_es,
      group: getMateriaFunctionalGroup(row.materia).title,
      organo: competentBodyLabel(row.materia, options.tipoSocial),
      mayoria: majorityLabel(row.min_majority_code),
      quorum: quorumLabel(row, options.tipoSocial),
      documentos: documentRequirements(row).join(", "),
      notaria: row.requires_notary ? "Escritura pública" : "No necesaria",
      registro: row.requires_registry || row.inscribable ? "Inscripción requerida" : "No inscribible",
      publicacion: row.publication_required ? "Publicación requerida" : "No requerida",
      plazos: plazoLabel(row),
      fuente: source,
      overrides,
      pactos,
    };
  });
}

export function buildSourceChipsForMateria(input: {
  materia: string;
  legalReference?: string | null;
  overrides?: RuleParamOverrideRow[];
  pactos?: Array<{ materias_aplicables?: string[] | null; titulo?: string | null; tipo_clausula?: string | null }>;
}): SourceChipViewModel[] {
  const overrides = (input.overrides ?? []).filter((override) => overrideApplicaAMateria(override, input.materia));
  const pactos = (input.pactos ?? []).filter((pacto) => pactoApplicaAMateria(pacto, input.materia));
  const chips: SourceChipViewModel[] = [
    {
      type: "Ley",
      reference: input.legalReference ?? "Referencia legal pendiente",
      version: "vigente",
      validationState: input.legalReference ? "Validado" : "Pendiente revisión",
      actionLabel: "Ver fuente",
    },
  ];
  for (const override of overrides) {
    chips.push({
      type: override.fuente === "REGLAMENTO" ? "Reglamento" : override.fuente === "ESTATUTOS" ? "Estatutos" : "Override documental",
      reference: override.referencia ?? `${override.clave ?? "requisito"} sin referencia documental`,
      version: "vigente",
      validationState: override.referencia ? "Validado" : "Incompleto",
      actionLabel: "Ver fuente",
    });
  }
  for (const pacto of pactos) {
    chips.push({
      type: "Pacto parasocial",
      reference: pacto.titulo ?? pacto.tipo_clausula ?? "Pacto vigente",
      version: "vigente",
      validationState: "Pendiente revisión",
      actionLabel: "Ver pacto",
    });
  }
  return chips;
}

export type TemplateDocumentStage =
  | "Pre-acuerdo"
  | "Convocatoria"
  | "Modelo de acuerdo"
  | "Acta"
  | "Certificación"
  | "Post-acuerdo";

export type TemplateOpeningStatus = "ready" | "blocked" | "not_applicable";

export type TemplateStageCriticality = "apertura" | "soporte" | "cierre" | "no_aplica";

export interface TemplateReadinessFormalization {
  requiresNotary?: boolean;
  requiresRegistry?: boolean;
  inscribable?: boolean;
}

export interface TemplateReadinessPolicy {
  /**
   * La fila completa permite decidir si la certificación es requisito de
   * apertura. Con solo el código se reconoce la naturaleza informativa, pero
   * se conserva la política estricta para una formalización desconocida.
   */
  materia?:
    | string
    | Pick<
        MateriaCatalogRow,
        "materia" | "requires_notary" | "requires_registry" | "inscribable"
      >
    | null;
  informativa?: boolean;
  /** Motivo jurídico por el que la materia no aplica a la sociedad seleccionada. */
  notApplicableReason?: string | null;
  /** Formalización efectiva del rule pack; prevalece sobre el mínimo de catálogo. */
  formalization?: TemplateReadinessFormalization | null;
}

export interface TemplateDocumentBinding {
  stage: TemplateDocumentStage;
  template: PlantillaProtegidaRow;
  statusLabel: string;
  metadataComplete: boolean;
  automaticVariablesValid: boolean;
  editableFieldsPending: number;
  upgradeAvailable: boolean;
  selectionReason: string;
}

const TEMPLATE_STAGE_BY_TYPE: Record<string, TemplateDocumentStage> = {
  INFORME_PRECEPTIVO: "Pre-acuerdo",
  INFORME_DOCUMENTAL_PRE: "Pre-acuerdo",
  CONVOCATORIA: "Convocatoria",
  CONVOCATORIA_SL_NOTIFICACION: "Convocatoria",
  MODELO_ACUERDO: "Modelo de acuerdo",
  ACTA_SESION: "Acta",
  ACTA_ACUERDO_ESCRITO: "Acta",
  ACTA_CONSIGNACION: "Acta",
  ACTA_DECISION_CONJUNTA: "Acta",
  ACTA_ORGANO_ADMIN: "Acta",
  CERTIFICACION: "Certificación",
  DOCUMENTO_REGISTRAL: "Post-acuerdo",
  SUBSANACION_REGISTRAL: "Post-acuerdo",
};

export const TEMPLATE_DOCUMENT_STAGES: TemplateDocumentStage[] = [
  "Pre-acuerdo",
  "Convocatoria",
  "Modelo de acuerdo",
  "Acta",
  "Certificación",
  "Post-acuerdo",
];

export const MINIMUM_TEMPLATE_STAGES: TemplateDocumentStage[] = [
  "Modelo de acuerdo",
  "Acta",
  "Certificación",
];

function templateStageCriticality(
  stage: TemplateDocumentStage,
  input: {
    informativa: boolean;
    certificationRequiredAtOpening: boolean;
  },
): TemplateStageCriticality {
  if (input.informativa) return stage === "Acta" ? "cierre" : "no_aplica";
  if (stage === "Modelo de acuerdo" || stage === "Acta") return "apertura";
  if (stage === "Certificación") {
    return input.certificationRequiredAtOpening ? "apertura" : "cierre";
  }
  if (stage === "Post-acuerdo") return "cierre";
  return "soporte";
}

function templateStageConsequence(
  stage: TemplateDocumentStage,
  criticality: TemplateStageCriticality,
  status: TemplateReadinessItem["status"],
) {
  if (criticality === "no_aplica") {
    return "No aplica a esta materia informativa; no forma parte de un expediente decisorio.";
  }
  if (criticality === "apertura") {
    if (status === "activa") return "La fase está disponible y permite abrir el expediente.";
    if (status === "pendiente_revision") {
      return "La plantilla candidata no habilita la apertura hasta quedar activa.";
    }
    return `Sin plantilla activa de ${stage.toLowerCase()} no puede abrirse el expediente.`;
  }
  if (criticality === "cierre") {
    if (status === "activa") return "La fase está disponible para completar el cierre documental.";
    if (stage === "Acta") {
      return "No bloquea la apertura; debe dejarse constancia en acta antes del cierre.";
    }
    return "No bloquea la apertura; debe resolverse antes del cierre o la formalización.";
  }
  if (status === "activa") return "La plantilla está disponible como soporte del expediente.";
  return "No bloquea la apertura; se incorporará como soporte cuando resulte exigible.";
}

function templateStage(template: PlantillaProtegidaRow): TemplateDocumentStage {
  return TEMPLATE_STAGE_BY_TYPE[template.tipo] ?? "Post-acuerdo";
}

function templateStatusLabel(template: PlantillaProtegidaRow) {
  if (template.estado === "ACTIVA" && template.aprobada_por) return "Firmada por Comité Legal";
  if (template.estado === "ACTIVA" || template.estado === "APROBADA") return "Aprobada";
  if (template.estado === "REVISADA") return "Pendiente de aprobación";
  return "Sin aprobar";
}

function hasTemplateMatterMatch(template: PlantillaProtegidaRow, materia: string) {
  const templateMatter = template.materia_acuerdo ?? template.materia;
  return Boolean(
    templateMatter &&
      rulePackMateriaMatches(
        resolveMateriaAlias(templateMatter),
        resolveMateriaAlias(materia),
      ),
  );
}

type TemplateBindingCriterion = string | string[] | null | undefined;

function criterionValues(value: TemplateBindingCriterion): string[] {
  return (Array.isArray(value) ? value : [value])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeOrganoCriterion(value?: string | null): string {
  return normalizeOrganoTipo(value) ?? String(value ?? "").trim().toUpperCase();
}

const COMPOSITE_ORGANO_MATCHES: Record<string, string[]> = {
  JUNTA_GENERAL_O_CONSEJO: ["JUNTA_GENERAL", "CONSEJO_ADMIN"],
  ADMIN_CONJUNTA_O_COAPROBADORES: [
    "ADMIN_CONJUNTA_O_COAPROBADORES",
    "ADMIN_SOLIDARIOS",
    "CO_APROBADORES",
  ],
};

const TRANSVERSAL_NON_ADOPTABLE_ORGANS = new Set([
  "DERIVADO_DEL_ACTO",
  "SOPORTE_INTERNO",
  "ORGANO_ADMIN",
]);

const ADMINISTRATION_ORGANS = new Set([
  "CONSEJO_ADMIN",
  "ADMIN_UNICO",
  "ADMIN_CONJUNTA_O_COAPROBADORES",
  "ADMIN_SOLIDARIOS",
  "COMISION_DELEGADA",
]);

const ADMIN_ORIGIN_PROCESS_TYPES = new Set([
  "CONVOCATORIA",
  "CONVOCATORIA_SL_NOTIFICACION",
]);

function organoCriterionMatches(
  template: PlantillaProtegidaRow,
  criterion: TemplateBindingCriterion,
): boolean {
  const requested = criterionValues(criterion).map(normalizeOrganoCriterion);
  if (requested.length === 0) return true;

  // La ausencia de órgano nunca equivale a una plantilla transversal/ANY.
  const templateOrgano = normalizeOrganoCriterion(template.organo_tipo);
  if (!templateOrgano) return false;

  // Certificaciones e informes de soporte son derivados transversales: el
  // órgano del acuerdo no debe expulsarlos del checklist. El mismo metadato en
  // un documento que sí adopta el acuerdo (p. ej. ACTA_SESION) conserva el
  // matching estricto de abajo.
  if (
    TRANSVERSAL_NON_ADOPTABLE_ORGANS.has(templateOrgano) &&
    !isAdoptionMetadataRequired(template.tipo)
  ) {
    return true;
  }

  if (templateOrgano === "ORGANO_ADMIN") {
    // La convocatoria la emite el órgano de administración aunque la materia
    // vaya a ser adoptada por la Junta. Para los demás documentos adoptables,
    // ORGANO_ADMIN solo agrega las formas reales de administración.
    if (ADMIN_ORIGIN_PROCESS_TYPES.has(normalizeCode(template.tipo))) {
      return requested.includes("JUNTA_GENERAL");
    }
    if (requested.some((organo) => ADMINISTRATION_ORGANS.has(organo))) return true;
  }

  return requested.some(
    (organo) =>
      organo === templateOrgano ||
      COMPOSITE_ORGANO_MATCHES[templateOrgano]?.includes(organo) ||
      COMPOSITE_ORGANO_MATCHES[organo]?.includes(templateOrgano),
  );
}

function adoptionCriterionMatches(
  template: PlantillaProtegidaRow,
  criterion: TemplateBindingCriterion,
): boolean {
  const requested = criterionValues(criterion).map(normalizeCode);
  if (requested.length === 0) return true;

  const templateMode = normalizeCode(template.adoption_mode);
  if (!templateMode) {
    // NULL solo significa «no aplica» en documentos que no adoptan acuerdos.
    return !isAdoptionMetadataRequired(template.tipo);
  }
  // ANY es válido en bindings gobernados, pero no sustituye el metadato
  // específico exigido a una fila de plantilla.
  return requested.includes(templateMode);
}

function tipoSocialCriterionMatches(
  template: PlantillaProtegidaRow,
  criterion?: string | null,
): boolean {
  const requested = normalizeCode(criterion);
  if (!requested || requested === "ANY") return true;

  // Contrato confirmado: NULL/ausente equivale a Todos, igual que ANY.
  const templateTipoSocial = normalizeCode(template.tipo_social);
  if (!templateTipoSocial || templateTipoSocial === "ANY") return true;
  const canonical = (value: string) => (value === "SRL" ? "SL" : value);
  return canonical(templateTipoSocial) === canonical(requested);
}

function templateMetadataComplete(template: PlantillaProtegidaRow): boolean {
  const policy = templateMetadataPolicy(template.tipo);
  const matterComplete =
    template.tipo !== "MODELO_ACUERDO" ||
    Boolean(template.materia_acuerdo ?? template.materia);
  const organoComplete =
    !policy.organoRequired || hasSpecificTemplateMetadata(template.organo_tipo);
  const adoptionComplete =
    !policy.adoptionModeRequired ||
    hasSpecificTemplateMetadata(template.adoption_mode);

  return Boolean(
    template.tipo &&
      template.jurisdiccion &&
      matterComplete &&
      organoComplete &&
      adoptionComplete,
  );
}

export function buildTemplateDocumentBindings(
  plantillas: PlantillaProtegidaRow[],
  criteria: {
    materia: string;
    jurisdiction?: string | null;
    tipoSocial?: string | null;
    organoTipo?: string | string[] | null;
    formaAdopcion?: string | string[] | null;
  },
): TemplateDocumentBinding[] {
  return plantillas
    .filter((template) => template.estado !== "ARCHIVADA")
    .filter((template) => hasTemplateMatterMatch(template, criteria.materia) || template.tipo !== "MODELO_ACUERDO")
    .filter((template) =>
      !criteria.jurisdiction ||
      !template.jurisdiccion ||
      normalizeCode(template.jurisdiccion) === normalizeCode(criteria.jurisdiction) ||
      normalizeCode(template.jurisdiccion) === "GLOBAL",
    )
    .filter((template) => organoCriterionMatches(template, criteria.organoTipo))
    .filter((template) => adoptionCriterionMatches(template, criteria.formaAdopcion))
    .filter((template) => tipoSocialCriterionMatches(template, criteria.tipoSocial))
    .map((template) => {
      const metadataComplete = templateMetadataComplete(template);
      const automaticVariablesValid = (template.capa2_variables ?? []).every((variable) => Boolean(variable.variable && variable.fuente));
      const editableFieldsPending = (template.capa3_editables ?? []).filter((field) => field.obligatoriedad === "OBLIGATORIO" || field.requerido).length;
      const reasons = [
        `fase ${templateStage(template).toLowerCase()}`,
        criteria.jurisdiction && template.jurisdiccion === criteria.jurisdiction ? "jurisdicción exacta" : null,
        hasTemplateMatterMatch(template, criteria.materia) ? "materia compatible" : "transversal",
        criterionValues(criteria.organoTipo).length > 0 ? "órgano compatible" : template.organo_tipo ? "órgano informado" : null,
        criterionValues(criteria.formaAdopcion).length > 0
          ? isAdoptionMetadataRequired(template.tipo)
            ? "forma de adopción compatible"
            : "forma de adopción no aplicable"
          : template.adoption_mode
            ? "forma de adopción informada"
            : null,
        criteria.tipoSocial
          ? template.tipo_social
            ? "tipo social compatible"
            : "todos los tipos sociales"
          : null,
      ].filter(Boolean);
      return {
        stage: templateStage(template),
        template,
        statusLabel: templateStatusLabel(template),
        metadataComplete,
        automaticVariablesValid,
        editableFieldsPending,
        upgradeAvailable: template.estado === "REVISADA",
        selectionReason: reasons.join(" · "),
      };
    })
    .sort((a, b) =>
      TEMPLATE_DOCUMENT_STAGES.indexOf(a.stage) - TEMPLATE_DOCUMENT_STAGES.indexOf(b.stage) ||
      a.template.tipo.localeCompare(b.template.tipo) ||
      String(b.template.version).localeCompare(String(a.template.version)),
    );
}

export function evaluateTemplateReadiness(
  bindings: TemplateDocumentBinding[],
  policy?: TemplateReadinessPolicy,
): TemplateReadinessResult {
  const matterRow =
    policy?.materia && typeof policy.materia !== "string" ? policy.materia : null;
  const matterCode =
    typeof policy?.materia === "string" ? policy.materia : matterRow?.materia;
  const informativa =
    policy?.informativa ??
    isInformativeMatter(matterCode);
  const notApplicableReason = policy?.notApplicableReason?.trim() || null;
  const openingNotApplicable = informativa || Boolean(notApplicableReason);
  const formalization = policy?.formalization;
  const hasExplicitFormalization = Boolean(
    formalization ||
      (matterRow &&
        [matterRow.requires_notary, matterRow.requires_registry, matterRow.inscribable].some(
          (value) => typeof value === "boolean",
        )),
  );
  const certificationRequiredAtOpening = hasExplicitFormalization
    ? Boolean(
        formalization?.requiresNotary ?? matterRow?.requires_notary ?? false,
      ) ||
      Boolean(
        formalization?.requiresRegistry ?? matterRow?.requires_registry ?? false,
      ) ||
      Boolean(formalization?.inscribable ?? matterRow?.inscribable ?? false)
    : true;

  const items = TEMPLATE_DOCUMENT_STAGES.map((stage): TemplateReadinessItem => {
    const stageBindings = bindings.filter((binding) => binding.stage === stage);
    const active = stageBindings.some((binding) => binding.template.estado === "ACTIVA");
    const criticality = notApplicableReason
      ? "no_aplica"
      : templateStageCriticality(stage, {
          informativa,
          certificationRequiredAtOpening,
        });
    const status: TemplateReadinessItem["status"] = criticality === "no_aplica"
      ? "no_aplica"
      : active
        ? "activa"
        : stageBindings.length > 0
          ? "pendiente_revision"
          : "faltante";
    const blocking = criticality === "apertura" && status !== "activa";
    return {
      stage,
      status,
      criticality,
      blocking,
      consequence:
        criticality === "no_aplica" && notApplicableReason
          ? notApplicableReason
          : templateStageConsequence(stage, criticality, status),
      actionLabel: status === "no_aplica"
        ? "No requiere acción"
        : status === "faltante"
          ? "Asignar plantilla"
          : status === "pendiente_revision"
            ? "Revisar plantilla"
            : "Vista previa del documento",
    };
  });
  if (openingNotApplicable) {
    return {
      canStartCase: false,
      openingStatus: "not_applicable",
      openingMessage:
        notApplicableReason ?? "No aplica abrir expediente · dejar constancia en acta.",
      blockingMessage: null,
      items,
    };
  }
  const missing = items
    .filter((item) => item.blocking)
    .map((item) => item.stage.toLowerCase());
  const openingStatus: TemplateOpeningStatus = missing.length > 0 ? "blocked" : "ready";
  const blockingMessage = missing.length > 0
    ? `No se puede iniciar expediente porque falta plantilla activa de ${missing.join(", ")}.`
    : null;
  return {
    canStartCase: openingStatus === "ready",
    openingStatus,
    openingMessage: blockingMessage ?? "Documentación de apertura lista.",
    blockingMessage,
    items,
  };
}

export type MateriaGlobalStatus = "lista" | "advertencia" | "revision_legal" | "bloqueada";

export interface MateriaGlobalStatusResult {
  status: MateriaGlobalStatus;
  label: string;
  explanation: string;
  ctaLabel: string;
}

/**
 * Estado global de una materia para el abogado (informe UX §10): cada estado
 * lleva explicación y siguiente acción. Precedencia: bloqueada > revisión
 * legal > advertencia > lista.
 */
export function evaluateMateriaGlobalStatus(input: {
  templateReadiness: TemplateReadinessResult;
  conflictOfLaws?: ConflictOfLawsResult | null;
  legalReference?: string | null;
  /** Existe al menos una versión activa del rule pack aplicable. */
  ruleVersionAvailable?: boolean;
  /** Conflictos o activaciones equivalentes detectados al resolver la regla. */
  ruleWarnings?: string[];
  notApplicableReason?: string | null;
  applicablePactosCount?: number;
  /**
   * Materias de seguimiento/información: el dominio ya las trata como
   * "constancia en acta" (documentRequirements/formalizationLabel), así que
   * la falta de plantillas mínimas de expediente no las bloquea.
   */
  informativa?: boolean;
}): MateriaGlobalStatusResult {
  if (input.notApplicableReason) {
    return {
      status: "lista",
      label: "No aplica a esta sociedad",
      explanation: input.notApplicableReason,
      ctaLabel: "Ver regla aplicable",
    };
  }
  if (!input.templateReadiness.canStartCase && !input.informativa) {
    return {
      status: "bloqueada",
      label: "Bloqueada por falta de plantilla mínima",
      explanation:
        input.templateReadiness.blockingMessage ??
        "Falta una plantilla mínima para poder abrir el expediente.",
      ctaLabel: "Resolver bloqueo",
    };
  }
  if (input.ruleVersionAvailable === false && !input.informativa) {
    return {
      status: "revision_legal",
      label: "Requiere revisión legal",
      explanation:
        "Falta regla versionada activa para esta materia; debe publicarse o vincularse antes de tramitar.",
      ctaLabel: "Revisar fuentes",
    };
  }
  if (input.conflictOfLaws?.conflict_of_laws_flag) {
    return {
      status: "revision_legal",
      label: "Requiere revisión legal",
      explanation:
        input.conflictOfLaws.explanation ||
        "Hay un posible conflicto de ley aplicable que debe justificarse antes de tramitar.",
      ctaLabel: "Revisar fuentes",
    };
  }
  if (!input.legalReference) {
    return {
      status: "revision_legal",
      label: "Requiere revisión legal",
      explanation: "La referencia legal de esta materia está pendiente de completar.",
      ctaLabel: "Revisar fuentes",
    };
  }
  const ruleWarnings = (input.ruleWarnings ?? []).filter(Boolean);
  if (
    ruleWarnings.some(
      (warning) =>
        warning.startsWith("Conflicto de órgano:") ||
        warning.startsWith("No se puede determinar la aplicabilidad"),
    )
  ) {
    return {
      status: "revision_legal",
      label: "Requiere revisión legal",
      explanation: ruleWarnings.join(" "),
      ctaLabel: "Revisar fuentes",
    };
  }
  if ((input.applicablePactosCount ?? 0) > 0) {
    return {
      status: "advertencia",
      label: "Advertencia no bloqueante",
      explanation:
        "Hay pactos parasociales aplicables: generan obligaciones contractuales, pero no invalidan por sí solos el acuerdo societario.",
      ctaLabel: input.informativa ? "Ver regla aplicable" : "Iniciar expediente",
    };
  }
  if (ruleWarnings.length > 0) {
    return {
      status: "advertencia",
      label: "Advertencia no bloqueante",
      explanation: ruleWarnings.join(" "),
      ctaLabel: input.informativa ? "Ver regla aplicable" : "Iniciar expediente",
    };
  }
  if (input.informativa) {
    return {
      status: "lista",
      label: "Solo constancia",
      explanation:
        "No aplica abrir expediente decisorio; dejar constancia en acta.",
      ctaLabel: "Ver regla aplicable",
    };
  }
  return {
    status: "lista",
    label: "Lista para iniciar expediente",
    explanation: "Regla aplicable resuelta y documentos mínimos disponibles.",
    ctaLabel: "Iniciar expediente",
  };
}

export const DOCUMENT_TYPE_LABEL = TIPO_LABEL;

export function documentTypeLabel(tipo: string) {
  return tipoLabel(tipo);
}

/** Comparación numérica por segmentos ("1.10.0" > "1.9.0"), tolerante a prefijo "v". */
export function compareTemplateVersions(
  a?: string | number | null,
  b?: string | number | null,
) {
  const parse = (value: string | number | null | undefined) =>
    String(value ?? "0")
      .replace(/^v/i, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Identidad funcional de una plantilla dentro de una fase: dos plantillas con
 * la misma identidad son versiones (o duplicados) de la misma pieza; con
 * identidad distinta son piezas diferentes aunque compartan tipo y versión
 * (caso real: acta de consignación de socio único vs de administrador único).
 */
function templateFunctionalIdentity(template: PlantillaProtegidaRow) {
  const normalizeIdentityCode = (value?: string | null) =>
    String(value ?? "").trim().toUpperCase();
  return [
    normalizeIdentityCode(template.tipo),
    resolveMateriaAlias(template.materia_acuerdo ?? template.materia),
    normalizeOrganoTipo(template.organo_tipo) ?? normalizeIdentityCode(template.organo_tipo),
    normalizeIdentityCode(template.adoption_mode),
    normalizeIdentityCode(template.jurisdiccion),
    normalizeIdentityCode(template.tipo_social),
  ].join("|");
}

export interface TemplateStageDisplayGroup {
  current: TemplateDocumentBinding;
  older: TemplateDocumentBinding[];
  duplicates: TemplateDocumentBinding[];
}

/**
 * Agrupa bindings de una fase por identidad funcional: `current` es la versión
 * vigente para nuevos expedientes (mayor versión), `older` son versiones
 * anteriores (colapsables) y `duplicates` filas indistinguibles de la vigente
 * (incidencia de datos).
 */
export function groupStageBindingsForDisplay(
  bindings: TemplateDocumentBinding[],
): TemplateStageDisplayGroup[] {
  const byIdentity = new Map<string, TemplateDocumentBinding[]>();
  for (const binding of bindings) {
    const key = templateFunctionalIdentity(binding.template);
    const group = byIdentity.get(key) ?? [];
    group.push(binding);
    byIdentity.set(key, group);
  }
  const normalizeVersion = (value: string | number | null | undefined) =>
    String(value ?? "").replace(/^v/i, "").trim();
  return Array.from(byIdentity.values()).map((group) => {
    const sorted = [...group].sort((a, b) =>
      compareTemplateVersions(b.template.version, a.template.version),
    );
    const current = sorted[0];
    const rest = sorted.slice(1);
    // Duplicado exige la MISMA versión literal; empates numéricos con sufijos
    // distintos ("1.0.0-beta" vs "1.0.0-rc") son versiones diferentes.
    const isDuplicateOfCurrent = (binding: TemplateDocumentBinding) =>
      compareTemplateVersions(binding.template.version, current.template.version) === 0 &&
      normalizeVersion(binding.template.version) === normalizeVersion(current.template.version);
    return {
      current,
      older: rest.filter((binding) => !isDuplicateOfCurrent(binding)),
      duplicates: rest.filter(isDuplicateOfCurrent),
    };
  });
}

/**
 * Duplicados de DATOS: misma identidad funcional completa y misma versión.
 * Las variantes por órgano, forma de adopción, jurisdicción o tipo social son
 * piezas legítimas y no deben sanearse como duplicados.
 */
export function detectTemplateDataDuplicates(bindings: TemplateDocumentBinding[]) {
  const groups = groupStageBindingsForDisplay(bindings);
  const results: Array<{ tipo: string; version: string; ids: string[] }> = [];

  for (const group of groups) {
    if (group.duplicates.length === 0) continue;
    results.push({
      tipo: group.current.template.tipo,
      version: String(group.current.template.version),
      ids: [group.current.template.id, ...group.duplicates.map((binding) => binding.template.id)],
    });
  }

  return results;
}

export function organoTipoBusinessLabel(value?: string | null) {
  return organoLabel(value);
}

/**
 * Label visible de un binding. Si otro binding visible comparte tipo y versión
 * (piezas distintas con el mismo nombre aparente), acumula discriminadores en
 * orden órgano → forma de adopción → materia HASTA que la etiqueta queda única
 * frente a los ambiguos. (Caso real: nombramiento por Junta art. 214 LSC vs
 * cooptación por Consejo art. 244 LSC comparten adopción MEETING; solo el
 * órgano las distingue. Con 3 variantes puede hacer falta más de un atributo.)
 */
export function templateBindingDisplayLabel(
  binding: TemplateDocumentBinding,
  siblings: TemplateDocumentBinding[] = [],
) {
  const base = `${documentTypeLabel(binding.template.tipo)} · v${binding.template.version}`;
  const ambiguousSiblings = siblings.filter(
    (other) =>
      other.template.id !== binding.template.id &&
      other.template.tipo === binding.template.tipo &&
      compareTemplateVersions(other.template.version, binding.template.version) === 0,
  );
  if (ambiguousSiblings.length === 0) return base;

  const discriminators: Array<(t: PlantillaProtegidaRow) => string | null> = [
    (t) => organoTipoBusinessLabel(t.organo_tipo),
    (t) => adoptionModeLabel(t.adoption_mode, { tipo: t.tipo }),
    (t) => {
      const matter = t.materia_acuerdo ?? t.materia;
      return matter ? labelMateria(matter) : null;
    },
    (t) => jurisdictionLabel(t.jurisdiccion),
    (t) => tipoSocialLabel(t.tipo_social),
  ];

  const parts: string[] = [];
  let clashing = ambiguousSiblings;
  for (const pick of discriminators) {
    const mine = pick(binding.template);
    if (!mine) continue;
    const still = clashing.filter((other) => (pick(other.template) ?? "") === mine);
    if (still.length === clashing.length) continue; // este atributo no distingue nada
    parts.push(mine);
    clashing = still;
    if (clashing.length === 0) break;
  }

  if (parts.length === 0) {
    // Indistinguibles por atributos visibles (duplicidad de datos): mantener el
    // discriminador clásico para no ocultar información.
    if (binding.template.adoption_mode) {
      return `${base} · ${adoptionModeBusinessLabel(binding.template.adoption_mode)}`;
    }
    return base;
  }
  return `${base} · ${parts.join(" · ")}`;
}

export function requirementStateLabel(state: RequirementOperationalState) {
  if (state === "cumplido") return "Cumplido";
  if (state === "pendiente") return "Pendiente";
  if (state === "bloqueante") return "Bloqueante";
  return "No aplica";
}

export function adoptionModeBusinessLabel(value?: string | null) {
  return adoptionModeLabel(value);
}

export function matterClassBusinessLabel(value?: string | null) {
  const normalized = normalizeCode(value);
  const labels: Record<string, string> = {
    ORDINARIA: "Ordinaria",
    ESTATUTARIA: "Reforzada por estatutos o ley",
    ESTRUCTURAL: "Operación estructural",
    ESPECIAL: "Especial",
  };
  return labels[normalized] ?? sanitizeBusinessLabel(value);
}

export function sanitizeBusinessLabel(value?: string | null) {
  if (!value) return "—";
  if (value.startsWith("DEMO_")) return "Evidencia operativa";
  return value.split("_").join(" ");
}
