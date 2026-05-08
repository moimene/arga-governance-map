// ============================================================
// Rule Manager — Contrato puro (read-only) para Acuerdo360
// Spec: docs/superpowers/plans/2026-05-06-secretaria-gestor-reglas-acuerdo360-plan.md
// ============================================================
//
// Objetivo: construir, sobre las fuentes ya existentes
// (normative-framework, pactos-engine, agreement-360), una capa que
// presente al equipo legal la "regla efectiva" de un acuerdo:
//
//   LEY → ESTATUTOS / overrides → REGLAMENTO → PACTO PARASOCIAL → POLÍTICA → REGLA EFECTIVA
//
// Y que separe tres veredictos jurídicamente distintos:
//
//   - Validez societaria      ¿el órgano puede adoptar el acuerdo?
//   - Cumplimiento contractual ¿incumple un pacto, veto o consentimiento?
//   - Implementación operativa ¿hay que parar la ejecución/registro hasta
//                                obtener waiver o consentimiento expreso?
//
// Este módulo es PURO: no consulta Supabase, no toca UI, no muta datos.
// Recibe inputs ya cargados y devuelve un objeto serializable.
// ============================================================

import {
  buildEntityNormativeProfile,
  type EntityNormativeProfile,
  type EntityNormativeProfileInput,
  type FormalizationRequirement,
  type NormativeLayer,
  type NormativePlane,
  type NormativeSource,
  summarizeFormalizationForAgreement,
} from "./normative-framework";
import {
  evaluarPactosParasociales,
  type PactoEvalResult,
  type PactoParasocial,
  type PactosEvalInput,
} from "@/lib/rules-engine/pactos-engine";

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export type LegalConsequence =
  | "VALIDITY_BLOCK"      // Bloqueo societario: el acuerdo no puede proclamarse válidamente.
  | "CONTRACTUAL_BREACH"  // Incumplimiento contractual: el acuerdo es válido pero rompe un pacto.
  | "OPERATIONAL_HOLD"    // Hold operativo: parar ejecución/registro hasta obtener waiver/consentimiento.
  | "WARNING"             // Advertencia informativa que no bloquea.
  | "NO_EFFECT";          // Sin efecto: la fuente no aplica al acuerdo evaluado.

export type EffectiveRuleStatus =
  | "PROCLAMABLE_AND_EXECUTABLE"  // Sin breaches ni holds: se puede adoptar y ejecutar.
  | "PROCLAMABLE_HELD"             // Societariamente válido pero hay hold operativo o breach contractual.
  | "BLOCKED";                     // Hay al menos un VALIDITY_BLOCK: no se puede adoptar.

export interface EffectiveRuleSource {
  layer: NormativeLayer;
  plane: NormativePlane;
  label: string;
  reference: string | null;
  source_id: string | null;
  status: NormativeSource["status"];
  notes: string[];
}

export interface EffectiveRuleConsequence {
  consequence: LegalConsequence;
  source_layer: NormativeLayer;
  source_plane: NormativePlane;
  source_id: string | null;
  source_label: string;
  matter: string | null;
  reason: string;
  remediable: boolean;          // true si la consecuencia se puede remediar (waiver, consentimiento, ratificación).
  remediation_hint?: string;
}

export interface EffectiveMajority {
  /** Código resumen del régimen aplicable (SIMPLE, REFORZADA, ESTRUCTURAL, PACTO_*). */
  code: string | null;
  /** Threshold legal base si lo conoce el caller (ej. 0.5, 0.6667, 0.75). */
  legal_threshold?: number | null;
  /** Threshold elevado por pacto si supera el legal. */
  pacto_threshold?: number | null;
  /** Threshold efectivo a aplicar. */
  effective_threshold?: number | null;
  /** Origen del threshold efectivo: ley o pacto. */
  effective_source?: "LEY" | "PACTO" | null;
  /** Descripción legible si el caller la suministra. */
  description?: string | null;
  notes: string[];
}

export interface EffectiveRuleRequirements {
  convocatoria?: { required: boolean; notes: string[] };
  quorum?: { required: boolean; notes: string[] };
  majority?: EffectiveMajority;
  unanimity?: { required: boolean; notes: string[] };
  veto?: { applies: boolean; titulares: string[]; notes: string[] };
  consent?: { required: boolean; from: string[]; notes: string[] };
  documentation: FormalizationRequirement[];
  registry: { required: boolean; notes: string[] };
  publication: { required: boolean; notes: string[] };
}

export interface RuleManagerInput {
  entity: EntityNormativeProfileInput["entity"];
  jurisdictionRuleSets?: EntityNormativeProfileInput["jurisdictionRuleSets"];
  rulePacks?: EntityNormativeProfileInput["rulePacks"];
  overrides?: EntityNormativeProfileInput["overrides"];
  pactos?: PactoParasocial[];
  agreement: {
    matter: string;
    matter_class?: string | null;
    body_type?: string | null;
    adoption_mode: string;
    inscribable?: boolean | null;
    /**
     * Si el caller resolvió la mayoría legal exacta desde un rule pack
     * activo (con threshold real), la pasa aquí; el contrato la prefiere
     * sobre la heurística por matter_class.
     */
    legal_majority?: {
      code: string | null;
      threshold?: number | null;
      description?: string | null;
    } | null;
  };
  pactosEval?: Partial<PactosEvalInput>;
  // Opciones de clasificación legal
  options?: {
    /**
     * Lista de identificadores de cláusulas/pactos cuya consecuencia debe
     * elevarse a VALIDITY_BLOCK porque el equipo legal confirmó que están
     * incorporados a estatutos.
     */
    statutoryEnshrinedPactoIds?: string[];
  };
  tenantId?: string | null;
  now?: Date | string;
}

export interface EffectiveAgreementRule {
  schema_version: "rule-manager-contract.v1";
  evaluated_at: string;
  entity_id: string;
  matter: string;
  matter_class: string | null;
  body_type: string | null;
  adoption_mode: string;
  inscribable: boolean;
  status: EffectiveRuleStatus;
  societary_valid: boolean;
  contractual_compliant: boolean;
  operational_clear: boolean;
  sources: EffectiveRuleSource[];
  requirements: EffectiveRuleRequirements;
  consequences: EffectiveRuleConsequence[];
  pactos_evaluated: PactoEvalResult[];
  profile: EntityNormativeProfile;
  trace: {
    profile_hash: string;
    pacto_ids: string[];
    statutory_enshrined_pacto_ids: string[];
  };
}

// ─── Helpers internos ───────────────────────────────────────────────────────

function isoNow(now?: Date | string) {
  const date = now ? new Date(now) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function dedupe<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const value of values) {
    const k = key(value);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(value);
    }
  }
  return out;
}

function profileSourcesToEffective(profile: EntityNormativeProfile): EffectiveRuleSource[] {
  return profile.sources.map((source) => ({
    layer: source.layer,
    plane: source.plane,
    label: source.label,
    reference: source.reference,
    source_id: source.source_id,
    status: source.status,
    notes: source.notes,
  }));
}

function inferMajorityCode(matterClass?: string | null) {
  const upper = (matterClass ?? "").trim().toUpperCase();
  if (upper === "ORDINARIA") return "SIMPLE";
  if (upper === "ESTRUCTURAL") return "ESTRUCTURAL";
  if (upper === "ESTATUTARIA") return "REFORZADA";
  return null;
}

/** Adopción que exige convocatoria con plazo y forma. */
const ADOPTION_NEEDS_CONVOCATION = new Set([
  "MEETING",
  "UNIVERSAL",
  "CO_APROBACION", // k de n administradores: notificación a los implicados.
]);

/** Adopción que exige unanimidad o equivalente. */
const ADOPTION_NEEDS_UNANIMITY = new Set([
  "NO_SESSION",
  "UNIPERSONAL_SOCIO",
]);

/** Adopción que exige quórum de constitución (sesión presencial o equivalente). */
const ADOPTION_NEEDS_QUORUM = new Set([
  "MEETING",
  "UNIVERSAL",
]);

/** Etiquetas humanas por modo de adopción. */
const ADOPTION_LABELS: Record<string, string> = {
  MEETING: "Acuerdo en sesión",
  UNIVERSAL: "Junta universal",
  NO_SESSION: "Acuerdo sin sesión",
  CO_APROBACION: "Co-aprobación de administradores",
  SOLIDARIO: "Decisión de administrador solidario",
  UNIPERSONAL_SOCIO: "Decisión del socio único",
  UNIPERSONAL_ADMIN: "Decisión del administrador único",
};

function maxPactoMajorityThreshold(pactos: PactoParasocial[], matter: string) {
  const aplicables = pactos.filter(
    (p) =>
      p.estado === "VIGENTE" &&
      p.tipo_clausula === "MAYORIA_REFORZADA_PACTADA" &&
      p.materias_aplicables.includes(matter) &&
      typeof p.umbral_activacion === "number",
  );
  if (aplicables.length === 0) return null;
  return aplicables.reduce(
    (max, p) => (p.umbral_activacion! > max ? p.umbral_activacion! : max),
    0,
  );
}

function buildMajorityRequirement(
  input: RuleManagerInput,
  pactos: PactoParasocial[],
): EffectiveMajority {
  const matterClass = (input.agreement.matter_class ?? "").trim().toUpperCase();
  const heuristic = inferMajorityCode(input.agreement.matter_class);
  const provided = input.agreement.legal_majority ?? null;
  const legalThreshold = provided?.threshold ?? null;
  const pactoThreshold = maxPactoMajorityThreshold(pactos, input.agreement.matter);

  const effectiveThreshold =
    pactoThreshold !== null && pactoThreshold > (legalThreshold ?? 0)
      ? pactoThreshold
      : legalThreshold;
  const effectiveSource: "LEY" | "PACTO" | null =
    pactoThreshold !== null && pactoThreshold === effectiveThreshold
      ? "PACTO"
      : legalThreshold !== null
        ? "LEY"
        : null;

  const code = pactoThreshold !== null ? "PACTO_MAYORIA_REFORZADA" : provided?.code ?? heuristic;
  const description = provided?.description ?? null;

  const notes: string[] = [];
  if (matterClass && !provided) {
    notes.push(`Materia ${matterClass}: mayoría inferida por defecto del régimen aplicable.`);
  } else if (provided) {
    notes.push(
      `Mayoría legal suministrada por el caller${
        legalThreshold !== null ? ` (threshold ${(legalThreshold * 100).toFixed(1)}%)` : ""
      }.`,
    );
  } else {
    notes.push("No se ha clasificado la materia: la mayoría debe confirmarse caso a caso.");
  }
  if (pactoThreshold !== null) {
    notes.push(
      `Pacto parasocial eleva el threshold a ${(pactoThreshold * 100).toFixed(1)}% para esta materia.`,
    );
  }

  return {
    code,
    legal_threshold: legalThreshold,
    pacto_threshold: pactoThreshold,
    effective_threshold: effectiveThreshold,
    effective_source: effectiveSource,
    description,
    notes,
  };
}

function buildRequirements(
  input: RuleManagerInput,
  profile: EntityNormativeProfile,
  pactos: PactoParasocial[],
): EffectiveRuleRequirements {
  const documentation = summarizeFormalizationForAgreement({
    agreement_kind: input.agreement.matter,
    matter_class: input.agreement.matter_class,
    adoption_mode: input.agreement.adoption_mode,
    inscribable: input.agreement.inscribable ?? null,
    is_listed: profile.is_listed,
  });

  const adoption = input.agreement.adoption_mode.toUpperCase();
  const matterClass = (input.agreement.matter_class ?? "").trim().toUpperCase();
  const inscribable =
    input.agreement.inscribable === true ||
    matterClass === "ESTRUCTURAL" ||
    matterClass === "ESTATUTARIA";

  const adoptionLabel = ADOPTION_LABELS[adoption] ?? adoption;
  const requiresConvocation = ADOPTION_NEEDS_CONVOCATION.has(adoption);
  const requiresUnanimity = ADOPTION_NEEDS_UNANIMITY.has(adoption);
  const requiresQuorum = ADOPTION_NEEDS_QUORUM.has(adoption);

  let convocationNote: string;
  if (adoption === "CO_APROBACION") {
    convocationNote = "Co-aprobación: notificar a los administradores requeridos antes del cierre.";
  } else if (adoption === "SOLIDARIO") {
    convocationNote = "Decisión solidaria: no requiere convocatoria formal; el administrador solidario decide.";
  } else if (adoption === "UNIPERSONAL_ADMIN") {
    convocationNote = "Decisión del administrador único: no requiere convocatoria formal.";
  } else if (requiresConvocation) {
    convocationNote = "La adopción requiere convocatoria con plazo y forma del régimen aplicable.";
  } else {
    convocationNote = "El modo de adopción no requiere convocatoria formal.";
  }

  let unanimityNote: string;
  if (adoption === "NO_SESSION") {
    unanimityNote = "Acuerdo sin sesión: requiere unanimidad o el régimen sin sesión aplicable.";
  } else if (adoption === "UNIPERSONAL_SOCIO") {
    unanimityNote = "Decisión unipersonal del socio único: equivale a acuerdo unánime.";
  } else if (adoption === "CO_APROBACION") {
    unanimityNote = "Co-aprobación exige los k administradores configurados, no unanimidad estricta.";
  } else if (adoption === "SOLIDARIO") {
    unanimityNote = "Decisión de administrador solidario: no aplica unanimidad ni mayoría colegiada.";
  } else {
    unanimityNote = "No requiere unanimidad por defecto.";
  }

  let quorumNote: string;
  if (requiresQuorum) {
    quorumNote = "El órgano necesita quorum de constitución conforme a ley/estatutos.";
  } else if (adoption === "CO_APROBACION") {
    quorumNote = "Co-aprobación: en lugar de quorum, exige los k administradores requeridos.";
  } else {
    quorumNote = `No aplica quorum: ${adoptionLabel.toLowerCase()}.`;
  }

  return {
    convocatoria: {
      required: requiresConvocation,
      notes: [convocationNote],
    },
    quorum: {
      required: requiresQuorum,
      notes: [quorumNote],
    },
    majority: buildMajorityRequirement(input, pactos),
    unanimity: {
      required: requiresUnanimity,
      notes: [unanimityNote],
    },
    documentation,
    registry: {
      required: inscribable,
      notes: inscribable
        ? ["Materia inscribible: requiere elevación a público e inscripción registral."]
        : ["Materia no inscribible por defecto."],
    },
    publication: {
      required: profile.is_listed,
      notes: profile.is_listed
        ? ["Sociedad cotizada: el sistema advierte LMV/CNMV; no bloquea automáticamente."]
        : ["No se requieren publicaciones de supervisor."],
    },
  };
}

function titularsFromPacto(pacto: PactoParasocial | undefined): string[] {
  if (!pacto) return [];
  if (pacto.titular_veto) return [pacto.titular_veto];
  return pacto.firmantes.map((firmante) => firmante.nombre).filter(Boolean);
}

function vetoRequirementFromPactos(
  pactos: PactoParasocial[],
  pactosEval: PactoEvalResult[],
): { applies: boolean; titulares: string[]; notes: string[] } {
  const aplica = pactosEval.filter((r) => r.tipo === "VETO" && r.aplica);
  if (aplica.length === 0) {
    return {
      applies: false,
      titulares: [],
      notes: ["No hay derechos de veto pactados aplicables a esta materia."],
    };
  }
  const pactoById = new Map(pactos.map((p) => [p.id, p]));
  const titulares = dedupe(
    aplica.flatMap((r) => titularsFromPacto(pactoById.get(r.pacto_id))),
    (value) => value,
  );
  // Fallback al título del pacto si no hay datos estructurados de titular.
  if (titulares.length === 0) {
    aplica.forEach((r) => titulares.push(r.pacto_titulo));
  }
  return {
    applies: true,
    titulares,
    notes: aplica.map((r) => r.explain.mensaje ?? `Veto aplicable de pacto ${r.pacto_id}.`),
  };
}

function consentRequirementFromPactos(
  pactos: PactoParasocial[],
  pactosEval: PactoEvalResult[],
): { required: boolean; from: string[]; notes: string[] } {
  const aplica = pactosEval.filter((r) => r.tipo === "CONSENTIMIENTO_INVERSOR" && r.aplica);
  if (aplica.length === 0) {
    return {
      required: false,
      from: [],
      notes: ["No hay consentimientos previos requeridos por pacto."],
    };
  }
  const pactoById = new Map(pactos.map((p) => [p.id, p]));
  const from = dedupe(
    aplica.flatMap((r) => titularsFromPacto(pactoById.get(r.pacto_id))),
    (value) => value,
  );
  if (from.length === 0) {
    aplica.forEach((r) => from.push(r.pacto_titulo));
  }
  return {
    required: true,
    from,
    notes: aplica.map((r) => r.explain.mensaje ?? `Consentimiento previo requerido por pacto ${r.pacto_id}.`),
  };
}

// ─── Clasificación legal de consecuencias ───────────────────────────────────

export function classifyPactoConsequence(
  result: PactoEvalResult,
  options: { isStatutoryEnshrined?: boolean } = {},
): {
  consequence: LegalConsequence;
  remediable: boolean;
  remediation_hint?: string;
} {
  const { isStatutoryEnshrined } = options;
  if (!result.aplica) {
    return { consequence: "NO_EFFECT", remediable: false };
  }
  if (result.cumple) {
    return { consequence: "NO_EFFECT", remediable: false };
  }

  // Pacto incumplido. La consecuencia jurídica depende de si está
  // incorporado a estatutos (validez societaria) o solo en pacto parasocial
  // (incumplimiento contractual + hold operativo).
  if (isStatutoryEnshrined) {
    return {
      consequence: "VALIDITY_BLOCK",
      remediable: true,
      remediation_hint:
        "La regla está incorporada a estatutos. Para proclamar el acuerdo: alcanzar el requisito o reformar estatutos antes de adoptar.",
    };
  }

  switch (result.tipo) {
    case "VETO":
      return {
        consequence: "OPERATIONAL_HOLD",
        remediable: true,
        remediation_hint:
          "El veto es contractual: documentar renuncia/waiver del titular antes de ejecutar/registrar.",
      };
    case "CONSENTIMIENTO_INVERSOR":
      return {
        consequence: "OPERATIONAL_HOLD",
        remediable: true,
        remediation_hint:
          "Obtener consentimiento previo escrito del titular antes de ejecutar/registrar.",
      };
    case "MAYORIA_REFORZADA_PACTADA":
      return {
        consequence: "CONTRACTUAL_BREACH",
        remediable: true,
        remediation_hint:
          "Repetir adopción alcanzando la mayoría pactada o documentar waiver de los firmantes.",
      };
    default:
      return {
        consequence: result.severity === "WARNING" ? "WARNING" : "CONTRACTUAL_BREACH",
        remediable: true,
        remediation_hint:
          "Revisar pacto con Legal: ajustar adopción o documentar waiver/consentimiento.",
      };
  }
}

// ─── Función principal pura ─────────────────────────────────────────────────

export function buildEffectiveAgreementRule(input: RuleManagerInput): EffectiveAgreementRule {
  const profile = buildEntityNormativeProfile({
    tenantId: input.tenantId,
    entity: input.entity,
    jurisdictionRuleSets: input.jurisdictionRuleSets,
    rulePacks: input.rulePacks,
    overrides: input.overrides,
    pactos: (input.pactos ?? []).map((pacto) => ({
      id: pacto.id,
      titulo: pacto.titulo,
      tipo_clausula: pacto.tipo_clausula,
      materias_aplicables: pacto.materias_aplicables,
      descripcion: pacto.descripcion,
      estado: pacto.estado,
    })),
    now: input.now,
  });

  const pactosEval = evaluarPactosParasociales(input.pactos ?? [], {
    materias: [input.agreement.matter],
    capitalPresente: input.pactosEval?.capitalPresente ?? 0,
    capitalTotal: input.pactosEval?.capitalTotal ?? 0,
    votosFavor: input.pactosEval?.votosFavor ?? 0,
    votosContra: input.pactosEval?.votosContra ?? 0,
    consentimientosPrevios: input.pactosEval?.consentimientosPrevios ?? [],
    vetoRenunciado: input.pactosEval?.vetoRenunciado ?? [],
  });

  const statutoryIds = new Set(input.options?.statutoryEnshrinedPactoIds ?? []);

  const consequences: EffectiveRuleConsequence[] = [];

  for (const result of pactosEval.resultados) {
    const isStatutory = statutoryIds.has(result.pacto_id);
    const classification = classifyPactoConsequence(result, { isStatutoryEnshrined: isStatutory });
    if (classification.consequence === "NO_EFFECT") continue;
    consequences.push({
      consequence: classification.consequence,
      source_layer: isStatutory ? "ESTATUTOS" : "PACTO_PARASOCIAL",
      source_plane: isStatutory ? "SOCIETARIO" : "CONTRACTUAL",
      source_id: result.pacto_id,
      source_label: result.pacto_titulo,
      matter: input.agreement.matter,
      reason: result.explain.mensaje ?? `Resultado del pacto ${result.pacto_titulo}`,
      remediable: classification.remediable,
      remediation_hint: classification.remediation_hint,
    });
  }

  if (profile.is_listed) {
    consequences.push({
      consequence: "WARNING",
      source_layer: "LEY",
      source_plane: "SOCIETARIO",
      source_id: null,
      source_label: "Régimen LMV/CNMV",
      matter: input.agreement.matter,
      reason: "Sociedad cotizada: el motor advierte sobre obligaciones LMV/CNMV; no bloquea automáticamente.",
      remediable: false,
    });
  }

  const pactosVigentes = (input.pactos ?? []).filter((p) => p.estado === "VIGENTE");
  const requirements = buildRequirements(input, profile, pactosVigentes);
  requirements.veto = vetoRequirementFromPactos(pactosVigentes, pactosEval.resultados);
  requirements.consent = consentRequirementFromPactos(pactosVigentes, pactosEval.resultados);

  const hasValidityBlock = consequences.some((c) => c.consequence === "VALIDITY_BLOCK");
  const hasBreach = consequences.some((c) => c.consequence === "CONTRACTUAL_BREACH");
  const hasHold = consequences.some((c) => c.consequence === "OPERATIONAL_HOLD");

  const status: EffectiveRuleStatus = hasValidityBlock
    ? "BLOCKED"
    : hasBreach || hasHold
      ? "PROCLAMABLE_HELD"
      : "PROCLAMABLE_AND_EXECUTABLE";

  return {
    schema_version: "rule-manager-contract.v1",
    evaluated_at: isoNow(input.now),
    entity_id: input.entity.id,
    matter: input.agreement.matter,
    matter_class: input.agreement.matter_class ?? null,
    body_type: input.agreement.body_type ?? null,
    adoption_mode: input.agreement.adoption_mode,
    inscribable: requirements.registry.required,
    status,
    societary_valid: !hasValidityBlock,
    contractual_compliant: !hasBreach && !hasValidityBlock,
    operational_clear: !hasHold && !hasBreach && !hasValidityBlock,
    sources: profileSourcesToEffective(profile),
    requirements,
    consequences,
    pactos_evaluated: pactosEval.resultados,
    profile,
    trace: {
      profile_hash: profile.profile_hash,
      pacto_ids: pactosEval.resultados.map((r) => r.pacto_id),
      statutory_enshrined_pacto_ids: Array.from(statutoryIds),
    },
  };
}
