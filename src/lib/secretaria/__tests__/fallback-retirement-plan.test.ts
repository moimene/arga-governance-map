import { describe, expect, test } from "vitest";
import {
  evaluateFallbackRetirement,
  getFallbackRetirementItemsByPriority,
  getRulePackSeedTargetsByPriority,
  RULE_PACK_SEED_TARGETS_V21,
  SECRETARIA_FALLBACK_RETIREMENT_ITEMS,
  summarizeFallbackRetirement,
} from "../fallback-retirement-plan";

describe("fallback-retirement-plan", () => {
  test("mantiene inventario P0 de fallbacks que bloquean produccion juridica", () => {
    const p0 = getFallbackRetirementItemsByPriority("P0");

    expect(p0.length).toBe(SECRETARIA_FALLBACK_RETIREMENT_ITEMS.length);
    expect(p0.every((item) => item.blocksProductionLegalDefensibility)).toBe(true);
    expect(p0.map((item) => item.key)).toContain("prototype-meeting-rule-pack");
    expect(p0.map((item) => item.key)).toContain("prototype-registry-rule-pack");
    expect(p0.map((item) => item.key)).toContain("meeting-point-snapshots-json");
  });

  test("explicita huecos criticos CO_APROBACION y SOLIDARIO", () => {
    const keys = SECRETARIA_FALLBACK_RETIREMENT_ITEMS.map((item) => item.key);

    expect(keys).toContain("co-aprobacion-template-gap");
    expect(keys).toContain("solidario-template-gap");
    expect(
      SECRETARIA_FALLBACK_RETIREMENT_ITEMS.find((item) => item.key === "co-aprobacion-template-gap")?.target.templateTarget,
    ).toBe("ACTA_DECISION_CONJUNTA");
    expect(
      SECRETARIA_FALLBACK_RETIREMENT_ITEMS.find((item) => item.key === "solidario-template-gap")?.target.templateTarget,
    ).toBe("ACTA_ORGANO_ADMIN");
  });

  test("prioriza rule packs P0 que sustituyen reglas materiales criticas", () => {
    const p0 = getRulePackSeedTargetsByPriority("P0").map((target) => target.packId);

    expect(p0).toEqual([
      "DELEGACION_FACULTADES",
      "DIVIDENDO_A_CUENTA",
      "OPERACION_VINCULADA",
      "AUTORIZACION_GARANTIA",
    ]);
  });

  test("no considera eliminado un fallback hasta cumplir los cinco criterios", () => {
    expect(evaluateFallbackRetirement({}).eliminated).toBe(false);
    expect(
      evaluateFallbackRetirement({
        cloudRulePackActive: true,
        engineV2ConsumesPack: true,
        cloudTemplateApproved: true,
        fallbackDeprecatedOrRemoved: true,
      }),
    ).toEqual({
      eliminated: false,
      missingCriteria: ["funcion V1 convertida en wrapper V2 o eliminada"],
    });
    expect(
      evaluateFallbackRetirement({
        cloudRulePackActive: true,
        engineV2ConsumesPack: true,
        cloudTemplateApproved: true,
        fallbackDeprecatedOrRemoved: true,
        legacyWrapperConverted: true,
      }),
    ).toEqual({ eliminated: true, missingCriteria: [] });
  });

  test("resume alcance de retirada sin consultar Supabase", () => {
    const summary = summarizeFallbackRetirement();

    expect(summary.totalFallbacks).toBe(10);
    expect(summary.productionBlockingFallbacks).toBe(10);
    expect(summary.totalRulePackSeedTargets).toBe(RULE_PACK_SEED_TARGETS_V21.length);
    expect(summary.seedTargetsByPriority).toEqual({ P0: 4, P1: 8, P2: 4 });
  });
});
