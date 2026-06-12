import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { isOperationalTemplate } from "@/lib/doc-gen/template-operability";

export interface AgreementTemplateContext {
  adoption_mode?: string | null;
  agreement_kind?: string | null;
  matter_class?: string | null;
  governing_bodies?: { body_type?: string | null } | null;
  entities?: { jurisdiction?: string | null } | null;
}

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || null;
}

export function organoFamily(value?: string | null) {
  const code = normalizeCode(value);
  if (!code) return null;
  if (code.includes("CDA") || code.includes("CONSEJO")) return "CONSEJO";
  if (code.includes("JUNTA") || code.includes("ASAMBLEA")) return "JUNTA";
  if (code.includes("ADMIN")) return "ADMIN";
  if (code.includes("COMISION") || code.includes("COMIT")) return "COMISION";
  return code;
}

export function templateOrganoMatches(templateOrgano?: string | null, bodyType?: string | null) {
  if (!templateOrgano || !bodyType) return true;
  return organoFamily(templateOrgano) === organoFamily(bodyType);
}

// ITEM-080/112 — Decisión de producto (no requiere cambio de schema): la
// discriminación SA/SL (DL-4) NO se modela como eje `tipo_social` en
// `plantillas_protegidas`. Las plantillas de acta/certificación (ACTA_*,
// CERTIFICACION) son agnósticas del tipo social, y la selección automática SA/SL
// vive en el Tramitador vía los MODELO_ACUERDO por materia (useModelosAcuerdo).
// Por eso este filtro de compatibilidad no incluye `tipo_social`: la dimensión
// relevante para la plantilla es materia × órgano × jurisdicción × adopción.
// Si en el futuro se requieren actas tipificadas por SA/SL, añadir aquí la columna
// + filtro; hoy no hay caso real de mismatch (las ACTA_* compatibles son neutrales).
export function templateCompatibleWithAgreement(
  template: PlantillaProtegidaRow,
  agreement: AgreementTemplateContext,
  allowedTypes?: string[] | null,
) {
  if (allowedTypes && !allowedTypes.includes(template.tipo)) return false;

  const agreementJurisdiction = normalizeCode(agreement.entities?.jurisdiction) ?? "ES";
  const templateJurisdiction = normalizeCode(template.jurisdiccion);
  const jurisdictionOk =
    !templateJurisdiction ||
    templateJurisdiction === "GLOBAL" ||
    templateJurisdiction === "MULTI" ||
    templateJurisdiction === agreementJurisdiction;

  const materiaOk =
    !template.materia_acuerdo ||
    template.materia_acuerdo === agreement.agreement_kind ||
    template.materia_acuerdo === agreement.matter_class;

  const adoptionOk =
    !template.adoption_mode ||
    normalizeCode(template.adoption_mode) === normalizeCode(agreement.adoption_mode);

  const organoOk = templateOrganoMatches(template.organo_tipo, agreement.governing_bodies?.body_type);

  return isOperationalTemplate(template) && jurisdictionOk && materiaOk && adoptionOk && organoOk;
}

