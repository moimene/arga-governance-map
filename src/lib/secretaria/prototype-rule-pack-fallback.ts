import type {
  CanonicalRulePackVersion,
  MateriaClase,
  ReglaParametro,
  RulePack,
  RuleResolution,
  TipoActa,
  TipoOrgano,
  TipoSocial,
} from "@/lib/rules-engine";

export interface MeetingRuleSpec {
  materia: string;
  clase: MateriaClase;
}

export interface PrototypeRulePackResolution {
  specs: MeetingRuleSpec[];
  packs: RulePack[];
  fallbackPackIds: string[];
  hasFallback: boolean;
}

export interface CloudMeetingRulePackStrictResolution {
  specs: MeetingRuleSpec[];
  packs: RulePack[];
  missingSpecs: MeetingRuleSpec[];
  warnings: string[];
}

const tipoSocialValues: TipoSocial[] = ["SA", "SAU", "SL", "SLU"];

function param<T>(valor: T, referencia: string): ReglaParametro<T> {
  return {
    valor,
    fuente: "SISTEMA",
    referencia,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isMeetingRulePackPayload(payload: unknown): payload is RulePack {
  return (
    isRecord(payload) &&
    isRecord(payload.convocatoria) &&
    isRecord(payload.constitucion) &&
    isRecord(payload.votacion)
  );
}

export function uniqueMeetingRuleSpecs(specs: MeetingRuleSpec[]): MeetingRuleSpec[] {
  const seen = new Set<string>();
  const out: MeetingRuleSpec[] = [];
  for (const spec of specs) {
    const materia = spec.materia?.trim();
    if (!materia) continue;
    const key = `${materia}:${spec.clase}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ materia, clase: spec.clase });
  }
  return out;
}

function rulePackFromResolution(resolution: RuleResolution | undefined): RulePack | null {
  const payload = resolution?.rulePack?.payload;
  return isMeetingRulePackPayload(payload) ? payload : null;
}

function relationMatches(
  resolution: CanonicalRulePackVersion | null | undefined,
  spec: MeetingRuleSpec,
  organoTipo: TipoOrgano,
) {
  if (!resolution) return false;
  const materiaMatches = !resolution.materia || resolution.materia === spec.materia || resolution.packId === spec.materia;
  const claseMatches = !resolution.clase || resolution.clase === spec.clase;
  const organoMatches = !resolution.organoTipo || resolution.organoTipo === organoTipo;
  return materiaMatches && claseMatches && organoMatches;
}

function actaForOrgano(organoTipo: TipoOrgano): TipoActa {
  return organoTipo === "JUNTA_GENERAL" ? "ACTA_JUNTA" : "ACTA_CONSEJO";
}

export function buildPrototypeMeetingRulePackFallback(
  spec: MeetingRuleSpec,
  organoTipo: TipoOrgano,
): RulePack {
  const id = `prototype-meeting-${organoTipo}-${spec.materia}-${spec.clase}`;
  const reference = "Fallback tecnico de prototipo; requiere rule pack Cloud aprobado antes de uso productivo.";

  return {
    id,
    materia: spec.materia,
    clase: spec.clase,
    organoTipo,
    modosAdopcionPermitidos: ["MEETING"],
    convocatoria: {
      antelacionDias: {
        SA: param(30, reference),
        SAU: param(30, reference),
        SL: param(15, reference),
        SLU: param(15, reference),
      },
      canales: Object.fromEntries(tipoSocialValues.map((tipo) => [tipo, []])) as Record<TipoSocial, string[]>,
      contenidoMinimo: [],
    },
    constitucion: {
      quorum: {
        SA_1a: param(0.25, reference),
        SA_2a: param(0, reference),
        SL: param(0, reference),
        CONSEJO: param("mayoria_miembros", reference),
      },
    },
    votacion: {
      mayoria: {
        SA: { formula: "favor > contra", fuente: "SISTEMA", referencia: reference },
        SL: { formula: "favor > contra", fuente: "SISTEMA", referencia: reference },
        CONSEJO: { formula: "mayoria_consejeros", fuente: "SISTEMA", referencia: reference },
      },
      abstenciones: "no_cuentan",
      votoCalidadPermitido: organoTipo === "CONSEJO",
    },
    documentacion: { obligatoria: [] },
    acta: {
      tipoActaPorModo: { MEETING: actaForOrgano(organoTipo) },
      contenidoMinimo: {
        sesion: ["asistentes", "orden_dia", "votaciones", "resultado"],
        consignacion: [],
        acuerdoEscrito: [],
      },
      requiereTranscripcionLibroActas: true,
      requiereConformidadConjunta: false,
    },
    plazosMateriales: {},
    postAcuerdo: {
      inscribible: false,
      instrumentoRequerido: "NINGUNO",
      publicacionRequerida: false,
    },
    reglaEspecifica: {
      prototype_fallback: true,
      source_of_truth: "none",
      reason: "rule_pack_cloud_missing_or_unusable",
    },
  };
}

export function resolvePrototypeMeetingRulePacks(
  specsInput: MeetingRuleSpec[],
  resolutions: RuleResolution[],
  organoTipo: TipoOrgano,
): PrototypeRulePackResolution {
  const specs = uniqueMeetingRuleSpecs(specsInput);
  const used = new Set<number>();
  const packs: RulePack[] = [];
  const fallbackPackIds: string[] = [];

  for (const spec of specs) {
    const exactIndex = resolutions.findIndex((resolution, index) => {
      if (used.has(index)) return false;
      return relationMatches(resolution.rulePack, spec, organoTipo) && rulePackFromResolution(resolution);
    });
    const position = exactIndex >= 0 ? exactIndex : used.size;
    const pack = rulePackFromResolution(resolutions[position]);

    if (pack && (exactIndex >= 0 || relationMatches(resolutions[position]?.rulePack, spec, organoTipo))) {
      used.add(position);
      packs.push(pack);
      continue;
    }

    const fallback = buildPrototypeMeetingRulePackFallback(spec, organoTipo);
    packs.push(fallback);
    fallbackPackIds.push(fallback.id);
  }

  return {
    specs,
    packs,
    fallbackPackIds,
    hasFallback: fallbackPackIds.length > 0,
  };
}

export function resolveCloudMeetingRulePacksStrict(
  specsInput: MeetingRuleSpec[],
  resolutions: RuleResolution[],
  organoTipo: TipoOrgano,
): CloudMeetingRulePackStrictResolution {
  const specs = uniqueMeetingRuleSpecs(specsInput);
  const used = new Set<number>();
  const packs: RulePack[] = [];
  const missingSpecs: MeetingRuleSpec[] = [];
  const warnings: string[] = [];

  for (const spec of specs) {
    const exactIndex = resolutions.findIndex((resolution, index) => {
      if (used.has(index)) return false;
      return relationMatches(resolution.rulePack, spec, organoTipo) && rulePackFromResolution(resolution);
    });

    if (exactIndex >= 0) {
      used.add(exactIndex);
      const pack = rulePackFromResolution(resolutions[exactIndex]);
      if (pack) packs.push(pack);
      continue;
    }

    missingSpecs.push(spec);
    warnings.push(`missing_cloud_rule_pack:${organoTipo}:${spec.materia}:${spec.clase}`);
  }

  return {
    specs,
    packs,
    missingSpecs,
    warnings,
  };
}
