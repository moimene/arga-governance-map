/**
 * Criterio único: ¿una materia decisoria tiene fila en `materia_catalog`?
 *
 * H-50 (MOI-15, 2026-09-27, severidad A): el asistente de convocatoria y
 * otros selectores ofrecían materias DECISORIAS del catálogo de
 * `AGENDA_MATERIAS` (o listas locales equivalentes) sin fila real en
 * `materia_catalog`. Con cualquiera de esas 14 se puede emitir la
 * convocatoria, pero el acta la rechaza en servidor
 * ("authoritative minute: every point needs a catalogued matter…",
 * `supabase/migrations/20260720120000_authoritative_legal_artifact_gates.sql`):
 * camino sin salida. Clasificar cada materia (clase, mayoría, inscribibilidad,
 * cita legal) es criterio del Comité Legal — este módulo NO decide eso, solo
 * evita ofrecer lo que el servidor no sostiene.
 *
 * Fail-closed (decisión D-30): mientras el catálogo carga o falla,
 * `codigosCatalogo` es `null` y NINGUNA materia se considera catalogada. El
 * lado seguro es ocultar de más, nunca ofrecer de más.
 */

export type CatalogoMateriaCodigos = ReadonlySet<string> | null;

export function esMateriaCatalogada(
  materia: string,
  codigosCatalogo: CatalogoMateriaCodigos,
): boolean {
  if (!codigosCatalogo) return false;
  return codigosCatalogo.has(materia);
}

/**
 * Construye el `Set` de códigos catalogados a partir de una fila cualquiera
 * de `materia_catalog` (o cualquier lista con campo `materia`). `null`
 * mientras el hook está cargando o en error — nunca un `Set` vacío, que un
 * consumidor distraído podría confundir con "cero pendientes".
 */
export function materiaCatalogCodigos(
  rows: readonly { materia: string }[] | undefined,
  estado: { isLoading?: boolean; isError?: boolean } = {},
): CatalogoMateriaCodigos {
  if (estado.isLoading || estado.isError || !rows) return null;
  return new Set(rows.map((row) => row.materia));
}

export interface FiltroMateriasCatalogadas<T> {
  catalogadas: T[];
  pendientes: T[];
}

/**
 * Separa una lista de materias (cualquier forma con `value`) en catalogadas
 * y pendientes según el `Set` de códigos vigente. Única función que decide
 * la partición: un selector que la aplique nunca puede ofrecer una
 * pendiente, y siempre puede anunciar cuántas quedan fuera.
 */
export function filtrarMateriasCatalogadas<T extends { value: string }>(
  materias: readonly T[],
  codigosCatalogo: CatalogoMateriaCodigos,
): FiltroMateriasCatalogadas<T> {
  const catalogadas: T[] = [];
  const pendientes: T[] = [];
  for (const materia of materias) {
    (esMateriaCatalogada(materia.value, codigosCatalogo) ? catalogadas : pendientes).push(materia);
  }
  return { catalogadas, pendientes };
}

/**
 * Nota visible para no hacer desaparecer en silencio las materias ocultas.
 * `null` cuando no hay ninguna pendiente (no se muestra nota).
 */
export function notaMateriasPendientes(pendientesCount: number): string | null {
  if (pendientesCount <= 0) return null;
  return `${pendientesCount} materia${pendientesCount === 1 ? "" : "s"} pendiente${
    pendientesCount === 1 ? "" : "s"
  } de clasificación jurídica`;
}
