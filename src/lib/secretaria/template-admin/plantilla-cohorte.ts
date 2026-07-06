/**
 * UX-7.B (run-log UX 2026-06-20) — Modelo de cohortes de plantilla.
 *
 * Clasifica cada plantilla en una cohorte de ciclo de vida + completitud a partir
 * de metadatos REALES (`estado`, binding de materia, `contrato_variables_version`).
 * Es una función pura y determinista: NO finge criterio jurídico, solo agrupa por
 * el estado de gobierno documental que ya está en la ficha. Habilita el badge de
 * cohorte y el filtro por cohorte en el catálogo de plantillas.
 *
 * Precedencia dentro de ACTIVA (de más a menos accionable, coherente con los avisos
 * T10 de `Plantillas.tsx`): sin regla (no usable como bloqueo) → metadatos
 * incompletos → lista. Un estado desconocido nunca se marca como "lista": cae a
 * EN_PREPARACION (fallback conservador).
 */
export type PlantillaCohorte =
  | "ACTIVA_LISTA"
  | "ACTIVA_SIN_REGLA"
  | "ACTIVA_METADATOS_INCOMPLETOS"
  | "EN_PREPARACION"
  | "HISTORICO";

export interface PlantillaCohorteInput {
  estado: string | null | undefined;
  materia: string | null | undefined;
  materia_acuerdo: string | null | undefined;
  contrato_variables_version: string | null | undefined;
}

/** Orden de presentación (más accionable primero) para chips de filtro/leyenda. */
export const COHORTE_ORDER: PlantillaCohorte[] = [
  "ACTIVA_LISTA",
  "ACTIVA_SIN_REGLA",
  "ACTIVA_METADATOS_INCOMPLETOS",
  "EN_PREPARACION",
  "HISTORICO",
];

export function clasificarCohortePlantilla(input: PlantillaCohorteInput): PlantillaCohorte {
  const estado = (input.estado ?? "").trim().toUpperCase();

  if (estado === "ARCHIVADA" || estado === "DEPRECADA") return "HISTORICO";

  if (estado === "ACTIVA") {
    // Binding de materia: mismo predicado que el aviso "sin regla" de T10.
    const binding = input.materia_acuerdo ?? input.materia;
    if (!binding) return "ACTIVA_SIN_REGLA";
    // Metadatos de gobierno documental: mismo predicado que el aviso T10.
    if (!input.contrato_variables_version) return "ACTIVA_METADATOS_INCOMPLETOS";
    return "ACTIVA_LISTA";
  }

  // BORRADOR / REVISADA / APROBADA — y cualquier estado desconocido/nulo, que por
  // prudencia nunca se etiqueta como "lista" ni "histórico".
  return "EN_PREPARACION";
}

const LABELS: Record<PlantillaCohorte, string> = {
  ACTIVA_LISTA: "Activa · lista para uso",
  ACTIVA_SIN_REGLA: "Activa · sin regla aplicable",
  ACTIVA_METADATOS_INCOMPLETOS: "Activa · metadatos incompletos",
  EN_PREPARACION: "En preparación",
  HISTORICO: "Histórico",
};

const DESCRIPCIONES: Record<PlantillaCohorte, string> = {
  ACTIVA_LISTA:
    "Plantilla activa con binding de materia y contrato de variables. Puede usarse como base de bloqueo documental.",
  ACTIVA_SIN_REGLA:
    "Plantilla activa que no está vinculada a una regla/materia aplicable. No debe usarse como base de bloqueo hasta asignarle binding.",
  ACTIVA_METADATOS_INCOMPLETOS:
    "Plantilla activa pero sin metadatos de gobierno documental (versión de contrato de variables). Revísalos antes de usarla como base de bloqueo.",
  EN_PREPARACION:
    "Plantilla en borrador, revisión o aprobación. Aún no está activa para uso operativo.",
  HISTORICO: "Plantilla archivada o deprecada. Se conserva como histórico, no para uso.",
};

export function cohorteLabel(cohorte: PlantillaCohorte): string {
  return LABELS[cohorte] ?? cohorte;
}

export function cohorteDescripcion(cohorte: PlantillaCohorte): string {
  return DESCRIPCIONES[cohorte] ?? "";
}

/** Tono visual para el chip de cohorte (tokens --status-* / --g-*). */
export function cohorteTone(cohorte: PlantillaCohorte): "success" | "warning" | "neutral" {
  switch (cohorte) {
    case "ACTIVA_LISTA":
      return "success";
    case "ACTIVA_SIN_REGLA":
    case "ACTIVA_METADATOS_INCOMPLETOS":
      return "warning";
    default:
      return "neutral";
  }
}
