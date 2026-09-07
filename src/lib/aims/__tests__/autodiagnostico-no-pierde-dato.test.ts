import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildEvaluationPayload,
  restoreEvaluationState,
  type MedidaAdicionalRef,
} from "../evaluacion-payload";

/**
 * Tres campos que el formulario recogía y el guardado tiraba.
 *
 * Medido el 2026-09-07 sobre el primer alta real del tenant Garrigues (Harvey,
 * `2f877e8c…`): la fila persistida en `ai_risk_assessments.findings` era
 * `{code, title, status, planCode}` y nada más, con 84 findings y un `L8`
 * dentro. Lo que se perdía:
 *
 *   1. `difficulty` — se gradúan las 84 medidas y ninguna llegaba a la fila.
 *   2. `justification` — `MATURITY_LEVELS.L8` la declara obligatoria y la
 *      pantalla la pide con asterisco.
 *   3. las **Medidas Adicionales (MA)** — `buildEvaluationPayload` sólo
 *      recorría el catálogo, así que se añadían, se pintaban y desaparecían.
 *
 * Este fichero prueba el CAMINO DE ESCRITURA y su vuelta, no la pantalla: si
 * el payload vuelve a soltar un campo, un finding deja de ser reconstruible y
 * el borrador se rompe.
 */

const MEDIDAS = [
  { id: "MG_RISK_01", description: "Identificar riesgos", requirementCode: "RISK_MGMT" },
  { id: "MG_RISK_02", description: "Evaluar riesgos", requirementCode: "RISK_MGMT" },
];
const REQUISITOS = [
  { code: "RISK_MGMT", title: "Sistema de gestión de riesgos", measures: [{ id: "MG_RISK_01" }, { id: "MG_RISK_02" }] },
];
const MA: MedidaAdicionalRef = {
  id: "MA_123456_1",
  description: "Registrar los prompts que salen a un proveedor de modelo",
  requirementCode: "RISK_MGMT",
  subpartId: "9.2.a",
};

describe("el autodiagnóstico no pierde lo que el formulario recoge", () => {
  it("persiste dificultad y justificación, no sólo el nivel", () => {
    const out = buildEvaluationPayload(
      {
        MG_RISK_01: { maturity: "L3", difficulty: "00" },
        MG_RISK_02: { maturity: "L8", justification: "No hay tratamiento biométrico." },
      },
      MEDIDAS,
      REQUISITOS,
    );
    const [uno, dos] = out.findings;
    expect(uno.difficulty, "la dificultad graduada no llega a la fila").toBe("00");
    expect(dos.justification, "la justificación de una L8 no llega a la fila").toBe(
      "No hay tratamiento biométrico.",
    );
    // Y lo no aportado se guarda como ausencia, no como un valor inventado.
    expect(uno.justification).toBeNull();
    expect(dos.difficulty).toBeNull();
  });

  it("una dificultad en blanco NO se guarda como '01' (media)", () => {
    // El desplegable venía preseleccionado en «01: Media», así que las 84
    // medidas nacían graduadas por nadie y el dato espurio no se distinguía de
    // una graduación real.
    const out = buildEvaluationPayload(
      { MG_RISK_01: { maturity: "L5", difficulty: "" } },
      MEDIDAS,
      REQUISITOS,
    );
    expect(out.findings[0].difficulty).toBeNull();
  });

  it("las Medidas Adicionales llegan al payload y cuentan en su requisito", () => {
    const evaluaciones = {
      MG_RISK_01: { maturity: "L5" },
      MG_RISK_02: { maturity: "L5" },
      [MA.id]: { maturity: "L1" },
    };

    // Control positivo del instrumento: SIN la MA el requisito sale conforme.
    // Si este control fallara, el test de abajo pasaría por otra razón.
    const sinMa = buildEvaluationPayload(evaluaciones, MEDIDAS, REQUISITOS);
    expect(sinMa.checks[0].status).toBe("CONFORME");
    expect(sinMa.findings).toHaveLength(2);

    const conMa = buildEvaluationPayload(evaluaciones, MEDIDAS, REQUISITOS, undefined, [MA]);
    expect(conMa.findings.map((f) => f.code)).toContain(MA.id);
    expect(conMa.findings.find((f) => f.code === MA.id)?.kind).toBe("MA");
    expect(conMa.totales, "la MA no cuenta en el denominador").toBe(3);
    expect(
      conMa.checks[0].status,
      "una MA en L1 no arrastra a su requisito: añadirla no tendría consecuencia",
    ).toBe("NO_CONFORME");
  });

  it("una MA sin contestar deja su requisito PENDIENTE", () => {
    const out = buildEvaluationPayload(
      { MG_RISK_01: { maturity: "L5" }, MG_RISK_02: { maturity: "L5" } },
      MEDIDAS,
      REQUISITOS,
      undefined,
      [MA],
    );
    expect(out.checks[0].status).toBe("PENDIENTE");
  });

  it("el finding es round-trippable: el borrador se reconstruye entero", () => {
    // Es la otra mitad del autoguardado. Si el finding no lleva de vuelta
    // nivel, dificultad, justificación, tipo y requisito, «guardar borrador»
    // sería escribir en un pozo.
    const evaluaciones = {
      MG_RISK_01: { maturity: "L4", difficulty: "02", justification: "" },
      MG_RISK_02: { maturity: "L8", difficulty: "00", justification: "Fuera de alcance." },
      [MA.id]: { maturity: "L2", difficulty: "01", justification: "" },
    };
    const out = buildEvaluationPayload(evaluaciones, MEDIDAS, REQUISITOS, undefined, [MA]);

    const vuelta = restoreEvaluationState(out.findings);
    expect(vuelta.evaluations.MG_RISK_01).toEqual({ maturity: "L4", difficulty: "02", justification: "" });
    expect(vuelta.evaluations.MG_RISK_02).toEqual({ maturity: "L8", difficulty: "00", justification: "Fuera de alcance." });
    expect(vuelta.evaluations[MA.id]).toEqual({ maturity: "L2", difficulty: "01", justification: "" });
    expect(vuelta.additionalMeasures).toEqual([MA]);

    // Y volver a construir desde lo reconstruido da el mismo payload: la ida y
    // la vuelta no pierden nada por el camino.
    const otraVez = buildEvaluationPayload(
      vuelta.evaluations,
      MEDIDAS,
      REQUISITOS,
      undefined,
      vuelta.additionalMeasures,
    );
    expect(otraVez.findings).toEqual(out.findings);
    expect(otraVez.status).toBe(out.status);
  });

  it("una fila anterior al cambio se reconstruye sin inventar campos", () => {
    // Las 8 evaluaciones que ya están en Cloud sólo traen cuatro claves.
    const legado = [{ code: "MG_RISK_01", title: "Identificar riesgos", status: "L5", planCode: "03" }];
    const vuelta = restoreEvaluationState(legado);
    expect(vuelta.evaluations.MG_RISK_01).toEqual({ maturity: "L5", difficulty: "", justification: "" });
    expect(vuelta.additionalMeasures).toEqual([]);
  });
});

describe("la pantalla del wizard usa el camino que persiste", () => {
  const fuente = readFileSync("src/pages/ai-governance/EvaluacionNueva.tsx", "utf8");

  it("pasa las Medidas Adicionales a buildEvaluationPayload", () => {
    // El defecto era exactamente esto: la pantalla llamaba al constructor con
    // tres argumentos y las MA vivían en un `useState` aparte que nadie leía.
    expect(fuente).toMatch(/buildEvaluationPayload\(\s*\n?\s*evaluations,\s*\n?\s*allMeasures,\s*\n?\s*requirements,\s*\n?\s*undefined,\s*\n?\s*additionalMeasures/);
  });

  it("no reintroduce el valor por defecto de dificultad", () => {
    // Se busca el literal en la construcción del estado, no en el `<option>`,
    // que sí tiene que seguir ofreciendo «01: Media».
    expect(fuente).not.toMatch(/difficulty:\s*"01"/);
  });
});
