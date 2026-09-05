// src/lib/grc/penal-scope.ts
//
// Las dos decisiones de `/grc/penal-anticorrupcion` que fabricaban dato, sacadas
// de la pantalla y convertidas en funciones puras.
//
// Viven aquí y no en el componente por la misma razón que `assessed-band.ts`:
// un test que vigila el CÓDIGO FUENTE con una expresión regular se esquiva de
// seis maneras (constante intermedia, tabla de lookup, `switch`, condición
// partida…), todas semánticamente idénticas al defecto. Un test de
// COMPORTAMIENTO sobre una función pura no se esquiva: o el riesgo cuenta como
// penal o no cuenta, y o la celda devuelve un número que está en la fila o no
// devuelve ninguno.
import { tieneEjes, type Banda } from "./assessed-band";

export type RiesgoPenalLike = {
  module_id?: string | null;
  code?: string | null;
  probability?: number | null;
  impact?: number | null;
  inherent_score?: number | null;
  residual_score?: number | null;
  assessed_band?: Banda | string | null;
};

/**
 * Un riesgo penal del tenant, sea cual sea su codificación.
 *
 * ARGA los guarda con `module_id='penal'` y código `RSK-PEN-*`; Garrigues con
 * `module_id='risk'` y `RSK-GARR-PEN-*`. El filtro anterior
 * (`module_id === "penal" || code.startsWith("RSK-PEN")`) solo reconocía la
 * codificación de ARGA, así que la tarjeta contaba 0 sobre los 82 riesgos
 * penales reales del despacho — y un `|| 9` literal la remataba pintando nueve.
 */
export function esRiesgoPenal(r: RiesgoPenalLike): boolean {
  if (r.module_id === "penal") return true;
  return /-PEN-/.test(r.code ?? "");
}

/**
 * Qué se puede decir del nivel de un riesgo SIN inventarse nada.
 *
 * - `SCORE`: hay al menos uno de los dos ejes clásicos. Cada uno se sirve solo
 *   si está: el que falte va como `null`, no se deduce del otro.
 * - `BANDA`: no hay ejes, pero la fuente publica una banda ordinal.
 * - `SIN_DATO`: ni una cosa ni la otra.
 *
 * Lo que había antes era
 * `inherent_score || (prob && impact ? prob*impact : 6)` y
 * `residual_score || Math.ceil(inherent/2)`: pintaba «6 / 3» en verde para los
 * 82 riesgos del mapa penal —evaluados por banda, sin score— y un residual
 * inventado para los 18 de ARGA, que tienen inherente pero residual NULL.
 */
export type NivelRiesgo =
  | { tipo: "SCORE"; inherente: number | null; residual: number | null }
  | { tipo: "BANDA"; banda: Banda }
  | { tipo: "SIN_DATO" };

export function nivelRiesgo(r: RiesgoPenalLike): NivelRiesgo {
  const inherente = r.inherent_score ?? (tieneEjes(r) ? r.probability! * r.impact! : null);
  const residual = r.residual_score ?? null;
  if (inherente !== null || residual !== null) {
    return { tipo: "SCORE", inherente, residual };
  }
  const banda = r.assessed_band;
  if (typeof banda === "string" && banda.length > 0) {
    return { tipo: "BANDA", banda: banda as Banda };
  }
  return { tipo: "SIN_DATO" };
}
