import { describe, it, expect } from "vitest";
import {
  clasificarCohortePlantilla,
  cohorteLabel,
  cohorteDescripcion,
  COHORTE_ORDER,
} from "./plantilla-cohorte";

// UX-7.B (run-log 2026-06-20) — modelo de cohortes de plantilla. Clasificación
// pura sobre metadatos REALES (estado + binding materia + contrato_variables_version).
// No finge criterio jurídico: solo agrupa por estado de ciclo de vida y completitud.
describe("clasificarCohortePlantilla (UX-7.B)", () => {
  const base = {
    estado: "ACTIVA",
    materia: "APROBACION_CUENTAS",
    materia_acuerdo: "APROBACION_CUENTAS",
    contrato_variables_version: "v1.1",
  };

  it("ACTIVA con binding y contrato de variables → ACTIVA_LISTA", () => {
    expect(clasificarCohortePlantilla(base)).toBe("ACTIVA_LISTA");
  });

  it("ACTIVA sin binding de materia → ACTIVA_SIN_REGLA (precede a metadatos)", () => {
    expect(
      clasificarCohortePlantilla({ ...base, materia: null, materia_acuerdo: null, contrato_variables_version: null }),
    ).toBe("ACTIVA_SIN_REGLA");
  });

  it("ACTIVA con binding pero sin contrato de variables → ACTIVA_METADATOS_INCOMPLETOS", () => {
    expect(clasificarCohortePlantilla({ ...base, contrato_variables_version: null })).toBe(
      "ACTIVA_METADATOS_INCOMPLETOS",
    );
  });

  it("usa materia_acuerdo como binding si materia es null", () => {
    expect(clasificarCohortePlantilla({ ...base, materia: null })).toBe("ACTIVA_LISTA");
  });

  it("BORRADOR / REVISADA / APROBADA → EN_PREPARACION", () => {
    expect(clasificarCohortePlantilla({ ...base, estado: "BORRADOR" })).toBe("EN_PREPARACION");
    expect(clasificarCohortePlantilla({ ...base, estado: "REVISADA" })).toBe("EN_PREPARACION");
    expect(clasificarCohortePlantilla({ ...base, estado: "APROBADA" })).toBe("EN_PREPARACION");
  });

  it("ARCHIVADA / DEPRECADA → HISTORICO", () => {
    expect(clasificarCohortePlantilla({ ...base, estado: "ARCHIVADA" })).toBe("HISTORICO");
    expect(clasificarCohortePlantilla({ ...base, estado: "DEPRECADA" })).toBe("HISTORICO");
  });

  it("estado desconocido o nulo → EN_PREPARACION (conservador, nunca 'lista')", () => {
    expect(clasificarCohortePlantilla({ ...base, estado: "FOO" })).toBe("EN_PREPARACION");
    expect(clasificarCohortePlantilla({ ...base, estado: null })).toBe("EN_PREPARACION");
  });

  it("es case-insensitive en el estado", () => {
    expect(clasificarCohortePlantilla({ ...base, estado: "activa" })).toBe("ACTIVA_LISTA");
  });

  it("cada cohorte tiene label y descripción no vacíos", () => {
    for (const c of COHORTE_ORDER) {
      expect(cohorteLabel(c).length).toBeGreaterThan(0);
      expect(cohorteDescripcion(c).length).toBeGreaterThan(0);
    }
  });
});
