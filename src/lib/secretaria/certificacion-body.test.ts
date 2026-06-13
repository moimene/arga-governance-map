import { describe, it, expect } from "vitest";
import { buildCertificacionBody } from "./certificacion-body";

describe("buildCertificacionBody", () => {
  const base = {
    certificanteCargoLabel: "Secretario",
    certificanteNombre: "Lucía Paredes Vega",
    entidadNombre: "ARGA Seguros, S.A.",
    organoNombre: "Consejo de Administración",
    numAcuerdos: 3,
    fechaISO: "2026-06-13T10:00:00Z",
  };

  it("compone un cuerpo de certificación con certificante, órgano y nº de acuerdos", () => {
    const body = buildCertificacionBody(base);
    expect(body).toContain("CERTIFIC");
    expect(body).toContain("Lucía Paredes Vega");
    expect(body).toContain("Secretario");
    expect(body).toContain("ARGA Seguros, S.A.");
    expect(body).toContain("Consejo de Administración");
    expect(body).toContain("art. 109");
    // el nº de acuerdos certificados aparece
    expect(body).toMatch(/\b3\b/);
  });

  it("incluye el Vº Bº cuando hay visto bueno", () => {
    const body = buildCertificacionBody({
      ...base,
      vistoBuenoCargoLabel: "Presidente",
      vistoBuenoNombre: "Antonio Ríos Valverde",
    });
    expect(body).toMatch(/V\.?º?\s*B\.?º?|Visto bueno/i);
    expect(body).toContain("Antonio Ríos Valverde");
  });

  it("omite el bloque de Vº Bº cuando no hay visto bueno (p.ej. administrador único)", () => {
    const body = buildCertificacionBody({
      certificanteCargoLabel: "Administrador único",
      certificanteNombre: "Pedro Gómez",
      entidadNombre: "Filial ARGA S.L.U.",
      numAcuerdos: 1,
      fechaISO: "2026-06-13T10:00:00Z",
    });
    expect(body).toContain("Pedro Gómez");
    expect(body).not.toContain("Visto bueno");
  });

  it("es determinista (no usa la fecha del sistema, usa fechaISO)", () => {
    const a = buildCertificacionBody(base);
    const b = buildCertificacionBody(base);
    expect(a).toBe(b);
    expect(a).toContain("13");
  });
});
