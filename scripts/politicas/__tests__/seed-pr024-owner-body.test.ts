// scripts/politicas/__tests__/seed-pr024-owner-body.test.ts — F2.T15, idempotencia.
import { describe, expect, it } from "bun:test";
import {
  ARGA_SYSTEM_IDS,
  CATIT_ID,
  construirPlanPoliticas,
  construirPlanSistemas,
  GARRIGUES_COMITE_IA_ID,
  GARRIGUES_SYSTEM_IDS,
  PI30_ID,
  PR024_ID,
  type PoliticaRow,
  type SistemaRow,
} from "../seed-pr024-owner-body";

describe("seed-pr024-owner-body — construirPlanPoliticas", () => {
  it("PR-024 con owner_body_id NULL se propone hacia CATIT", () => {
    const plan = construirPlanPoliticas([{ id: PR024_ID, owner_body_id: null }]);
    expect(plan).toEqual([{ id: PR024_ID, antes: null, despues: CATIT_ID }]);
  });

  it("PI-30 ya con owner_body_id puesto no se toca", () => {
    const plan = construirPlanPoliticas([{ id: PI30_ID, owner_body_id: GARRIGUES_COMITE_IA_ID }]);
    expect(plan).toHaveLength(0);
  });

  it("segunda corrida no propone nada — idempotente en los dos órdenes", () => {
    const primera = construirPlanPoliticas([{ id: PR024_ID, owner_body_id: null }, { id: PI30_ID, owner_body_id: null }]);
    const aplicadas: PoliticaRow[] = primera.map((c) => ({ id: c.id, owner_body_id: c.despues }));
    expect(construirPlanPoliticas(aplicadas)).toHaveLength(0);
    expect(construirPlanPoliticas([...aplicadas].reverse())).toHaveLength(0);
  });

  it("una política ajena (no PR-024/PI-30) se ignora", () => {
    expect(construirPlanPoliticas([{ id: "otra-politica", owner_body_id: null }])).toHaveLength(0);
  });
});

describe("seed-pr024-owner-body — construirPlanSistemas", () => {
  it("los 8 sistemas ARGA sin ai_policy_id apuntan a PR-024 y los 6 de Garrigues a PI-30", () => {
    const sistemas: SistemaRow[] = [...ARGA_SYSTEM_IDS, ...GARRIGUES_SYSTEM_IDS].map((id) => ({ id, ai_policy_id: null }));
    const plan = construirPlanSistemas(sistemas);
    expect(plan).toHaveLength(ARGA_SYSTEM_IDS.length + GARRIGUES_SYSTEM_IDS.length);
    expect(plan.filter((c) => c.despues === PR024_ID)).toHaveLength(ARGA_SYSTEM_IDS.length);
    expect(plan.filter((c) => c.despues === PI30_ID)).toHaveLength(GARRIGUES_SYSTEM_IDS.length);
  });

  it("un sistema con ai_policy_id ya puesto no se pisa", () => {
    const sistemas: SistemaRow[] = [{ id: ARGA_SYSTEM_IDS[0], ai_policy_id: "otra-politica" }];
    expect(construirPlanSistemas(sistemas)).toHaveLength(0);
  });

  it("segunda corrida no propone nada — idempotente en los dos órdenes", () => {
    const sistemas: SistemaRow[] = [...ARGA_SYSTEM_IDS, ...GARRIGUES_SYSTEM_IDS].map((id) => ({ id, ai_policy_id: null }));
    const primera = construirPlanSistemas(sistemas);
    const aplicados: SistemaRow[] = sistemas.map((s) => {
      const cambio = primera.find((c) => c.id === s.id);
      return { id: s.id, ai_policy_id: cambio?.despues ?? s.ai_policy_id };
    });
    expect(construirPlanSistemas(aplicados)).toHaveLength(0);
    expect(construirPlanSistemas([...aplicados].reverse())).toHaveLength(0);
  });
});
