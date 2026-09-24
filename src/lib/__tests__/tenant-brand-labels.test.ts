import { describe, expect, it } from "vitest";
import {
  brandName,
  groupFullLabel,
  groupPortfolioLabel,
  scopeLabel,
  shellLabel,
  siiOrgLabel,
} from "@/lib/tenant-brand-labels";

describe("tenant-brand-labels — defaults ARGA verbatim con branding null", () => {
  it("null → strings actuales exactos (contrato: cero cambio visual ARGA)", () => {
    expect(shellLabel(null)).toBe("TGMS PLATFORM");
    expect(scopeLabel(null)).toBe("Grupo ARGA");
    expect(siiOrgLabel(null)).toBe("Grupo ARGA Seguros");
    expect(brandName(null)).toBe("TGMS");
  });

  it("branding poblado → labels del tenant", () => {
    const b = {
      nombre: "Garrigues",
      shell_label: "GARRIGUES GOBERNANZA",
      scope_label: "Grupo Garrigues",
      sii_org_label: "Garrigues",
    };
    expect(shellLabel(b)).toBe("GARRIGUES GOBERNANZA");
    expect(scopeLabel(b)).toBe("Grupo Garrigues");
    expect(siiOrgLabel(b)).toBe("Garrigues");
    expect(brandName(b)).toBe("Garrigues");
  });

  it("strings vacíos o de espacios caen al default neutro en tenant no nulo", () => {
    expect(shellLabel({ shell_label: "  " })).toBe("TGMS PLATFORM");
    expect(scopeLabel({ scope_label: "" })).toBe("Grupo");
    expect(siiOrgLabel({ sii_org_label: "  " })).toBe("Entidad");
    expect(brandName({ nombre: "" })).toBe("Grupo");
  });

  it("valor no-string (branding JSONB futuro con label numérico) cae al fallback neutro", () => {
    expect(shellLabel({ shell_label: 123 as unknown as string })).toBe("TGMS PLATFORM");
    expect(scopeLabel({ scope_label: 123 as unknown as string })).toBe("Grupo");
  });

  it("tenant con marca pero sin scope_label deriva de su propio nombre, jamás de ARGA", () => {
    const b = { nombre: "Grupo Nuevo" };
    expect(scopeLabel(b)).toBe("Grupo Nuevo");
    expect(groupFullLabel(b)).toBe("Grupo Nuevo");
    expect(siiOrgLabel(b)).toBe("Grupo Nuevo");
    expect(brandName(b)).toBe("Grupo Nuevo");
    expect(groupPortfolioLabel(b)).toBe("Vista de grupo: cartera societaria Grupo Nuevo");

    const acme = { nombre: "Acme" };
    expect(scopeLabel(acme)).toBe("Acme");
    expect(groupFullLabel(acme)).toBe("Grupo Acme");
    expect(siiOrgLabel(acme)).toBe("Acme");
    expect(brandName(acme)).toBe("Acme");
  });

  it("tenant con branding vacío o solo fixtures ('none') no hereda rótulos de ARGA", () => {
    const b = { fixtures: "none" };
    expect(scopeLabel(b)).toBe("Grupo");
    expect(groupFullLabel(b)).toBe("Grupo");
    expect(siiOrgLabel(b)).toBe("Entidad");
    expect(brandName(b)).toBe("Grupo");
    expect(groupPortfolioLabel(b)).toBe("Vista de grupo: cartera societaria Grupo");
  });
});

describe("labels de grupo — defaults ARGA verbatim solo con null", () => {
  it("null → strings actuales exactos (contrato cero cambio ARGA)", () => {
    expect(groupFullLabel(null)).toBe("Grupo ARGA Seguros");
    expect(groupPortfolioLabel(null)).toBe("Vista de grupo: cartera societaria ARGA");
  });
  it("branding → etiquetas del tenant", () => {
    const b = { nombre: "Garrigues", scope_label: "Grupo Garrigues" };
    expect(groupFullLabel(b)).toBe("Grupo Garrigues");
    expect(groupPortfolioLabel(b)).toBe("Vista de grupo: cartera societaria Garrigues");
  });
});
