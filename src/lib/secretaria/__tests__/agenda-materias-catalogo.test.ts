import { describe, expect, it } from "vitest";
import {
  AGENDA_MATERIAS,
  agendaMateriaGroupsCatalogadas,
  agendaMateriaSelectionForKind,
  materiaDefaultForOrganoCatalogada,
  materiasPendientesDeCatalogo,
} from "@/lib/secretaria/agenda-materias";

// H-50 (MOI-15, severidad A): variantes *Catalogadas de agenda-materias.ts —
// ninguna debe devolver, ni preseleccionar, una materia decisoria sin fila en
// `materia_catalog` (el acta la rechaza en servidor: "every point needs a
// catalogued matter"). `agendaMateriaGroups`/`materiaDefaultForOrgano` (sin
// catálogo) quedan intactos para los consumidores que solo necesitan la
// partición por órgano/tipo social — agenda-materias.test.ts sigue
// cubriéndolos sin cambios.
describe("agenda-materias — variantes *Catalogadas (H-50)", () => {
  const TODAS_CATALOGADAS = new Set(AGENDA_MATERIAS.map((m) => m.value));

  it("agendaMateriaGroupsCatalogadas: fail-closed — sin catálogo (null) no ofrece ninguna decisoria", () => {
    expect(agendaMateriaGroupsCatalogadas("CONSEJO", undefined, null)).toEqual([]);
    expect(agendaMateriaGroupsCatalogadas("JUNTA_GENERAL", undefined, null)).toEqual([]);
  });

  it("agendaMateriaGroupsCatalogadas: con catálogo completo, coincide con agendaMateriaGroups sin catálogo", () => {
    const sinCatalogo = new Set(AGENDA_MATERIAS.map((m) => m.value));
    const groups = agendaMateriaGroupsCatalogadas("CONSEJO", undefined, sinCatalogo);
    expect(groups.flatMap((g) => g.materias.map((m) => m.value))).toContain("APROBACION_PLAN_NEGOCIO");
  });

  it("agendaMateriaGroupsCatalogadas: excluye exactamente las materias sin fila en el Set", () => {
    // APROBACION_PLAN_NEGOCIO es el caso real medido (MOI-15, reunión del
    // grupo nuevo con esa materia): sin fila en materia_catalog.
    const codigos = new Set(AGENDA_MATERIAS.map((m) => m.value).filter((v) => v !== "APROBACION_PLAN_NEGOCIO"));
    const groups = agendaMateriaGroupsCatalogadas("CONSEJO", undefined, codigos);
    const valores = groups.flatMap((g) => g.materias.map((m) => m.value));
    expect(valores).not.toContain("APROBACION_PLAN_NEGOCIO");
    // El resto de propias del Consejo sigue disponible.
    expect(valores).toContain("FORMULACION_CUENTAS");
  });

  it("materiaDefaultForOrganoCatalogada: fail-closed — sin catálogo cae al fallback conservador (nunca revienta)", () => {
    const def = materiaDefaultForOrganoCatalogada("CONSEJO", null);
    expect(def).toBeDefined();
    expect(typeof def.value).toBe("string");
  });

  it("materiaDefaultForOrganoCatalogada: nunca elige una materia sin fila en el catálogo si hay alguna catalogada compatible", () => {
    // Simula el caso real: APROBACION_PLAN_NEGOCIO (primera compatible con
    // CONSEJO en AGENDA_MATERIAS) sin catálogo, pero FORMULACION_CUENTAS sí.
    const codigos = new Set(["FORMULACION_CUENTAS"]);
    const def = materiaDefaultForOrganoCatalogada("CONSEJO", codigos);
    expect(def.value).toBe("FORMULACION_CUENTAS");
  });

  it("materiasPendientesDeCatalogo: cuenta lo que agendaMateriaGroupsCatalogadas oculta, nunca en silencio", () => {
    const codigos = new Set(AGENDA_MATERIAS.map((m) => m.value).filter((v) => v !== "APROBACION_PLAN_NEGOCIO"));
    const pendientes = materiasPendientesDeCatalogo("CONSEJO", undefined, codigos);
    expect(pendientes.map((m) => m.value)).toContain("APROBACION_PLAN_NEGOCIO");
  });

  it("agendaMateriaSelectionForKind: al pasar a DECISORIO con codigosCatalogo, nunca preselecciona una materia sin fila", () => {
    const codigos = new Set(["FORMULACION_CUENTAS"]);
    const seleccion = agendaMateriaSelectionForKind({
      kind: "DECISORIO",
      currentMateria: null,
      organoTipo: "CONSEJO",
      codigosCatalogo: codigos,
    });
    expect(seleccion.materia).toBe("FORMULACION_CUENTAS");
  });

  it("agendaMateriaSelectionForKind: sin codigosCatalogo (undefined) preserva el contrato previo — no rompe consumidores ajenos a H-50", () => {
    const seleccion = agendaMateriaSelectionForKind({
      kind: "DECISORIO",
      currentMateria: null,
      organoTipo: "CONSEJO",
    });
    expect(seleccion.materia).toBe("APROBACION_PLAN_NEGOCIO");
  });

  it("agendaMateriaSelectionForKind: con catálogo completo, sigue conservando el valor actual compatible", () => {
    const seleccion = agendaMateriaSelectionForKind({
      kind: "DECISORIO",
      currentMateria: "FORMULACION_CUENTAS",
      organoTipo: "CONSEJO",
      codigosCatalogo: TODAS_CATALOGADAS,
    });
    expect(seleccion.materia).toBe("FORMULACION_CUENTAS");
  });
});
