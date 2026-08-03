import { describe, expect, it } from "vitest";
import { resolveAgreementInscribable } from "../useAgreementCompliance";

describe("resolveAgreementInscribable", () => {
  it("conserva el valor materializado cuando el motor parcial no emite la regla", () => {
    expect(resolveAgreementInscribable(true, [])).toBe(true);
  });

  it("respeta una evaluación explícita del motor", () => {
    expect(resolveAgreementInscribable(true, [{ regla: "inscribible", valor: "false" }])).toBe(false);
    expect(resolveAgreementInscribable(false, [{ regla: "inscribible", valor: "true" }])).toBe(true);
  });
});
