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
