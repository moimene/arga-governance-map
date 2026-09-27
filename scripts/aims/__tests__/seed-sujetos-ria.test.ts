// scripts/aims/__tests__/seed-sujetos-ria.test.ts — F2.T16, idempotencia.
import { describe, expect, it } from "bun:test";
import { ARGA_SUJETOS, construirPlan, GARRIGUES_SUJETOS, type FilaExistente } from "../seed-sujetos-ria";

describe("seed-sujetos-ria — construirPlan", () => {
  it("desde vacío propone las 13 filas de ARGA", () => {
    expect(construirPlan(ARGA_SUJETOS, [])).toHaveLength(13);
  });

  it("desde vacío propone las 5 filas de Garrigues", () => {
    expect(construirPlan(GARRIGUES_SUJETOS, [])).toHaveLength(5);
  });

  it("una tupla (sistema, entidad, rol) ya existente en CUALQUIER estado se omite", () => {
    const existentes: FilaExistente[] = [
      { system_id: ARGA_SUJETOS[0].systemId, entity_id: ARGA_SUJETOS[0].entityId, role: ARGA_SUJETOS[0].role },
    ];
    const plan = construirPlan(ARGA_SUJETOS, existentes);
    expect(plan).toHaveLength(12);
    expect(plan.some((h) => h.systemId === ARGA_SUJETOS[0].systemId && h.role === ARGA_SUJETOS[0].role)).toBe(false);
  });

  it("mismo sistema y entidad con rol distinto NO se confunde con el ya sembrado", () => {
    // ARGA_SUJETOS[0] y [1] son el mismo (sistema, entidad) con roles distintos.
    const existentes: FilaExistente[] = [
      { system_id: ARGA_SUJETOS[0].systemId, entity_id: ARGA_SUJETOS[0].entityId, role: ARGA_SUJETOS[0].role },
    ];
    const plan = construirPlan(ARGA_SUJETOS, existentes);
    expect(plan.some((h) => h.systemId === ARGA_SUJETOS[1].systemId && h.role === ARGA_SUJETOS[1].role)).toBe(true);
  });

  it("segunda corrida (tras aplicar la primera) no propone nada — idempotente en los dos órdenes", () => {
    const primeraArga = construirPlan(ARGA_SUJETOS, []);
    const existentesArga: FilaExistente[] = primeraArga.map((h) => ({ system_id: h.systemId, entity_id: h.entityId, role: h.role }));
    expect(construirPlan(ARGA_SUJETOS, existentesArga)).toHaveLength(0);
    expect(construirPlan([...ARGA_SUJETOS].reverse(), existentesArga)).toHaveLength(0);

    const primeraGarr = construirPlan(GARRIGUES_SUJETOS, []);
    const existentesGarr: FilaExistente[] = primeraGarr.map((h) => ({ system_id: h.systemId, entity_id: h.entityId, role: h.role }));
    expect(construirPlan(GARRIGUES_SUJETOS, existentesGarr)).toHaveLength(0);
    expect(construirPlan([...GARRIGUES_SUJETOS].reverse(), existentesGarr)).toHaveLength(0);
  });

  it("todas las hipótesis son SIEMBRA_HIPOTESIS con roleBasis del catálogo permitido", () => {
    const CATALOGO = new Set(["3.3", "3.3+3.11", "3.4", "25.1.a", "25.1.b", "25.1.c", "3.5", "3.6", "3.7", "3.68", "3.63", "ACUERDO_INTRAGRUPO"]);
    for (const h of [...ARGA_SUJETOS, ...GARRIGUES_SUJETOS]) {
      for (const base of h.roleBasis) {
        expect(CATALOGO.has(base)).toBe(true);
      }
      expect(h.rationale).toMatch(/validar por Legal/);
    }
  });
});
