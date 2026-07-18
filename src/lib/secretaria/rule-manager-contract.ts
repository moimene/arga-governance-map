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
  type AgreementNormativeSnapshot,
  type EntityNormativeProfile,
  type EntityNormativeProfileInput,
  type FormalizationRequirement,
  type NormativeFrameworkStatus,
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
  pactosEval?: Partial<PactosEvalInput> & {
    /**
     * Si es true, los evaluadores que dependen de cifras de votación
     * (MAYORIA_REFORZADA_PACTADA) NO se calculan: el contrato los reporta
     * como WARNING "pendiente de votación" en lugar de evaluarlos con
     * `votosFavor=0` (lo que produce un falso positivo de breach). Útil
     * para el simulador pre-adopción donde aún no hay cifras.
     */
    skipVoteDependentEvaluations?: boolean;
  };
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
  MEETING: "Sesión formal",
  UNIVERSAL: "Junta universal",
  NO_SESSION: "Acuerdo sin sesión",
  CO_APROBACION: "Decisión mancomunada",
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

  const skipVotes = input.pactosEval?.skipVoteDependentEvaluations === true;
  // Pactos cuya evaluación depende de cifras de votación (en MVP solo
  // MAYORIA_REFORZADA_PACTADA). Si skipVotes está activo, los apartamos del
  // engine y los reportamos como pendientes de votación.
  const inputPactos = input.pactos ?? [];
  const pactosForEngine = skipVotes
    ? inputPactos.filter((p) => p.tipo_clausula !== "MAYORIA_REFORZADA_PACTADA")
    : inputPactos;
  const pactosPendingVote = skipVotes
    ? inputPactos.filter((p) => p.tipo_clausula === "MAYORIA_REFORZADA_PACTADA")
    : [];

  const pactosEval = evaluarPactosParasociales(pactosForEngine, {
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

  // Pactos vote-dependent reportados como WARNING "pendiente de votación".
  for (const pacto of pactosPendingVote) {
    if (!pacto.materias_aplicables.includes(input.agreement.matter)) continue;
    consequences.push({
      consequence: "WARNING",
      source_layer: "PACTO_PARASOCIAL",
      source_plane: "CONTRACTUAL",
      source_id: pacto.id,
      source_label: pacto.titulo,
      matter: input.agreement.matter,
      reason:
        `Pacto ${pacto.tipo_clausula} aplicable a la materia. ` +
        `Umbral pactado: ${pacto.umbral_activacion ? (pacto.umbral_activacion * 100).toFixed(0) + "%" : "no especificado"}. ` +
        `Pendiente de evaluar con cifras de votación.`,
      remediable: false,
      remediation_hint:
        "Inyectar `capitalPresente` y `votosFavor` en pactosEval para evaluar el cumplimiento.",
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

// ─── classifyFrozenSnapshot ─────────────────────────────────────────────────
//
// Toma un AgreementNormativeSnapshot ya almacenado (compliance_explain.normative_snapshot)
// y produce una lectura HONESTA de lo que el snapshot describe.
//
// Diseño deliberadamente conservador:
// - NO infiere "Validez societaria OK" / "Cumplimiento contractual OK". Esos
//   son veredictos del simulador con LegalConsequence (Bloque 1+2), y el
//   snapshot no contiene información suficiente sin reconstruir la cadena
//   completa con pactos originales.
// - NO hace string-matching sobre warnings: solo lee campos estructurados.
// - Detecta presencia de capa PACTO_PARASOCIAL inspeccionando sources[].layer,
//   no inspeccionando texto.
// - Resume conteos (blockers, warnings, formalización requerida vs condicional)
//   tal cual.
// - Devuelve etiquetas humanas explícitas que NO usan "OK"/"breach"/"hold" para
//   evitar implicaciones jurídicas que el snapshot no soporta.

export type FrozenSnapshotHealth =
  | "PROFILE_OK"          // framework_status COMPLETO sin blockers
  | "PROFILE_INCOMPLETE"  // INCOMPLETO o DESACTUALIZADO
  | "PROFILE_CONFLICT";   // CONFLICTO o blockers presentes

export interface FrozenSnapshotClassification {
  schema_version: "frozen-snapshot-classification.v1";

  // Lectura técnica (sin inferencia jurídica)
  framework_status: NormativeFrameworkStatus;
  health: FrozenSnapshotHealth;
  health_detail: string;

  // Conteos del profile congelado
  profile_blockers_count: number;
  profile_warnings_count: number;

  // Capas presentes (sources con status ACTIVE)
  source_layers: NormativeLayer[];
  has_pacto_layer: boolean;
  has_estatutos_layer: boolean;
  has_reglamento_layer: boolean;

  // Formalización congelada
  formalization_required_count: number;
  formalization_conditional_count: number;
  formalization_requirements: FormalizationRequirement[];

  // Trazabilidad
  evaluated_at: string | null;
  snapshot_id: string | null;
  profile_hash: string | null;
  meeting_rule_pack_version: string | null;
  meeting_ruleset_snapshot_id: string | null;
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function classifyFrozenSnapshot(
  snapshot: AgreementNormativeSnapshot | null | undefined,
): FrozenSnapshotClassification | null {
  if (!snapshot) return null;

  const sources = safeArray(snapshot.sources);
  const warnings = safeArray(snapshot.warnings);
  const blockers = safeArray(snapshot.blockers);
  const formalizationAll = safeArray(snapshot.formalization_requirements);
  const ruleTrace = (snapshot.rule_trace ?? {}) as AgreementNormativeSnapshot["rule_trace"];

  // Capas únicas presentes (con status ACTIVE; las MISSING/WARNING no cuentan)
  const activeLayers = Array.from(
    new Set(sources.filter((s) => s?.status === "ACTIVE").map((s) => s.layer)),
  );

  const hasPactoLayer = activeLayers.includes("PACTO_PARASOCIAL");
  const hasEstatutosLayer = activeLayers.includes("ESTATUTOS");
  const hasReglamentoLayer = activeLayers.includes("REGLAMENTO");

  const requiredFormalization = formalizationAll.filter((r) => r?.status === "REQUIRED");
  const conditionalFormalization = formalizationAll.filter((r) => r?.status === "CONDITIONAL");

  // Salud del profile (solo describe lo que el framework_status ya etiquetó +
  // presencia de blockers; sin inferencias adicionales).
  const frameworkStatus: NormativeFrameworkStatus = snapshot.framework_status ?? "INCOMPLETO";
  let health: FrozenSnapshotHealth;
  let healthDetail: string;
  if (frameworkStatus === "CONFLICTO" || blockers.length > 0) {
    health = "PROFILE_CONFLICT";
    healthDetail =
      blockers.length > 0
        ? `El profile reporta ${blockers.length} bloqueo(s) en el momento de adopción.`
        : "El profile congelado se marcó como CONFLICTO al adoptarse.";
  } else if (frameworkStatus === "INCOMPLETO" || frameworkStatus === "DESACTUALIZADO") {
    health = "PROFILE_INCOMPLETE";
    healthDetail =
      `El profile congelado se marcó como ${frameworkStatus} al adoptarse. ` +
      `Esto NO equivale a invalidez societaria; significa que faltaba alguna fuente estructurada.`;
  } else {
    health = "PROFILE_OK";
    healthDetail = "El profile congelado se marcó como COMPLETO al adoptarse.";
  }

  return {
    schema_version: "frozen-snapshot-classification.v1",
    framework_status: frameworkStatus,
    health,
    health_detail: healthDetail,
    profile_blockers_count: blockers.length,
    profile_warnings_count: warnings.length,
    source_layers: activeLayers,
    has_pacto_layer: hasPactoLayer,
    has_estatutos_layer: hasEstatutosLayer,
    has_reglamento_layer: hasReglamentoLayer,
    formalization_required_count: requiredFormalization.length,
    formalization_conditional_count: conditionalFormalization.length,
    formalization_requirements: formalizationAll,
    evaluated_at: safeString(snapshot.evaluated_at),
    snapshot_id: safeString(snapshot.snapshot_id),
    profile_hash: safeString(snapshot.profile_hash),
    meeting_rule_pack_version: safeString(ruleTrace.meeting_rule_pack_version),
    meeting_ruleset_snapshot_id: safeString(ruleTrace.meeting_ruleset_snapshot_id),
  };
}
