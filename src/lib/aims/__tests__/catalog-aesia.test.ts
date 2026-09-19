import { describe, it, expect } from "bun:test";
import {
  AESIA_RIA_REQUIREMENTS,
  ISO_42001_REQUIREMENTS,
  calculateAdaptationPlan,
  deriveDiagnosisStatus,
  computeAssessmentStats,
  getAllMeasuresForFramework,
  getRequirementsForFramework,
  subpartTitle,
  TEXTO_COTEJADO_RIA,
  VERSION_CATALOGO_RIA,
  type RequirementDef,
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
    // Esto SÍ es un detector de cambio y se declara como tal: pina el número de
    // requisitos y de medidas para que una edición involuntaria se note. NO
    // verifica la procedencia de la Guía AESIA: eso sigue sin cotejar. Lo que sí
    // se cotejó (2026-09-19) es cada clave y cada título contra el texto
    // consolidado del Reglamento: ver los bloques «Recotejo» de abajo.
    // 84 → 93 → 99: el recotejo de los arts. 12, 13 y 17 añade 9 medidas (17.1 d y e,
    // 13.3 b i, iv, v y vii, y los tres fines del 12.2) y el de los arts. 9, 10,
    // 14 y 72 otras 6 (9.2 c, 9.7, 9.8, 10.2 g, 14.5 y 72.4).
    expect(AESIA_RIA_REQUIREMENTS.length).toBe(12);
    expect(
      AESIA_RIA_REQUIREMENTS.reduce((sum, r) => sum + r.measures.length, 0),
    ).toBe(99);
  });

  // Absorbido de `src/hooks/__tests__/useAiGovernanceHooks.test.ts`, que se
  // llamaba «Hook Contracts» y no probaba ningún hook: repetía este fichero con
  // cuatro imports sin usar. Esto era lo único suyo que no estaba ya aquí — el
  // selector por marco, que es el que decide qué catálogo ve la pantalla.
  it("selecciona el catálogo por marco: 12 requisitos RIA y 10 de ISO 42001", () => {
    const ria = getRequirementsForFramework("EU_AI_ACT");
    expect(ria.length).toBe(12);
    expect(ria[0].code).toBe("QUALITY_MGMT");
    expect(ria[11].code).toBe("INCIDENT_MGMT");

    const iso = getRequirementsForFramework("ISO_42001");
    expect(iso.length).toBe(10);
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
    const n = allMeasures.length;
    expect(n).toBeGreaterThan(50);

    // Scenario 1: Empty assessments
    const emptyStats = computeAssessmentStats(allMeasures, {});
    expect(emptyStats.totalMeasures).toBe(n);
    expect(emptyStats.diagnosedCount).toBe(0);
    expect(emptyStats.pendingCount).toBe(n);
    expect(emptyStats.maturityScore).toBe(0);

    // Scenario 2: Half L5 (conforming) and half L1 (gap)
    const mitad = Math.floor(n / 2);
    const mixedMap: Record<string, { maturity: string }> = {};
    allMeasures.slice(0, mitad).forEach((m) => {
      mixedMap[m.id] = { maturity: "L5" };
    });
    allMeasures.slice(mitad).forEach((m) => {
      mixedMap[m.id] = { maturity: "L1" };
    });

    const mixedStats = computeAssessmentStats(allMeasures, mixedMap);
    expect(mixedStats.diagnosedCount).toBe(n);
    expect(mixedStats.pendingCount).toBe(0);
    expect(mixedStats.planCounts["03"]).toBe(mitad);
    expect(mixedStats.planCounts["01"]).toBe(n - mitad);
    expect(mixedStats.maturityScore).toBe(Math.round((mitad / n) * 100));
    expect(mixedStats.hasGaps).toBe(true);
  });
});

/**
 * RECOTEJO CONTRA EL TEXTO CONSOLIDADO A 27-07-2026 (F1.T12 y F1.T13)
 * --------------------------------------------------------------------
 * Fuente: EUR-Lex, CELEX 02024R1689-20260727 (Reglamento (UE) 2024/1689 tras
 * el Reglamento (UE) 2026/1744), leído literal el 2026-09-19.
 *
 * `CODIGOS_ANTERIORES` es la foto de los 84 códigos MG que había ANTES del
 * recotejo (commit 2327212). Es una línea base que no se mueve: en Cloud hay
 * findings persistidos con estos códigos (la evaluación de Harvey del 07-09
 * responde a las 84) y un código renombrado o movido de requisito dejaría esa
 * respuesta sin medida de la que colgarse.
 */
const CODIGOS_ANTERIORES: Record<string, string[]> = {
  QUALITY_MGMT: ["MG_QUAL_01", "MG_QUAL_02", "MG_QUAL_03", "MG_QUAL_04", "MG_QUAL_05", "MG_QUAL_06", "MG_QUAL_07", "MG_QUAL_08", "MG_QUAL_09", "MG_QUAL_10", "MG_QUAL_11"],
  RISK_MGMT: ["MG_RISK_01", "MG_RISK_02", "MG_RISK_03", "MG_RISK_04", "MG_RISK_05", "MG_RISK_06", "MG_RISK_07", "MG_RISK_08", "MG_RISK_09"],
  HUMAN_OVERSIGHT: ["MG_HUMN_01", "MG_HUMN_02", "MG_HUMN_03", "MG_HUMN_04", "MG_HUMN_05", "MG_HUMN_06", "MG_HUMN_07", "MG_HUMN_08", "MG_HUMN_09"],
  DATA_GOVERNANCE: ["MG_DATA_01", "MG_DATA_02", "MG_DATA_03", "MG_DATA_04", "MG_DATA_05", "MG_DATA_06", "MG_DATA_07", "MG_DATA_08", "MG_DATA_09", "MG_DATA_10"],
  TRANSPARENCY: ["MG_TRANS_01", "MG_TRANS_02", "MG_TRANS_03", "MG_TRANS_04", "MG_TRANS_05", "MG_TRANS_06", "MG_TRANS_07", "MG_TRANS_08", "MG_TRANS_09", "MG_TRANS_10", "MG_TRANS_11"],
  ACCURACY: ["MG_ACCU_01", "MG_ACCU_02", "MG_ACCU_03"],
  ROBUSTNESS: ["MG_ROBU_01", "MG_ROBU_02", "MG_ROBU_03"],
  CYBERSECURITY: ["MG_CIBE_01", "MG_CIBE_02", "MG_CIBE_03", "MG_CIBE_04"],
  LOGGING: ["MG_LOGG_01", "MG_LOGG_02", "MG_LOGG_03", "MG_LOGG_04", "MG_LOGG_05", "MG_LOGG_06", "MG_LOGG_07"],
  TECHNICAL_DOC: ["MG_TDOC_01", "MG_TDOC_02", "MG_TDOC_03", "MG_TDOC_04", "MG_TDOC_05", "MG_TDOC_06", "MG_TDOC_07"],
  POST_MARKET: ["MG_POST_01", "MG_POST_02", "MG_POST_03", "MG_POST_04", "MG_POST_05"],
  INCIDENT_MGMT: ["MG_INCI_01", "MG_INCI_02", "MG_INCI_03", "MG_INCI_04", "MG_INCI_05"],
};

/**
 * Requisitos cuyo recotejo contra el consolidado está hecho y fechado: los doce
 * (F1.T12 los arts. 12, 13 y 17; F1.T13 los 9, 10, 15, 72 y 73, y con ellos el
 * 11 y el 14, que completan el catálogo). Lista literal: un requisito nuevo sin
 * cotejar no entra solo.
 */
const RECOTEJADOS = [
  "QUALITY_MGMT", "RISK_MGMT", "HUMAN_OVERSIGHT", "DATA_GOVERNANCE", "TRANSPARENCY", "ACCURACY",
  "ROBUSTNESS", "CYBERSECURITY", "LOGGING", "TECHNICAL_DOC", "POST_MARKET", "INCIDENT_MGMT",
];

function codigosPerdidos(catalogo: RequirementDef[]): string[] {
  const donde = new Map(catalogo.flatMap((r) => r.measures.map((m) => [m.id, r.code] as const)));
  return Object.entries(CODIGOS_ANTERIORES).flatMap(([codigo, ids]) =>
    ids.filter((id) => donde.get(id) !== codigo).map((id) => `${codigo}/${id}`),
  );
}

function sinFechaDeCotejo(catalogo: RequirementDef[], codigos: string[]): string[] {
  return catalogo
    .filter((r) => codigos.includes(r.code))
    .filter((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.verificadoEl ?? "") || (r.verificadoEl ?? "") < "2026-07-27")
    .map((r) => r.code);
}

const req = (code: string) => {
  const r = AESIA_RIA_REQUIREMENTS.find((x) => x.code === code);
  if (!r) throw new Error(`no existe el requisito ${code}`);
  return r;
};
const medida = (r: RequirementDef, id: string) => {
  const m = r.measures.find((x) => x.id === id);
  if (!m) throw new Error(`${r.code}: no existe la medida ${id}`);
  return m;
};

describe("Recotejo contra el texto consolidado — línea base y fecha", () => {
  it("ningún código MG anterior desaparece ni cambia de requisito", () => {
    expect(Object.values(CODIGOS_ANTERIORES).flat().length).toBe(84);
    expect(codigosPerdidos(AESIA_RIA_REQUIREMENTS)).toEqual([]);
    // Control positivo: renombrar un código lo detecta.
    const mutado = AESIA_RIA_REQUIREMENTS.map((r) =>
      r.code !== "LOGGING"
        ? r
        : { ...r, measures: r.measures.map((m) => (m.id === "MG_LOGG_07" ? { ...m, id: "MG_LOGG_07B" } : m)) },
    );
    expect(codigosPerdidos(mutado)).toEqual(["LOGGING/MG_LOGG_07"]);
  });

  it("toda medida nueva declara la versión en que entra, y ninguna anterior la lleva", () => {
    const anteriores = new Set(Object.values(CODIGOS_ANTERIORES).flat());
    const todas = AESIA_RIA_REQUIREMENTS.flatMap((r) => r.measures);
    const nuevas = todas.filter((m) => !anteriores.has(m.id));
    expect(nuevas.length, "el recotejo no ha añadido ninguna medida").toBeGreaterThan(0);
    for (const m of nuevas) expect(m.desde, `${m.id} sin versión`).toBe(VERSION_CATALOGO_RIA);
    for (const m of todas.filter((x) => anteriores.has(x.id))) {
      expect(m.desde, `${m.id} ya existía y declara versión`).toBeUndefined();
    }
  });

  it("cada requisito declara verificadoEl, y los recotejados con fecha posterior al consolidado", () => {
    expect(TEXTO_COTEJADO_RIA.celex).toBe("02024R1689-20260727");
    for (const r of AESIA_RIA_REQUIREMENTS) {
      expect("verificadoEl" in r, `${r.code}: no declara verificadoEl`).toBe(true);
    }
    // El universo de la lista cubre el catálogo entero: ningún requisito fuera.
    expect(AESIA_RIA_REQUIREMENTS.map((r) => r.code).filter((c) => !RECOTEJADOS.includes(c))).toEqual([]);
    expect(sinFechaDeCotejo(AESIA_RIA_REQUIREMENTS, RECOTEJADOS)).toEqual([]);
    // Control positivo: quitar la fecha a uno lo detecta.
    const mutado = AESIA_RIA_REQUIREMENTS.map((r) => (r.code === "LOGGING" ? { ...r, verificadoEl: null } : r));
    expect(sinFechaDeCotejo(mutado, RECOTEJADOS)).toEqual(["LOGGING"]);
  });
});

describe("Recotejo — art. 12 (conservación de registros)", () => {
  const log = req("LOGGING");

  it("no queda ningún «12.4»: el artículo no tiene apartado 4", () => {
    expect(log.subparts.map((s) => s.subpartId)).not.toContain("12.4");
    expect(JSON.stringify(log)).not.toMatch(/12\.4/);
    // Control positivo del patrón: la serialización sí contiene las claves reales.
    expect(JSON.stringify(log)).toMatch(/12\.3/);
  });

  it("los mínimos del 12.3 se rotulan solo para el anexo III, punto 1, letra a)", () => {
    for (const id of ["MG_LOGG_02", "MG_LOGG_03", "MG_LOGG_04", "MG_LOGG_05", "MG_LOGG_07"]) {
      const m = medida(log, id);
      expect(m.subpartId.startsWith("12.3"), `${id} cuelga de ${m.subpartId}`).toBe(true);
      expect(subpartTitle(log, m.subpartId), `${id}: el bloque no dice a quién aplica`).toContain(
        "anexo III, punto 1, letra a)",
      );
    }
  });

  it("los tres fines del 12.2 tienen medida propia", () => {
    for (const letra of ["a", "b", "c"]) {
      expect(log.measures.some((m) => m.subpartId === `12.2.${letra}`), `12.2.${letra} sin medida`).toBe(true);
    }
  });

  it("la conservación dice seis meses y cita los arts. 19 y 26.6", () => {
    const titulo = subpartTitle(log, medida(log, "MG_LOGG_06").subpartId);
    expect(titulo).toMatch(/seis meses/);
    expect(titulo).toMatch(/\b19\b/);
    expect(titulo).toMatch(/26\.6/);
  });
});

describe("Recotejo — art. 13 (transparencia)", () => {
  const tr = req("TRANSPARENCY");

  it("título oficial y el destinatario es el responsable del despliegue", () => {
    expect(tr.title).toBe("Transparencia y comunicación de información a los responsables del despliegue");
    const texto = [tr.title, tr.description, ...tr.subparts.map((s) => s.titleShort), ...tr.measures.map((m) => m.description)].join(" | ");
    expect(texto.length).toBeGreaterThan(500);
    expect(tr.description).toMatch(/responsables del despliegue/);
    expect(texto).not.toMatch(/usuario/i);
  });

  it("los siete incisos del 13.3 b) tienen medida", () => {
    for (const inciso of ["i", "ii", "iii", "iv", "v", "vi", "vii"]) {
      expect(tr.measures.some((m) => m.subpartId === `13.3.b.${inciso}`), `13.3 b) ${inciso}) sin medida`).toBe(true);
    }
  });

  it("el 13.3 e) cubre recursos, vida útil y mantenimiento", () => {
    const e = tr.measures.filter((m) => m.subpartId === "13.3.e").map((m) => m.description).join(" ");
    expect(e).toMatch(/vida útil/);
    expect(e).toMatch(/mantenimiento/);
  });
});

describe("Recotejo — art. 17 (sistema de gestión de la calidad)", () => {
  const q = req("QUALITY_MGMT");
  const letras = "abcdefghijklm".split("");

  it("una clave por letra del 17.1, de la a) a la m), cada una con su medida", () => {
    expect(q.subparts.map((s) => s.subpartId)).toEqual(letras.map((l) => `17.1.${l}`));
    for (const l of letras) {
      expect(q.measures.some((m) => m.subpartId === `17.1.${l}`), `17.1.${l} sin medida`).toBe(true);
    }
  });

  it("las claves siguen a la letra y no al orden de antes", () => {
    const donde = Object.fromEntries(q.measures.map((m) => [m.id, m.subpartId]));
    // Antes la «d» llevaba la f), la «e» la g)… hasta la «k», que llevaba la m).
    expect(donde).toMatchObject({
      MG_QUAL_01: "17.1.a",
      MG_QUAL_03: "17.1.b",
      MG_QUAL_02: "17.1.c",
      MG_QUAL_04: "17.1.f",
      MG_QUAL_05: "17.1.g",
      MG_QUAL_06: "17.1.h",
      MG_QUAL_07: "17.1.i",
      MG_QUAL_08: "17.1.j",
      MG_QUAL_09: "17.1.k",
      MG_QUAL_10: "17.1.l",
      MG_QUAL_11: "17.1.m",
    });
    // d) y e) no tenían medida: las suyas son nuevas.
    for (const l of ["d", "e"]) {
      const suyas = q.measures.filter((m) => m.subpartId === `17.1.${l}`);
      expect(suyas.length).toBeGreaterThan(0);
      expect(suyas.every((m) => m.desde === VERSION_CATALOGO_RIA)).toBe(true);
    }
  });
});

/** Clave de cada medida del requisito, para asertar la ubicación. */
const ubicacion = (r: RequirementDef) => Object.fromEntries(r.measures.map((m) => [m.id, m.subpartId]));
const textoDe = (r: RequirementDef) =>
  [r.title, r.description, ...r.subparts.map((s) => s.titleShort), ...r.measures.map((m) => m.description)].join(" | ");

describe("Recotejo — art. 9 (sistema de gestión de riesgos)", () => {
  const rk = req("RISK_MGMT");

  it("9.2 b) y c) realineados: el uso indebido va en la b) y la c) tiene medida propia", () => {
    expect(ubicacion(rk)).toMatchObject({ MG_RISK_01: "9.2.a", MG_RISK_02: "9.2.b", MG_RISK_03: "9.2.b", MG_RISK_04: "9.2.d" });
    const c = rk.measures.filter((m) => m.subpartId === "9.2.c");
    expect(c.length).toBeGreaterThan(0);
    expect(c.every((m) => m.desde === VERSION_CATALOGO_RIA)).toBe(true);
    expect(c.map((m) => m.description).join(" ")).toMatch(/vigilancia poscomercialización/);
  });

  it("9.4 a 9.9 en su apartado: combinación, residual, pruebas, condiciones reales, momento y vulnerables", () => {
    expect(ubicacion(rk)).toMatchObject({
      MG_RISK_09: "9.4",
      MG_RISK_07: "9.5",
      MG_RISK_08: "9.6",
      MG_RISK_05: "9.6",
      MG_RISK_06: "9.9",
    });
    expect(subpartTitle(rk, "9.5")).toMatch(/residual/i);
    expect(subpartTitle(rk, "9.6")).toMatch(/prueba/i);
    expect(subpartTitle(rk, "9.7")).toMatch(/condiciones reales/i);
    expect(subpartTitle(rk, "9.8")).toMatch(/umbrales/i);
    for (const clave of ["9.7", "9.8"]) {
      expect(rk.measures.some((m) => m.subpartId === clave && m.desde === VERSION_CATALOGO_RIA), `${clave} sin medida`).toBe(true);
    }
  });
});

describe("Recotejo — art. 10 (datos y gobernanza de datos)", () => {
  const dg = req("DATA_GOVERNANCE");

  it("las ocho letras del 10.2 tienen medida, con la g) nueva y las lagunas en la h)", () => {
    for (const l of "abcdefgh".split("")) {
      expect(dg.measures.some((m) => m.subpartId === `10.2.${l}`), `10.2.${l} sin medida`).toBe(true);
    }
    expect(ubicacion(dg).MG_DATA_07).toBe("10.2.h");
    const g = dg.measures.filter((m) => m.subpartId === "10.2.g");
    expect(g.every((m) => m.desde === VERSION_CATALOGO_RIA)).toBe(true);
    expect(g.map((m) => m.description).join(" ")).toMatch(/sesgos/);
  });

  it("el 10.5 está suprimido: las categorías especiales cuelgan del art. 4 bis", () => {
    expect(JSON.stringify(dg)).not.toMatch(/"10\.5"/);
    expect(JSON.stringify(dg)).toMatch(/"10\.4"/);
    const titulo = subpartTitle(dg, ubicacion(dg).MG_DATA_10);
    expect(titulo).toMatch(/art\. 4 bis/);
  });
});

describe("Recotejo — art. 15 (precisión, solidez y ciberseguridad)", () => {
  it("precisión: el nivel y su uniformidad en el 15.1; las métricas en las instrucciones, 15.3", () => {
    expect(ubicacion(req("ACCURACY"))).toEqual({ MG_ACCU_01: "15.1", MG_ACCU_02: "15.3", MG_ACCU_03: "15.1" });
  });

  it("solidez en el 15.4 y ciberseguridad en el 15.5", () => {
    const sol = req("ROBUSTNESS");
    expect(Object.values(ubicacion(sol)).every((k) => k.startsWith("15.4"))).toBe(true);
    expect(Object.values(ubicacion(req("CYBERSECURITY"))).every((k) => k.startsWith("15.5"))).toBe(true);
    // Los intentos de alteración por terceros son ciberseguridad (15.5), no solidez.
    expect(medida(sol, "MG_ROBU_01").description).not.toMatch(/alteraci/);
  });

  it("MG_ROBU_03 corregida: bucles de retroalimentación, no «no degradar»", () => {
    const m = medida(req("ROBUSTNESS"), "MG_ROBU_03");
    expect(m.description).toMatch(/bucles de retroalimentación/);
    expect(m.description).not.toMatch(/degrad/);
  });
});

describe("Recotejo — art. 72 (vigilancia poscomercialización)", () => {
  const pm = req("POST_MARKET");

  it("claves del 72.1 al 72.4, cada una con medida, y ningún 72.5", () => {
    expect(JSON.stringify(pm)).not.toMatch(/72\.5/);
    for (const ap of ["72.1", "72.2", "72.3", "72.4"]) {
      expect(pm.measures.some((m) => m.subpartId === ap), `${ap} sin medida`).toBe(true);
    }
  });
});

describe("Recotejo — art. 73 (incidentes graves)", () => {
  const inc = req("INCIDENT_MGMT");

  it("MG_INCI_01 con los tres plazos: 15, 10 y 2 días", () => {
    const d = medida(inc, "MG_INCI_01").description;
    expect(d).toMatch(/\b15 días/);
    expect(d).toMatch(/\b10 días/);
    expect(d).toMatch(/\b2 días/);
  });

  it("sin «afectados»: el art. 73 notifica a la autoridad de vigilancia del mercado", () => {
    const texto = textoDe(inc);
    expect(texto).toMatch(/autoridad(es)? de vigilancia del mercado/);
    expect(texto).not.toMatch(/afectados/);
  });

  it("claves del art. 73 que existen: 73.1 a 73.5 en la notificación y 73.6 en la investigación", () => {
    const u = ubicacion(inc);
    expect(u).toMatchObject({ MG_INCI_01: "73.1", MG_INCI_02: "73.6.p1", MG_INCI_03: "73.6.p1", MG_INCI_04: "73.6.p2" });
  });
});

describe("Recotejo — arts. 11 y 14 (para cerrar el catálogo)", () => {
  it("documentación técnica: el 11.2 es del anexo I, así que las dos medidas del art. 11 van en el 11.1", () => {
    const td = req("TECHNICAL_DOC");
    expect(td.subparts.map((s) => s.subpartId)).not.toContain("11.2");
    expect(ubicacion(td)).toMatchObject({
      MG_TDOC_01: "11.1",
      MG_TDOC_02: "11.1",
      MG_TDOC_04: "AnexoIV.1.h",
      MG_TDOC_06: "AnexoIV.2.d",
      MG_TDOC_07: "AnexoIV.2.g",
    });
  });

  it("supervisión humana: el 14.5 tiene medida, rotulada solo para el anexo III, punto 1, letra a)", () => {
    const ho = req("HUMAN_OVERSIGHT");
    const m = ho.measures.filter((x) => x.subpartId === "14.5");
    expect(m.length).toBe(1);
    expect(m[0].desde).toBe(VERSION_CATALOGO_RIA);
    expect(subpartTitle(ho, "14.5")).toContain("anexo III, punto 1, letra a)");
  });
});
