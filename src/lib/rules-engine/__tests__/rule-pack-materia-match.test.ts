import { describe, it, expect } from "vitest";
import { rulePackMateriaMatches } from "../rule-resolution";

// W5/remediación — el matcher de pack por materia debe ser alias-aware: un
// agreement_kind con grafía legacy (p.ej. MOD_ESTATUTOS) debe casar con el pack
// canónico (MODIFICACION_ESTATUTOS). Antes useAgreementCompliance hacía match
// exacto sin alias, por lo que tras retirar el pack legacy esos acuerdos no
// resolvían ninguna regla (bug latente para TODA grafía aliased).
describe("rulePackMateriaMatches (alias-aware)", () => {
  it("casa por igualdad exacta", () => {
    expect(rulePackMateriaMatches("MODIFICACION_ESTATUTOS", "MODIFICACION_ESTATUTOS")).toBe(true);
  });

  it("casa grafía legacy del agreement con pack canónico", () => {
    expect(rulePackMateriaMatches("MODIFICACION_ESTATUTOS", "MOD_ESTATUTOS")).toBe(true);
  });

  it("casa grafía legacy del pack con agreement canónico", () => {
    expect(rulePackMateriaMatches("MOD_ESTATUTOS", "MODIFICACION_ESTATUTOS")).toBe(true);
  });

  it("casa otra grafía aliased (AMPLIACION_CAPITAL ↔ AUMENTO_CAPITAL)", () => {
    expect(rulePackMateriaMatches("AUMENTO_CAPITAL", "AMPLIACION_CAPITAL")).toBe(true);
  });

  it("no casa materias distintas", () => {
    expect(rulePackMateriaMatches("APROBACION_CUENTAS", "MODIFICACION_ESTATUTOS")).toBe(false);
  });

  it("no casa con pack nulo/indefinido", () => {
    expect(rulePackMateriaMatches(null, "MODIFICACION_ESTATUTOS")).toBe(false);
    expect(rulePackMateriaMatches(undefined, "MODIFICACION_ESTATUTOS")).toBe(false);
  });
});
