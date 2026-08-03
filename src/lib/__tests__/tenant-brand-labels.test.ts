import { describe, expect, it } from "vitest";
import {
  brandName,
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

  it("strings vacíos o de espacios caen al default", () => {
    expect(shellLabel({ shell_label: "  " })).toBe("TGMS PLATFORM");
    expect(scopeLabel({ scope_label: "" })).toBe("Grupo ARGA");
  });

  it("valor no-string (branding JSONB futuro con label numérico) cae al default", () => {
    expect(shellLabel({ shell_label: 123 as unknown as string })).toBe("TGMS PLATFORM");
  });
});
