import { describe, it, expect } from "vitest";
import {
  evaluateRepresentacionWarnings,
  type RepresentacionWarningInput,
} from "@/lib/secretaria/representacion-validations";

const base: RepresentacionWarningInput = {
  scope: "JUNTA_PROXY",
  entityIsCotizada: false,
  entityTipoSocial: "SA",
  representanteEsConsejero: false,
  representadoEsConsejero: false,
  representanteEsEjecutivo: false,
  documentoRefPresente: true,
};

function codes(input: RepresentacionWarningInput): string[] {
  return evaluateRepresentacionWarnings(input).map((w) => w.code);
}

describe("evaluateRepresentacionWarnings", () => {
  it("SA junta sin nada que advertir devuelve lista vacía", () => {
    expect(evaluateRepresentacionWarnings(base)).toEqual([]);
  });

  it("art. 183 LSC: JUNTA_PROXY en SL emite warning de círculo restringido", () => {
    const result = codes({ ...base, entityTipoSocial: "SL" });
    expect(result).toContain("ART_183_LSC_SL_CIRCULO_RESTRINGIDO");
  });

  it("art. 183 LSC: aplica también a SLU", () => {
    expect(codes({ ...base, entityTipoSocial: "SLU" })).toContain(
      "ART_183_LSC_SL_CIRCULO_RESTRINGIDO",
    );
  });

  it("art. 183 LSC: NO aplica a SA ni en CONSEJO_DELEGACION", () => {
    expect(codes({ ...base, entityTipoSocial: "SA" })).not.toContain(
      "ART_183_LSC_SL_CIRCULO_RESTRINGIDO",
    );
    expect(
      codes({ ...base, scope: "CONSEJO_DELEGACION", entityTipoSocial: "SL" }),
    ).not.toContain("ART_183_LSC_SL_CIRCULO_RESTRINGIDO");
  });

  it("art. 529 quáter LSC: cotizada + delegado no consejero emite warning", () => {
    const result = codes({
      ...base,
      scope: "CONSEJO_DELEGACION",
      entityIsCotizada: true,
      representanteEsConsejero: false,
    });
    expect(result).toContain("ART_529_QUATER_LSC_DELEGADO_NO_CONSEJERO");
  });

  it("art. 529 quáter LSC: no ejecutivo delega en ejecutivo emite warning de distinto carácter", () => {
    const result = codes({
      ...base,
      scope: "CONSEJO_DELEGACION",
      entityIsCotizada: true,
      representadoEsConsejero: true,
      representanteEsConsejero: true,
      representanteEsEjecutivo: true,
    });
    expect(result).toContain("ART_529_QUATER_LSC_CARACTER_DISTINTO");
    expect(result).not.toContain("ART_529_QUATER_LSC_DELEGADO_NO_CONSEJERO");
  });

  it("art. 529 quáter LSC: NO aplica si la sociedad no es cotizada", () => {
    const result = codes({
      ...base,
      scope: "CONSEJO_DELEGACION",
      entityIsCotizada: false,
      representanteEsConsejero: false,
    });
    expect(result).not.toContain("ART_529_QUATER_LSC_DELEGADO_NO_CONSEJERO");
    expect(result).not.toContain("ART_529_QUATER_LSC_CARACTER_DISTINTO");
  });

  it("ARGA (cotizada SA) en consejo con delegado consejero no ejecutivo: sin warnings 529", () => {
    const result = codes({
      scope: "CONSEJO_DELEGACION",
      entityIsCotizada: true,
      entityTipoSocial: "SA",
      representadoEsConsejero: true,
      representanteEsConsejero: true,
      representanteEsEjecutivo: false,
      documentoRefPresente: true,
    });
    expect(result).toEqual([]);
  });

  it("evidencia: documento de poder ausente emite recordatorio", () => {
    expect(codes({ ...base, documentoRefPresente: false })).toContain(
      "EVIDENCIA_DOCUMENTO_PODER",
    );
  });

  it("cada warning cita su artículo", () => {
    const result = evaluateRepresentacionWarnings({
      ...base,
      entityTipoSocial: "SL",
      documentoRefPresente: false,
    });
    expect(result.every((w) => w.articulo.length > 0)).toBe(true);
  });
});
