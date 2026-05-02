import { describe, expect, it } from "vitest";
import {
  buildPrototypeMeetingRulePackFallback,
  resolveCloudMeetingRulePacksStrict,
  resolvePrototypeMeetingRulePacks,
  uniqueMeetingRuleSpecs,
} from "../prototype-rule-pack-fallback";
import type { RulePack, RuleResolution } from "@/lib/rules-engine";

const resolvedPack: RulePack = buildPrototypeMeetingRulePackFallback(
  { materia: "APROBACION_CUENTAS", clase: "ORDINARIA" },
  "CONSEJO",
);

function resolution(pack: RulePack | null): RuleResolution {
  return {
    ok: Boolean(pack),
    severity: pack ? "OK" : "BLOCKING",
    rulePack: pack
      ? {
          versionId: `${pack.id}@1`,
          packId: pack.id,
          version: "1.0.0",
          lifecycleStatus: "ACTIVE",
          isProductionUsable: true,
          materia: pack.materia,
          clase: pack.clase,
          organoTipo: pack.organoTipo,
          nombre: null,
          descripcion: null,
          payload: pack,
          persistedPayloadHash: "hash",
          payloadHash: "hash",
          effectiveFrom: null,
          effectiveTo: null,
          createdAt: null,
          sourceShape: "LEGACY_IS_ACTIVE",
          warnings: [],
        }
      : null,
    applicableOverrides: [],
    rulesetSnapshotId: pack ? "snapshot" : null,
    explain: [],
    blocking_issues: pack ? [] : ["missing"],
    warnings: [],
  };
}

describe("prototype-rule-pack-fallback", () => {
  it("deduplica materias para alinear specs con resoluciones Cloud", () => {
    const specs = uniqueMeetingRuleSpecs([
      { materia: "APROBACION_CUENTAS", clase: "ORDINARIA" },
      { materia: "APROBACION_CUENTAS", clase: "ORDINARIA" },
      { materia: "NOMBRAMIENTO_CONSEJERO", clase: "ORDINARIA" },
    ]);

    expect(specs).toEqual([
      { materia: "APROBACION_CUENTAS", clase: "ORDINARIA" },
      { materia: "NOMBRAMIENTO_CONSEJERO", clase: "ORDINARIA" },
    ]);
  });

  it("usa el payload Cloud compatible cuando existe", () => {
    const result = resolvePrototypeMeetingRulePacks(
      [{ materia: "APROBACION_CUENTAS", clase: "ORDINARIA" }],
      [resolution(resolvedPack)],
      "CONSEJO",
    );

    expect(result.hasFallback).toBe(false);
    expect(result.packs[0]).toBe(resolvedPack);
  });

  it("crea fallback tecnico cerrado cuando Cloud no aporta payload utilizable", () => {
    const result = resolvePrototypeMeetingRulePacks(
      [{ materia: "NOMBRAMIENTO_CONSEJERO", clase: "ORDINARIA" }],
      [resolution(null)],
      "CONSEJO",
    );

    expect(result.hasFallback).toBe(true);
    expect(result.fallbackPackIds[0]).toContain("prototype-meeting-CONSEJO-NOMBRAMIENTO_CONSEJERO");
    expect(result.packs[0].reglaEspecifica?.prototype_fallback).toBe(true);
    expect(result.packs[0].reglaEspecifica?.source_of_truth).toBe("none");
    expect(result.packs[0].votacion.mayoria.CONSEJO.formula).toBe("mayoria_consejeros");
  });

  it("no reutiliza un pack Cloud de otro organo para una reunion de consejo", () => {
    const juntaPack: RulePack = {
      ...resolvedPack,
      id: "junta-nombramiento",
      materia: "NOMBRAMIENTO_CONSEJERO",
      organoTipo: "JUNTA_GENERAL",
    };
    const result = resolvePrototypeMeetingRulePacks(
      [{ materia: "NOMBRAMIENTO_CONSEJERO", clase: "ORDINARIA" }],
      [resolution(juntaPack)],
      "CONSEJO",
    );

    expect(result.hasFallback).toBe(true);
    expect(result.packs[0].id).toContain("prototype-meeting-CONSEJO-NOMBRAMIENTO_CONSEJERO");
  });

  it("resuelve modo Cloud estricto sin crear fallback", () => {
    const result = resolveCloudMeetingRulePacksStrict(
      [
        { materia: "APROBACION_CUENTAS", clase: "ORDINARIA" },
        { materia: "NOMBRAMIENTO_CONSEJERO", clase: "ORDINARIA" },
      ],
      [resolution(resolvedPack)],
      "CONSEJO",
    );

    expect(result.packs).toEqual([resolvedPack]);
    expect(result.missingSpecs).toEqual([{ materia: "NOMBRAMIENTO_CONSEJERO", clase: "ORDINARIA" }]);
    expect(result.warnings).toContain("missing_cloud_rule_pack:CONSEJO:NOMBRAMIENTO_CONSEJERO:ORDINARIA");
  });
});
