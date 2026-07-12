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
  ACTIVA_LISTA: "Metadatos completos",
  ACTIVA_SIN_REGLA: "Sin regla aplicable",
  ACTIVA_METADATOS_INCOMPLETOS: "Metadatos incompletos",
  EN_PREPARACION: "En preparación",
  HISTORICO: "Histórico",
};

const DESCRIPCIONES: Record<PlantillaCohorte, string> = {
  ACTIVA_LISTA:
    "Plantilla vigente con vinculación de materia y contrato de variables. Puede exigirse en la comprobación documental.",
  ACTIVA_SIN_REGLA:
    "Plantilla vigente que no está vinculada a una regla o materia aplicable. No debe exigirse hasta completar la vinculación.",
  ACTIVA_METADATOS_INCOMPLETOS:
    "Plantilla vigente sin todos los metadatos de gobierno documental. Revísalos antes de exigirla en un expediente.",
  EN_PREPARACION:
    "Plantilla en borrador, revisión o aprobación. Aún no está vigente para nuevos expedientes.",
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
