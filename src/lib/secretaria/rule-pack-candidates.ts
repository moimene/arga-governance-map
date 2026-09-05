/**
 * Reducción de candidatos de rule pack por órgano — función PURA.
 *
 * POR QUÉ VIVE AQUÍ. Esta decisión estaba embebida en el `queryFn` de
 * `useRulePackForMateria`, y el único guard que la protegía comprobaba que el
 * FUENTE del hook contuviese dos literales. Un `expect(src).toContain(...)` no
 * distingue la lógica de una llamada de señuelo: se podía romper la regresión
 * sin escribir ninguno de los literales prohibidos. Extraída, se prueba por
 * comportamiento.
 *
 * CONTRATO (dos mitades que no se pueden confundir):
 *
 *  1. Con órgano conocido: se PREFIEREN sus packs, pero si ninguno lo es se
 *     sirve el resto igualmente. Devolver `null` por discrepancia de órgano
 *     sería fail-closed — la «opción C» — que es criterio del Comité Legal y
 *     está deliberadamente EXCLUIDA de este lote.
 *
 *  2. Sin órgano conocido y con packs de órganos distintos: NO se elige. De
 *     este hook sale la mayoría legal que se rotula «regla efectiva», y la de
 *     la Junta no es la del Consejo: elegir al azar afirma ante el abogado algo
 *     que nadie ha determinado. `null` degrada el contrato a inferencia
 *     etiquetada.
 */
import { rulePackOrganoFamily } from "./rule-pack-organo";

/**
 * @param rows candidatos de la materia, en orden determinista
 * @param organo familia de órgano del acuerdo, ya normalizada, o null/undefined
 * @param organoDe cómo leer el órgano de cada fila
 * @returns los candidatos a desempatar, o `null` si no se puede elegir
 */
export function narrowRulePackCandidates<T>(
  rows: T[],
  organo: string | null | undefined,
  organoDe: (row: T) => string | null | undefined,
): T[] | null {
  const candidatos = rows ?? [];
  if (candidatos.length === 0) return candidatos;

  if (organo) {
    const delOrgano = candidatos.filter((row) => rulePackOrganoFamily(organoDe(row)) === organo);
    // Preferir sí; dejar de servir, no.
    return delOrgano.length > 0 ? delOrgano : candidatos;
  }

  const distintosOrganos = new Set(
    candidatos.map((row) => rulePackOrganoFamily(organoDe(row)) ?? "SIN_ORGANO"),
  );
  if (distintosOrganos.size > 1) return null;
  return candidatos;
}
