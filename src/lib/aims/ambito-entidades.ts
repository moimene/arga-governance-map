// src/lib/aims/ambito-entidades.ts
//
// F2.T11 — el selector de ámbito filtra el inventario de IA por el SUJETO real
// (`aims_ria_subjects.entity_id` → `entities.country`/`jurisdiction`), no por
// vocabulario en el nombre del sistema. La mina anterior (`filterSystemsByScope`
// en `readiness.ts`) recortaba por palabras como "auto" o "siniestros" y quedó
// desarmada devolviendo siempre el inventario completo (A5, 2026-08-29); esta
// hoja es el reemplazo real cuando haya sujetos de los que tirar.
//
// Módulo HOJA, sin React: lo consume `filterSystemsByScope` y, cuando exista,
// el ScopeSwitcher del layout de AIMS.
//
// FALLA ABIERTO
// -------------
// Un sistema sin ningún sujeto (hoy, 100% de los 14 sistemas de ARGA y
// Garrigues: 0 filas en `aims_ria_subjects`, medido en el carril A de F2) se
// muestra en CUALQUIER ámbito, con la etiqueta «sin sociedad atribuida». Nunca
// se oculta un sistema por falta de dato — sería una brecha invisible.
//
// Un ámbito que esta hoja no sabe traducir a un país (una región como "LATAM"
// o "Europa", o cualquier cadena que no está en el catálogo) tampoco filtra:
// se declara "no se filtra" en vez de inventar qué países la componen. Es la
// misma garantía que ya prueba `filter-systems-scope.test.ts`: un ámbito
// desconocido nunca oculta en silencio.

/** Alias de país que no son ISO-3166-1 alpha-2 pero se usan en el dato real. */
const ALIAS_ISO2: Record<string, string> = { UK: "GB" };

/** `coalesce(country, jurisdiction)`, normalizado a ISO2 (con el alias UK→GB). */
export function paisDeEntidad(e: { country?: string | null; jurisdiction?: string | null }): string | null {
  const raw = (e.country ?? e.jurisdiction ?? "").trim().toUpperCase();
  if (!raw) return null;
  return ALIAS_ISO2[raw] ?? raw;
}

/**
 * Ámbito (etiqueta de `src/data/scopes.ts` o de `branding.scopes`) → único
 * país ISO2 que representa, cuando la etiqueta ES un país. Una región
 * ("LATAM", "Europa", "Asia-Pacífico") o un ámbito "(Global)"/"Grupo ..." no
 * tiene una composición de países declarada en ningún sitio del dato: se
 * devuelve `null` (no filtra), en vez de inventar qué entra en "Europa".
 */
const PAIS_POR_AMBITO: Record<string, string> = {
  España: "ES",
  Portugal: "PT",
  Brasil: "BR",
  México: "MX",
  Turquía: "TR",
  "EE.UU.": "US",
};

export function paisDelAmbito(scope: string): string | null {
  return PAIS_POR_AMBITO[scope.trim()] ?? null;
}

export type SujetoAmbito = { systemId: string; entityId: string };
export type EntidadAmbito = { id: string; country?: string | null; jurisdiction?: string | null };

/** ¿Esta entidad cae dentro del ámbito? Un ámbito sin país conocido no filtra: todas caen dentro. */
export function entidadEnAmbito(entidad: EntidadAmbito, scope: string): boolean {
  const pais = paisDelAmbito(scope);
  if (pais === null) return true;
  return paisDeEntidad(entidad) === pais;
}

/**
 * ¿Este sistema se muestra en este ámbito? Falla abierto: sin sujeto, o con un
 * sujeto cuya entidad no se resuelve, se muestra siempre.
 */
export function sistemaEnAmbito(
  systemId: string,
  scope: string,
  subjects: SujetoAmbito[],
  entities: EntidadAmbito[],
): boolean {
  const propios = subjects.filter((s) => s.systemId === systemId);
  if (propios.length === 0) return true;
  const porId = new Map(entities.map((e) => [e.id, e]));
  return propios.some((s) => {
    const e = porId.get(s.entityId);
    return e ? entidadEnAmbito(e, scope) : true;
  });
}

/** Filtra una lista de sistemas por ámbito, delegando en `sistemaEnAmbito` para cada uno. */
export function filtrarSistemasPorAmbito<T extends { id: string }>(
  systems: T[],
  scope: string,
  subjects: SujetoAmbito[],
  entities: EntidadAmbito[],
): T[] {
  return systems.filter((s) => sistemaEnAmbito(s.id, scope, subjects, entities));
}

/** Etiqueta de procedencia cuando un sistema no tiene sujeto: se dice, no se calla. */
export const SIN_SOCIEDAD_ATRIBUIDA = "sin sociedad atribuida";
