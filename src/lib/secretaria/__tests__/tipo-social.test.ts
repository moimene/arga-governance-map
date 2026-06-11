import { describe, it, expect } from "vitest";
import { deriveTipoSocial } from "../tipo-social";

describe("deriveTipoSocial", () => {
  it("tipo_social explícito tiene prioridad sobre legal_form", () => {
    expect(deriveTipoSocial({ tipo_social: "SA", legal_form: "S.L." })).toBe("SA");
  });

  it("fixture SL (tipo_social SL / legal_form S.L.) → SL", () => {
    expect(deriveTipoSocial({ tipo_social: "SL", legal_form: "S.L." })).toBe("SL");
  });

  it("formas unipersonales explícitas se conservan", () => {
    expect(deriveTipoSocial({ tipo_social: "SLU" })).toBe("SLU");
    expect(deriveTipoSocial({ tipo_social: "SAU" })).toBe("SAU");
  });

  it("texto 'Sociedad Anónima' (con y sin tilde) → SA", () => {
    expect(deriveTipoSocial({ legal_form: "Sociedad Anónima" })).toBe("SA");
    expect(deriveTipoSocial({ legal_form: "SOCIEDAD ANONIMA" })).toBe("SA");
  });

  it("'S.A.' → SA", () => {
    expect(deriveTipoSocial({ legal_form: "S.A." })).toBe("SA");
  });

  it("fallback null/undefined → SL", () => {
    expect(deriveTipoSocial(null)).toBe("SL");
    expect(deriveTipoSocial(undefined)).toBe("SL");
    expect(deriveTipoSocial({})).toBe("SL");
  });

  it("forma desconocida no asimilable a SA → SL", () => {
    expect(deriveTipoSocial({ legal_form: "Cooperativa" })).toBe("SL");
  });
});
