import { describe, expect, it } from "vitest";
import {
  applyTipoSocialDefaults,
  createEmptySociedadDraft,
  deriveJuntaName,
  deriveNominalValue,
  isUnipersonalTipo,
  legalFormFromTipo,
  tipoTituloFromTipo,
} from "../defaults";
import { filterSettingsByCatalog } from "../catalog-loader";

describe("sociedad onboarding defaults and operability helpers", () => {
  it("derives legal form and title type from social type", () => {
    expect(legalFormFromTipo("SA")).toBe("S.A.");
    expect(legalFormFromTipo("SLU")).toBe("S.L.U.");
    expect(tipoTituloFromTipo("SAU")).toBe("ACCION");
    expect(tipoTituloFromTipo("SL")).toBe("PARTICIPACION");
  });

  it("locks unipersonal defaults for SAU/SLU", () => {
    const draft = createEmptySociedadDraft("2026-05-12");
    const next = applyTipoSocialDefaults(draft, "SAU");

    expect(isUnipersonalTipo("SAU")).toBe(true);
    expect(next.profile.es_unipersonal).toBe(true);
    expect(next.capital.tipo_titulo).toBe("ACCION");
  });

  it("keeps SA/SL editable as non-unipersonal", () => {
    const draft = createEmptySociedadDraft("2026-05-12");
    const next = applyTipoSocialDefaults(draft, "SL");

    expect(isUnipersonalTipo("SL")).toBe(false);
    expect(next.profile.es_unipersonal).toBe(false);
  });

  it("derives Junta/Socio Unico names", () => {
    expect(deriveJuntaName("SLU")).toBe("Socio unico");
    expect(deriveJuntaName("SA")).toBe("Junta General de Accionistas");
  });

  it("derives nominal value conservatively", () => {
    expect(deriveNominalValue("3000", "3000")).toBe("1");
    expect(deriveNominalValue("3000", "0")).toBe("");
  });

  it("filters entity settings by catalog keys", () => {
    const filtered = filterSettingsByCatalog(
      [
        { key: "known", value: true },
        { key: "unknown", value: false },
      ],
      new Set(["known"]),
    );

    expect(filtered).toEqual([{ key: "known", value: true }]);
  });
});
