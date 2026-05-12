import { describe, it, expect } from "vitest";
import { ORGANO_CANONICO, ORGANO_ALIAS, normalizeOrganoTipo, isOrganoCanonico } from "../organo-canonico";

describe("organo-canonico", () => {
  it("acepta los 10 valores canónicos", () => {
    const canonicos = [
      "JUNTA_GENERAL", "CONSEJO_ADMIN", "ORGANO_ADMIN",
      "SOCIO_UNICO", "ADMIN_UNICO",
      "ADMIN_CONJUNTA_O_COAPROBADORES", "ADMIN_SOLIDARIOS",
      "COMISION_DELEGADA", "SOPORTE_INTERNO", "DERIVADO_DEL_ACTO",
    ];
    for (const v of canonicos) {
      expect(isOrganoCanonico(v)).toBe(true);
      expect(normalizeOrganoTipo(v)).toBe(v);
    }
  });

  it("normaliza CONSEJO_ADMINISTRACION → CONSEJO_ADMIN", () => {
    expect(normalizeOrganoTipo("CONSEJO_ADMINISTRACION")).toBe("CONSEJO_ADMIN");
  });

  it("normaliza CONSEJO → CONSEJO_ADMIN", () => {
    expect(normalizeOrganoTipo("CONSEJO")).toBe("CONSEJO_ADMIN");
  });

  it("normaliza ADMIN_CONJUNTA → ADMIN_CONJUNTA_O_COAPROBADORES", () => {
    expect(normalizeOrganoTipo("ADMIN_CONJUNTA")).toBe("ADMIN_CONJUNTA_O_COAPROBADORES");
  });

  it("normaliza ADMIN_SOLIDARIO → ADMIN_SOLIDARIOS", () => {
    expect(normalizeOrganoTipo("ADMIN_SOLIDARIO")).toBe("ADMIN_SOLIDARIOS");
  });

  it("normaliza case-insensitive (consejo_administracion → CONSEJO_ADMIN)", () => {
    expect(normalizeOrganoTipo("consejo_administracion")).toBe("CONSEJO_ADMIN");
  });

  it("devuelve null para valores inválidos", () => {
    expect(normalizeOrganoTipo("XXX_INVENTADO")).toBeNull();
    expect(normalizeOrganoTipo("")).toBeNull();
    expect(normalizeOrganoTipo(null)).toBeNull();
  });

  it("isOrganoCanonico rechaza alias sin normalizar", () => {
    expect(isOrganoCanonico("CONSEJO_ADMINISTRACION")).toBe(false);
    expect(isOrganoCanonico("CONSEJO")).toBe(false);
  });

  it("ORGANO_ALIAS contiene exactamente los 4 aliases acordados", () => {
    expect(Object.keys(ORGANO_ALIAS).sort()).toEqual(
      ["ADMIN_CONJUNTA", "ADMIN_SOLIDARIO", "CONSEJO", "CONSEJO_ADMINISTRACION"].sort(),
    );
  });

  it("ORGANO_CANONICO tiene 10 entradas", () => {
    expect(ORGANO_CANONICO.length).toBe(10);
  });
});
