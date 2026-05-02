import { describe, expect, test } from "vitest";
import {
  buildPrototypeRegistryRulePackFallback,
  buildPrototypeRegistryRulePayload,
} from "../prototype-registry-rule-fallback";

const baseAgreement = {
  id: "agreement-1",
  tenant_id: "tenant-1",
  agreement_kind: "NOMBRAMIENTO_CONSEJERO",
  matter_class: "ORDINARIA",
};

describe("prototype registry rule fallback", () => {
  test("marks appointment matters as registrable through escritura for prototype only", () => {
    const payload = buildPrototypeRegistryRulePayload(baseAgreement);

    expect(payload.inscribible).toBe(true);
    expect(payload.instrumentoRequerido).toBe("ESCRITURA");
    expect(payload.prototype_fallback).toBe(true);
    expect(payload.source_of_truth).toBe("none");
  });

  test("does not make ordinary unknown matters registrable by implication", () => {
    const payload = buildPrototypeRegistryRulePayload({
      ...baseAgreement,
      agreement_kind: "POLITICAS_CORPORATIVAS",
    });

    expect(payload.inscribible).toBe(false);
    expect(payload.instrumentoRequerido).toBe("NINGUNO");
  });

  test("treats structural matters as registrable and publication-sensitive", () => {
    const payload = buildPrototypeRegistryRulePayload({
      ...baseAgreement,
      agreement_kind: "ACTIVOS_ESENCIALES",
      matter_class: "ESTRUCTURAL",
    });

    expect(payload.inscribible).toBe(true);
    expect(payload.instrumentoRequerido).toBe("ESCRITURA");
    expect(payload.publicacionRequerida).toBe(true);
  });

  test("returns deterministic RulePackData without Cloud source-of-truth claims", () => {
    const first = buildPrototypeRegistryRulePackFallback(baseAgreement);
    const second = buildPrototypeRegistryRulePackFallback(baseAgreement);

    expect(first).toEqual(second);
    expect(first.pack.id).toBe("prototype-registry-NOMBRAMIENTO_CONSEJERO");
    expect(first.payload.source_of_truth).toBe("none");
  });
});
