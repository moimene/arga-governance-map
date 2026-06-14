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

/** ¿Debe incluirse el dato TEST? Opt-in para E2E/depuración; por defecto false. */
export function shouldIncludeTestData(): boolean {
  // El harness E2E arranca el dev server con VITE_E2E=1 para ver el dato TEST que
  // sus specs crean. Builds de demo/producción no lo definen -> TEST oculto.
  try {
    if (
      typeof import.meta !== "undefined" &&
      (import.meta as { env?: Record<string, unknown> }).env?.VITE_E2E === "1"
    ) {
      return true;
    }
  } catch {
    /* import.meta.env no disponible */
  }
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("tgms.includeTestData") === "1") {
      return true;
    }
  } catch {
    /* localStorage no disponible (SSR/node) */
  }
  try {
    if (
      typeof window !== "undefined" &&
      window.location &&
      new URLSearchParams(window.location.search).get("includeTest") === "1"
    ) {
      return true;
    }
  } catch {
    /* window no disponible */
  }
  return false;
}

/**
 * Aplica el filtro de data_class a una query PostgREST de Supabase sobre una tabla
 * que tiene columna `data_class` (entities, persons). No-op si el opt-in TEST está
 * activo. Tipado laxo a propósito: el builder de supabase-js tiene tipos genéricos
 * muy profundos; tiparlo con genéricos dispara TS2589 al encadenar .order() después.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyVisibleDataClass(query: any, column = "data_class"): any {
  return shouldIncludeTestData() ? query : query.neq(column, TEST_DATA_CLASS);
}

/** Filtra en cliente una lista de filas por su data_class (para joins donde no se
 *  puede filtrar en la query, p.ej. embeds PostgREST). */
export function filterVisibleByDataClass<T extends { data_class?: string | null }>(rows: T[]): T[] {
  if (shouldIncludeTestData()) return rows;
  return rows.filter((r) => isVisibleDataClass(r.data_class));
}
