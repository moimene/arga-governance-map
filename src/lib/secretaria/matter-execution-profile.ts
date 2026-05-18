import type { NormalizedCapa3Field } from "@/lib/secretaria/capa3-fields";
import type { EntityNormativeProfile } from "@/lib/secretaria/normative-framework";
import {
  isAtOrBeyondStep,
  WORKFLOW_STEPS_VERSION,
  type AdoptionWorkflowStep,
} from "@/lib/secretaria/workflow-steps";
import type { PactoParasocial, RulePack, RuleParamOverride } from "@/lib/rules-engine";

export type FormalGate =
  | "CONVOCATORIA"
  | "CONSTITUCION"
  | "VOTACION"
  | "DOCUMENTACION"
  | "POST_ACUERDO";

export type OverrideTipo = "VIA_ALTERNATIVA" | "DESVIACION_CON_RIESGO";

export type RiskFlag =
  | "IMPUGNABILIDAD"
  | "CALIFICACION_REGISTRAL"
  | "NULIDAD"
  | "TRAZABILIDAD_PARCIAL";

export type ProfileSeverity = "INFO" | "WARNING" | "BLOCKING";

export type MinimumPrerequisiteStatus = "DOCUMENTADO" | "APROBADO" | "INSCRITO";

export type FormalGateEvaluationStatus = "PASSED" | "WARNING" | "OVERRIDE_REQUIRED" | "BLOCKED";

export interface FormalGateOverride {
  gate: FormalGate;
  requisito: string;
  override_tipo: OverrideTipo;
  fundamento?: string;
  justificacion: string;
  consecuencia?: string;
  risk_flag?: RiskFlag;
  timestamp: string;
}

export interface MatterPrerequisite {
  materia_requerida: string;
  organo_tipo_requerido?: string;
  estado_minimo: MinimumPrerequisiteStatus;
  fuente: string;
  verificable_automaticamente: boolean;
  severity: ProfileSeverity;
  blocking_from_step?: AdoptionWorkflowStep;
  non_overridable?: boolean;
  risk_flag?: RiskFlag;
}

export interface ProfileGap {
  gate: FormalGate | "PREREQUISITO" | "EFICIENCIA";
  code: string;
  severity: ProfileSeverity;
  message: string;
  fuente?: string;
  overridable: boolean;
  override_tipo?: OverrideTipo;
  risk_flag?: RiskFlag;
  risk_flags_adicionales?: RiskFlag[];
}

export interface ExpedientePrerequisiteRecord {
  materia: string;
  organo_tipo?: string | null;
  estado: MinimumPrerequisiteStatus | "BORRADOR" | "PENDIENTE" | "RECHAZADO";
  id?: string;
}

export interface ExpedienteState {
  prerequisitos?: ExpedientePrerequisiteRecord[];
}

export interface MatterExecutionProfile {
  schema_version: "matter-execution-profile.v1";
  workflow_steps_version: typeof WORKFLOW_STEPS_VERSION;
  materia: string;
  organo_tipo: string;
  tipo_social: string;
  adoption_mode: string;
  jurisdiccion: string;
  subtipo_materia?: string;
  is_listed: boolean;
  convocatoria: {
    required: boolean;
    plazo_minimo_dias?: number;
    fuente: string;
    forma_convocatoria: string[];
    segunda_convocatoria: boolean;
    documentacion_preceptiva: string[];
    blockers: string[];
  };
  constitucion: {
    quorum_rule: string;
    quorum_threshold?: number;
    fuente: string;
    blockers: string[];
  };
  votacion: {
    majority_rule: string;
    majority_threshold?: number;
    fuente: string;
    abstenciones_obligatorias: string[];
    veto_checks: string[];
    blockers: string[];
  };
  documentacion: {
    documentos_obligatorios: string[];
    informes_preceptivos: string[];
    blockers: string[];
  };
  post_acuerdo: {
    es_inscribible: boolean;
    escritura_publica: boolean;
    certificacion_requerida: boolean;
    publicacion_borme: boolean;
    plazo_inscripcion_dias?: number;
    documentos_registrales: string[];
    comunicacion_regulador: string[];
    workflow: string[];
  };
  prerequisitos: MatterPrerequisite[];
  secretary_override: {
    allowed: true;
    overrides: FormalGateOverride[];
  };
  eficiencia: {
    campos_a_actualizar: string[];
    reason: string;
  };
  registry_trace?: {
    binding_id?: string;
    template_id?: string;
    template_version?: string;
  };
  rule_trace: {
    rule_pack_id?: string;
    rule_pack_version_id?: string;
    normative_snapshot_id?: string;
  };
  gaps: ProfileGap[];
}

export interface BuildMatterExecutionProfileContext {
  materia: string;
  organo_tipo: string;
  tipo_social: string;
  adoption_mode: string;
  jurisdiccion?: string;
  subtipo_materia?: string;
  is_listed?: boolean;
  is_supervised_entity?: boolean;
  rulePackPayload: Partial<RulePack> & Record<string, unknown>;
  normativeProfile: EntityNormativeProfile;
  paramOverrides?: RuleParamOverride[];
  pactosParasociales?: PactoParasocial[];
  capa3Schema?: NormalizedCapa3Field[];
  registryTrace?: {
    binding_id?: string;
    template_id?: string;
    template_version?: string;
  };
}

export interface FormalGateEvidence {
  gate: FormalGate;
  now?: Date | string;
  convocatoria?: {
    noticeDays?: number;
    juntaUniversal?: boolean;
    unanimousConsent?: boolean;
  };
  documents?: string[];
  values?: Record<string, unknown>;
}

export interface FormalGateEvaluation {
  gate: FormalGate;
  status: FormalGateEvaluationStatus;
  gaps: ProfileGap[];
  override?: FormalGateOverride;
}

const STATUS_RANK: Record<MinimumPrerequisiteStatus, number> = {
  DOCUMENTADO: 1,
  APROBADO: 2,
  INSCRITO: 3,
};

export const RISK_FLAG_PRIORITY: Record<RiskFlag, number> = {
  NULIDAD: 1,
  IMPUGNABILIDAD: 2,
  CALIFICACION_REGISTRAL: 3,
  TRAZABILIDAD_PARCIAL: 4,
};

const DEFAULT_SOURCE = "Regla legal base";

const REFRESHABLE_FIELDS_BY_MATTER: Record<string, string[]> = {
  APROBACION_CUENTAS: [
    "ejercicio",
    "ejercicio_fiscal",
    "propuesta_aplicacion_resultado",
    "resultado_ejercicio",
  ],
  FORMULACION_CUENTAS: [
    "ejercicio",
    "informe_gestion_resumen",
    "propuesta_aplicacion_resultado",
    "auditor_designado",
  ],
  DISTRIBUCION_DIVIDENDOS: [
    "importe_dividendo",
    "resultado_distribuible",
    "fecha_pago",
    "cuantia_dividendo",
  ],
  NOMBRAMIENTO_AUDITOR: ["duracion_anos", "ejercicio_inicio", "ejercicio_fin", "auditor_designado"],
  FINANCIACION: [
    "tipo_financiacion",
    "entidad_financiera",
    "importe_financiacion",
    "plazo",
    "condiciones_financieras_resumen",
    "garantias",
  ],
  CONTRATACION_RELEVANTE: [
    "contraparte",
    "objeto_contrato",
    "precio_total",
    "plazo_contrato",
    "condiciones_esenciales",
  ],
  FUSION: ["tipo_fusion", "relacion_canje", "proyecto_comun_ref"],
  ESCISION: ["tipo_escision", "relacion_canje", "proyecto_comun_ref"],
  FUSION_ESCISION: ["tipo_operacion", "relacion_canje", "proyecto_comun_ref"],
};

function nowIso(value?: Date | string) {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function resolveRiskFlag(candidates: RiskFlag[]) {
  const ordered = [...new Set(candidates)].sort(
    (a, b) => RISK_FLAG_PRIORITY[a] - RISK_FLAG_PRIORITY[b],
  );
  return {
    primary: ordered[0],
    additional: ordered.slice(1),
  };
}

function ruleParamValue<T>(value: unknown): T | undefined {
  if (value && typeof value === "object" && "valor" in value) {
    return (value as { valor?: T }).valor;
  }
  return undefined;
}

function ruleParamReference(value: unknown, fallback = DEFAULT_SOURCE) {
  if (value && typeof value === "object" && "referencia" in value) {
    const reference = (value as { referencia?: unknown }).referencia;
    if (typeof reference === "string" && reference.trim()) return reference;
  }
  return fallback;
}

function overrideFor(context: BuildMatterExecutionProfileContext, key: string) {
  return (context.paramOverrides ?? []).find((override) => normalizeCode(override.clave) === normalizeCode(key));
}

function overrideValue(context: BuildMatterExecutionProfileContext, key: string) {
  return overrideFor(context, key)?.valor;
}

function booleanOverride(context: BuildMatterExecutionProfileContext, key: string) {
  return overrideValue(context, key) === true;
}

function numericOverride(context: BuildMatterExecutionProfileContext, key: string) {
  return numericValue(overrideValue(context, key));
}

function overrideReference(context: BuildMatterExecutionProfileContext, key: string, fallback = DEFAULT_SOURCE) {
  const override = overrideFor(context, key);
  return override?.referencia || fallback;
}

function legalNoticeMinimumDays(tipoSocial: string) {
  const normalized = normalizeCode(tipoSocial);
  if (normalized === "SA" || normalized === "SAU") return 30;
  if (normalized === "SL" || normalized === "SLU") return 15;
  return undefined;
}

function convocatoriaRuleFor(context: BuildMatterExecutionProfileContext) {
  const tipoSocial = normalizeCode(context.tipo_social);
  const rules = context.rulePackPayload.convocatoria?.antelacionDias as Record<string, unknown> | undefined;
  return rules?.[tipoSocial] ?? rules?.SA ?? rules?.SL;
}

function resolveNoticeDays(
  context: BuildMatterExecutionProfileContext,
  convocatoriaRule: unknown,
): { days?: number; fuente: string; gap?: ProfileGap } {
  const legalMinimum = legalNoticeMinimumDays(context.tipo_social);
  const rulePackDays = numericValue(ruleParamValue<number>(convocatoriaRule));
  const statutoryDays = numericOverride(context, "plazo_convocatoria_dias");

  if (statutoryDays !== null && typeof legalMinimum === "number") {
    if (statutoryDays >= legalMinimum) {
      return {
        days: statutoryDays,
        fuente: overrideReference(context, "plazo_convocatoria_dias", "Estatutos sociales"),
      };
    }

    return {
      days: legalMinimum,
      fuente: "Art. 176 LSC",
      gap: profileGap({
        gate: "CONVOCATORIA",
        code: "STATUTORY_NOTICE_BELOW_LEGAL_MINIMUM",
        severity: "INFO",
        message: `Override estatutario de ${statutoryDays} dias inferior al minimo legal de ${legalMinimum} dias. Se aplica el minimo legal.`,
        fuente: "Art. 176 LSC",
        overridable: false,
      }),
    };
  }

  if (rulePackDays !== null) {
    if (typeof legalMinimum === "number" && rulePackDays < legalMinimum) {
      return {
        days: legalMinimum,
        fuente: "Art. 176 LSC",
        gap: profileGap({
          gate: "CONVOCATORIA",
          code: "RULE_PACK_NOTICE_BELOW_LEGAL_MINIMUM",
          severity: "INFO",
          message: `Rule pack indica ${rulePackDays} dias, inferior al minimo legal de ${legalMinimum} dias. Se aplica el minimo legal.`,
          fuente: "Art. 176 LSC",
          overridable: false,
        }),
      };
    }

    return {
      days: rulePackDays,
      fuente: ruleParamReference(convocatoriaRule),
    };
  }

  return {
    days: legalMinimum,
    fuente: typeof legalMinimum === "number" ? "Art. 176 LSC" : ruleParamReference(convocatoriaRule),
  };
}

function hasSecondCall(context: BuildMatterExecutionProfileContext) {
  const tipoSocial = normalizeCode(context.tipo_social);
  if (tipoSocial === "SA" || tipoSocial === "SAU") return true;
  if (tipoSocial === "SL" || tipoSocial === "SLU") {
    return booleanOverride(context, "segunda_convocatoria_sl");
  }
  return false;
}

function secondCallInfoGap(context: BuildMatterExecutionProfileContext) {
  const tipoSocial = normalizeCode(context.tipo_social);
  if ((tipoSocial === "SL" || tipoSocial === "SLU") && !booleanOverride(context, "segunda_convocatoria_sl")) {
    return profileGap({
      gate: "CONVOCATORIA",
      code: "SL_SECOND_CALL_REQUIRES_STATUTORY_OVERRIDE",
      severity: "INFO",
      message: "La SL/SLU no tiene segunda convocatoria salvo prevision estatutaria. Se aplica false por defecto.",
      fuente: "Art. 195 LSC y autonomia estatutaria",
    });
  }
  return undefined;
}

function regulatoryCommunicationInfo(context: BuildMatterExecutionProfileContext) {
  if (!context.is_supervised_entity) return [];
  return ["Entidad supervisada: verificar si esta materia requiere comunicacion o autorizacion previa DGSFP/CNMV."];
}

function regulatoryCommunicationGap(context: BuildMatterExecutionProfileContext) {
  if (!context.is_supervised_entity) return undefined;
  return profileGap({
    gate: "POST_ACUERDO",
    code: "SUPERVISED_ENTITY_REGULATORY_CHECK",
    severity: "INFO",
    message: "Entidad supervisada: verificar si esta materia requiere comunicacion o autorizacion previa DGSFP/CNMV.",
    fuente: "Solvencia II / LOSSEAR / normativa CNMV segun materia",
  });
}

function quorumRuleFor(context: BuildMatterExecutionProfileContext) {
  const organo = normalizeCode(context.organo_tipo);
  const tipoSocial = normalizeCode(context.tipo_social);
  const quorum = context.rulePackPayload.constitucion?.quorum as Record<string, unknown> | undefined;
  if (!quorum) return undefined;
  if (organo === "CONSEJO_ADMIN" || organo === "CONSEJO") return quorum.CONSEJO;
  if (tipoSocial === "SA" || tipoSocial === "SAU") return quorum.SA_1a;
  return quorum.SL;
}

function majorityRuleFor(context: BuildMatterExecutionProfileContext) {
  const organo = normalizeCode(context.organo_tipo);
  const tipoSocial = normalizeCode(context.tipo_social);
  const majority = context.rulePackPayload.votacion?.mayoria as Record<string, unknown> | undefined;
  if (!majority) return undefined;
  if (organo === "CONSEJO_ADMIN" || organo === "CONSEJO") return majority.CONSEJO;
  if (tipoSocial === "SA" || tipoSocial === "SAU") return majority.SA;
  return majority.SL;
}

function isUniversalAlternative(context: BuildMatterExecutionProfileContext) {
  return normalizeCode(context.adoption_mode) === "UNIVERSAL";
}

function isUnipersonalMode(context: BuildMatterExecutionProfileContext) {
  return ["UNIPERSONAL_SOCIO", "UNIPERSONAL_ADMIN", "SOLIDARIO", "CO_APROBACION"].includes(
    normalizeCode(context.adoption_mode),
  );
}

function sourceRulePackId(rulePackPayload: Partial<RulePack> & Record<string, unknown>) {
  return typeof rulePackPayload.id === "string" ? rulePackPayload.id : undefined;
}

function sourceRulePackVersionId(context: BuildMatterExecutionProfileContext) {
  const raw =
    context.rulePackPayload.rule_pack_version_id ??
    context.rulePackPayload.version_id ??
    context.rulePackPayload.version;
  return typeof raw === "string" ? raw : undefined;
}

function documentNames(context: BuildMatterExecutionProfileContext) {
  return (context.rulePackPayload.documentacion?.obligatoria ?? [])
    .map((item) => item.nombre || item.id)
    .filter(Boolean);
}

function requiredReportsForMatter(materia: string) {
  if (materia === "FUSION" || materia === "ESCISION" || materia === "FUSION_ESCISION") {
    return ["Proyecto comun de modificacion estructural", "Informes exigidos por RDL 5/2023 cuando procedan"];
  }
  if (materia === "MODIFICACION_ESTATUTOS" || materia === "AMPLIACION_OBJETO_SOCIAL") {
    return ["Texto integro de la modificacion estatutaria"];
  }
  if (materia === "NOMBRAMIENTO_AUDITOR") {
    return ["Propuesta de nombramiento y duracion del encargo"];
  }
  return [];
}

function prerequisitesForMatter(materia: string): MatterPrerequisite[] {
  switch (materia) {
    case "APROBACION_CUENTAS":
      return [
        {
          materia_requerida: "FORMULACION_CUENTAS",
          organo_tipo_requerido: "ORGANO_ADMIN",
          estado_minimo: "APROBADO",
          fuente: "Art. 253 LSC",
          verificable_automaticamente: true,
          severity: "BLOCKING",
        },
      ];
    case "DISTRIBUCION_DIVIDENDOS":
      return [
        {
          materia_requerida: "APROBACION_CUENTAS",
          organo_tipo_requerido: "JUNTA_GENERAL",
          estado_minimo: "APROBADO",
          fuente: "Art. 273 LSC",
          verificable_automaticamente: true,
          severity: "BLOCKING",
        },
      ];
    case "FUSION":
    case "ESCISION":
    case "FUSION_ESCISION":
      return [
        {
          materia_requerida: "PROYECTO_COMUN_MODIFICACION_ESTRUCTURAL",
          estado_minimo: "DOCUMENTADO",
          fuente: "Arts. 11-25 RDL 5/2023",
          verificable_automaticamente: false,
          severity: "WARNING",
          blocking_from_step: "CONVOCATORIA",
          risk_flag: "IMPUGNABILIDAD",
        },
      ];
    case "DELEGACION_FACULTADES":
      return [
        {
          materia_requerida: "NOMBRAMIENTO_CONSEJERO",
          estado_minimo: "INSCRITO",
          fuente: "Art. 249 LSC",
          verificable_automaticamente: true,
          severity: "WARNING",
        },
      ];
    case "CERTIFICACION_ACUERDOS":
      return [
        {
          materia_requerida: "ACTA_APROBADA",
          estado_minimo: "APROBADO",
          fuente: "RRM arts. 108-109",
          verificable_automaticamente: true,
          severity: "BLOCKING",
          non_overridable: true,
          risk_flag: "CALIFICACION_REGISTRAL",
        },
      ];
    default:
      return [];
  }
}

function postAgreementWorkflow(profile: Pick<MatterExecutionProfile, "post_acuerdo">) {
  const workflow = ["LIBRO_ACTAS"];
  if (profile.post_acuerdo.certificacion_requerida) workflow.push("CERTIFICACION");
  if (profile.post_acuerdo.escritura_publica) workflow.push("ESCRITURA_PUBLICA");
  if (profile.post_acuerdo.es_inscribible) workflow.push("INSCRIPCION_REGISTRAL");
  if (profile.post_acuerdo.publicacion_borme) workflow.push("PUBLICACION_BORME");
  return workflow;
}

function profileGap(input: Omit<ProfileGap, "overridable"> & { overridable?: boolean }): ProfileGap {
  return { ...input, overridable: input.overridable ?? true };
}

function profileIntrinsicGaps(context: BuildMatterExecutionProfileContext) {
  const gaps: ProfileGap[] = [];
  const materia = normalizeCode(context.materia);
  const organo = normalizeCode(context.organo_tipo);
  const tipoSocial = normalizeCode(context.tipo_social);
  const subtipo = normalizeCode(context.subtipo_materia);

  if (materia === "NOMBRAMIENTO_CONSEJERO" && subtipo === "COOPTACION" && tipoSocial !== "SA" && tipoSocial !== "SAU") {
    const hasStatutorySupport = booleanOverride(context, "cooptacion_sl_estatutaria");
    gaps.push(profileGap({
      gate: "VOTACION",
      code: "COOPTACION_SOLO_SA",
      severity: hasStatutorySupport ? "WARNING" : "BLOCKING",
      message: hasStatutorySupport
        ? "Cooptacion en SL con prevision estatutaria: revisar texto estatutario y criterio registral aplicable."
        : "La cooptacion del art. 244 LSC esta configurada como cauce propio de SA/SAU; en SL exige prevision estatutaria expresa.",
      fuente: "Art. 244 LSC",
      override_tipo: "DESVIACION_CON_RIESGO",
      risk_flag: hasStatutorySupport ? "CALIFICACION_REGISTRAL" : "IMPUGNABILIDAD",
    }));
  }

  if (materia === "CESE_CONSEJERO" && (organo === "CONSEJO_ADMIN" || organo === "CONSEJO")) {
    if (!subtipo) {
      gaps.push(profileGap({
        gate: "VOTACION",
        code: "CESE_CONSEJO_SUBTIPO_REQUIRED",
        severity: "BLOCKING",
        message: "El cese por Consejo requiere subtipo: RENUNCIA, CESE_AUTOMATICO o PROPUESTA_CESE_A_JUNTA.",
        fuente: "Art. 223.1 LSC",
        override_tipo: "DESVIACION_CON_RIESGO",
        risk_flag: "IMPUGNABILIDAD",
      }));
    } else if (subtipo === "AD_NUTUM") {
      gaps.push(profileGap({
        gate: "VOTACION",
        code: "CESE_AD_NUTUM_COMPETENCIA_JUNTA",
        severity: "BLOCKING",
        message: "El Consejo no puede cesar ad nutum a un consejero; la separacion libre corresponde a la Junta General.",
        fuente: "Art. 223.1 LSC",
        override_tipo: "DESVIACION_CON_RIESGO",
        risk_flag: "IMPUGNABILIDAD",
      }));
    }
  }

  if ((materia === "FUSION" || materia === "ESCISION" || materia === "FUSION_ESCISION") && !context.subtipo_materia) {
    gaps.push(profileGap({
      gate: "DOCUMENTACION",
      code: "SUBTIPO_MODIFICACION_ESTRUCTURAL_PENDIENTE",
      severity: "BLOCKING",
      message: "La modificacion estructural requiere subtipo operacional para cerrar informes, publicidad y canje aplicables.",
      fuente: "RDL 5/2023",
      override_tipo: "DESVIACION_CON_RIESGO",
      risk_flag: "TRAZABILIDAD_PARCIAL",
    }));
  }

  return gaps;
}

export function buildMatterExecutionProfile(context: BuildMatterExecutionProfileContext): MatterExecutionProfile {
  const materia = normalizeCode(context.materia);
  const convocatoriaRule = convocatoriaRuleFor(context);
  const quorumRule = quorumRuleFor(context);
  const majorityRule = majorityRuleFor(context);
  const noticeResolution = resolveNoticeDays(context, convocatoriaRule);
  const post: Partial<RulePack["postAcuerdo"]> = context.rulePackPayload.postAcuerdo ?? {};
  const plazoInscripcion = post.plazoInscripcion;
  const plazoInscripcionDias =
    typeof plazoInscripcion === "object" && plazoInscripcion && "dias" in plazoInscripcion
      ? Number((plazoInscripcion as { dias?: unknown }).dias)
      : undefined;

  const convocatoriaRequired = !isUniversalAlternative(context) && !isUnipersonalMode(context);
  const secondCallGap = convocatoriaRequired ? secondCallInfoGap(context) : undefined;
  const regulatoryGap = regulatoryCommunicationGap(context);
  const baseProfile: MatterExecutionProfile = {
    schema_version: "matter-execution-profile.v1",
    workflow_steps_version: WORKFLOW_STEPS_VERSION,
    materia,
    organo_tipo: normalizeCode(context.organo_tipo),
    tipo_social: normalizeCode(context.tipo_social),
    adoption_mode: normalizeCode(context.adoption_mode),
    jurisdiccion: context.jurisdiccion ?? "ES",
    subtipo_materia: context.subtipo_materia,
    is_listed: Boolean(context.is_listed ?? context.normativeProfile.is_listed),
    convocatoria: {
      required: convocatoriaRequired,
      plazo_minimo_dias: convocatoriaRequired ? noticeResolution.days : undefined,
      fuente: convocatoriaRequired ? noticeResolution.fuente : "Art. 178 LSC / via alternativa",
      forma_convocatoria: context.rulePackPayload.convocatoria?.canales?.[normalizeCode(context.tipo_social) as "SA" | "SL" | "SAU" | "SLU"] ?? [],
      segunda_convocatoria: hasSecondCall(context),
      documentacion_preceptiva: documentNames(context),
      blockers: [],
    },
    constitucion: {
      quorum_rule: String(ruleParamValue<string | number>(quorumRule) ?? "Segun ley, estatutos y perfil normativo"),
      quorum_threshold: numericValue(ruleParamValue<number>(quorumRule)) ?? undefined,
      fuente: ruleParamReference(quorumRule),
      blockers: [],
    },
    votacion: {
      majority_rule:
        typeof majorityRule === "object" && majorityRule && "formula" in majorityRule
          ? String((majorityRule as { formula?: unknown }).formula ?? "Segun ley y estatutos")
          : "Segun ley y estatutos",
      majority_threshold: undefined,
      fuente:
        typeof majorityRule === "object" && majorityRule && "referencia" in majorityRule
          ? String((majorityRule as { referencia?: unknown }).referencia ?? DEFAULT_SOURCE)
          : DEFAULT_SOURCE,
      abstenciones_obligatorias: materia === "OPERACION_VINCULADA" ? ["Consejero vinculado (arts. 228-229 LSC)"] : [],
      veto_checks: [
        ...(context.pactosParasociales?.length ? ["Pactos parasociales aplicables al expediente (warning contractual)"] : []),
        ...(["FINANCIACION", "CONTRATACION_RELEVANTE", "AUTORIZACION_GARANTIA"].includes(materia)
          ? ["Verificar umbral 25% activo (art. 160.f LSC)"]
          : []),
      ],
      blockers: [],
    },
    documentacion: {
      documentos_obligatorios: documentNames(context),
      informes_preceptivos: requiredReportsForMatter(materia),
      blockers: [],
    },
    post_acuerdo: {
      es_inscribible: Boolean(post.inscribible),
      escritura_publica: post.instrumentoRequerido === "ESCRITURA",
      certificacion_requerida: Boolean(post.inscribible) || post.instrumentoRequerido !== "NINGUNO",
      publicacion_borme: Boolean(post.publicacionRequerida),
      plazo_inscripcion_dias: Number.isFinite(plazoInscripcionDias) ? plazoInscripcionDias : undefined,
      documentos_registrales: [],
      comunicacion_regulador: regulatoryCommunicationInfo(context),
      workflow: [],
    },
    prerequisitos: prerequisitesForMatter(materia),
    secretary_override: {
      allowed: true,
      overrides: [],
    },
    eficiencia: {
      campos_a_actualizar: computeRefreshableCapa3FieldsForMatter(materia, context.capa3Schema ?? []),
      reason: "Campos derivados de la materia y del schema Capa 3 de la plantilla resuelta.",
    },
    registry_trace: context.registryTrace,
    rule_trace: {
      rule_pack_id: sourceRulePackId(context.rulePackPayload),
      rule_pack_version_id: sourceRulePackVersionId(context),
      normative_snapshot_id: context.normativeProfile.profile_id,
    },
    gaps: [
      ...profileIntrinsicGaps(context),
      ...(convocatoriaRequired && noticeResolution.gap ? [noticeResolution.gap] : []),
      ...(secondCallGap ? [secondCallGap] : []),
      ...(regulatoryGap ? [regulatoryGap] : []),
    ],
  };

  baseProfile.post_acuerdo.workflow = postAgreementWorkflow(baseProfile);
  if (materia === "FUSION" || materia === "ESCISION" || materia === "FUSION_ESCISION") {
    baseProfile.post_acuerdo.es_inscribible = true;
    baseProfile.post_acuerdo.escritura_publica = true;
    baseProfile.post_acuerdo.certificacion_requerida = true;
    baseProfile.post_acuerdo.publicacion_borme = true;
    baseProfile.post_acuerdo.documentos_registrales = [
      "Proyecto comun",
      "Certificacion del acuerdo",
      "Escritura publica",
      "Publicaciones y acreditacion de derechos de acreedores cuando proceda",
    ];
    baseProfile.post_acuerdo.workflow = postAgreementWorkflow(baseProfile);
  }

  return baseProfile;
}

function computeRefreshableCapa3FieldsForMatter(materia: string, capa3Schema: NormalizedCapa3Field[]) {
  const candidates = new Set(REFRESHABLE_FIELDS_BY_MATTER[materia] ?? []);
  return capa3Schema
    .map((field) => field.campo)
    .filter((campo) => candidates.has(campo));
}

export function computeRefreshableCapa3Fields(
  profile: MatterExecutionProfile,
  capa3Schema: NormalizedCapa3Field[],
) {
  return computeRefreshableCapa3FieldsForMatter(profile.materia, capa3Schema);
}

export function derivePostAgreementWorkflow(profile: MatterExecutionProfile) {
  return postAgreementWorkflow(profile);
}

export function computePrerequisiteGaps(
  profile: MatterExecutionProfile,
  expedienteState: ExpedienteState,
  currentStep?: AdoptionWorkflowStep,
): ProfileGap[] {
  const records = expedienteState.prerequisitos ?? [];
  return profile.prerequisitos.flatMap((prerequisite) => {
    const match = records.find((record) => {
      const sameMatter = normalizeCode(record.materia) === normalizeCode(prerequisite.materia_requerida);
      const sameOrgan =
        !prerequisite.organo_tipo_requerido ||
        !record.organo_tipo ||
        normalizeCode(record.organo_tipo) === normalizeCode(prerequisite.organo_tipo_requerido);
      return sameMatter && sameOrgan;
    });

    if (match && STATUS_RANK[match.estado as MinimumPrerequisiteStatus] >= STATUS_RANK[prerequisite.estado_minimo]) {
      return [];
    }

    const effectiveSeverity =
      prerequisite.blocking_from_step && currentStep && isAtOrBeyondStep(currentStep, prerequisite.blocking_from_step)
        ? "BLOCKING"
        : prerequisite.severity;
    const effectiveRiskFlag =
      effectiveSeverity === "BLOCKING"
        ? prerequisite.risk_flag ?? "TRAZABILIDAD_PARCIAL"
        : prerequisite.risk_flag === "TRAZABILIDAD_PARCIAL"
          ? prerequisite.risk_flag
          : undefined;

    return [profileGap({
      gate: "PREREQUISITO",
      code: "PREREQUISITE_MISSING",
      severity: effectiveSeverity,
      message: `${prerequisite.materia_requerida} debe constar como ${prerequisite.estado_minimo}.`,
      fuente: prerequisite.fuente,
      overridable: !prerequisite.non_overridable,
      override_tipo: effectiveSeverity === "BLOCKING" ? "DESVIACION_CON_RIESGO" : "VIA_ALTERNATIVA",
      risk_flag: effectiveRiskFlag,
    })];
  });
}

function riskyOverride(gate: FormalGate, requisito: string, justificacion: string, timestamp: string): FormalGateOverride {
  return {
    gate,
    requisito,
    override_tipo: "DESVIACION_CON_RIESGO",
    justificacion,
    consecuencia: "El acuerdo queda marcado con riesgo formal y debe revisarse antes de certificacion o presentacion registral.",
    risk_flag: gate === "POST_ACUERDO" ? "CALIFICACION_REGISTRAL" : "IMPUGNABILIDAD",
    timestamp,
  };
}

export function evaluateFormalGate(
  profile: MatterExecutionProfile,
  evidence: FormalGateEvidence,
): FormalGateEvaluation {
  const timestamp = nowIso(evidence.now);

  if (evidence.gate === "CONVOCATORIA") {
    if (!profile.convocatoria.required) {
      return { gate: evidence.gate, status: "PASSED", gaps: [] };
    }
    if (evidence.convocatoria?.juntaUniversal || evidence.convocatoria?.unanimousConsent) {
      return {
        gate: evidence.gate,
        status: "PASSED",
        gaps: [],
        override: {
          gate: "CONVOCATORIA",
          requisito: "Convocatoria formal",
          override_tipo: "VIA_ALTERNATIVA",
          fundamento: "Art. 178 LSC junta universal / consentimiento unanime",
          justificacion: "La reunion se documenta por via legal alternativa sin defecto de convocatoria.",
          timestamp,
        },
      };
    }

    const noticeDays = evidence.convocatoria?.noticeDays;
    if (typeof noticeDays === "number" && typeof profile.convocatoria.plazo_minimo_dias === "number") {
      if (noticeDays >= profile.convocatoria.plazo_minimo_dias) {
        return { gate: evidence.gate, status: "PASSED", gaps: [] };
      }
      const gap = profileGap({
        gate: "CONVOCATORIA",
        code: "NOTICE_PERIOD_SHORT",
        severity: "BLOCKING",
        message: `Plazo de convocatoria ${noticeDays} dias inferior al minimo ${profile.convocatoria.plazo_minimo_dias}.`,
        fuente: profile.convocatoria.fuente,
        overridable: false,
        override_tipo: "DESVIACION_CON_RIESGO",
        risk_flag: "IMPUGNABILIDAD",
      });
      return {
        gate: evidence.gate,
        status: "BLOCKED",
        gaps: [gap],
      };
    }
  }

  if (evidence.gate === "DOCUMENTACION") {
    const values = evidence.values ?? {};
    if (profile.materia === "NOMBRAMIENTO_AUDITOR") {
      const duration = numericValue(values.duracion_anos ?? values.duracion_auditor_anos);
      if (duration !== null && (duration < 3 || duration > 9)) {
        const gap = profileGap({
          gate: "DOCUMENTACION",
          code: "AUDITOR_DURATION_OUT_OF_RANGE",
          severity: "BLOCKING",
          message: "La duracion del nombramiento de auditor debe estar entre 3 y 9 anos.",
          fuente: "Art. 264 LSC",
          overridable: false,
          override_tipo: "DESVIACION_CON_RIESGO",
          risk_flag: "CALIFICACION_REGISTRAL",
        });
        return {
          gate: evidence.gate,
          status: "BLOCKED",
          gaps: [gap],
        };
      }
    }

    if (profile.materia === "NOMBRAMIENTO_CONSEJERO" && (profile.tipo_social === "SA" || profile.tipo_social === "SAU")) {
      const mandateYears = numericValue(values.mandato_anos ?? values.mandato_consejero_anos);
      if (mandateYears !== null && mandateYears > 6) {
        const gap = profileGap({
          gate: "DOCUMENTACION",
          code: "CONSEJERO_MANDATE_EXCEEDS_SA_MAX",
          severity: "BLOCKING",
          message: "La duracion del cargo de consejero en SA no puede exceder de 6 anos.",
          fuente: "Art. 221.1 LSC",
          overridable: false,
          override_tipo: "DESVIACION_CON_RIESGO",
          risk_flag: "CALIFICACION_REGISTRAL",
        });
        return {
          gate: evidence.gate,
          status: "BLOCKED",
          gaps: [gap],
        };
      }
    }

    const providedDocs = new Set((evidence.documents ?? []).map(normalizeCode));
    const missing = profile.documentacion.documentos_obligatorios.filter((doc) => !providedDocs.has(normalizeCode(doc)));
    if (missing.length > 0) {
      return {
        gate: evidence.gate,
        status: "WARNING",
        gaps: missing.map((doc) => profileGap({
          gate: "DOCUMENTACION",
          code: "DOCUMENT_REQUIRED_NOT_FOUND",
          severity: "WARNING",
          message: `No consta documento preceptivo: ${doc}.`,
          fuente: DEFAULT_SOURCE,
          override_tipo: "DESVIACION_CON_RIESGO",
          risk_flag: "TRAZABILIDAD_PARCIAL",
        })),
      };
    }
  }

  return { gate: evidence.gate, status: "PASSED", gaps: [] };
}
