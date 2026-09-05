import { describe, expect, it } from "vitest";
import { narrowRulePackCandidates } from "../rule-pack-candidates";

type Fila = { id: string; organo: string | null };
const organoDe = (row: Fila) => row.organo;
// `organo` llega YA normalizado a familia por el hook (rulePackOrganoFamily),
// mientras que el órgano de cada fila se normaliza dentro de la función.
const reducir = (rows: Fila[], organo: string | null) =>
  narrowRulePackCandidates(rows, organo, organoDe);

const JUNTA: Fila = { id: "junta", organo: "JUNTA_GENERAL" };
const CONSEJO: Fila = { id: "consejo", organo: "CONSEJO_ADMINISTRACION" };
const SIN_ORGANO: Fila = { id: "sin", organo: null };

describe("reducción de candidatos de rule pack por órgano", () => {
  it("prefiere los packs del órgano que adopta", () => {
    expect(reducir([JUNTA, CONSEJO], "CONSEJO")).toEqual([CONSEJO]);
    expect(reducir([JUNTA, CONSEJO], "JUNTA_GENERAL")).toEqual([JUNTA]);
  });

  it("NO es fail-closed: con órgano conocido y sin coincidencia sigue sirviendo", () => {
    // Esta es la «opción C» EXCLUIDA del lote (criterio del Comité Legal): si
    // esta aserción cae con null, alguien la ha colado. Un señuelo textual no
    // puede satisfacer esto, hay que ejecutar la decisión.
    const salida = reducir([JUNTA], "CONSEJO");
    expect(salida).not.toBeNull();
    expect(salida).toEqual([JUNTA]);
  });

  it("sin órgano conocido y con órganos distintos se niega a elegir", () => {
    expect(reducir([JUNTA, CONSEJO], null)).toBeNull();
    expect(reducir([JUNTA, SIN_ORGANO], null)).toBeNull();
  });

  it("sin órgano conocido pero con un único órgano sí sirve", () => {
    expect(reducir([JUNTA], null)).toEqual([JUNTA]);
    expect(reducir([JUNTA, { id: "junta-2", organo: "JUNTA_GENERAL" }], null)).toHaveLength(2);
  });

  it("no inventa candidatos donde no los hay", () => {
    expect(reducir([], "JUNTA_GENERAL")).toEqual([]);
    expect(reducir([], null)).toEqual([]);
  });

  it("el hook consume esta decisión y no una copia propia", async () => {
    // Backstop de acoplamiento: si alguien vuelve a inlinear la lógica en el
    // hook, los tests de arriba seguirían verdes sobre código muerto.
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const hook = readFileSync(resolve(process.cwd(), "src/hooks/useRulePacks.ts"), "utf8");
    expect(hook).toContain("narrowRulePackCandidates(");
  });
});
