// src/lib/grc/assessed-band.ts
// G5 — bandas de color de un mapa de riesgos evaluado en origen.
//
// Las bandas NO tienen nombre de nivel. La fuente no publica leyenda ni
// criterio, así que llamarlas "Crítico"/"Alto"/"Medio"/"Bajo" sería inventar
// una escala. Se identifican por su color y por su posición relativa.
//
// Módulo hoja: no importa nada del proyecto, para que pueda usarse desde
// cualquier capa sin arrastrar ciclos.

export type Banda = "ROJO" | "NARANJA" | "AMARILLO" | "VERDE" | "NO_EVALUADA";

// De mayor a menor. Los dos verdes de la fuente van colapsados en VERDE: su
// orden relativo no está publicado y una banda tiene que estar ordenada.
export const ORDEN_BANDAS: readonly Banda[] = ["ROJO", "NARANJA", "AMARILLO", "VERDE", "NO_EVALUADA"];

// Colores del propio mapa. Son DATO, no marca: se sirven tal cual para que el
// lector reconozca la matriz que ya conoce.
export const COLOR_BANDA: Record<Banda, string> = {
  ROJO: "rgb(255,0,0)",
  NARANJA: "rgb(255,192,0)",
  AMARILLO: "rgb(255,255,0)",
  VERDE: "rgb(146,208,80)",
  NO_EVALUADA: "rgb(217,217,217)",
};

// Sin nombre de nivel, a propósito.
export const ETIQUETA_BANDA: Record<Banda, string> = {
  ROJO: "Banda roja",
  NARANJA: "Banda naranja",
  AMARILLO: "Banda amarilla",
  VERDE: "Banda verde",
  NO_EVALUADA: "Sin evaluar",
};

export const NOTA_ESCALA =
  "Los niveles proceden del mapa evaluado del despacho, que los expresa por color. " +
  "La fuente no publica leyenda ni criterio de bandas, así que no se les atribuye nombre. " +
  "El orden relativo de los dos tonos de verde no consta.";

/**
 * Un riesgo tiene ejes clásicos solo si trae LOS DOS. Con medio dato no se
 * completa el que falta: rellenar con 1 es lo que hacía que un riesgo sin
 * evaluar dijera "Prob. 1 · Impacto 1".
 */
export function tieneEjes(r: { probability?: number | null; impact?: number | null }): boolean {
  return r.probability != null && r.impact != null;
}

export type Celda = "VERDE_CLARO" | "VERDE_INTENSO" | "AMARILLO" | "NARANJA" | "ROJO";

export const COLOR_CELDA: Record<Celda, string> = {
  VERDE_INTENSO: "0,176,80",
  VERDE_CLARO: "146,208,80",
  AMARILLO: "255,255,0",
  NARANJA: "255,192,0",
  ROJO: "255,0,0",
};

// El desglose conserva el color exacto de la fuente. Los dos verdes se
// distinguen aquí aunque su orden relativo no esté publicado: distinguirlos
// no es ordenarlos.
export const ETIQUETA_CELDA: Record<Celda, string> = {
  VERDE_INTENSO: "Verde intenso",
  VERDE_CLARO: "Verde claro",
  AMARILLO: "Amarillo",
  NARANJA: "Naranja",
  ROJO: "Rojo",
};

// ─── Prioridad por score, y por qué las bandas NO participan ─────────────────
//
// Estas dos funciones viven aquí, y no en la pantalla, por una razón concreta:
// la review de la Tarea 1 demostró que un test que vigila el CÓDIGO FUENTE de
// Risk360 con una expresión regular es esquivable de seis maneras distintas
// —constante intermedia, tabla de lookup, condición partida en dos líneas,
// `switch`, `includes`…— todas semánticamente idénticas al defecto. Un test de
// COMPORTAMIENTO sobre una función pura no se esquiva: o la banda cuenta como
// "crítico" o no cuenta, y da igual cómo esté escrito el código que lo decide.

export const PRIORIDAD_TODOS = "Todos";

export type RiesgoPriorizable = {
  probability?: number | null;
  impact?: number | null;
  assessed_band?: Banda | string | null;
};

/** Score clásico 1-25. `null` cuando faltan los ejes: nunca se completa el que falta. */
export function riskScore(r: RiesgoPriorizable): number | null {
  return tieneEjes(r) ? r.probability! * r.impact! : null;
}

/**
 * Filtro de Prioridad. Solo se aplica a riesgos CON ejes.
 *
 * Un riesgo evaluado por banda ordinal no tiene prioridad en esta escala y no
 * puede tenerla: la fuente da un nivel compuesto por celda y no lo descompone
 * en probabilidad × impacto. Mapear ROJO→"Críticos" o NO_EVALUADA→"Bajos"
 * inventaría la leyenda que la fuente no publica (D-2), y lo segundo además
 * afirmaría que un delito SIN EVALUAR es de riesgo bajo.
 */
export function matchesScoreFilter(r: RiesgoPriorizable, filter: string): boolean {
  if (filter === PRIORIDAD_TODOS) return true;
  const score = riskScore(r);
  if (score === null) return false; // sin ejes: fuera de esta escala, no "bajo"
  if (filter === "criticos") return score >= 20;
  if (filter === "altos") return score >= 15 && score < 20;
  if (filter === "medios") return score >= 10 && score < 15;
  if (filter === "bajos") return score < 10;
  return true;
}

/**
 * Recuento de severidad. Devuelve también `sinEjes` para que la pantalla pueda
 * decir en voz alta cuántos riesgos quedan FUERA del recuento: un "0 críticos"
 * mudo sobre 82 delitos —de los que uno está en banda roja— se lee como "no hay
 * exposición alta", que es justo lo contrario de lo que dice el mapa.
 */
export function countSeverity(risks: readonly RiesgoPriorizable[]): {
  criticos: number;
  altos: number;
  sinEjes: number;
} {
  let criticos = 0;
  let altos = 0;
  let sinEjes = 0;
  for (const r of risks) {
    const s = riskScore(r);
    if (s === null) {
      sinEjes++;
    } else if (s >= 20) {
      criticos++;
    } else if (s >= 15) {
      altos++;
    }
  }
  return { criticos, altos, sinEjes };
}

// ─── Precedencia entre las DOS evaluaciones de un riesgo ─────────────────────
//
// Hasta el 2026-09-07 esta pregunta no existía: la CHECK `risks_banda_sin_ejes`
// hacía imposible que una fila trajera banda y ejes a la vez, así que las tres
// pantallas se conformaban con `tieneEjes(r) ? ejes : r.assessed_band ? banda :
// null`. Ese ternario esconde una precedencia que nadie escribió: los ejes
// ganan Y LA BANDA DESAPARECE. Retirada la CHECK (migración 20260907T2, por
// decisión del usuario para poder sembrar Garrigues con dato simulado
// persistente), esa celda pasa a ser alcanzable y el ternario deja de ser
// inocente: un riesgo con banda ROJA y ejes 2x2 se pintaría "Mínimo" a secas.
//
// La regla, en un solo sitio y sin React para poder probarla:
//
//   1. Se pinta TODO lo que el riesgo trae. Con las dos evaluaciones se pintan
//      LAS DOS, y la pantalla declara que son dos y que no se concilian.
//      Ocultar una es la contradicción escondida, que es lo que no se tolera.
//   2. La escala 1-25 —filtro de Prioridad, KPI de severidad, mapa de calor,
//      orden— se alimenta SOLO de los ejes. Una banda no entra en ella ni
//      cuando va sola (D-2, arriba) ni cuando acompaña a unos ejes.
//   3. Ninguna de las dos se deriva de la otra en ningún sentido. Mapear un
//      score a una banda, o una banda a un score, inventaría la leyenda que la
//      fuente no publica. No hay conciliación posible, y por eso el aviso dice
//      que no la hay en vez de fingir que las dos coinciden.
//
// Las pantallas IMPORTAN esto; no vuelven a decidirlo. Mismo patrón que
// `src/lib/grc/obligation-coverage.ts`, que nació porque el criterio vivía en
// una pantalla y el arreglo llegó a esa y no a sus dos hermanas.

export const AVISO_DOBLE_LECTURA =
  "Este riesgo trae dos evaluaciones a la vez: la banda de su mapa de origen y los ejes " +
  "de probabilidad × impacto. No se concilian entre sí —la fuente de la banda no publica " +
  "su leyenda— así que pueden discrepar. Se muestran las dos sin elegir por usted.";

export type ModoLectura = "EJES" | "BANDA" | "AMBAS" | "SIN_EVALUAR";

export type LecturaRiesgo = {
  modo: ModoLectura;
  /** Pintar el bloque de probabilidad × impacto. */
  muestraEjes: boolean;
  /** Pintar la banda. Con `AMBAS` es `true`: la banda NO se oculta tras los ejes. */
  muestraBanda: boolean;
  /** Score 1-25, o `null`. Único valor que alimenta filtros, KPIs y mapa de calor. */
  score: number | null;
  banda: Banda | null;
  /** Texto que la pantalla DEBE pintar cuando hay dos evaluaciones; `null` si no las hay. */
  avisoDobleLectura: string | null;
};

export function lecturaRiesgo(r: RiesgoPriorizable): LecturaRiesgo {
  const ejes = tieneEjes(r);
  const banda = (r.assessed_band ?? null) as Banda | null;
  const score = riskScore(r);
  if (ejes && banda) {
    return {
      modo: "AMBAS",
      muestraEjes: true,
      muestraBanda: true,
      score,
      banda,
      avisoDobleLectura: AVISO_DOBLE_LECTURA,
    };
  }
  if (ejes) {
    return { modo: "EJES", muestraEjes: true, muestraBanda: false, score, banda: null, avisoDobleLectura: null };
  }
  if (banda) {
    return { modo: "BANDA", muestraEjes: false, muestraBanda: true, score: null, banda, avisoDobleLectura: null };
  }
  return { modo: "SIN_EVALUAR", muestraEjes: false, muestraBanda: false, score: null, banda: null, avisoDobleLectura: null };
}
