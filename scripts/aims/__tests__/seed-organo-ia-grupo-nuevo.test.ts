// scripts/aims/__tests__/seed-organo-ia-grupo-nuevo.test.ts — MOI-150, idempotencia.
import { describe, expect, it } from "bun:test";
import {
  CDA_CORPORACION_NUEVA_ID,
  CORPORACION_NUEVA_ENTITY_ID,
  SISTEMA_MOI55_REAL_ID,
  faltaOrgano,
  yaDeclarado,
  type SujetoExistente,
} from "../seed-organo-ia-grupo-nuevo";

const fila = (governing_body_id: string | null): SujetoExistente => ({
  system_id: SISTEMA_MOI55_REAL_ID,
  entity_id: CORPORACION_NUEVA_ENTITY_ID,
  role: "RESPONSABLE_DESPLIEGUE",
  governing_body_id,
});

describe("seed-organo-ia-grupo-nuevo — yaDeclarado", () => {
  it("sin ninguna fila, no está declarado", () => {
    expect(yaDeclarado([])).toBe(false);
  });

  it("con la tupla exacta ya presente, está declarado (idempotente)", () => {
    expect(yaDeclarado([fila(CDA_CORPORACION_NUEVA_ID)])).toBe(true);
  });

  it("una fila de otro sistema, otra entidad o otro rol no cuenta", () => {
    expect(yaDeclarado([{ ...fila(CDA_CORPORACION_NUEVA_ID), system_id: "otro-sistema" }])).toBe(false);
    expect(yaDeclarado([{ ...fila(CDA_CORPORACION_NUEVA_ID), entity_id: "otra-entidad" }])).toBe(false);
    expect(yaDeclarado([{ ...fila(CDA_CORPORACION_NUEVA_ID), role: "PROVEEDOR" }])).toBe(false);
  });
});

describe("seed-organo-ia-grupo-nuevo — faltaOrgano (D-28 bis, MOI-150)", () => {
  it("sin la fila, no falta nada que declarar (yaDeclarado ya cubre el alta)", () => {
    expect(faltaOrgano([])).toBe(false);
  });

  it("con la fila y el órgano D-28 ya puesto, no falta nada", () => {
    expect(faltaOrgano([fila(CDA_CORPORACION_NUEVA_ID)])).toBe(false);
  });

  it("con la fila SIN órgano (corrida previa a la migración 20260928172000), falta completarlo", () => {
    expect(faltaOrgano([fila(null)])).toBe(true);
  });

  it("con la fila y un órgano DISTINTO del D-28, también falta completarlo", () => {
    expect(faltaOrgano([fila("00000000-0000-0000-0000-000000000099")])).toBe(true);
  });
});
