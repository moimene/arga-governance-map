// MOI-215 — un solo cálculo de los plazos DORA/RGPD para AIMS y GRC.
//
// Dos cosas se comprueban aquí, y las dos tienen que sobrevivir a que alguien
// reintroduzca un segundo cálculo:
//  1. Equivalencia: AIMS (`calculateDoraDeadlines`/`calculateGdprDeadline`) y
//     GRC (`computeDoraDeadlines`/`computeGdprBreachDeadlines`) dan la MISMA
//     fecha para los mismos casos difíciles (sin clasificar, k+30min, k+23h,
//     medianoche UTC, fin de enero, fin de mes, RGPD 72h). Antes de MOI-215 no
//     la daban: AIMS resolvía sin clasificar a k+4h y GRC a k+24h.
//  2. Backstop de fuente: ni `incident-clocks.ts` (AIMS) ni `regulatory-clocks.ts`
//     (GRC) vuelven a traer su propia aritmética de 4h/24h/72h para DORA o de
//     72h para el RGPD — la delegan en `regulatory-deadlines.ts`. Es la capa
//     débil (mira el fuente, no el comportamiento), pero el test 1 ya cubre el
//     comportamiento: si alguien reintroduce un cálculo paralelo que SÍ da el
//     mismo resultado hoy, este backstop lo sigue cazando por construcción.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateDoraDeadlines, calculateGdprDeadline } from "@/lib/aims/incident-clocks";
import { computeDoraDeadlines, computeGdprBreachDeadlines } from "@/lib/grc/regulatory-clocks";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

const K = "2026-08-28T10:00:00.000Z";

describe("MOI-215 — equivalencia AIMS/GRC de los plazos DORA", () => {
  const casos: { nombre: string; classificationDate?: string }[] = [
    { nombre: "sin clasificar" },
    { nombre: "clasificado a k+30min", classificationDate: new Date(new Date(K).getTime() + 30 * 60_000).toISOString() },
    { nombre: "clasificado a k+23h (tope de 24h manda)", classificationDate: new Date(new Date(K).getTime() + 23 * 3_600_000).toISOString() },
    { nombre: "clasificado en el mismo instante del conocimiento", classificationDate: K },
  ];

  for (const { nombre, classificationDate } of casos) {
    it(`${nombre}: misma fecha inicial en AIMS y GRC`, () => {
      const aims = calculateDoraDeadlines(K, classificationDate);
      const grc = computeDoraDeadlines(K, classificationDate ?? null);
      expect(aims.initialDeadlineDate).toBe(grc.initialNotificationDeadline.toISOString());
      expect(aims.intermediateDeadlineDate).toBe(grc.intermediateReportDeadline.toISOString());
      expect(aims.finalDeadlineDate).toBe(grc.finalReportDeadline.toISOString());
    });
  }

  it("medianoche UTC exacta: ambos calculan el mismo tope de 24h", () => {
    const medianoche = "2026-03-01T00:00:00.000Z";
    const aims = calculateDoraDeadlines(medianoche);
    const grc = computeDoraDeadlines(medianoche);
    expect(aims.initialDeadlineDate).toBe("2026-03-02T00:00:00.000Z");
    expect(aims.initialDeadlineDate).toBe(grc.initialNotificationDeadline.toISOString());
  });

  it("31 de enero: el informe final recorta al último día de febrero en los dos", () => {
    const enero31 = "2026-01-31T09:00:00.000Z";
    const aims = calculateDoraDeadlines(enero31);
    const grc = computeDoraDeadlines(enero31);
    // conocimiento 31/01 09:00Z → inicial +24h = 01/02 09:00Z → intermedio
    // +72h = 04/02 09:00Z → final +1 mes natural = 04/03, NO 28/02: el
    // recorte de `addOneMonthUtc` sólo actúa cuando el día de destino no
    // existe, y marzo sí tiene día 4.
    expect(aims.finalDeadlineDate).toBe(grc.finalReportDeadline.toISOString());
  });

  it("fin de mes: 30 de septiembre no desborda a octubre en ninguno de los dos", () => {
    // conocimiento tal que el intermedio caiga el 30 o 31: se fuerza con una
    // clasificación que deje el intermedio a fin de agosto.
    const k = "2026-08-27T09:00:00.000Z";
    const clasificacion = "2026-08-27T09:00:00.000Z"; // inicial = k+4h = 27/08 13:00Z
    const aims = calculateDoraDeadlines(k, clasificacion);
    const grc = computeDoraDeadlines(k, clasificacion);
    // intermedio = 27/08 13:00Z + 72h = 30/08 13:00Z → final = 30/09 13:00Z (septiembre tiene 30 días)
    expect(aims.intermediateDeadlineDate).toBe("2026-08-30T13:00:00.000Z");
    expect(aims.finalDeadlineDate).toBe("2026-09-30T13:00:00.000Z");
    expect(aims.finalDeadlineDate).toBe(grc.finalReportDeadline.toISOString());
  });
});

describe("MOI-215 — equivalencia AIMS/GRC del reloj RGPD (72h)", () => {
  it("mismo vencimiento de 72h desde el conocimiento", () => {
    const aims = calculateGdprDeadline(K, false);
    const grc = computeGdprBreachDeadlines(K, false);
    expect(aims.deadlineDate).toBe(grc.authorityNotificationDeadline.toISOString());
  });

  it("el alto riesgo no cambia el plazo de 72h en ninguno de los dos", () => {
    const aims = calculateGdprDeadline(K, true);
    const grc = computeGdprBreachDeadlines(K, true);
    expect(aims.deadlineDate).toBe(grc.authorityNotificationDeadline.toISOString());
  });
});

describe("MOI-215 — backstop: un solo sitio calcula, nadie reimplementa", () => {
  const aimsSrc = sinComentarios(
    readFileSync(join(process.cwd(), "src/lib/aims/incident-clocks.ts"), "utf8"),
  );
  const grcSrc = sinComentarios(
    readFileSync(join(process.cwd(), "src/lib/grc/regulatory-clocks.ts"), "utf8"),
  );

  it("los dos consumidores importan el cálculo único", () => {
    expect(aimsSrc).toContain('from "@/lib/regulatory-deadlines"');
    expect(aimsSrc).toContain("computeDoraDeadlineMilestones");
    expect(grcSrc).toContain('from "@/lib/regulatory-deadlines"');
    expect(grcSrc).toContain("computeDoraDeadlineMilestones");
  });

  it("AIMS ya no trae su propia aritmética de 4h/24h para DORA", () => {
    // Antes de MOI-215: `deadline4h`/`deadline24h`/`4 * 60 * 60 * 1000` vivían
    // aquí. Si reaparecen, es un segundo cálculo.
    expect(aimsSrc).not.toMatch(/4\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(aimsSrc).not.toMatch(/24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(aimsSrc).not.toContain("deadline4h");
    expect(aimsSrc).not.toContain("deadline24h");
  });

  it("GRC ya no trae su propia aritmética de 4h/24h para DORA", () => {
    expect(grcSrc).not.toContain("max4hFromClassification");
    expect(grcSrc).not.toContain("max24hFromKnowledge");
  });

  it("el mes natural de DORA se suma en UTC en los dos (no `addCalendarMonths`, que sigue en hora local para NIS2/DSAR)", () => {
    // `addCalendarMonths` sigue existiendo en GRC (NIS2, DSAR: fuera de
    // alcance de MOI-215) pero no debe seguir siendo lo que suma el mes final
    // de DORA — eso es `addOneMonthUtc`, dentro del cálculo único.
    expect(grcSrc).toMatch(/computeDoraDeadlineMilestones\(/);
    const doraFn = grcSrc.slice(grcSrc.indexOf("export function computeDoraDeadlines"));
    const doraFnBody = doraFn.slice(0, doraFn.indexOf("\n}\n") + 3);
    expect(doraFnBody).not.toContain("addCalendarMonths(");
  });
});
