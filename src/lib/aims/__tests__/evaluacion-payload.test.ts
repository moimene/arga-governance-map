import { describe, it, expect } from "bun:test";
import { buildEvaluationPayload } from "../evaluacion-payload";

/**
 * A2 — Una evaluación sin contestar no puede persistirse como conforme.
 *
 * El formulario imputaba `L5` a toda medida no respondida y marcaba el
 * requisito `CONFORME`, de modo que enviarlo sin tocar nada escribía en base
 * de datos 84 findings en nivel alto y todos los requisitos conformes, con
 * una `evidence_url` de un proveedor al que nunca se llama.
 */
const MEDIDAS = [
  { id: "M1", description: "Medida uno" },
  { id: "M2", description: "Medida dos" },
  { id: "M3", description: "Medida tres" },
];
const REQUISITOS = [
  { code: "R1", title: "Requisito uno", description: "d1", measures: [{ id: "M1" }, { id: "M2" }] },
  { code: "R2", title: "Requisito dos", description: "d2", measures: [{ id: "M3" }] },
];

describe("A2 — no se imputa conformidad a lo no contestado", () => {
  it("sin contestar nada no se persiste ni un solo finding", () => {
    const out = buildEvaluationPayload({}, MEDIDAS, REQUISITOS);
    expect(out.findings).toHaveLength(0);
  });

  it("sin contestar nada ningún requisito queda CONFORME", () => {
    const out = buildEvaluationPayload({}, MEDIDAS, REQUISITOS);
    expect(out.checks.map((c) => c.status)).toEqual(["PENDIENTE", "PENDIENTE"]);
  });

  it("un requisito a medias no se da por evaluado", () => {
    const out = buildEvaluationPayload({ M1: { maturity: "L5" } }, MEDIDAS, REQUISITOS);
    expect(out.checks.find((c) => c.requirement_code === "R1")?.status).toBe("PENDIENTE");
    expect(out.findings).toHaveLength(1);
  });

  it("un requisito completo y sin brechas sí es CONFORME", () => {
    const out = buildEvaluationPayload(
      { M1: { maturity: "L5" }, M2: { maturity: "L5" }, M3: { maturity: "L5" } },
      MEDIDAS,
      REQUISITOS,
    );
    expect(out.checks.every((c) => c.status === "CONFORME")).toBe(true);
    expect(out.findings).toHaveLength(3);
  });

  it("una brecha declarada hace el requisito NO_CONFORME", () => {
    const out = buildEvaluationPayload(
      { M1: { maturity: "L1" }, M2: { maturity: "L5" }, M3: { maturity: "L5" } },
      MEDIDAS,
      REQUISITOS,
    );
    expect(out.checks.find((c) => c.requirement_code === "R1")?.status).toBe("NO_CONFORME");
  });

  // --- Casos que cierran las cuatro mutaciones que sobrevivían a la review ---

  it("un requisito sin medidas no puede darse por conforme", () => {
    // `[].every()` es vacuamente cierto: sin el guard de longitud, un requisito
    // sin medidas salía CONFORME.
    const out = buildEvaluationPayload({}, MEDIDAS, [
      { code: "R0", title: "Sin medidas", measures: [] },
    ]);
    expect(out.checks[0].status).toBe("PENDIENTE");
  });

  it("una evaluación parcial no queda CONFORME a nivel global", () => {
    const out = buildEvaluationPayload(
      { M1: { maturity: "L5" }, M2: { maturity: "L5" } },
      MEDIDAS,
      REQUISITOS,
    );
    expect(out.status).toBe("CON_GAPS");
  });

  it("volver a «Sin evaluar» deja la medida sin contestar", () => {
    // Quien elige un nivel y vuelve atrás deja `{maturity: ""}`. Si eso contara
    // como contestado, se persistiría un finding con nivel vacío y el requisito
    // saldría CONFORME. Es el camino más alcanzable desde la propia UI.
    const out = buildEvaluationPayload(
      { M1: { maturity: "" }, M2: { maturity: "L5" }, M3: { maturity: "L5" } },
      MEDIDAS,
      REQUISITOS,
    );
    expect(out.findings.map((f) => f.code)).toEqual(["M2", "M3"]);
    expect(out.checks.find((c) => c.requirement_code === "R1")?.status).toBe("PENDIENTE");
  });

  it.each(["L1", "L2", "L3", "L4", "L6", "L7"])(
    "un requisito contestado con %s no acredita conformidad",
    (nivel) => {
      // Sólo L5 (implementada) y L8 (no necesaria) acreditan. L3 es
      // «documentada, NO implementada» y antes se persistía CONFORME.
      const out = buildEvaluationPayload(
        { M3: { maturity: nivel } },
        MEDIDAS,
        [{ code: "R2", title: "Requisito dos", measures: [{ id: "M3" }] }],
      );
      expect(out.checks[0].status).toBe("NO_CONFORME");
    },
  );

  it.each(["L5", "L8"])("un requisito contestado con %s sí acredita conformidad", (nivel) => {
    const out = buildEvaluationPayload(
      { M3: { maturity: nivel } },
      MEDIDAS,
      [{ code: "R2", title: "Requisito dos", measures: [{ id: "M3" }] }],
    );
    expect(out.checks[0].status).toBe("CONFORME");
  });

  it("no se inventa evidencia de ningún proveedor", () => {
    const out = buildEvaluationPayload(
      { M1: { maturity: "L5" }, M2: { maturity: "L5" }, M3: { maturity: "L5" } },
      MEDIDAS,
      REQUISITOS,
    );
    expect(JSON.stringify(out)).not.toMatch(/eadtrust|g-digital|sha512/i);
    expect(out.checks.every((c) => !c.evidence_url)).toBe(true);
  });

  it("los estados usan el vocabulario que ya existe en la columna", () => {
    // Un valor nuevo no tendría chip en la ficha y `readiness.ts` no lo
    // contaría como brecha: un requisito sin evaluar dejaría de figurar
    // como hueco, justo el sesgo que esta tarea corrige.
    const out = buildEvaluationPayload({}, MEDIDAS, REQUISITOS);
    for (const c of out.checks) {
      expect(["CONFORME", "NO_CONFORME", "PENDIENTE"]).toContain(c.status);
    }
  });

  it("el estado global distingue no evaluado de conforme", () => {
    expect(buildEvaluationPayload({}, MEDIDAS, REQUISITOS).status).toBe("BORRADOR");
    expect(
      buildEvaluationPayload(
        { M1: { maturity: "L5" }, M2: { maturity: "L5" }, M3: { maturity: "L5" } },
        MEDIDAS,
        REQUISITOS,
      ).status,
    ).toBe("CONFORME");
  });
});
