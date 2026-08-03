import type { SecretariaDocumentType } from "./document-generation-boundary";

export interface AgreementTemplateRoutingInput {
  tipo: string;
}

/**
 * Traduce una plantilla elegida desde Agreement 360 al tipo documental del
 * composer. MODELO_ACUERDO tiene contrato propio: no es un informe PRE ni un
 * documento registral y siempre queda enlazado al agreement_id canónico.
 */
export function agreementTemplateDocumentType(
  plantilla: AgreementTemplateRoutingInput,
  adoptionMode?: string | null,
): SecretariaDocumentType {
  const tipo = plantilla.tipo;
  const mode = adoptionMode?.trim().toUpperCase() ?? "";

  if (tipo === "MODELO_ACUERDO") return "MODELO_ACUERDO";
  if (
    tipo === "ACTA_ACUERDO_ESCRITO" ||
    tipo === "ACTA_DECISION_CONJUNTA" ||
    tipo === "ACTA_ORGANO_ADMIN" ||
    mode === "NO_SESSION" ||
    mode === "CO_APROBACION" ||
    mode === "SOLIDARIO"
  ) {
    return "ACUERDO_SIN_SESION";
  }
  if (tipo === "ACTA_CONSIGNACION" || mode.startsWith("UNIPERSONAL")) {
    return "DECISION_UNIPERSONAL";
  }
  if (tipo === "INFORME_DOCUMENTAL_PRE") return "INFORME_DOCUMENTAL_PRE";
  if (tipo === "INFORME_PRECEPTIVO") return "INFORME_DOCUMENTAL_PRE";
  return "INFORME_DOCUMENTAL_PRE";
}

export function templateTypesForAgreementAdoptionMode(
  adoptionMode?: string | null,
): string[] | null {
  const mode = adoptionMode?.trim().toUpperCase();
  if (mode === "NO_SESSION") return ["ACTA_ACUERDO_ESCRITO"];
  if (mode === "CO_APROBACION") return ["ACTA_DECISION_CONJUNTA"];
  if (mode === "SOLIDARIO") return ["ACTA_ORGANO_ADMIN"];
  if (mode === "UNIPERSONAL_SOCIO" || mode === "UNIPERSONAL_ADMIN") {
    return ["ACTA_CONSIGNACION"];
  }
  return null;
}
