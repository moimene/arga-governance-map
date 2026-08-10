import { describe, it, expect } from "vitest";
import { isAdminUnicoCertificante } from "./certificacion-admin-unico";

describe("isAdminUnicoCertificante", () => {
  it("true: ADMIN_UNICO vigente y ningún PRESIDENTE/SECRETARIO fuera de un COMITE", () => {
    expect(isAdminUnicoCertificante([{ cargo: "ADMIN_UNICO", body: null }])).toBe(true);
  });

  it("fix round 1 (I1) — no da falso negativo con un PRESIDENTE de un COMITE consultivo (matriz Garrigues)", () => {
    // Rosa Zarza, presidenta del Consejo de Socios (COMITE consultivo), junto
    // al administrador único Vives (body null). El PRESIDENTE de un comité
    // consultivo no es un órgano de administración colegiado.
    const signingAuthorities = [
      { cargo: "ADMIN_UNICO", body: null },
      { cargo: "PRESIDENTE", body: { body_type: "COMITE" } },
    ];
    expect(isAdminUnicoCertificante(signingAuthorities)).toBe(true);
  });

  it("false: entidad tipo ARGA — PRESIDENTE/SECRETARIO de un órgano de administración real (no COMITE)", () => {
    const signingAuthorities = [
      { cargo: "PRESIDENTE", body: { body_type: "CONSEJO_ADMINISTRACION" } },
      { cargo: "SECRETARIO", body: { body_type: "CONSEJO_ADMINISTRACION" } },
    ];
    expect(isAdminUnicoCertificante(signingAuthorities)).toBe(false);
  });

  it("false: sin ADMIN_UNICO vigente en absoluto", () => {
    expect(isAdminUnicoCertificante([])).toBe(false);
  });

  it("false: ADMIN_UNICO vigente pero también un SECRETARIO de órgano no-COMITE", () => {
    const signingAuthorities = [
      { cargo: "ADMIN_UNICO", body: null },
      { cargo: "SECRETARIO", body: { body_type: "CONSEJO_ADMINISTRACION" } },
    ];
    expect(isAdminUnicoCertificante(signingAuthorities)).toBe(false);
  });
});
