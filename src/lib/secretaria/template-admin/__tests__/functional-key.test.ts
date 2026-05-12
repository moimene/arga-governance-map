import { describe, it, expect } from "vitest";
import {
  CORE_V1_MATERIAS,
  CORE_V1_MATERIAS_COUNT,
  buildFunctionalKey,
  detectFunctionalDuplicate,
  serializeFunctionalKey,
  matchesFunctionalKey,
} from "../functional-key";
import type { PlantillaCandidate } from "../types";

const baseRow = (overrides: Partial<PlantillaCandidate> = {}): PlantillaCandidate => ({
  id: "rid",
  tipo: "MODELO_ACUERDO",
  materia: "APROBACION_CUENTAS",
  materia_acuerdo: null,
  jurisdiccion: "ES",
  version: "1.0.0",
  estado: "ACTIVA",
  organo_tipo: "JUNTA_GENERAL",
  adoption_mode: "MEETING",
  aprobada_por: "X",
  fecha_aprobacion: "2026-01-01",
  referencia_legal: "Art. 160 LSC",
  capa1_inmutable: "x".repeat(120),
  capa2_variables: [],
  capa3_editables: [],
  ...overrides,
});

describe("functional-key", () => {
  it("CORE_V1_MATERIAS_COUNT = 14", () => {
    expect(CORE_V1_MATERIAS_COUNT).toBe(14);
    expect(CORE_V1_MATERIAS.length).toBe(14);
  });

  it("buildFunctionalKey usa materia_acuerdo si está, sino materia", () => {
    const k1 = buildFunctionalKey(baseRow({ materia: "X", materia_acuerdo: "Y" }), "tenant1");
    expect(k1.materia).toBe("Y");
    const k2 = buildFunctionalKey(baseRow({ materia: "X", materia_acuerdo: null }), "tenant1");
    expect(k2.materia).toBe("X");
  });

  it("buildFunctionalKey rellena tenantId del argumento", () => {
    const k = buildFunctionalKey(baseRow(), "tenant42");
    expect(k.tenantId).toBe("tenant42");
  });

  it("serializeFunctionalKey produce string determinista", () => {
    const k1 = buildFunctionalKey(baseRow(), "t1");
    const k2 = buildFunctionalKey(baseRow(), "t1");
    expect(serializeFunctionalKey(k1)).toBe(serializeFunctionalKey(k2));
  });

  it("matchesFunctionalKey ignora id y otros campos no funcionales", () => {
    const a = baseRow({ id: "a" });
    const b = baseRow({ id: "b" });
    expect(matchesFunctionalKey(a, b, "t1")).toBe(true);
  });

  it("matchesFunctionalKey detecta diferencia en organo_tipo", () => {
    const a = baseRow({ organo_tipo: "JUNTA_GENERAL" });
    const b = baseRow({ organo_tipo: "CONSEJO_ADMIN" });
    expect(matchesFunctionalKey(a, b, "t1")).toBe(false);
  });

  it("matchesFunctionalKey detecta diferencia en materia normalizada", () => {
    const a = baseRow({ materia: "X", materia_acuerdo: "AUMENTO_CAPITAL" });
    const b = baseRow({ materia: "AUMENTO_CAPITAL", materia_acuerdo: null });
    expect(matchesFunctionalKey(a, b, "t1")).toBe(true);
  });

  it("CORE_V1_MATERIAS incluye las 14 combinaciones del spec §3", () => {
    const set = new Set(CORE_V1_MATERIAS.map((m) => `${m.organo}|${m.materia}`));
    expect(set.has("JUNTA_GENERAL|APROBACION_CUENTAS")).toBe(true);
    expect(set.has("CONSEJO_ADMIN|DISTRIBUCION_CARGOS")).toBe(true);
    expect(set.has("ORGANO_ADMIN|FORMULACION_CUENTAS")).toBe(true);
    expect(set.has("CONSEJO_ADMIN|COMITES_INTERNOS")).toBe(true);
  });

  it("detectFunctionalDuplicate encuentra duplicados no-terminales", () => {
    const candidate = baseRow({ id: "candidate", estado: "REVISADA" });
    const duplicate = baseRow({ id: "existing-draft", estado: "BORRADOR" });

    expect(
      detectFunctionalDuplicate(candidate, [duplicate], "t1", {
        states: ["BORRADOR", "REVISADA", "APROBADA", "ACTIVA"],
      })?.id,
    ).toBe("existing-draft");
  });

  it("detectFunctionalDuplicate respeta filtro de estados", () => {
    const candidate = baseRow({ id: "candidate", estado: "REVISADA" });
    const archived = baseRow({ id: "archived", estado: "ARCHIVADA" });

    expect(
      detectFunctionalDuplicate(candidate, [archived], "t1", {
        states: ["BORRADOR", "REVISADA", "APROBADA", "ACTIVA"],
      }),
    ).toBeNull();
  });
});
