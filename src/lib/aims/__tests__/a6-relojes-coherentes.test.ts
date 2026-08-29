import { describe, expect, it } from "bun:test";
import { calculateDoraDeadlines, calculateGdprDeadline, calculateRiaDeadline, evaluateMultiregimeIncident } from "../incident-clocks";

/**
 * A6 — Los relojes regulatorios dejan de contradecirse y de citar mal.
 *
 * Defectos corregidos:
 *  - el reloj de 72 h del RGPD se etiquetaba `Art. 34` cuando había alto riesgo
 *    para los interesados; el plazo de 72 h es SIEMPRE del art. 33, y el art. 34
 *    (comunicación al interesado) no tiene plazo de 72 h;
 *  - DORA devolvía `initialDeadlineHours: 4` como literal fijo aunque la fecha
 *    elegida fuera k+24 h: los dos campos del mismo objeto decían cosas distintas;
 *  - la rama de 24 h era inalcanzable desde el orquestador, que nunca pasaba la
 *    fecha de clasificación;
 *  - `isAiHighRisk` se declaraba y no se usaba: TODO incidente activaba el reloj
 *    del art. 73 RIA, que sólo alcanza a sistemas de alto riesgo.
 */
const K = new Date("2026-08-01T10:00:00.000Z");
const h = (d: string, from: Date = K) => (new Date(d).getTime() - from.getTime()) / 3_600_000;

describe("A6 — RGPD: el reloj de 72 h es del art. 33", () => {
  it("cita el art. 33 aunque haya alto riesgo para los interesados", () => {
    const r = calculateGdprDeadline(K, true);
    expect(r.articleRef).toContain("33");
    expect(r.articleRef).not.toMatch(/^Art\. 34$/);
  });

  it("el alto riesgo añade la comunicación al interesado, no cambia el plazo", () => {
    const alto = calculateGdprDeadline(K, true);
    const normal = calculateGdprDeadline(K, false);
    expect(alto.deadlineHours).toBe(72);
    expect(normal.deadlineHours).toBe(72);
    expect(alto.requiresDataSubjectNotice).toBe(true);
    expect(normal.requiresDataSubjectNotice).toBe(false);
  });
});

describe("A6 — DORA: las horas se derivan de la fecha, no son un literal", () => {
  it("sin clasificación, el plazo inicial son 4 h desde el conocimiento", () => {
    const r = calculateDoraDeadlines(K);
    expect(h(r.initialDeadlineDate)).toBe(4);
    expect(r.initialDeadlineHours).toBe(4);
  });

  it("con clasificación tardía, el tope de 24 h manda y las horas lo dicen", () => {
    // Clasificado a +23 h: 23+4=27 h supera el tope de 24 h desde conocimiento.
    const r = calculateDoraDeadlines(K, new Date(K.getTime() + 23 * 3_600_000));
    expect(h(r.initialDeadlineDate)).toBe(24);
    expect(r.initialDeadlineHours, "las horas siguen diciendo 4 con una fecha de 24 h").toBe(24);
  });

  it("el informe final es un mes natural, no 30 días fijos", () => {
    const r = calculateDoraDeadlines(K);
    const inter = new Date(r.intermediateDeadlineDate);
    const fin = new Date(r.finalDeadlineDate);
    const esperado = new Date(inter);
    esperado.setMonth(esperado.getMonth() + 1);
    expect(fin.toISOString()).toBe(esperado.toISOString());
  });

  it("declara que encadena sobre plazos y no sobre envíos reales", () => {
    expect(calculateDoraDeadlines(K).assumesPriorReportsAtDeadline).toBe(true);
  });
});

describe("A6 — el reloj del art. 73 RIA sólo alcanza al alto riesgo", () => {
  it("si consta que NO es de alto riesgo, no se emite el reloj", () => {
    // Criterio revisado: sólo se omite cuando CONSTA que no aplica. La
    // clasificación desconocida se advierte, no se oculta (ver más abajo).
    expect(
      evaluateMultiregimeIncident({ knowledgeDate: K, isAiRelated: true, isAiHighRisk: false }).ria,
    ).toBeUndefined();
  });

  it("con alto riesgo acreditado sí se emite", () => {
    expect(
      evaluateMultiregimeIncident({ knowledgeDate: K, isAiRelated: true, isAiHighRisk: true }).ria,
    ).toBeDefined();
  });

  it("la fecha de clasificación llega hasta DORA", () => {
    // Antes el orquestador llamaba sin clasificación y la rama de 24 h era
    // inalcanzable en producción.
    const r = evaluateMultiregimeIncident({
      knowledgeDate: K,
      isAiRelated: false,
      isIctRelated: true,
      classificationDate: new Date(K.getTime() + 23 * 3_600_000),
    });
    expect(r.dora?.initialDeadlineHours).toBe(24);
  });
});

describe("A6 — citas del art. 73 RIA", () => {
  it("el plazo ordinario de 15 días se cita en el 73.2, no en el 73.1", () => {
    // El 73.1 es el deber de notificar; los quince días están en el 73.2.
    // Es el mismo error que se corrigió en el RGPD, cometido dos veces.
    expect(calculateRiaDeadline(K, "ORDINARY_SERIOUS").articleRef).toBe("Art. 73.2");
  });

  it("los otros dos supuestos conservan su artículo y su plazo", () => {
    const g = calculateRiaDeadline(K, "WIDESPREAD_INFRINGEMENT");
    expect(g.articleRef).toBe("Art. 73.3");
    expect(g.deadlineHours).toBe(48);
    const m = calculateRiaDeadline(K, "DEATH_INCIDENT");
    expect(m.articleRef).toBe("Art. 73.4");
    expect(m.deadlineHours).toBe(240);
  });

  it("el supuesto de 2 días no se describe como «riesgo inminente»", () => {
    // La norma se remite al art. 3.49.b): alteración grave e irreversible de
    // infraestructuras críticas. No es lo mismo.
    const g = calculateRiaDeadline(K, "WIDESPREAD_INFRINGEMENT");
    expect(g.ruleDescription).not.toMatch(/riesgo inminente/i);
    expect(g.ruleDescription).toMatch(/3\.49/);
  });
});

describe("A6 — aritmética del mes natural", () => {
  it("no desborda de enero a marzo", () => {
    // `setMonth(+1)` sobre el 31 de enero daba 3 de marzo: TRES DÍAS DESPUÉS
    // del mes natural, y en la dirección peligrosa.
    const enero = new Date("2026-01-28T10:00:00.000Z");
    const fin = new Date(calculateDoraDeadlines(enero).finalDeadlineDate);
    expect(fin.getUTCMonth(), `desbordó a ${fin.toISOString()}`).toBe(1); // febrero
  });

  it("es independiente de la zona horaria del proceso", () => {
    // `setMonth` opera en hora local: dos usuarios en husos distintos veían
    // vencimientos distintos del mismo incidente. Se calcula en UTC.
    const k = new Date("2026-01-28T20:00:00.000Z");
    const esperado = calculateDoraDeadlines(k).finalDeadlineDate;
    const tzPrevia = process.env.TZ;
    try {
      for (const tz of ["UTC", "Europe/Madrid", "Pacific/Midway", "Pacific/Kiritimati"]) {
        process.env.TZ = tz;
        expect(calculateDoraDeadlines(k).finalDeadlineDate, `difiere en ${tz}`).toBe(esperado);
      }
    } finally {
      process.env.TZ = tzPrevia;
    }
  });

  it("las horas iniciales son efectivas y la regla aplicada se declara", () => {
    // `Math.round` daba "5" con clasificación a k+30 min bajo un rótulo "4h/24h".
    const r = calculateDoraDeadlines(K, new Date(K.getTime() + 30 * 60_000));
    expect(r.initialDeadlineHours).toBe(4.5);
    expect(r.initialRule).toBe("4H_FROM_CLASSIFICATION");
    expect(calculateDoraDeadlines(K, new Date(K.getTime() + 23 * 3_600_000)).initialRule)
      .toBe("24H_CAP_FROM_KNOWLEDGE");
  });
});

describe("A6 — la clasificación desconocida se advierte, no se oculta", () => {
  it("sin clasificación registrada se muestra el plazo ADVERTIDO", () => {
    // Ocultar un plazo que puede aplicar es peor que mostrarlo con la cautela.
    const r = evaluateMultiregimeIncident({ knowledgeDate: K, isAiRelated: true });
    expect(r.ria).toBeDefined();
    expect(r.ria?.highRiskUnconfirmed).toBe(true);
  });

  it("con alto riesgo acreditado no hay cautela", () => {
    const r = evaluateMultiregimeIncident({ knowledgeDate: K, isAiRelated: true, isAiHighRisk: true });
    expect(r.ria?.highRiskUnconfirmed).toBe(false);
  });

  it("si consta que NO es de alto riesgo, no se emite el reloj", () => {
    expect(
      evaluateMultiregimeIncident({ knowledgeDate: K, isAiRelated: true, isAiHighRisk: false }).ria,
    ).toBeUndefined();
  });
});
