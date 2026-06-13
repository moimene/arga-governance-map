import { describe, it, expect } from "vitest";
import { evaluarAutorizacionesRegulatorias } from "./autorizaciones-regulatorias";

// W7 — evaluador puro de autorizaciones regulatorias sectoriales (G13).
// Para una entidad regulada (asegurador ES), ciertas materias exigen
// autorización previa del supervisor (DGSFP). El evaluador devuelve required/
// present/missing/expired y un flag blocking, alias-aware en la materia.
const HOY = "2026-06-13T00:00:00Z";

describe("evaluarAutorizacionesRegulatorias", () => {
  it("entidad NO regulada → sin requisitos, no bloqueante", () => {
    const r = evaluarAutorizacionesRegulatorias({
      materia: "FUSION",
      esEntidadRegulada: false,
      sectorRegulado: null,
      jurisdiccion: "ES",
      autorizaciones: [],
      hoyISO: HOY,
    });
    expect(r.required).toEqual([]);
    expect(r.blocking).toBe(false);
  });

  it("asegurador ES + materia estructural sin autorización → DGSFP requerida y faltante (blocking)", () => {
    const r = evaluarAutorizacionesRegulatorias({
      materia: "FUSION",
      esEntidadRegulada: true,
      sectorRegulado: "SEGUROS",
      jurisdiccion: "ES",
      autorizaciones: [],
      hoyISO: HOY,
    });
    expect(r.required).toContain("DGSFP");
    expect(r.missing).toContain("DGSFP");
    expect(r.blocking).toBe(true);
  });

  it("con autorización DGSFP vigente → presente, no bloqueante", () => {
    const r = evaluarAutorizacionesRegulatorias({
      materia: "FUSION",
      esEntidadRegulada: true,
      sectorRegulado: "SEGUROS",
      jurisdiccion: "ES",
      autorizaciones: [
        { organismo: "DGSFP", estado: "VIGENTE", fechaVigenciaHasta: "2026-12-31" },
      ],
      hoyISO: HOY,
    });
    expect(r.present).toContain("DGSFP");
    expect(r.missing).toEqual([]);
    expect(r.blocking).toBe(false);
  });

  it("con autorización DGSFP caducada por fecha → expired y bloqueante", () => {
    const r = evaluarAutorizacionesRegulatorias({
      materia: "FUSION",
      esEntidadRegulada: true,
      sectorRegulado: "SEGUROS",
      jurisdiccion: "ES",
      autorizaciones: [
        { organismo: "DGSFP", estado: "VIGENTE", fechaVigenciaHasta: "2026-01-01" },
      ],
      hoyISO: HOY,
    });
    expect(r.expired).toContain("DGSFP");
    expect(r.blocking).toBe(true);
  });

  it("materia ordinaria (aprobación de cuentas) no exige autorización", () => {
    const r = evaluarAutorizacionesRegulatorias({
      materia: "APROBACION_CUENTAS",
      esEntidadRegulada: true,
      sectorRegulado: "SEGUROS",
      jurisdiccion: "ES",
      autorizaciones: [],
      hoyISO: HOY,
    });
    expect(r.required).toEqual([]);
    expect(r.blocking).toBe(false);
  });

  it("es alias-aware en la materia (grafía legacy estructural)", () => {
    const r = evaluarAutorizacionesRegulatorias({
      materia: "OPERACION_ESTRUCTURAL",
      esEntidadRegulada: true,
      sectorRegulado: "SEGUROS",
      jurisdiccion: "ES",
      autorizaciones: [],
      hoyISO: HOY,
    });
    expect(r.required).toContain("DGSFP");
  });

  it("grafías estructurales agregadas (FUSION_ESCISION, VENTA_ACTIVOS_SUSTANCIALES, MODIFICACION_OBJETO) disparan DGSFP", () => {
    for (const materia of ["FUSION_ESCISION", "VENTA_ACTIVOS_SUSTANCIALES", "MODIFICACION_OBJETO"]) {
      const r = evaluarAutorizacionesRegulatorias({
        materia,
        esEntidadRegulada: true,
        sectorRegulado: "SEGUROS",
        jurisdiccion: "ES",
        autorizaciones: [],
        hoyISO: HOY,
      });
      expect(r.required, materia).toContain("DGSFP");
    }
  });

  it("asegurador NO español (PT) no exige DGSFP (gate específico de ES)", () => {
    const r = evaluarAutorizacionesRegulatorias({
      materia: "FUSION",
      esEntidadRegulada: true,
      sectorRegulado: "SEGUROS",
      jurisdiccion: "PT",
      autorizaciones: [],
      hoyISO: HOY,
    });
    expect(r.required).toEqual([]);
    expect(r.blocking).toBe(false);
  });
});
