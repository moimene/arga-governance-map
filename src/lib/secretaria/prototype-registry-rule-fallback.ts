import type { PostAcuerdoPayload, RulePackData } from "@/hooks/useRulePackForMateria";

export interface PrototypeRegistryAgreementInput {
  id: string;
  tenant_id: string;
  agreement_kind: string;
  matter_class: string;
}

const INSCRIBABLE_PROTOTYPE_MATTERS = new Set([
  "NOMBRAMIENTO_CONSEJERO",
  "CESE_CONSEJERO",
  "DELEGACION_FACULTADES",
  "NOMBRAMIENTO_AUDITOR",
  "MODIFICACION_ESTATUTOS",
  "AUMENTO_CAPITAL",
  "REDUCCION_CAPITAL",
  "FUSION_ESCISION",
]);

export function buildPrototypeRegistryRulePayload(
  agreement: PrototypeRegistryAgreementInput,
): PostAcuerdoPayload {
  const inscribible =
    INSCRIBABLE_PROTOTYPE_MATTERS.has(agreement.agreement_kind) ||
    agreement.matter_class === "ESTRUCTURAL";

  return {
    inscribible,
    instrumentoRequerido: inscribible ? "ESCRITURA" : "NINGUNO",
    publicacionRequerida: agreement.matter_class === "ESTRUCTURAL",
    plazoInscripcion: inscribible ? 30 : undefined,
    notas:
      "Fallback técnico de prototipo: no sustituye al rule pack Cloud aprobado ni a validación legal productiva.",
    prototype_fallback: true,
    source_of_truth: "none",
    fallback_reason: "missing_cloud_registry_rule_pack",
  };
}

export function buildPrototypeRegistryRulePackFallback(
  agreement: PrototypeRegistryAgreementInput,
): RulePackData {
  const payload = buildPrototypeRegistryRulePayload(agreement);

  return {
    pack: {
      id: `prototype-registry-${agreement.agreement_kind}`,
      tenant_id: agreement.tenant_id,
      materia: agreement.agreement_kind,
      materia_clase: agreement.matter_class,
      nombre: `${agreement.agreement_kind} · fallback registral prototipo`,
      descripcion: "Fallback técnico de tramitación registral para prototipo.",
      organo_tipo: null,
      created_at: "",
    },
    version: {
      id: `prototype-registry-${agreement.agreement_kind}-v1`,
      pack_id: `prototype-registry-${agreement.agreement_kind}`,
      rule_pack_id: `prototype-registry-${agreement.agreement_kind}`,
      version: "prototype",
      version_number: 0,
      is_active: true,
      payload,
      created_at: "",
    },
    payload,
  };
}
