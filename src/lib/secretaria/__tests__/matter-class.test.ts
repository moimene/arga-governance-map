/**
 * Tests para `src/lib/secretaria/matter-class.ts`.
 *
 * Verifica el contrato del helper que filtra materias compatibles con
 * el CHECK constraint `agreements_matter_class_check`. El filtro evita
 * el bug HTTP 400 silencioso documentado en
 * docs/superpowers/plans/2026-05-09-matter-class-especial-filter.md.
 */
import { describe, expect, it } from "vitest";
import {
  AGREEMENT_COMPATIBLE_MATTER_CLASSES,
  filterAgreementCompatibleMaterias,
  isAgreementCompatibleMatterClass,
} from "../matter-class";

describe("matter-class — agreement compatibility", () => {
  it("AGREEMENT_COMPATIBLE_MATTER_CLASSES expone exactamente los 3 valores aceptados por el CHECK", () => {
    // Sólido contra el CHECK SQL: si esto cambia, hay que migrar el CHECK
    // y actualizar la constante simultáneamente.
    expect([...AGREEMENT_COMPATIBLE_MATTER_CLASSES].sort()).toEqual([
      "ESTATUTARIA",
      "ESTRUCTURAL",
      "ORDINARIA",
    ]);
  });

  describe("isAgreementCompatibleMatterClass", () => {
    it("acepta los 3 valores válidos", () => {
      expect(isAgreementCompatibleMatterClass("ORDINARIA")).toBe(true);
      expect(isAgreementCompatibleMatterClass("ESTATUTARIA")).toBe(true);
      expect(isAgreementCompatibleMatterClass("ESTRUCTURAL")).toBe(true);
    });

    it("rechaza 'ESPECIAL' (PACTO_PARASOCIAL / EXCLUSION / SEPARACION)", () => {
      expect(isAgreementCompatibleMatterClass("ESPECIAL")).toBe(false);
    });

    it("rechaza valores ausentes / vacíos / arbitrarios", () => {
      expect(isAgreementCompatibleMatterClass(null)).toBe(false);
      expect(isAgreementCompatibleMatterClass(undefined)).toBe(false);
      expect(isAgreementCompatibleMatterClass("")).toBe(false);
      expect(isAgreementCompatibleMatterClass("OTRO")).toBe(false);
      expect(isAgreementCompatibleMatterClass("ordinaria")).toBe(false); // case-sensitive
    });
  });

  describe("filterAgreementCompatibleMaterias", () => {
    it("filtra rows con matter_class='ESPECIAL' y mantiene los 3 válidos", () => {
      const input = [
        { materia: "APROBACION_CUENTAS", matter_class: "ORDINARIA" },
        { materia: "MOD_ESTATUTOS", matter_class: "ESTATUTARIA" },
        { materia: "FUSION", matter_class: "ESTRUCTURAL" },
        { materia: "PACTO_PARASOCIAL", matter_class: "ESPECIAL" },
        { materia: "EXCLUSION_SOCIO", matter_class: "ESPECIAL" },
        { materia: "SEPARACION_SOCIO", matter_class: "ESPECIAL" },
      ];
      const result = filterAgreementCompatibleMaterias(input);
      expect(result.map((r) => r.materia).sort()).toEqual([
        "APROBACION_CUENTAS",
        "FUSION",
        "MOD_ESTATUTOS",
      ]);
    });

    it("preserva todas las propiedades de los rows válidos (no destructive)", () => {
      const input = [
        { materia: "APROBACION_CUENTAS", matter_class: "ORDINARIA", custom: "x" },
      ];
      const result = filterAgreementCompatibleMaterias(input);
      expect(result).toEqual(input);
    });

    it("devuelve [] para input vacío sin error", () => {
      expect(filterAgreementCompatibleMaterias([])).toEqual([]);
    });

    it("filtra rows con matter_class null/undefined", () => {
      const input = [
        { materia: "X", matter_class: null },
        { materia: "Y", matter_class: undefined },
        { materia: "Z", matter_class: "ORDINARIA" },
      ];
      const result = filterAgreementCompatibleMaterias(input);
      expect(result.map((r) => r.materia)).toEqual(["Z"]);
    });
  });
});
