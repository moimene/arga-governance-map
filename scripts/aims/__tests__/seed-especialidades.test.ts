// scripts/aims/__tests__/seed-especialidades.test.ts — F2.T10, idempotencia.
import { describe, expect, it } from "bun:test";
import { construirPlan, GARRIGUES_ESPECIALIDADES, type FilaExistente } from "../seed-especialidades";

describe("seed-especialidades — construirPlan", () => {
  it("desde vacío propone las 5 especialidades", () => {
    const plan = construirPlan([]);
    expect(plan).toHaveLength(5);
    expect(new Set(plan.map((p) => p.especialidad))).toEqual(
      new Set(GARRIGUES_ESPECIALIDADES.map((e) => e.especialidad)),
    );
  });

  it("segunda corrida (tras aplicar la primera) no propone nada — idempotente", () => {
    const primera = construirPlan([]);
    const actuales: FilaExistente[] = primera.map((p) => ({ especialidad: p.especialidad, governing_body_id: p.despues }));
    const segunda = construirPlan(actuales);
    expect(segunda).toHaveLength(0);
  });

  it("es independiente del orden en que llegan las filas existentes", () => {
    const actuales: FilaExistente[] = GARRIGUES_ESPECIALIDADES.map((e) => ({
      especialidad: e.especialidad,
      governing_body_id: e.governingBodyId,
    }));
    const enOrden = construirPlan(actuales);
    const invertido = construirPlan([...actuales].reverse());
    expect(enOrden).toEqual([]);
    expect(invertido).toEqual([]);
  });

  it("una especialidad con órgano distinto al del catálogo sí se replantea", () => {
    const actuales: FilaExistente[] = [{ especialidad: "JURIDICO", governing_body_id: "otro-organo" }];
    const plan = construirPlan(actuales);
    const juridico = plan.find((p) => p.especialidad === "JURIDICO");
    expect(juridico?.antes).toBe("otro-organo");
    expect(juridico?.despues).toBe("432e420b-4db1-44f1-81da-e3575b1d3dec");
  });
});
