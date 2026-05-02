export type FallbackCategory =
  | "ui_legacy_rule"
  | "local_template_fixture"
  | "json_snapshot_bridge"
  | "prototype_rule_pack"
  | "demo_data";

export type RetirementPriority = "P0" | "P1" | "P2";

export interface FallbackRetirementCriterionState {
  cloudRulePackActive?: boolean;
  engineV2ConsumesPack?: boolean;
  cloudTemplateApproved?: boolean;
  fallbackDeprecatedOrRemoved?: boolean;
  legacyWrapperConverted?: boolean;
}

export interface FallbackRetirementTarget {
  rulePackTarget: string;
  templateTarget?: string;
  persistenceTarget?: string;
  sourceOfTruthTarget: "Cloud" | "Cloud+WORM";
}

export interface FallbackRetirementItem {
  key: string;
  label: string;
  category: FallbackCategory;
  currentSurface: string;
  currentSourceOfTruth: "frontend" | "fixture" | "json_bridge" | "prototype" | "demo_data";
  target: FallbackRetirementTarget;
  priority: RetirementPriority;
  blocksProductionLegalDefensibility: boolean;
  requiredAction: string;
}

export interface RulePackSeedTarget {
  packId: string;
  acceptedPackIds?: string[];
  legacyPackIds?: string[];
  materia: string;
  priority: RetirementPriority;
  replaces: string;
}

export interface FallbackRetirementStatus {
  eliminated: boolean;
  missingCriteria: string[];
}

const REQUIRED_CRITERIA: Array<keyof FallbackRetirementCriterionState> = [
  "cloudRulePackActive",
  "engineV2ConsumesPack",
  "cloudTemplateApproved",
  "fallbackDeprecatedOrRemoved",
  "legacyWrapperConverted",
];

const CRITERION_LABELS: Record<keyof FallbackRetirementCriterionState, string> = {
  cloudRulePackActive: "rule_pack_versions activo con hash verificable",
  engineV2ConsumesPack: "motor V2 consume el pack y produce explain/snapshot",
  cloudTemplateApproved: "plantilla Cloud aprobada por Legal",
  fallbackDeprecatedOrRemoved: "fixture/fallback retirado o marcado deprecated",
  legacyWrapperConverted: "funcion V1 convertida en wrapper V2 o eliminada",
};

export const SECRETARIA_FALLBACK_RETIREMENT_ITEMS: FallbackRetirementItem[] = [
  {
    key: "notice-period-hardcoded",
    label: "Plazos de convocatoria hardcodeados SA/SL",
    category: "ui_legacy_rule",
    currentSurface: "src/hooks/useJurisdiccionRules.ts::checkNoticePeriodByType",
    currentSourceOfTruth: "frontend",
    target: {
      rulePackTarget: "rule_pack_versions.payload.convocatoria.antelacionDias por materia/forma social",
      sourceOfTruthTarget: "Cloud",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Seedear packs activos, activar doble evaluacion V1/V2 y convertir hook legacy en wrapper del motor.",
  },
  {
    key: "quorum-status-hardcoded",
    label: "Quorum y mayoria genericos en UI",
    category: "ui_legacy_rule",
    currentSurface: "src/hooks/useAgreementCompliance.ts::computeQuorumStatus",
    currentSourceOfTruth: "frontend",
    target: {
      rulePackTarget: "rule_pack_versions.payload.constitucion/votacion por materia, organo y tipo social",
      persistenceTarget: "rule_evaluation_results",
      sourceOfTruthTarget: "Cloud+WORM",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Consumir motor V2 y persistir resultado versionado antes de proclamar resultado productivo.",
  },
  {
    key: "template-fixtures",
    label: "Fixtures locales de plantillas documentales",
    category: "local_template_fixture",
    currentSurface: "src/lib/secretaria/legal-template-fixtures.ts",
    currentSourceOfTruth: "fixture",
    target: {
      rulePackTarget: "plantillas_protegidas Cloud con hash, protecciones y aprobacion legal",
      templateTarget: "CONVOCATORIA, ACTA_SESION, ACTA_CONSIGNACION, ACTA_ACUERDO_ESCRITO, CERTIFICACION, DOCUMENTO_REGISTRAL",
      sourceOfTruthTarget: "Cloud",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Completar aprobada_por/fecha_aprobacion y desactivar fallback local como fuente de generacion productiva.",
  },
  {
    key: "co-aprobacion-template-gap",
    label: "Plantilla faltante de decision conjunta",
    category: "local_template_fixture",
    currentSurface: "CO_APROBACION sin ACTA_DECISION_CONJUNTA Cloud aprobada",
    currentSourceOfTruth: "fixture",
    target: {
      rulePackTarget: "rule_pack_versions CO_APROBACION",
      templateTarget: "ACTA_DECISION_CONJUNTA",
      sourceOfTruthTarget: "Cloud",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Crear plantilla Cloud, aprobar por Legal y cubrir variables Capa 2/Capa 3.",
  },
  {
    key: "solidario-template-gap",
    label: "Plantilla faltante de organo administrador solidario",
    category: "local_template_fixture",
    currentSurface: "SOLIDARIO sin ACTA_ORGANO_ADMIN Cloud aprobada",
    currentSourceOfTruth: "fixture",
    target: {
      rulePackTarget: "rule_pack_versions SOLIDARIO",
      templateTarget: "ACTA_ORGANO_ADMIN",
      sourceOfTruthTarget: "Cloud",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Crear plantilla Cloud, aprobar por Legal y enlazarla al AdoptionMode SOLIDARIO.",
  },
  {
    key: "meeting-point-snapshots-json",
    label: "Snapshots por punto en quorum_data JSON libre",
    category: "json_snapshot_bridge",
    currentSurface: "meetings.quorum_data.point_snapshots",
    currentSourceOfTruth: "json_bridge",
    target: {
      rulePackTarget: "rule_pack_versions activo por materia",
      persistenceTarget: "rule_evaluation_results WORM con rule_pack_id, version y snapshot_hash",
      sourceOfTruthTarget: "Cloud+WORM",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Aplicar paquete de migracion aprobado y redirigir snapshot de reunion a tabla versionada/WORM.",
  },
  {
    key: "modelo-acuerdo-unapproved",
    label: "Modelos de acuerdo activos sin aprobacion legal formal",
    category: "local_template_fixture",
    currentSurface: "MODELO_ACUERDO version 0.x/1 o sin aprobada_por",
    currentSourceOfTruth: "fixture",
    target: {
      rulePackTarget: "rule_pack_versions por materia",
      templateTarget: "MODELO_ACUERDO Cloud aprobado con referencia LSC",
      sourceOfTruthTarget: "Cloud",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Completar referencia legal, organo, AdoptionMode, semver y aprobacion legal.",
  },
  {
    key: "demo-census",
    label: "Censo demo no persistido para asistentes/votos",
    category: "demo_data",
    currentSurface: "ReunionStepper fallback de asistentes",
    currentSourceOfTruth: "demo_data",
    target: {
      rulePackTarget: "rule_pack_versions quorum/votacion",
      persistenceTarget: "meeting_attendees + mandates/holdings/capital 100%",
      sourceOfTruthTarget: "Cloud",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Completar datos Cloud ARGA de mandatos, capital y asistentes; retirar censo no persistido.",
  },
  {
    key: "prototype-meeting-rule-pack",
    label: "Fallback tecnico de rule pack de reunion",
    category: "prototype_rule_pack",
    currentSurface: "src/lib/secretaria/prototype-rule-pack-fallback.ts",
    currentSourceOfTruth: "prototype",
    target: {
      rulePackTarget: "rule_pack_versions activo compatible por materia, clase y organo",
      persistenceTarget: "rule_evaluation_results",
      sourceOfTruthTarget: "Cloud+WORM",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Seedear pack compatible y fallar cerrado en produccion si no existe.",
  },
  {
    key: "prototype-registry-rule-pack",
    label: "Fallback tecnico de rule pack registral",
    category: "prototype_rule_pack",
    currentSurface: "src/lib/secretaria/prototype-registry-rule-fallback.ts",
    currentSourceOfTruth: "prototype",
    target: {
      rulePackTarget: "rule_pack_versions.payload.postAcuerdo por materia",
      templateTarget: "DOCUMENTO_REGISTRAL Cloud aprobado",
      sourceOfTruthTarget: "Cloud",
    },
    priority: "P0",
    blocksProductionLegalDefensibility: true,
    requiredAction: "Seedear postAcuerdo registral y fallar cerrado en produccion si no existe.",
  },
];

export const RULE_PACK_SEED_TARGETS_V21: RulePackSeedTarget[] = [
  { packId: "DELEGACION_FACULTADES", materia: "Delegacion facultades/CD", priority: "P0", replaces: "mayoria generica; requiere 2/3 e indelegables" },
  { packId: "DIVIDENDO_A_CUENTA", materia: "Dividendo a cuenta", priority: "P0", replaces: "sin validacion de base disponible/liquidez" },
  { packId: "OPERACION_VINCULADA", materia: "Operacion vinculada/dispensa", priority: "P0", replaces: "sin exclusion automatica de conflictuado" },
  {
    packId: "AUTORIZACION_GARANTIA",
    acceptedPackIds: ["AUTORIZACION_GARANTIA", "GARANTIA_PRESTAMO"],
    legacyPackIds: ["GARANTIA_PRESTAMO"],
    materia: "Garantia/prestamo intragrupo",
    priority: "P0",
    replaces: "sin determinacion de organo por umbral 25%",
  },
  { packId: "COOPTACION", materia: "Cooptacion consejeros SA", priority: "P1", replaces: "sin pack; mayoria generica" },
  { packId: "CUENTAS_CONSOLIDADAS", materia: "Formulacion cuentas consolidadas", priority: "P1", replaces: "sin validacion de obligacion grupo" },
  { packId: "INFORME_GESTION", materia: "Informe gestion/EINF", priority: "P1", replaces: "sin validacion de obligacion" },
  { packId: "EJECUCION_AUMENTO_DELEGADO", materia: "Ejecucion aumento delegado", priority: "P1", replaces: "sin control de consumo de delegacion" },
  { packId: "TRASLADO_DOMICILIO", materia: "Traslado domicilio Espana", priority: "P1", replaces: "sin verificacion de autorizacion estatutaria" },
  { packId: "PODERES_APODERADOS", materia: "Otorgamiento de poderes", priority: "P1", replaces: "mayoria generica" },
  { packId: "NOMBRAMIENTO_AUDITOR", materia: "Nombramiento auditor", priority: "P1", replaces: "sin validacion plazo 3-9 anos" },
  { packId: "APROBACION_PRESUPUESTO", materia: "Presupuesto anual", priority: "P1", replaces: "sin fallback pacto P6" },
  { packId: "WEB_CORPORATIVA", materia: "Web corporativa inscrita", priority: "P2", replaces: "sin control de inscripcion RM" },
  { packId: "AUTOCARTERA", materia: "Autocartera SA", priority: "P2", replaces: "sin control tope 10%" },
  { packId: "DISOLUCION_LIQUIDADORES", materia: "Disolucion y liquidadores", priority: "P2", replaces: "sin validacion causa/plazo" },
  { packId: "RATIFICACION_ACTOS", materia: "Ratificacion de actos", priority: "P2", replaces: "sin efecto retroactivo trazado" },
];

export function getFallbackRetirementItemsByPriority(priority: RetirementPriority) {
  return SECRETARIA_FALLBACK_RETIREMENT_ITEMS.filter((item) => item.priority === priority);
}

export function getRulePackSeedTargetsByPriority(priority: RetirementPriority) {
  return RULE_PACK_SEED_TARGETS_V21.filter((item) => item.priority === priority);
}

export function evaluateFallbackRetirement(
  state: FallbackRetirementCriterionState,
): FallbackRetirementStatus {
  const missingCriteria = REQUIRED_CRITERIA
    .filter((criterion) => state[criterion] !== true)
    .map((criterion) => CRITERION_LABELS[criterion]);

  return {
    eliminated: missingCriteria.length === 0,
    missingCriteria,
  };
}

export function summarizeFallbackRetirement() {
  const byPriority = {
    P0: getFallbackRetirementItemsByPriority("P0").length,
    P1: getFallbackRetirementItemsByPriority("P1").length,
    P2: getFallbackRetirementItemsByPriority("P2").length,
  };
  const seedTargetsByPriority = {
    P0: getRulePackSeedTargetsByPriority("P0").length,
    P1: getRulePackSeedTargetsByPriority("P1").length,
    P2: getRulePackSeedTargetsByPriority("P2").length,
  };

  return {
    totalFallbacks: SECRETARIA_FALLBACK_RETIREMENT_ITEMS.length,
    productionBlockingFallbacks: SECRETARIA_FALLBACK_RETIREMENT_ITEMS.filter(
      (item) => item.blocksProductionLegalDefensibility,
    ).length,
    byPriority,
    totalRulePackSeedTargets: RULE_PACK_SEED_TARGETS_V21.length,
    seedTargetsByPriority,
  };
}
