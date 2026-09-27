// scripts/entidades/__tests__/seed-ria-direcciones.test.ts — F2.T15, idempotencia.
import { describe, expect, it } from "bun:test";
import {
  ARGA_ASEGURADORAS_SIN_SECTOR,
  ARGA_CANDIDATE_IDS,
  construirPlan,
  type EntidadRow,
} from "../seed-ria-direcciones-pais-sector";

function filaVacia(id: string, jurisdiction: string, esAseguradora: boolean): EntidadRow {
  return {
    id,
    legal_name: id,
    jurisdiction,
    country: null,
    regulated_sector: esAseguradora ? null : null,
    address: null,
  };
}

describe("seed-ria-direcciones-pais-sector — construirPlan", () => {
  it("las 10 candidatas con todo NULL producen un cambio de country cada una", () => {
    const filas = ARGA_CANDIDATE_IDS.map((id) => filaVacia(id, "ES", ARGA_ASEGURADORAS_SIN_SECTOR.includes(id)));
    const plan = construirPlan(filas);
    expect(plan).toHaveLength(10);
    expect(plan.every((c) => c.country?.despues === "ES")).toBe(true);
  });

  it("solo las 3 aseguradoras del plan reciben regulated_sector=SEGUROS", () => {
    const filas = ARGA_CANDIDATE_IDS.map((id) => filaVacia(id, "ES", false));
    const plan = construirPlan(filas);
    const conSector = plan.filter((c) => c.regulated_sector);
    expect(conSector.map((c) => c.id).sort()).toEqual([...ARGA_ASEGURADORAS_SIN_SECTOR].sort());
  });

  it("nunca pisa un regulated_sector ya puesto (ARGA Seguros)", () => {
    const filas: EntidadRow[] = [
      { id: "6d7ed736-f263-4531-a59d-c6ca0cd41602", legal_name: "ARGA Seguros, S.A.", jurisdiction: "ES", country: null, regulated_sector: "SEGUROS", address: null },
    ];
    const plan = construirPlan(filas);
    expect(plan[0].regulated_sector).toBeUndefined();
    expect(plan[0].country?.despues).toBe("ES");
  });

  it("nunca inventa address: la fila siempre declara address_sin_dato cuando es NULL", () => {
    const filas = ARGA_CANDIDATE_IDS.map((id) => filaVacia(id, "ES", false));
    const plan = construirPlan(filas);
    expect(plan.every((c) => c.address_sin_dato)).toBe(true);
  });

  it("segunda corrida (tras aplicar) no propone nada — idempotente en los dos órdenes", () => {
    const filas = ARGA_CANDIDATE_IDS.map((id) => filaVacia(id, "ES", ARGA_ASEGURADORAS_SIN_SECTOR.includes(id)));
    const primera = construirPlan(filas);

    const aplicadas: EntidadRow[] = filas.map((f) => {
      const cambio = primera.find((c) => c.id === f.id);
      return {
        ...f,
        country: cambio?.country?.despues ?? f.country,
        regulated_sector: cambio?.regulated_sector?.despues ?? f.regulated_sector,
      };
    });

    expect(construirPlan(aplicadas)).toHaveLength(0);
    expect(construirPlan([...aplicadas].reverse())).toHaveLength(0);
  });

  it("una fila fuera de las 10 candidatas se ignora aunque tenga NULL", () => {
    const plan = construirPlan([filaVacia("00000000-0000-0000-0000-000000000099", "ES", false)]);
    expect(plan).toHaveLength(0);
  });
});
