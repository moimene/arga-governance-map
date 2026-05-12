/**
 * Tests para `checkNoticePeriodByType` (V1 motor de antelación).
 *
 * Cubre los hallazgos Codex iterativos sobre el dispatch organoTipo del
 * PR #3:
 *   - round 2 (commit de857fb): dispatch JGA/CdA/Comisión
 *   - round 14 (P2 round 14): bypass SLU/SAU SÓLO para juntas, no consejos
 *
 * Mock de Date para que `diffDays` sea determinista. La función no usa
 * tenant context ni TanStack Query, así que el test es puro.
 */

import { describe, it, expect } from "vitest";
import { checkNoticePeriodByType } from "../useJurisdiccionRules";

// La función calcula `diffDays = floor((meetingDate - today) / day)`. No
// mockeamos Date — usamos meetings con offsets relativos al `Date.now()`
// que se evalúa en cada llamada. Pequeño jitter por ejecución (<1ms)
// nunca cambia el floor de un offset entero de días.
const futureDate = (daysAhead: number) =>
  new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000 + 60_000).toISOString();

describe("checkNoticePeriodByType — dispatch por organoTipo", () => {
  describe("UNIVERSAL", () => {
    it("UNIVERSAL siempre pasa (no plazo)", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(0),
          jurisdiction: "ES",
          convocationType: "UNIVERSAL",
          tipoSocial: "SA",
        }),
      ).toBe(true);
    });
  });

  describe("Junta General (LSC art. 176)", () => {
    it("Junta SA ES con 30 días → OK", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(30),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SA",
          organoTipo: "JGA",
        }),
      ).toBe(true);
    });

    it("Junta SA ES con 5 días → falla (< 30)", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(5),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SA",
          organoTipo: "JGA",
        }),
      ).toBe(false);
    });
  });

  describe("CdA (art. 246 LSC / reglamento)", () => {
    it("CdA SA con 5 días → OK", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(5),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SA",
          organoTipo: "CDA",
        }),
      ).toBe(true);
    });

    it("CdA SA con 2 días → falla (< 5)", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(2),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SA",
          organoTipo: "CDA",
        }),
      ).toBe(false);
    });

    it("CONSEJO_ADMINISTRACION matching liberal: 5 días → OK", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(5),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SA",
          organoTipo: "CONSEJO_ADMINISTRACION",
        }),
      ).toBe(true);
    });
  });

  describe("Comisiones (3 días por reglamento)", () => {
    it("Comisión delegada con 3 días → OK", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(3),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SA",
          organoTipo: "COMISION_DELEGADA",
        }),
      ).toBe(true);
    });

    it("Comité con 1 día → falla (< 3)", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(1),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SA",
          organoTipo: "COMITE",
        }),
      ).toBe(false);
    });
  });

  // Codex P2 round 14 PR #3: el bypass SLU/SAU SÓLO exime juntas.
  describe("bypass SLU/SAU — sólo aplica a juntas (Codex round 14)", () => {
    it("Junta SLU con 0 días → OK (art. 173.3 LSC: socio único sin convocatoria)", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(0),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SLU",
          organoTipo: "JGA",
        }),
      ).toBe(true);
    });

    it("Junta SAU con 0 días → OK (art. 173.3 LSC: SA unipersonal)", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(0),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SAU",
          organoTipo: "JGA",
        }),
      ).toBe(true);
    });

    it("CdA de SLU con 2 días → falla (reglamento del consejo exige 5)", () => {
      // Antes del round 14, el bypass `tipoSocial==='SLU'` se ejecutaba
      // antes del check organoTipo y devolvía true. Ahora el bypass está
      // DENTRO del bloque junta — para CdA se aplica el plazo del órgano.
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(2),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SLU",
          organoTipo: "CDA",
        }),
      ).toBe(false);
    });

    it("CdA de SAU con 5 días → OK (reglamento default 5)", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(5),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SAU",
          organoTipo: "CDA",
        }),
      ).toBe(true);
    });

    it("Comisión de SLU con 1 día → falla (3 días reglamento)", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(1),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SLU",
          organoTipo: "COMISION_DELEGADA",
        }),
      ).toBe(false);
    });
  });

  describe("organoTipo undefined (compat legacy)", () => {
    it("sin organoTipo, SA con 30 días → asume junta y OK", () => {
      expect(
        checkNoticePeriodByType({
          meetingDate: futureDate(30),
          jurisdiction: "ES",
          convocationType: "ORDINARIA",
          tipoSocial: "SA",
        }),
      ).toBe(true);
    });
  });
});
