// W3-F4 — Segregación operativa por data_class (cierre de W3).
// ============================================================================
// `data_class` (DEMO | TEST | PRE_RELEASE | PRODUCTION) clasifica entities y persons.
// El cierre de W3 exige filtrar el dato TEST de forma CONSISTENTE en TODOS los
// read-paths (hooks de lista, scope switcher, wizards). Este módulo centraliza la
// política para evitar el anti-patrón de filtrar un solo read-path (lección W3/codex).
//
// Política: por defecto se OCULTA el dato TEST (demo y pruebas con humanos no deben
// ver artefactos de test). El harness E2E puede OPTAR por verlo activando el flag
// (localStorage `tgms.includeTestData=1` o `?includeTest=1`), porque sus specs crean
// data TEST y necesitan verificarla en la UI.

export const TEST_DATA_CLASS = "TEST";
export const VISIBLE_DATA_CLASSES = ["DEMO", "PRE_RELEASE", "PRODUCTION"] as const;

/** Pura: ¿es visible esta data_class? null/DEMO/PRE/PROD visibles; TEST oculta salvo opt-in. */
export function isVisibleDataClass(
  dataClass: string | null | undefined,
  includeTest = false,
): boolean {
  if (includeTest) return true;
  return dataClass !== TEST_DATA_CLASS;
}

/**
 * ¿Debe incluirse el dato TEST? SOLO opt-in en tiempo de build vía `VITE_E2E=1`
 * (lo activa el dev server de Playwright). NO se ofrece opt-in por localStorage ni
 * por query param: serían un bypass del lado del cliente en demo/producción (lección
 * de revisión adversarial /codex, 2026-06-14). En builds desplegados VITE_E2E no se
 * define, por lo que el dato TEST queda siempre oculto.
 */
export function shouldIncludeTestData(): boolean {
  try {
    return (
      typeof import.meta !== "undefined" &&
      (import.meta as { env?: Record<string, unknown> }).env?.VITE_E2E === "1"
    );
  } catch {
    return false;
  }
}

/**
 * Aplica el filtro de data_class a una query PostgREST de Supabase sobre una tabla
 * que tiene columna `data_class` (entities, persons). No-op si el opt-in E2E está
 * activo. Usa `data_class IS NULL OR data_class <> 'TEST'` para que las filas sin
 * clasificar (NULL) sigan siendo visibles conforme a la política (P1 /codex).
 * Tipado laxo a propósito: el builder de supabase-js tiene tipos genéricos muy
 * profundos; tiparlo con genéricos dispara TS2589 al encadenar .order() después.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyVisibleDataClass(query: any, column = "data_class"): any {
  return shouldIncludeTestData()
    ? query
    : query.or(`${column}.is.null,${column}.neq.${TEST_DATA_CLASS}`);
}

/** Filtra en cliente una lista de filas por su data_class (para joins donde no se
 *  puede filtrar en la query, p.ej. embeds PostgREST). */
export function filterVisibleByDataClass<T extends { data_class?: string | null }>(rows: T[]): T[] {
  if (shouldIncludeTestData()) return rows;
  return rows.filter((r) => isVisibleDataClass(r.data_class));
}
