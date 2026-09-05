/**
 * Presentación de recuentos del read model de la consola.
 *
 * Invariante del contrato: un valor `null` significa «no medido» (la consulta
 * falló) y NUNCA puede pintarse como 0. Un 0 afirma que se midió y no había
 * nada; decir 0 cuando no se ha podido medir es fabricar dato.
 */

export const NO_MEDIDO = "no medido";
export const CARGANDO = "cargando";

/**
 * Texto para una cifra del read model.
 *
 * Tres estados, no dos: mientras la consulta está EN VUELO no se ha medido nada
 * todavía, pero tampoco ha fallado — decir «no medido» ahí es tan impreciso como
 * decir 0. `cargando` distingue el tercero.
 */
export function formatMeasured(
  value: number | null | undefined,
  cargando = false,
): string {
  if (cargando && value == null) return CARGANDO;
  return value == null ? NO_MEDIDO : String(value);
}

/** Texto corto para tarjetas estrechas. `null`/`undefined` → «—». */
export function formatMeasuredShort(value: number | null | undefined): string {
  return value == null ? "—" : String(value);
}

/** `true` solo si se midió y hay algo. Sin medición no se afirma nada. */
export function hasMeasuredItems(value: number | null | undefined): boolean {
  return value != null && value > 0;
}

/** `true` si no se pudo medir: la UI debe usar tono neutro, no de éxito. */
export function isUnmeasured(value: number | null | undefined): boolean {
  return value == null;
}
