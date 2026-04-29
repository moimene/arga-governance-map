import type { DemoScenarioId } from "./scenarios";

export type DemoEntityKind = "SA_COTIZADA" | "SL" | "SLU";

export interface DemoPackEntity {
  id: string;
  name: string;
  kind: DemoEntityKind;
  jurisdiction: "ES";
  canonicalOwner: "TGMS Core";
  governingBody: {
    id: string;
    name: string;
    type: "CdA" | "ADMIN_UNICO";
  };
}

export interface DemoPackScenarioBinding {
  scenario: DemoScenarioId;
  entityId: string;
  bodyId: string;
}

export const demoPackVersion = "ARGA_DEMO_PACK_V1";

export const argaDemoPackEntities: DemoPackEntity[] = [
  {
    id: "demo-entity-arga-seguros-sa",
    name: "ARGA Seguros S.A.",
    kind: "SA_COTIZADA",
    jurisdiction: "ES",
    canonicalOwner: "TGMS Core",
    governingBody: {
      id: "demo-body-cda-arga-seguros",
      name: "Consejo de Administracion",
      type: "CdA",
    },
  },
  {
    id: "demo-entity-arga-servicios-sl",
    name: "ARGA Servicios Corporativos S.L.",
    kind: "SL",
    jurisdiction: "ES",
    canonicalOwner: "TGMS Core",
    governingBody: {
      id: "demo-body-admin-unico-servicios",
      name: "Administrador unico",
      type: "ADMIN_UNICO",
    },
  },
  {
    id: "demo-entity-cartera-arga-slu",
    name: "Cartera ARGA S.L.U.",
    kind: "SLU",
    jurisdiction: "ES",
    canonicalOwner: "TGMS Core",
    governingBody: {
      id: "demo-body-admin-unico-cartera",
      name: "Administrador unico",
      type: "ADMIN_UNICO",
    },
  },
];

export const demoPackScenarioBindings: DemoPackScenarioBinding[] = [
  {
    scenario: "JUNTA_UNIVERSAL_OK",
    entityId: "demo-entity-arga-seguros-sa",
    bodyId: "demo-body-cda-arga-seguros",
  },
  {
    scenario: "JUNTA_UNIVERSAL_FAIL_99",
    entityId: "demo-entity-arga-seguros-sa",
    bodyId: "demo-body-cda-arga-seguros",
  },
  {
    scenario: "VETO_BLOCK",
    entityId: "demo-entity-cartera-arga-slu",
    bodyId: "demo-body-admin-unico-cartera",
  },
  {
    scenario: "DOBLE_UMBRAL_FAIL",
    entityId: "demo-entity-arga-seguros-sa",
    bodyId: "demo-body-cda-arga-seguros",
  },
  {
    scenario: "CONFLICTO_EXCLUSION_OK",
    entityId: "demo-entity-arga-seguros-sa",
    bodyId: "demo-body-cda-arga-seguros",
  },
];

export function getDemoPackBinding(scenario: DemoScenarioId) {
  return demoPackScenarioBindings.find((binding) => binding.scenario === scenario);
}

export function getDemoPackEntity(entityId: string) {
  return argaDemoPackEntities.find((entity) => entity.id === entityId);
}
