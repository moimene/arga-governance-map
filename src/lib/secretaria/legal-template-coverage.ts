import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { LEGAL_TEAM_TEMPLATE_FIXTURES } from "./legal-template-fixtures";

export type LegalTemplateCoverageState =
  | "cloud_active"
  | "cloud_pending"
  | "fixture_pending_load"
  | "missing";

export interface LegalTemplateCoverageRequirement {
  key: string;
  label: string;
  tipo: string;
  organoTipo?: string | null;
  adoptionMode?: string | null;
  fixtureId?: string | null;
  critical: boolean;
}

export interface LegalTemplateCoverageRow extends LegalTemplateCoverageRequirement {
  state: LegalTemplateCoverageState;
  sourceLabel: string;
  activeCloudCount: number;
  pendingCloudCount: number;
  fixtureAvailable: boolean;
  cloudTemplateIds: string[];
  fixtureTemplateId: string | null;
}

export const LEGAL_TEMPLATE_COVERAGE_REQUIREMENTS: LegalTemplateCoverageRequirement[] = [
  {
    key: "convocatoria-junta",
    label: "Convocatoria Junta",
    tipo: "CONVOCATORIA",
    organoTipo: "JUNTA",
    fixtureId: "legal-fixture-convocatoria-junta-es",
    critical: true,
  },
  {
    key: "convocatoria-consejo",
    label: "Convocatoria Consejo",
    tipo: "CONVOCATORIA",
    organoTipo: "CONSEJO",
    fixtureId: "legal-fixture-convocatoria-consejo-es",
    critical: true,
  },
  {
    key: "acta-junta",
    label: "Acta Junta",
    tipo: "ACTA_SESION",
    organoTipo: "JUNTA",
    fixtureId: "legal-fixture-acta-junta-es",
    critical: true,
  },
  {
    key: "acta-consejo",
    label: "Acta Consejo",
    tipo: "ACTA_SESION",
    organoTipo: "CONSEJO",
    fixtureId: "legal-fixture-acta-consejo-es",
    critical: true,
  },
  {
    key: "certificacion",
    label: "Certificación",
    tipo: "CERTIFICACION",
    fixtureId: "legal-fixture-certificacion-es",
    critical: true,
  },
  {
    key: "acta-consignacion-socio-unico",
    label: "Acta socio único",
    tipo: "ACTA_CONSIGNACION",
    adoptionMode: "UNIPERSONAL_SOCIO",
    fixtureId: "legal-fixture-acta-consignacion-socio-unico-es",
    critical: true,
  },
  {
    key: "acta-consignacion-admin-unico",
    label: "Acta admin. único",
    tipo: "ACTA_CONSIGNACION",
    adoptionMode: "UNIPERSONAL_ADMIN",
    fixtureId: "legal-fixture-acta-consignacion-admin-unico-es",
    critical: true,
  },
  {
    key: "acta-sin-sesion",
    label: "Acta sin sesión",
    tipo: "ACTA_ACUERDO_ESCRITO",
    adoptionMode: "NO_SESSION",
    fixtureId: "legal-fixture-acta-acuerdo-escrito-sin-sesion-es",
    critical: true,
  },
  {
    key: "acta-co-aprobacion",
    label: "Acta decisión conjunta",
    tipo: "ACTA_DECISION_CONJUNTA",
    adoptionMode: "CO_APROBACION",
    fixtureId: "legal-fixture-acta-decision-conjunta-es",
    critical: true,
  },
  {
    key: "acta-solidario",
    label: "Acta órgano admin. solidario",
    tipo: "ACTA_ORGANO_ADMIN",
    adoptionMode: "SOLIDARIO",
    fixtureId: "legal-fixture-acta-organo-admin-solidario-es",
    critical: true,
  },
  {
    key: "informe-preceptivo",
    label: "Informe preceptivo",
    tipo: "INFORME_PRECEPTIVO",
    fixtureId: "legal-fixture-informe-preceptivo-es",
    critical: true,
  },
  {
    key: "informe-documental-pre",
    label: "Informe documental PRE",
    tipo: "INFORME_DOCUMENTAL_PRE",
    fixtureId: "legal-fixture-informe-documental-pre-es",
    critical: true,
  },
  {
    key: "documento-registral",
    label: "Documento registral",
    tipo: "DOCUMENTO_REGISTRAL",
    fixtureId: "legal-fixture-documento-registral-es",
    critical: true,
  },
  {
    key: "subsanacion-registral",
    label: "Subsanación registral",
    tipo: "SUBSANACION_REGISTRAL",
    fixtureId: "legal-fixture-subsanacion-registral-es",
    critical: true,
  },
  {
    key: "modelo-acuerdo",
    label: "Modelo de acuerdo",
    tipo: "MODELO_ACUERDO",
    critical: true,
  },
];

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || null;
}

function organoFamily(value?: string | null) {
  const code = normalizeCode(value);
  if (!code) return null;
  if (code.includes("CDA") || code.includes("CONSEJO")) return "CONSEJO";
  if (code.includes("JUNTA") || code.includes("ASAMBLEA")) return "JUNTA";
  if (code.includes("ADMIN")) return "ADMIN";
  return code;
}

function templateOrganoMatches(template: PlantillaProtegidaRow, organoTipo?: string | null) {
  if (!organoTipo) return true;
  if (!template.organo_tipo) return false;
  return organoFamily(template.organo_tipo) === organoFamily(organoTipo);
}

function templateAdoptionModeMatches(template: PlantillaProtegidaRow, adoptionMode?: string | null) {
  if (!adoptionMode) return true;
  if (!template.adoption_mode) return false;
  return normalizeCode(template.adoption_mode) === normalizeCode(adoptionMode);
}

function templateJurisdictionMatches(template: PlantillaProtegidaRow, jurisdiction?: string | null) {
  const expected = normalizeCode(jurisdiction);
  const actual = normalizeCode(template.jurisdiccion);
  if (!expected || !actual || actual === "GLOBAL" || actual === "MULTI") return true;
  return actual === expected;
}

function templateMatchesRequirement(
  template: PlantillaProtegidaRow,
  requirement: LegalTemplateCoverageRequirement,
  jurisdiction?: string | null,
) {
  return (
    normalizeCode(template.tipo) === normalizeCode(requirement.tipo) &&
    templateOrganoMatches(template, requirement.organoTipo) &&
    templateAdoptionModeMatches(template, requirement.adoptionMode) &&
    templateJurisdictionMatches(template, jurisdiction)
  );
}

function coverageState(activeCloudCount: number, pendingCloudCount: number, fixtureAvailable: boolean) {
  if (activeCloudCount > 0) return "cloud_active";
  if (pendingCloudCount > 0) return "cloud_pending";
  if (fixtureAvailable) return "fixture_pending_load";
  return "missing";
}

function sourceLabel(state: LegalTemplateCoverageState) {
  if (state === "cloud_active") return "Cloud activa";
  if (state === "cloud_pending") return "Cloud pendiente";
  if (state === "fixture_pending_load") return "Fixture local";
  return "Sin cobertura";
}

export function buildLegalTemplateCoverage(
  plantillas: PlantillaProtegidaRow[],
  options: { jurisdiction?: string | null } = {},
): LegalTemplateCoverageRow[] {
  return LEGAL_TEMPLATE_COVERAGE_REQUIREMENTS.map((requirement) => {
    const cloudMatches = plantillas.filter((template) =>
      templateMatchesRequirement(template, requirement, options.jurisdiction)
    );
    const activeCloud = cloudMatches.filter((template) => template.estado === "ACTIVA");
    const pendingCloud = cloudMatches.filter((template) => template.estado !== "ACTIVA");
    const fixture = requirement.fixtureId
      ? LEGAL_TEAM_TEMPLATE_FIXTURES.find((template) => template.id === requirement.fixtureId) ?? null
      : null;
    const state = coverageState(activeCloud.length, pendingCloud.length, !!fixture);

    return {
      ...requirement,
      state,
      sourceLabel: sourceLabel(state),
      activeCloudCount: activeCloud.length,
      pendingCloudCount: pendingCloud.length,
      fixtureAvailable: !!fixture,
      cloudTemplateIds: cloudMatches.map((template) => template.id),
      fixtureTemplateId: fixture?.id ?? null,
    };
  });
}
