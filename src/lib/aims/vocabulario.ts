/**
 * Vocabulario del módulo AIMS: un estado, una severidad, un nivel de riesgo.
 *
 * POR QUÉ ES UNA HOJA. Cada pantalla declaraba sus propias listas y su propio
 * mapa de etiquetas, así que la misma columna se pintaba distinta en dos sitios
 * y un valor nuevo llegaba a una lista y no a la de al lado. No importa nada de
 * `@/`: lo importan las 7 pantallas y `readiness.ts`.
 *
 * Ninguna de estas columnas tiene CHECK en Cloud, así que un valor fuera del
 * vocabulario es posible: se pinta el literal crudo y en estilo neutro.
 * Renombrarlo o teñirlo sería atribuirle un significado que nadie declaró.
 */

export const NIVELES_RIESGO = ["Inaceptable", "Alto", "Limitado", "Mínimo"] as const;
export type NivelRiesgo = (typeof NIVELES_RIESGO)[number];
export const ESTADOS_SISTEMA = ["ACTIVO", "EN_EVALUACION", "RETIRADO"] as const;

/** Los que ESCRIBE `evaluacion-payload.ts`. */
export const ESTADOS_EVALUACION = ["CONFORME", "CON_GAPS", "BORRADOR"] as const;
/** Sólo lectura: dato de ARGA anterior al producto. Ningún camino los escribe. */
export const ESTADOS_EVALUACION_LEGADO = ["APROBADO", "EN_REVISION"] as const;

export const SEVERIDADES_INCIDENTE = ["CRITICO", "ALTO", "MEDIO", "BAJO"] as const;
export const ESTADOS_INCIDENTE = ["ABIERTO", "EN_INVESTIGACION", "CERRADO"] as const;
export const MARCOS_EVALUACION = ["EU_AI_ACT", "ISO_42001"] as const;

export type Dominio =
  | "nivel"
  | "estadoSistema"
  | "estadoEvaluacion"
  | "severidad"
  | "estadoIncidente"
  | "marco";

const VALORES: Record<Dominio, readonly string[]> = {
  nivel: NIVELES_RIESGO,
  estadoSistema: ESTADOS_SISTEMA,
  estadoEvaluacion: [...ESTADOS_EVALUACION, ...ESTADOS_EVALUACION_LEGADO],
  severidad: SEVERIDADES_INCIDENTE,
  estadoIncidente: ESTADOS_INCIDENTE,
  marco: MARCOS_EVALUACION,
};

const ETIQUETAS: Record<Dominio, Record<string, string>> = {
  // El nivel se persiste ya en castellano: su etiqueta es el propio valor.
  nivel: {},
  estadoSistema: { ACTIVO: "Activo", EN_EVALUACION: "En evaluación", RETIRADO: "Retirado" },
  estadoEvaluacion: {
    CONFORME: "Conforme",
    CON_GAPS: "Con brechas",
    BORRADOR: "Borrador",
    APROBADO: "Aprobada (legado)",
    EN_REVISION: "En revisión (legado)",
  },
  severidad: { CRITICO: "Crítico", ALTO: "Alto", MEDIO: "Medio", BAJO: "Bajo" },
  estadoIncidente: { ABIERTO: "Abierto", EN_INVESTIGACION: "En investigación", CERRADO: "Cerrado" },
  marco: { EU_AI_ACT: "EU AI Act", ISO_42001: "ISO 42001" },
};

/** Etiquetas del FILTRO: cada opción nombra un conjunto, no una fila. */
const ETIQUETAS_FILTRO: Partial<Record<Dominio, Record<string, string>>> = {
  estadoSistema: { ACTIVO: "Activos", RETIRADO: "Retirados" },
  estadoEvaluacion: { CONFORME: "Conformes", APROBADO: "Aprobadas (legado)" },
  severidad: { CRITICO: "Crítica", ALTO: "Alta", MEDIO: "Media", BAJO: "Baja" },
  estadoIncidente: { ABIERTO: "Abiertos", CERRADO: "Cerrados" },
};

/** Dominios cuyo sustantivo es femenino: la opción de «no filtrar» concuerda. */
const TODOS_FEMENINO: Dominio[] = ["estadoEvaluacion", "severidad"];

export function etiqueta(dominio: Dominio, valor: string | null | undefined): string {
  if (!valor) return "";
  return ETIQUETAS[dominio][valor] ?? valor;
}

/**
 * Opciones de un grupo de filtro. `extra` son los valores PRESENTES EN EL DATO
 * que no están en el vocabulario: sin ellos, una fila con una grafía antigua no
 * es alcanzable por ningún filtro. Se ofrecen tal cual están escritos.
 */
export function opcionesFiltro(
  dominio: Dominio,
  extra?: (string | null | undefined)[],
): { value: string; label: string }[] {
  const valores = VALORES[dominio];
  const propias = valores.map((v) => ({
    value: v,
    label: ETIQUETAS_FILTRO[dominio]?.[v] ?? etiqueta(dominio, v),
  }));
  const conocidos = new Set<string>(valores);
  const extras = [...new Set((extra ?? []).filter((v): v is string => !!v))]
    .filter((v) => !conocidos.has(v))
    .sort()
    .map((v) => ({ value: v, label: v }));
  return [
    { value: "Todos", label: TODOS_FEMENINO.includes(dominio) ? "Todas" : "Todos" },
    ...propias,
    ...extras,
  ];
}

/**
 * Mayúsculas, sin tildes y el espacio al guion bajo. `ai_compliance_checks`
 * convive en Cloud con SEIS grafías del mismo puñado de estados (`Conforme`,
 * `No conforme`, `En revisión`…): comparar contra literales en mayúsculas
 * dejaba «No conforme» fuera y una no conformidad real se pintaba de amarillo.
 */
export function normalizeAimsStatus(status: string | null | undefined): string {
  return (status ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

const CHIP_NEUTRO =
  "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";

const CHIP_ESTADO_SISTEMA: Record<string, string> = {
  ACTIVO: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_EVALUACION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  RETIRADO: CHIP_NEUTRO,
};

const CLASE_NIVEL_RIESGO: Record<string, string> = {
  Inaceptable: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto: "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  Limitado: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Mínimo: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

/**
 * Chip del estado de una EVALUACIÓN. `CON_GAPS` y `CONFORME` son los dos
 * estados que el producto escribe, y hasta el 2026-09-08 el mapa local de la
 * lista sólo teñía los tres legados: una evaluación con brechas se pintaba
 * igual que una conforme, en gris, y la lista no las distinguía.
 */
const CHIP_ESTADO_EVALUACION: Record<string, string> = {
  CONFORME: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  CON_GAPS: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BORRADOR: CHIP_NEUTRO,
  // Legado de ARGA: ningún camino los escribe, pero hay filas con ellos.
  APROBADO: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_REVISION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
};

const CHIP_SEVERIDAD: Record<string, string> = {
  CRITICO: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  ALTO: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  MEDIO: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BAJO: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
};

const CHIP_ESTADO_INCIDENTE: Record<string, string> = {
  ABIERTO: "bg-[var(--status-error)]/10 text-[var(--status-error)] border border-[var(--status-error)]/30",
  EN_INVESTIGACION:
    "bg-[var(--status-warning)]/10 text-[var(--g-text-secondary)] border border-[var(--status-warning)]/30",
  CERRADO: "bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/30",
};

/** Chip del estado de un sistema. Fuera del vocabulario, neutro. */
export function chipClaseEstadoSistema(status: string | null | undefined): string {
  // Misma normalización que el KPI: «Activo» cuenta como activo y se pinta como activo.
  return CHIP_ESTADO_SISTEMA[normalizeAimsStatus(status)] ?? CHIP_NEUTRO;
}

/** Chip del nivel de riesgo. Fuera del vocabulario, neutro: un nivel que no se
 *  conoce no es «bajo» ni «alto», es desconocido. */
export function claseNivelRiesgo(nivel: string | null | undefined): string {
  return CLASE_NIVEL_RIESGO[nivel ?? ""] ?? CHIP_NEUTRO;
}

/**
 * Severidad material. La ficha comparaba con `CRITICA`/`ALTA`, que nadie
 * escribe, así que el banner de incidente material nunca se encendía.
 */
export function isMaterialSeverity(severity: string | null | undefined): boolean {
  return ["CRITICO", "ALTO"].includes(normalizeAimsStatus(severity));
}

/**
 * Chip del estado de una evaluación. Fuera del vocabulario, neutro: un estado
 * que nadie declaró no es «conforme» ni «con brechas».
 */
export function chipClaseEstadoEvaluacion(status: string | null | undefined): string {
  return CHIP_ESTADO_EVALUACION[normalizeAimsStatus(status)] ?? CHIP_NEUTRO;
}

/** Chip de la severidad de un incidente. Fuera del vocabulario, neutro. */
export function chipClaseSeveridad(severity: string | null | undefined): string {
  return CHIP_SEVERIDAD[normalizeAimsStatus(severity)] ?? CHIP_NEUTRO;
}

/** Chip del estado de un incidente. Fuera del vocabulario, neutro. */
export function chipClaseEstadoIncidente(status: string | null | undefined): string {
  return CHIP_ESTADO_INCIDENTE[normalizeAimsStatus(status)] ?? CHIP_NEUTRO;
}
