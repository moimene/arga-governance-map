/**
 * Criterio ÚNICO de familia de órgano para rule packs.
 *
 * Antes convivían dos criterios divergentes: `organoFamily` en
 * `useRulePackForMateria` comparaba por substring (`v.includes("CONSEJO")`) y el
 * panel del perfil de ejecución usaba lista blanca. El substring es inseguro —
 * un código como `NO_ADMINISTRACION` o `SIN_CONSEJO` casaba como órgano de
 * administración — y tener dos criterios vivos significa que dos pantallas
 * pueden discrepar sobre a qué órgano pertenece la misma regla.
 *
 * Vocabulario real verificado en Cloud `governance_OS` (2026-07-18):
 * `rule_packs.organo_tipo` ∈ {JUNTA_GENERAL ×36, CONSEJO ×18, SOCIO_UNICO ×2,
 * SOPORTE_INTERNO ×1}. No hay ningún pack con `organo_tipo` NULL ni de
 * COMISION_DELEGADA.
 *
 * DECISIÓN DELIBERADA — `SOCIO_UNICO` NO se colapsa en `JUNTA_GENERAL`.
 * Que el socio único equivalga a la Junta General a efectos de reglas (art. 15
 * LSC) es criterio jurídico pendiente del Comité Legal, no algo que deba
 * asumir este módulo. Se le da familia propia, que solo casa consigo misma.
 * Hoy el efecto es nulo: las dos materias con pack de socio único
 * (SOCIEDAD_UNIPERSONAL, CONTRATOS_SOCIO_UNICO_SOCIEDAD) no tienen ni un
 * acuerdo. Lo mismo para `SOPORTE_INTERNO`, que no es un órgano social.
 *
 * `JUNTA_GENERAL_O_CONSEJO` queda fuera a propósito: es ambiguo por diseño en
 * el catálogo y un pack híbrido no acredita a qué órgano corresponden sus
 * quórums.
 */

export type RulePackOrganoFamily =
  | "JUNTA_GENERAL"
  | "CONSEJO"
  | "COMISION_DELEGADA"
  | "SOCIO_UNICO"
  | "SOPORTE_INTERNO";

const FAMILY_BY_CODE: Readonly<Record<string, RulePackOrganoFamily>> = {
  JUNTA_GENERAL: "JUNTA_GENERAL",
  JUNTA: "JUNTA_GENERAL",
  JGA: "JUNTA_GENERAL",
  JGE: "JUNTA_GENERAL",

  CONSEJO: "CONSEJO",
  CONSEJO_ADMIN: "CONSEJO",
  CONSEJO_ADMINISTRACION: "CONSEJO",
  CDA: "CONSEJO",

  COMISION: "COMISION_DELEGADA",
  COMISION_DELEGADA: "COMISION_DELEGADA",
  COMITE: "COMISION_DELEGADA",

  SOCIO_UNICO: "SOCIO_UNICO",
  SOPORTE_INTERNO: "SOPORTE_INTERNO",
};

/**
 * Devuelve la familia canónica de un código de órgano, o `null` si el código no
 * está reconocido. Nunca adivina: un código desconocido no casa con nada.
 */
export function rulePackOrganoFamily(value?: string | null): RulePackOrganoFamily | null {
  const raw = String(value ?? "").trim().toUpperCase();
  return FAMILY_BY_CODE[raw] ?? null;
}

/** ¿El órgano del pack y el del acuerdo son el mismo? Sin comodines. */
export function sameRulePackOrgano(
  packOrgano?: string | null,
  agreementOrgano?: string | null,
): boolean {
  const pack = rulePackOrganoFamily(packOrgano);
  const agreement = rulePackOrganoFamily(agreementOrgano);
  return Boolean(pack && agreement && pack === agreement);
}
