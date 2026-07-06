import { describe, expect, it } from "vitest";
import type { TipoOrgano } from "@/lib/rules-engine";
import {
  AGENDA_MATERIAS,
  ALL_ORGANOS,
  MATERIA_ORGANOS,
  MATERIAS_LIBRES,
  agendaMateriaGroups,
  isMateriaCompatibleWithOrgano,
  labelMateria,
  materiaDefaultForOrgano,
} from "@/lib/secretaria/agenda-materias";

const ORGANOS: TipoOrgano[] = ["JUNTA_GENERAL", "CONSEJO", "COMISION_DELEGADA"];

describe("agenda-materias — catálogo canónico materia × órgano", () => {
  it("todas las materias del catálogo tienen mapeo explícito de órganos", () => {
    const sinMapeo = AGENDA_MATERIAS.filter((m) => !MATERIA_ORGANOS[m.value]);
    expect(sinMapeo.map((m) => m.value)).toEqual([]);
  });

  it("los grupos particionan exactamente las materias compatibles (sin duplicados ni huecos)", () => {
    for (const organo of ORGANOS) {
      const compatibles = AGENDA_MATERIAS.filter((m) => isMateriaCompatibleWithOrgano(m.value, organo)).map(
        (m) => m.value,
      );
      const agrupadas = agendaMateriaGroups(organo).flatMap((g) => g.materias.map((m) => m.value));
      expect([...agrupadas].sort()).toEqual([...compatibles].sort());
      expect(new Set(agrupadas).size).toBe(agrupadas.length);
    }
  });

  it("Junta y Consejo separan sus materias propias (cuentas: aprueba la Junta, formula el Consejo)", () => {
    const propiasJunta = agendaMateriaGroups("JUNTA_GENERAL").find((g) => g.key === "propias")!;
    const propiasConsejo = agendaMateriaGroups("CONSEJO").find((g) => g.key === "propias")!;
    expect(propiasJunta.materias.map((m) => m.value)).toContain("APROBACION_CUENTAS");
    expect(propiasJunta.materias.map((m) => m.value)).not.toContain("FORMULACION_CUENTAS");
    expect(propiasConsejo.materias.map((m) => m.value)).toContain("FORMULACION_CUENTAS");
    expect(propiasConsejo.materias.map((m) => m.value)).not.toContain("APROBACION_CUENTAS");
  });

  it("las transversales (todos los órganos) van en su propio grupo, no en propias", () => {
    for (const organo of ORGANOS) {
      const groups = agendaMateriaGroups(organo);
      const transversales = groups.find((g) => g.key === "transversales");
      expect(transversales?.materias.map((m) => m.value)).toContain("NOMBRAMIENTO_CONSEJERO");
      const propias = groups.find((g) => g.key === "propias");
      expect(propias?.materias.map((m) => m.value) ?? []).not.toContain("NOMBRAMIENTO_CONSEJERO");
    }
  });

  it("el punto libre está disponible para cualquier órgano en su propio grupo", () => {
    for (const organo of ORGANOS) {
      const libre = agendaMateriaGroups(organo).find((g) => g.key === "libre");
      expect(libre?.materias.map((m) => m.value)).toEqual([...MATERIAS_LIBRES]);
    }
  });

  it("una materia desconocida (borradores legacy) es compatible con todo por fallback conservador", () => {
    for (const organo of ORGANOS) {
      expect(isMateriaCompatibleWithOrgano("MATERIA_LEGACY_DESCONOCIDA", organo)).toBe(true);
    }
    expect(labelMateria("MATERIA_LEGACY_DESCONOCIDA")).toBe("MATERIA_LEGACY_DESCONOCIDA");
  });

  it("materiaDefaultForOrgano devuelve una materia compatible con el órgano", () => {
    for (const organo of ORGANOS) {
      const def = materiaDefaultForOrgano(organo);
      expect(isMateriaCompatibleWithOrgano(def.value, organo)).toBe(true);
    }
  });

  it("las materias estructurales son exclusivas de la Junta General", () => {
    const estructurales = AGENDA_MATERIAS.filter((m) => m.tipo === "ESTRUCTURAL");
    expect(estructurales.length).toBeGreaterThan(0);
    for (const m of estructurales) {
      expect(MATERIA_ORGANOS[m.value]).toEqual(["JUNTA_GENERAL"]);
    }
  });

  it("ALL_ORGANOS cubre los tres tipos de órgano soportados", () => {
    expect([...ALL_ORGANOS].sort()).toEqual([...ORGANOS].sort());
  });
});
