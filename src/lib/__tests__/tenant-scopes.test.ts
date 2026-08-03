import { describe, expect, it } from "vitest";
import { dashboardGreeting, scopesForTenant } from "@/lib/tenant-scopes";
import { scopes as ARGA_SCOPES } from "@/data/scopes";

describe("tenant-scopes — defaults ARGA verbatim con branding null", () => {
  it("branding null → lista ARGA actual y saludo actual, byte a byte", () => {
    expect(scopesForTenant(null)).toEqual(ARGA_SCOPES);
    expect(scopesForTenant(null)[0]).toBe("Grupo ARGA (Global)");
    expect(dashboardGreeting(null)).toBe("Buen día, Lucía");
  });

  it("branding con scopes propios → esa lista", () => {
    const b = { scope_label: "Grupo Garrigues", scopes: ["Grupo Garrigues (Global)", "España", "Portugal"] };
    expect(scopesForTenant(b)).toEqual(["Grupo Garrigues (Global)", "España", "Portugal"]);
  });

  it("branding sin scopes → deriva '<scope_label> (Global)'", () => {
    expect(scopesForTenant({ scope_label: "Grupo Garrigues" })).toEqual(["Grupo Garrigues (Global)"]);
  });

  it("branding presente → saludo sin nombre (la persona llega en G2)", () => {
    expect(dashboardGreeting({ nombre: "Garrigues" })).toBe("Buen día");
  });

  it("scopes con basura (no-strings) → cae al derivado, no revienta", () => {
    expect(scopesForTenant({ scope_label: "X", scopes: [1, 2] as unknown as string[] })).toEqual(["X (Global)"]);
  });
});
