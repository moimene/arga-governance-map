/**
 * Resolución unificada `governing_bodies` → `TipoOrgano` del motor V2.
 *
 * Carril FU#3 sobre INC-10/4036f1a. Centraliza la lógica que antes vivía
 * duplicada en 3 sitios con criterios distintos:
 *  - `src/hooks/useAgreementCompliance.ts:216` (NO reconocía "CDA" — bug)
 *  - `src/pages/secretaria/ConvocatoriasStepper.tsx:135`
 *  - `src/pages/secretaria/ReunionStepper.tsx:140`
 *
 * Convención BD verificada en Cloud `governance_OS` (2026-05-09):
 *  - body_type="CDA" es UMBRELLA para todos los órganos de administración:
 *    * CONSEJO_ADMIN colegiado (CdA con varios consejeros)
 *    * ADMIN_UNICO (administrador único)
 *    * ADMIN_SOLIDARIOS (administradores solidarios)
 *    * ADMIN_CONJUNTA (administradores mancomunados)
 *    Diferenciación fina por `config.organo_tipo`. Cloud actual: 20× CDA.
 *  - body_type="JUNTA" es Junta General (socios/accionistas). Cloud: 9×.
 *  - body_type="COMISION" es comisión delegada del CdA. Cloud: 5×.
 *  - body_type="COMITE" es comité (Auditoría, Riesgos, etc.). Cloud: 6×.
 *    Se trata como COMISION_DELEGADA por convención de quorum.
 *
 * El motor V2 (`TipoOrgano`) solo distingue 3 categorías:
 *  - `JUNTA_GENERAL`: junta de socios/accionistas
 *  - `CONSEJO`: órgano de administración (incluye admins no colegiados)
 *  - `COMISION_DELEGADA`: comisión o comité del CdA
 *
 * Decisión semántica para admin no colegiados (UNICO/SOLIDARIOS/CONJUNTA):
 * mapean a CONSEJO. Razón: siguen siendo "órgano de administración"; el
 * flujo específico (UNIPERSONAL_ADMIN, SOLIDARIO, CO_APROBACION) lo
 * determina `adoption_mode`, no `organoTipo`. CONSEJO es el bucket
 * "órgano de administración no-junta-no-comisión" en el motor V2.
 *
 * NO migra callers en este commit. Se centraliza el helper + tests
 * para que callers actuales (3) puedan migrarse en un siguiente paso
 * con confianza de que el contrato está fijado.
 */

import type { TipoOrgano } from "@/lib/rules-engine";

export type GoverningBodyShape = {
  body_type?: string | null;
  config?: Record<string, unknown> | null;
};

function readOrganoTipoFromConfig(config: GoverningBodyShape["config"]): string {
  if (!config || typeof config !== "object") return "";
  const value = (config as Record<string, unknown>).organo_tipo;
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function readBodyType(body: GoverningBodyShape | null | undefined): string {
  if (!body) return "";
  return String(body.body_type ?? "").trim().toUpperCase();
}

export function resolveOrganoTipo(body: GoverningBodyShape | null | undefined): TipoOrgano {
  const bodyType = readBodyType(body);
  const organoTipo = readOrganoTipoFromConfig(body?.config);

  // Junta General: junta de socios/accionistas. Socio único entra aquí
  // porque sigue siendo el "órgano de socios" aunque sea unipersonal.
  if (bodyType === "JUNTA" || organoTipo === "JUNTA_GENERAL" || organoTipo === "SOCIO_UNICO") {
    return "JUNTA_GENERAL";
  }

  // Comisión delegada y comités del CdA. Mismas reglas de quorum por
  // convención del proyecto.
  if (
    bodyType === "COMISION" ||
    bodyType === "COMITE" ||
    bodyType === "COMISION_DELEGADA" ||
    organoTipo.includes("COMISION") ||
    organoTipo.includes("COMIT")
  ) {
    return "COMISION_DELEGADA";
  }

  // Órgano de administración (umbrella): CdA colegiado + admin único +
  // solidarios + mancomunados. Todos colapsan a CONSEJO.
  if (
    bodyType === "CDA" ||
    bodyType === "CONSEJO" ||
    bodyType === "CONSEJO_ADMINISTRACION" ||
    organoTipo.includes("CONSEJO") ||
    organoTipo.includes("ADMIN")
  ) {
    return "CONSEJO";
  }

  // Fallback conservador: si no podemos clasificar, tratar como junta
  // general (semántica más restrictiva en términos de quorum).
  return "JUNTA_GENERAL";
}

/**
 * Igual que `resolveOrganoTipo`, pero devuelve `null` en vez de recurrir al
 * fallback a Junta cuando el órgano no se puede clasificar.
 *
 * Codex adversarial (2026-07-18): el fallback conservador es correcto para
 * decidir quórums —ante la duda, el régimen más exigente—, pero es engañoso
 * para MOSTRAR información jurídica: un órgano irreconocible aparecería en
 * pantalla como Junta General, afirmando algo que nadie ha acreditado. Las
 * superficies informativas deben usar esta variante y callar ante la duda.
 *
 * Cloud 2026-07-18: los 52 órganos existentes son CDA/JUNTA/COMISION/COMITE, de
 * modo que hoy ninguna fila cae en el `null`; esto cierra la trampa latente.
 */
export function resolveOrganoTipoStrict(
  body: GoverningBodyShape | null | undefined,
): TipoOrgano | null {
  const bodyType = readBodyType(body);
  const organoTipo = readOrganoTipoFromConfig(body?.config);
  if (!bodyType && !organoTipo) return null;

  const KNOWN_BODY_TYPES = new Set([
    "JUNTA",
    "COMISION",
    "COMITE",
    "COMISION_DELEGADA",
    "CDA",
    "CONSEJO",
    "CONSEJO_ADMINISTRACION",
  ]);
  const KNOWN_CONFIG_TIPOS = new Set([
    "JUNTA_GENERAL",
    "SOCIO_UNICO",
    "COMISION_DELEGADA",
    "CONSEJO_ADMIN",
    "ADMIN_UNICO",
    "ADMIN_SOLIDARIOS",
    "ADMIN_CONJUNTA",
  ]);
  if (!KNOWN_BODY_TYPES.has(bodyType) && !KNOWN_CONFIG_TIPOS.has(organoTipo)) return null;

  return resolveOrganoTipo(body);
}
