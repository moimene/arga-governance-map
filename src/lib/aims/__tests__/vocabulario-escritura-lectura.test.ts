import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { buildEvaluationPayload } from "../evaluacion-payload";
import {
  assessmentAcreditaConformidad,
  buildAimsReadiness,
  isAimsTechnicalFileGapCandidate,
  isMaterialSeverity,
  normalizeAimsStatus,
} from "../readiness";
import { SEVERIDADES_INCIDENTE } from "../vocabulario";

/**
 * El vocabulario que el producto ESCRIBE tiene que ser el que el producto LEE.
 *
 * Este test existe porque estaba partido en dos sitios a la vez:
 *
 *  1. Evaluaciones: `evacuacion-payload` escribe `CONFORME | CON_GAPS |
 *     BORRADOR`, y la lectura (`readiness`, Dashboard, Evaluaciones) contaba
 *     sólo `APROBADO`, un valor que NINGÚN camino del producto escribe. Una
 *     evaluación conforme recién creada no cubría a su sistema: el KPI seguía
 *     diciendo «alto riesgo sin evaluación aprobada» para siempre.
 *
 *  2. Incidentes: el alta escribe `CRITICO | ALTO | MEDIO | BAJO` y la ficha
 *     comparaba con `CRITICA` / `ALTA`.
 *
 * Los casos se derivan del CAMINO DE ESCRITURA REAL (`buildEvaluationPayload`),
 * no de una lista escrita a mano: si mañana el payload emite otro valor, este
 * test lo prueba contra la lectura sin que nadie tenga que acordarse.
 */

const REQ = {
  code: "RISK_MGMT",
  title: "Sistema de gestión de riesgos",
  measures: [{ id: "MG_RISK_01" }, { id: "MG_RISK_02" }],
};
const MEDIDAS = [
  { id: "MG_RISK_01", description: "Identificar riesgos" },
  { id: "MG_RISK_02", description: "Evaluar riesgos" },
];

/**
 * `L8` («no aplica») acredita SÓLO con su justificación: la escala la declara
 * obligatoria. Hasta el 2026-09-07 el texto se recogía en pantalla y se
 * descartaba al persistir, así que aquí bastaba con el nivel a secas.
 */
const L8_JUSTIFICADA = { maturity: "L8", justification: "El sistema no trata datos biométricos." };

/** Los tres estados que el camino de escritura puede producir, producidos. */
function estadosQueElProductoEscribe(): string[] {
  const conforme = buildEvaluationPayload({ MG_RISK_01: { maturity: "L5" }, MG_RISK_02: L8_JUSTIFICADA }, MEDIDAS, [REQ]);
  const conGaps = buildEvaluationPayload({ MG_RISK_01: { maturity: "L1" }, MG_RISK_02: { maturity: "L5" } }, MEDIDAS, [REQ]);
  const borrador = buildEvaluationPayload({}, MEDIDAS, [REQ]);
  return [conforme.status, conGaps.status, borrador.status];
}

describe("vocabulario de evaluaciones: escritura ↔ lectura", () => {
  it("el camino de escritura produce los tres estados esperados", () => {
    // Control positivo del instrumento: sin esto, un `buildEvaluationPayload`
    // que devolviera siempre lo mismo dejaría los tres tests de abajo verdes.
    expect(estadosQueElProductoEscribe()).toEqual(["CONFORME", "CON_GAPS", "BORRADOR"]);
  });

  it("el estado conforme que se ESCRIBE acredita conformidad al LEERSE", () => {
    const [conforme, conGaps, borrador] = estadosQueElProductoEscribe();
    expect(assessmentAcreditaConformidad(conforme), `${conforme} se escribe pero no se lee como conforme`).toBe(true);
    expect(assessmentAcreditaConformidad(conGaps)).toBe(false);
    expect(assessmentAcreditaConformidad(borrador)).toBe(false);
    // Y el legado de Cloud sigue contando: hay 5 filas `APROBADO` de ARGA.
    expect(assessmentAcreditaConformidad("APROBADO")).toBe(true);
  });

  it("una evaluación CONFORME cubre a su sistema de alto riesgo", () => {
    const [conforme] = estadosQueElProductoEscribe();
    const resumen = buildAimsReadiness({
      systems: [{ id: "sys-1", status: "ACTIVO", risk_level: "Alto" }],
      assessments: [{ id: "a-1", system_id: "sys-1", status: conforme, score: 100, findings: [] }],
      incidents: [{ id: "i-1", status: "CERRADO", severity: "BAJO", closed_at: "2026-01-01" }],
    });
    const dominio = resumen.domains.find((d) => d.id === "ai-act-assessments");
    expect(dominio?.metric).toBe("1/1 alto riesgo");
    expect(dominio?.status, "una evaluación conforme no cubre al sistema que evalúa").toBe("ready");
  });

  it("los findings que el producto ESCRIBE cuentan como controles cerrados al LEERSE", () => {
    // Tercer sitio donde escritura y lectura estaban partidas.
    // `buildEvaluationPayload` guarda en `findings[].status` el NIVEL de
    // madurez (`L5`, `L8`…), no una palabra de estado; `buildAimsReadiness`
    // contaba cerrados sólo `CERRADO/APROBADO/CONFORME/OK`. Una evaluación
    // contestada entera y conforme daba «0/2 cerrados» y arrastraba el dominio
    // «Controles» a demo-con-gaps para siempre.
    const conforme = buildEvaluationPayload(
      { MG_RISK_01: { maturity: "L5" }, MG_RISK_02: L8_JUSTIFICADA },
      MEDIDAS,
      [REQ],
    );
    // Control positivo: el camino de escritura produce de verdad niveles, no
    // palabras de estado. Sin esto, un payload que emitiera "CONFORME" dejaría
    // el test verde sin probar nada.
    expect(conforme.findings.map((f) => f.status)).toEqual(["L5", "L8"]);

    const resumen = buildAimsReadiness({
      systems: [{ id: "sys-1", status: "ACTIVO", risk_level: "Alto" }],
      assessments: [{ id: "a-1", system_id: "sys-1", status: conforme.status, score: 100, findings: conforme.findings }],
      incidents: [],
    });
    const controles = resumen.domains.find((d) => d.id === "controls");
    expect(controles?.metric, "los findings conformes que se escriben se leen como 0 cerrados")
      .toBe("2/2 cerrados");

    // Y discrimina: un nivel que NO acredita conformidad no cuenta.
    const conGaps = buildEvaluationPayload(
      { MG_RISK_01: { maturity: "L3" }, MG_RISK_02: { maturity: "L5" } },
      MEDIDAS,
      [REQ],
    );
    const resumenGaps = buildAimsReadiness({
      systems: [{ id: "sys-1", status: "ACTIVO", risk_level: "Alto" }],
      assessments: [{ id: "a-1", system_id: "sys-1", status: conGaps.status, score: 50, findings: conGaps.findings }],
      incidents: [],
    });
    expect(resumenGaps.domains.find((d) => d.id === "controls")?.metric, "L3 se cuenta como control cerrado")
      .toBe("1/2 cerrados");
  });

  it("una L8 SIN justificación no acredita: ni el requisito ni el control", () => {
    // La escala declara `requiresJustification: true` para `L8` y la pantalla
    // la pide con asterisco. El texto se recogía y se tiraba al persistir, así
    // que una exención en blanco contaba igual que una motivada.
    const sinMotivo = buildEvaluationPayload(
      { MG_RISK_01: { maturity: "L5" }, MG_RISK_02: { maturity: "L8" } },
      MEDIDAS,
      [REQ],
    );
    expect(sinMotivo.status, "una L8 sin motivo sigue dando el requisito por conforme").toBe("CON_GAPS");
    expect(sinMotivo.checks[0].status).toBe("NO_CONFORME");

    const resumen = buildAimsReadiness({
      systems: [{ id: "sys-1", status: "ACTIVO", risk_level: "Alto" }],
      assessments: [{ id: "a-1", system_id: "sys-1", status: sinMotivo.status, score: 50, findings: sinMotivo.findings }],
      incidents: [],
    });
    expect(resumen.domains.find((d) => d.id === "controls")?.metric, "una L8 en blanco cuenta como control cerrado")
      .toBe("1/2 cerrados");

    // Y el mismo nivel CON motivo sí acredita: la diferencia es el dato, no el nivel.
    const conMotivo = buildEvaluationPayload(
      { MG_RISK_01: { maturity: "L5" }, MG_RISK_02: L8_JUSTIFICADA },
      MEDIDAS,
      [REQ],
    );
    expect(conMotivo.status).toBe("CONFORME");
  });

  it("una evaluación CONFORME no se propone como gap de expediente técnico", () => {
    const [conforme, conGaps] = estadosQueElProductoEscribe();
    expect(
      isAimsTechnicalFileGapCandidate({ id: "a", status: conforme, score: 100, findings: [] }),
      "una evaluación conforme se sigue proponiendo a GRC como brecha",
    ).toBe(false);
    expect(isAimsTechnicalFileGapCandidate({ id: "b", status: conGaps, score: 100, findings: [] })).toBe(true);
  });
});

describe("vocabulario de severidad de incidentes: escritura ↔ lectura", () => {
  // Los valores del `<select>` de `IncidenteNuevo.tsx`, que es quien escribe.
  const QUE_SE_ESCRIBE = ["CRITICO", "ALTO", "MEDIO", "BAJO"];

  it("el alta sigue ofreciendo exactamente estos cuatro valores", () => {
    // Ancla contra el fuente: si el alta cambia de vocabulario, este test cae
    // antes de que la lectura se quede sorda otra vez. Desde el 2026-09-08 el
    // `<select>` se genera del módulo hoja, así que el ancla son las dos
    // mitades: el array y la arista que lo recorre.
    const alta = readFileSync("src/pages/ai-governance/IncidenteNuevo.tsx", "utf8");
    expect(alta, "el alta ya no genera sus opciones del vocabulario").toContain("SEVERIDADES_INCIDENTE.map");
    expect([...SEVERIDADES_INCIDENTE]).toEqual(QUE_SE_ESCRIBE);
  });

  it("la severidad material se reconoce sobre lo que el alta escribe", () => {
    expect(isMaterialSeverity("CRITICO")).toBe(true);
    expect(isMaterialSeverity("ALTO")).toBe(true);
    expect(isMaterialSeverity("MEDIO")).toBe(false);
    expect(isMaterialSeverity("BAJO")).toBe(false);
    // Sin severidad no se afirma materialidad.
    expect(isMaterialSeverity(null)).toBe(false);
    expect(isMaterialSeverity("")).toBe(false);
  });
});

describe("normalización de estados: el dato de Cloud no viene en una sola grafía", () => {
  it("las seis grafías reales de ai_compliance_checks colapsan en tres claves", () => {
    // Medido en Cloud el 2026-09-05: conviven `CONFORME`/`Conforme`,
    // `NO_CONFORME`/`No conforme`, `EN_CURSO`/`En revisión`.
    expect(normalizeAimsStatus("Conforme")).toBe("CONFORME");
    expect(normalizeAimsStatus("No conforme")).toBe("NO_CONFORME");
    expect(normalizeAimsStatus("En revisión")).toBe("EN_REVISION");
  });

  it("una no conformidad REAL no se pinta como vigilancia", () => {
    const resumen = buildAimsReadiness({
      systems: [{ id: "sys-1", status: "ACTIVO", risk_level: "Alto" }],
      assessments: [],
      incidents: [],
      // Grafía tal cual está escrita en Cloud, con tilde y espacio.
      complianceChecks: [
        { id: "c-1", system_id: "sys-1", requirement_code: "AIA-12", requirement_title: "Evidencia y trazabilidad", description: "registro", status: "No conforme" },
      ],
    });
    const monitor = resumen.complianceMonitors.find((m) => m.id === "evidence-recordkeeping");
    expect(monitor?.status, "una no conformidad real se pinta como Vigilancia").toBe("gap");
  });
});
