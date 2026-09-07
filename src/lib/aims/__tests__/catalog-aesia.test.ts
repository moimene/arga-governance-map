import { describe, it, expect } from "bun:test";
import {
  AESIA_RIA_REQUIREMENTS,
  ISO_42001_REQUIREMENTS,
  calculateAdaptationPlan,
  deriveDiagnosisStatus,
  computeAssessmentStats,
  getAllMeasuresForFramework,
  getRequirementsForFramework,
} from "../catalog-aesia";

/**
 * GATE VACUO CORREGIDO (2026-09-07, nº5 y nº6 del inventario).
 *
 * Este fichero se titulaba «AESIA Guía 16 Catalog & Conversion Engine» y sus
 * tres primeros tests contaban 12 requisitos y 84 medidas REDUCIENDO el propio
 * array y comparándolo consigo mismo. Dos problemas distintos:
 *
 *  1. El título afirmaba la procedencia —la Guía 16 de AESIA— que es
 *     exactamente lo que el producto NO sostiene. La atribución por requisito
 *     se retiró del catálogo por incorrecta (10 de 12 mal), y la procedencia
 *     del catálogo ENTERO sigue sin cotejar contra la publicación oficial:
 *     es deuda declarada en `no-fabricated-claims.test.ts`, no un hecho
 *     verificado. Un test no puede darla por buena en su nombre.
 *  2. Contar la propia declaración no puede falsar nada. Un cambio de tamaño
 *     deliberado se "arregla" cambiando el número del test, y ningún defecto
 *     del producto lo pone rojo.
 *
 * Lo que sí se comprueba ahora son las invariantes que la pantalla CONSUME: un
 * `subpartId` huérfano hace que `subpartTitle()` pinte «Bloque no
 * identificado», y dos medidas con el mismo `id` comparten respuesta en
 * `computeAssessmentStats` y falsean la madurez sin avisar.
 */
describe("Catálogo interno de requisitos y motor de conversión", () => {
  const CATALOGOS = [
    ["RIA (Reglamento (UE) 2024/1689)", AESIA_RIA_REQUIREMENTS],
    ["ISO 42001", ISO_42001_REQUIREMENTS],
  ] as const;

  it("ningún requisito está vacío: todos tienen bloques y medidas", () => {
    for (const [marco, catalogo] of CATALOGOS) {
      expect(catalogo.length, `${marco}: catálogo vacío`).toBeGreaterThan(0);
      for (const r of catalogo) {
        expect(r.subparts.length, `${marco}/${r.code}: sin bloques`).toBeGreaterThan(0);
        expect(r.measures.length, `${marco}/${r.code}: sin medidas`).toBeGreaterThan(0);
        expect(r.articleRef.length, `${marco}/${r.code}: sin referencia de artículo`).toBeGreaterThan(0);
      }
    }
  });

  it("cada medida cuelga de un bloque que existe en su requisito", () => {
    // Un `subpartId` que no está en `subparts` no rompe nada visiblemente: la
    // ficha pinta «Bloque no identificado» y la medida queda sin encuadre.
    let examinadas = 0;
    for (const [marco, catalogo] of CATALOGOS) {
      for (const r of catalogo) {
        const bloques = new Set(r.subparts.map((s) => s.subpartId));
        for (const m of r.measures) {
          examinadas++;
          expect(
            bloques.has(m.subpartId),
            `${marco}/${r.code}: la medida ${m.code} apunta al bloque ${m.subpartId}, que no existe`,
          ).toBe(true);
        }
      }
    }
    // Un bucle con dos anidamientos puede iterar cero veces y pasar por verde.
    expect(examinadas, "el bucle no ha examinado ninguna medida").toBeGreaterThan(50);
  });

  it("ningún identificador de medida se repite dentro de un marco", () => {
    // `computeAssessmentStats` indexa las respuestas por `m.id`: dos medidas con
    // el mismo id comparten diagnóstico y el score sale mal sin avisar.
    for (const [marco, catalogo] of CATALOGOS) {
      const ids = catalogo.flatMap((r) => r.measures.map((m) => m.id));
      const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(repetidos, `${marco}: identificadores de medida repetidos`).toEqual([]);
      const codigos = catalogo.flatMap((r) => r.measures.map((m) => m.code));
      expect(
        codigos.filter((c, i) => codigos.indexOf(c) !== i),
        `${marco}: códigos de medida repetidos`,
      ).toEqual([]);
    }
  });

  it("el tamaño del catálogo no cambia por accidente (detector, no verificación)", () => {
    // Esto SÍ es un detector de cambio y se declara como tal: pina 12 requisitos
    // y 84 medidas para que una edición involuntaria se note. NO verifica la
    // procedencia: nadie ha cotejado este catálogo contra publicación oficial
    // alguna, y ese cotejo sigue siendo deuda abierta. Si el catálogo cambia a
    // propósito, se cambia el número Y se dice de dónde sale el nuevo.
    expect(AESIA_RIA_REQUIREMENTS.length).toBe(12);
    expect(
      AESIA_RIA_REQUIREMENTS.reduce((sum, r) => sum + r.measures.length, 0),
    ).toBe(84);
  });

  // Absorbido de `src/hooks/__tests__/useAiGovernanceHooks.test.ts`, que se
  // llamaba «Hook Contracts» y no probaba ningún hook: repetía este fichero con
  // cuatro imports sin usar. Esto era lo único suyo que no estaba ya aquí — el
  // selector por marco, que es el que decide qué catálogo ve la pantalla.
  it("selecciona el catálogo por marco: 12 requisitos RIA y 4 de ISO 42001", () => {
    const ria = getRequirementsForFramework("EU_AI_ACT");
    expect(ria.length).toBe(12);
    expect(ria[0].code).toBe("QUALITY_MGMT");
    expect(ria[11].code).toBe("INCIDENT_MGMT");

    const iso = getRequirementsForFramework("ISO_42001");
    expect(iso.length).toBe(4);
    expect(iso[0].code).toBe("ISO_POLICIES");

    // Control discriminante: los dos marcos NO devuelven el mismo catálogo.
    expect(ria[0].code).not.toBe(iso[0].code);
  });

  it("el plan de adaptación se deriva de la escala de madurez del catálogo", () => {
    // L1, L2 -> Plan 01 (Documentar e Implementar)
    expect(calculateAdaptationPlan("L1").code).toBe("01");
    expect(calculateAdaptationPlan("L2").code).toBe("01");

    // L3, L4 -> Plan 02 (Implementar)
    expect(calculateAdaptationPlan("L3").code).toBe("02");
    expect(calculateAdaptationPlan("L4").code).toBe("02");

    // L5 -> Plan 03 (Adaptación Completa)
    expect(calculateAdaptationPlan("L5").code).toBe("03");

    // L6, L7 -> Plan 04 (Documentar)
    expect(calculateAdaptationPlan("L6").code).toBe("04");
    expect(calculateAdaptationPlan("L7").code).toBe("04");

    // L8 -> Plan 05 (Ninguna acción)
    expect(calculateAdaptationPlan("L8").code).toBe("05");

    // Unassigned or invalid
    expect(calculateAdaptationPlan(null).code).toBe("00");
    expect(calculateAdaptationPlan(undefined).code).toBe("00");
    expect(calculateAdaptationPlan("INVALID").code).toBe("00");
  });

  it("should correctly derive diagnosis status", () => {
    expect(deriveDiagnosisStatus("L5")).toBe("01");
    expect(deriveDiagnosisStatus("L1")).toBe("01");
    expect(deriveDiagnosisStatus("")).toBe("00");
    expect(deriveDiagnosisStatus(null)).toBe("00");
    expect(deriveDiagnosisStatus(undefined)).toBe("00");
  });

  it("should calculate assessment statistics and maturity score correctly", () => {
    const allMeasures = getAllMeasuresForFramework("EU_AI_ACT");
    expect(allMeasures.length).toBe(84);

    // Scenario 1: Empty assessments
    const emptyStats = computeAssessmentStats(allMeasures, {});
    expect(emptyStats.totalMeasures).toBe(84);
    expect(emptyStats.diagnosedCount).toBe(0);
    expect(emptyStats.pendingCount).toBe(84);
    expect(emptyStats.maturityScore).toBe(0);

    // Scenario 2: Half L5 (conforming) and half L1 (gap)
    const mixedMap: Record<string, { maturity: string }> = {};
    allMeasures.slice(0, 42).forEach((m) => {
      mixedMap[m.id] = { maturity: "L5" };
    });
    allMeasures.slice(42).forEach((m) => {
      mixedMap[m.id] = { maturity: "L1" };
    });

    const mixedStats = computeAssessmentStats(allMeasures, mixedMap);
    expect(mixedStats.diagnosedCount).toBe(84);
    expect(mixedStats.pendingCount).toBe(0);
    expect(mixedStats.planCounts["03"]).toBe(42);
    expect(mixedStats.planCounts["01"]).toBe(42);
    expect(mixedStats.maturityScore).toBe(50);
    expect(mixedStats.hasGaps).toBe(true);
  });
});
