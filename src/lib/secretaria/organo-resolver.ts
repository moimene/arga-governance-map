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
