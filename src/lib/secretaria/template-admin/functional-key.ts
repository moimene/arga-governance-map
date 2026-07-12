/**
 * Clave funcional para detectar duplicados activos + lista canónica de
 * las 14 combinaciones core v1.0 que la consola garantiza cubrir.
 * Sprint 1 — Spec §3 + §6.
 */

import type { FunctionalKey, PlantillaCandidate } from "./types";
import { resolveMateriaAlias } from "../agenda-materias";
import { normalizeOrganoTipo } from "./organo-canonico";

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
  return resolveMateriaAlias(row.materia_acuerdo ?? row.materia);
}

function normalizeFunctionalValue(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

export function buildFunctionalKey(row: PlantillaCandidate, tenantId: string): FunctionalKey {
  return {
    tenantId,
    tipo: normalizeFunctionalValue(row.tipo),
    jurisdiccion: normalizeFunctionalValue(row.jurisdiccion),
    materia: resolveMateria(row),
    organoTipo:
      normalizeOrganoTipo(row.organo_tipo) ?? normalizeFunctionalValue(row.organo_tipo),
    adoptionMode: normalizeFunctionalValue(row.adoption_mode),
    tipoSocial: normalizeFunctionalValue(row.tipo_social) || null,
  };
}

export function serializeFunctionalKey(k: FunctionalKey): string {
  return [
    k.tenantId,
    k.tipo,
    k.jurisdiccion,
    k.materia,
    k.organoTipo,
    k.adoptionMode,
    k.tipoSocial ?? "",
  ].join("|");
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

export function detectFunctionalDuplicate(
  candidate: PlantillaCandidate,
  existingTemplates: PlantillaCandidate[],
  tenantId: string,
  options: { states?: string[] } = {},
): PlantillaCandidate | null {
  const states = options.states ? new Set(options.states) : null;
  const candidateKey = serializeFunctionalKey(buildFunctionalKey(candidate, tenantId));
  for (const other of existingTemplates) {
    if (other.id === candidate.id) continue;
    if (states && !states.has(other.estado)) continue;
    if (serializeFunctionalKey(buildFunctionalKey(other, tenantId)) === candidateKey) {
      return other;
    }
  }
  return null;
}
