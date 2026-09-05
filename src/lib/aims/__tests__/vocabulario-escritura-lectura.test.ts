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

/** Los tres estados que el camino de escritura puede producir, producidos. */
function estadosQueElProductoEscribe(): string[] {
  const conforme = buildEvaluationPayload({ MG_RISK_01: { maturity: "L5" }, MG_RISK_02: { maturity: "L8" } }, MEDIDAS, [REQ]);
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
    // antes de que la lectura se quede sorda otra vez.
    const alta = readFileSync("src/pages/ai-governance/IncidenteNuevo.tsx", "utf8");
    const opciones = [...alta.matchAll(/<option value="([A-Z_]+)">/g)].map((m) => m[1]);
    for (const v of QUE_SE_ESCRIBE) {
      expect(opciones, `el alta ya no ofrece ${v}`).toContain(v);
    }
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
