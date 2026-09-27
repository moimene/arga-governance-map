// scripts/aims/__tests__/seed-organo-ia-grupo-nuevo.test.ts — MOI-150, idempotencia.
import { describe, expect, it } from "bun:test";
import {
  CORPORACION_NUEVA_ENTITY_ID,
  SISTEMA_MOI55_REAL_ID,
  yaDeclarado,
  type SujetoExistente,
} from "../seed-organo-ia-grupo-nuevo";

describe("seed-organo-ia-grupo-nuevo — yaDeclarado", () => {
  it("sin ninguna fila, no está declarado", () => {
    expect(yaDeclarado([])).toBe(false);
  });

  it("con la tupla exacta ya presente, está declarado (idempotente)", () => {
    const existentes: SujetoExistente[] = [
      { system_id: SISTEMA_MOI55_REAL_ID, entity_id: CORPORACION_NUEVA_ENTITY_ID, role: "RESPONSABLE_DESPLIEGUE" },
    ];
    expect(yaDeclarado(existentes)).toBe(true);
  });

  it("una fila de otro sistema, otra entidad o otro rol no cuenta", () => {
    expect(
      yaDeclarado([{ system_id: "otro-sistema", entity_id: CORPORACION_NUEVA_ENTITY_ID, role: "RESPONSABLE_DESPLIEGUE" }]),
    ).toBe(false);
    expect(
      yaDeclarado([{ system_id: SISTEMA_MOI55_REAL_ID, entity_id: "otra-entidad", role: "RESPONSABLE_DESPLIEGUE" }]),
    ).toBe(false);
    expect(
      yaDeclarado([{ system_id: SISTEMA_MOI55_REAL_ID, entity_id: CORPORACION_NUEVA_ENTITY_ID, role: "PROVEEDOR" }]),
    ).toBe(false);
  });
});
