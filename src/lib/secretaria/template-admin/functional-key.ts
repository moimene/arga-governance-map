/**
 * Clave funcional para detectar duplicados activos + lista canónica de
 * las 14 combinaciones core v1.0 que la consola garantiza cubrir.
 * Sprint 1 — Spec §3 + §6.
 */

import type { FunctionalKey, PlantillaCandidate } from "./types";
import { MATERIA_CANONICAL_ALIAS } from "../agenda-materias";
import { ORGANO_ALIAS } from "./organo-canonico";

export const CORE_V1_MATERIAS: ReadonlyArray<{ organo: string; materia: string }> = [
  { organo: "JUNTA_GENERAL", materia: "APROBACION_CUENTAS" },
  { organo: "JUNTA_GENERAL", materia: "DISTRIBUCION_DIVIDENDOS" },
  { organo: "JUNTA_GENERAL", materia: "NOMBRAMIENTO_CONSEJERO" },
  { organo: "JUNTA_GENERAL", materia: "CESE_CONSEJERO" },
  { organo: "JUNTA_GENERAL", materia: "MODIFICACION_ESTATUTOS" },
  { organo: "JUNTA_GENERAL", materia: "AUMENTO_CAPITAL" },
  { organo: "JUNTA_GENERAL", materia: "NOMBRAMIENTO_AUDITOR" },
  { organo: "CONSEJO_ADMIN", materia: "DISTRIBUCION_CARGOS" },
  { organo: "CONSEJO_ADMIN", materia: "DELEGACION_FACULTADES" },
  { organo: "CONSEJO_ADMIN", materia: "COMITES_INTERNOS" },
  { organo: "CONSEJO_ADMIN", materia: "POLITICAS_CORPORATIVAS" },
  { organo: "CONSEJO_ADMIN", materia: "NOMBRAMIENTO_CONSEJERO" },
  { organo: "CONSEJO_ADMIN", materia: "CESE_CONSEJERO" },
  { organo: "CONSEJO_ADMIN", materia: "FORMULACION_CUENTAS" },
] as const;

export const CORE_V1_MATERIAS_COUNT = CORE_V1_MATERIAS.length;

function resolveMateria(row: PlantillaCandidate): string {
  const materiaAcuerdo = normalizeFunctionalValue(row.materia_acuerdo);
  const normalized = materiaAcuerdo || normalizeFunctionalValue(row.materia);
  return MATERIA_CANONICAL_ALIAS[normalized] ?? normalized;
}

function normalizeFunctionalValue(value?: string | null): string {
  // PostgreSQL btrim(text) elimina espacios ASCII por defecto, no todo el
  // whitespace Unicode que String.trim() considera. Mantener la misma regla
  // evita predecesoras distintas entre el Gate cliente y el índice Cloud.
  return String(value ?? "").replace(/^ +| +$/g, "").toUpperCase();
}

/**
 * En la identidad funcional de plantillas, la ausencia de tipo social significa
 * que el documento aplica a cualquier forma social. Cloud contiene tanto NULL
 * como el literal legacy ANY, por lo que ambos deben producir la misma clave.
 */
export function normalizeFunctionalSocialType(value?: string | null): string {
  const normalized = normalizeFunctionalValue(value);
  return !normalized || normalized === "ANY" ? "ANY" : normalized;
}

function normalizeFunctionalOrganoType(value?: string | null): string {
  const normalized = normalizeFunctionalValue(value);
  return ORGANO_ALIAS[normalized] ?? normalized;
}

export function buildFunctionalKey(row: PlantillaCandidate, tenantId: string): FunctionalKey {
  return {
    tenantId,
    tipo: normalizeFunctionalValue(row.tipo),
    jurisdiccion: normalizeFunctionalValue(row.jurisdiccion),
    materia: resolveMateria(row),
    organoTipo: normalizeFunctionalOrganoType(row.organo_tipo),
    adoptionMode: normalizeFunctionalValue(row.adoption_mode),
    tipoSocial: normalizeFunctionalSocialType(row.tipo_social),
  };
}

export function serializeFunctionalKey(k: FunctionalKey): string {
  return JSON.stringify([
    k.tenantId,
    k.tipo,
    k.jurisdiccion,
    k.materia,
    k.organoTipo,
    k.adoptionMode,
    normalizeFunctionalSocialType(k.tipoSocial),
  ]);
}

export function matchesFunctionalKey(
  a: PlantillaCandidate,
  b: PlantillaCandidate,
  tenantId: string,
): boolean {
  return serializeFunctionalKey(buildFunctionalKey(a, tenantId)) ===
    serializeFunctionalKey(buildFunctionalKey(b, tenantId));
}

export function detectActiveDuplicate(
  candidate: PlantillaCandidate,
  existingActive: PlantillaCandidate[],
  tenantId: string,
): PlantillaCandidate | null {
  return detectFunctionalDuplicate(candidate, existingActive, tenantId, {
    states: ["ACTIVA"],
  });
}

export function findFunctionalDuplicates(
  candidate: PlantillaCandidate,
  existingTemplates: PlantillaCandidate[],
  tenantId: string,
  options: { states?: string[] } = {},
): PlantillaCandidate[] {
  const states = options.states ? new Set(options.states) : null;
  const candidateKey = serializeFunctionalKey(buildFunctionalKey(candidate, tenantId));
  return existingTemplates.filter((other) => {
    if (other.id === candidate.id) return false;
    if (states && !states.has(other.estado)) return false;
    return serializeFunctionalKey(buildFunctionalKey(other, tenantId)) === candidateKey;
  });
}

export function detectFunctionalDuplicate(
  candidate: PlantillaCandidate,
  existingTemplates: PlantillaCandidate[],
  tenantId: string,
  options: { states?: string[] } = {},
): PlantillaCandidate | null {
  return findFunctionalDuplicates(candidate, existingTemplates, tenantId, options)[0] ?? null;
}
