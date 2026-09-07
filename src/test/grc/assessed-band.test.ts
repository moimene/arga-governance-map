import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sinComentarios } from "../helpers/sin-comentarios";
import { resolve } from "node:path";
import {
  ORDEN_BANDAS, ETIQUETA_BANDA, tieneEjes,
  matchesScoreFilter, countSeverity, PRIORIDAD_TODOS,
  lecturaRiesgo, AVISO_DOBLE_LECTURA,
} from "@/lib/grc/assessed-band";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("G5 — bandas evaluadas", () => {
  it("el orden va de mayor a menor y los dos verdes están colapsados", () => {
    expect(ORDEN_BANDAS).toEqual(["ROJO", "NARANJA", "AMARILLO", "VERDE", "NO_EVALUADA"]);
  });

  it("ninguna etiqueta nombra un nivel que la fuente no publica", () => {
    const prohibidas = ["crítico", "critico", "alto", "medio", "bajo", "grave", "leve"];
    for (const t of Object.values(ETIQUETA_BANDA))
      for (const p of prohibidas)
        expect(t.toLowerCase(), `la etiqueta "${t}" nombra un nivel inventado`).not.toContain(p);
  });

  it("tieneEjes distingue el riesgo clásico del evaluado por banda", () => {
    expect(tieneEjes({ probability: 3, impact: 4 })).toBe(true);
    expect(tieneEjes({ probability: null, impact: null })).toBe(false);
    expect(tieneEjes({ probability: 3, impact: null })).toBe(false);
  });
});

describe("G5 — Risk 360 no inventa ejes", () => {
  const src = read("src/pages/grc/Risk360.tsx");

  it("ya no hay defaults que rellenen probability/impact con 1", () => {
    expect(src).not.toMatch(/probability\s*\?\?\s*1/);
    expect(src).not.toMatch(/impact\s*\?\?\s*1/);
  });

  it("la rama se decide por forma del dato, nunca por tenant", () => {
    expect(src).toContain("tieneEjes");
    expect(src).not.toMatch(/tenant_?[Ii]d\s*===/);
  });
});

describe("G5 — el editor no ofrece ejes que la fuente no publica", () => {
  const src = read("src/pages/grc/RiskEditor.tsx");

  it("ya no pre-rellena probability/impact con un 3 inventado", () => {
    expect(src).not.toMatch(/probability\s*\?\?\s*3/);
    expect(src).not.toMatch(/impact\s*\?\?\s*3/);
  });

  it("no decide por su cuenta qué evaluación ofrece: delega en el módulo", () => {
    expect(src).toContain("lecturaRiesgo(");
    // El `!!risk?.assessed_band` que vivía aquí escondía los ejes de un riesgo
    // que trae los dos Y LOS DEJABA SIN GUARDAR. La arista de verdad —que el
    // formulario ofrezca y guarde las dos— es de comportamiento y vive abajo.
    expect(src).not.toContain("evaluadoPorBanda");
  });
});

describe("G5 — el detalle del riesgo lee el desglose, no solo la banda", () => {
  const src = read("src/pages/grc/RiskDetalle.tsx");

  it("consume assessment_breakdown con un guard vivo", () => {
    expect(src).toMatch(/assessment_breakdown\s*(\?|&&|\))/);
  });

  it("pinta las dos familias de columnas del mapa", () => {
    expect(src).toContain("areas_negocio");
    expect(src).toContain("departamentos_internos");
  });

  it("marca las celdas sin evaluar en vez de pintarlas como un nivel", () => {
    expect(src).toContain("NO_EVALUADA");
  });

  it("declara la limitación de la escala EN EL RENDER, no solo en el import", () => {
    // `toContain("NOTA_ESCALA")` lo satisfacía la línea de import: el revisor
    // sustituyó `{NOTA_ESCALA}` por texto fijo en el único render (:186) y el
    // test siguió verde. Se exige la constante en posición de render JSX y
    // sobre el fuente sin comentarios, para que la prosa que lo explica no
    // satisfaga el propio guard. Sigue siendo un guard de texto: la lectura en
    // el DOM de esta ficha vive en src/test/grc/perimetro-declarado.test.tsx.
    expect(sinComentarios(src)).toMatch(/\{\s*NOTA_ESCALA\s*\}/);
  });
});

describe("D-2 — una banda NUNCA cuenta como un nivel con nombre", () => {
  // Este bloque sustituye a un guard por expresión regular sobre el código
  // fuente de Risk360. La review de la Tarea 1 lo sometió a prueba de mutación
  // y ESCAPARON 6 de 8 variantes semánticamente idénticas del defecto —entre
  // ellas revertir el KPI, que es justo la mitad del arreglo que el commit
  // prometía—. Un guard de texto es una carrera armamentística que se pierde:
  // se comprueba el COMPORTAMIENTO, que no depende de cómo esté escrito.
  const ROJO = { assessed_band: "ROJO" as const };
  const NARANJA = { assessed_band: "NARANJA" as const };
  const NO_EVALUADA = { assessed_band: "NO_EVALUADA" as const };
  const CON_EJES = { probability: 5, impact: 5 };          // score 25 -> crítico
  const CON_EJES_ALTO = { probability: 4, impact: 4 };     // score 16 -> alto

  it("ninguna banda satisface ningún filtro de prioridad", () => {
    for (const banda of [ROJO, NARANJA, NO_EVALUADA, { assessed_band: "AMARILLO" as const }, { assessed_band: "VERDE" as const }]) {
      for (const filtro of ["criticos", "altos", "medios", "bajos"]) {
        expect(matchesScoreFilter(banda, filtro)).toBe(false);
      }
    }
  });

  it("NO_EVALUADA no es 'bajos': un delito sin evaluar no es de riesgo bajo", () => {
    expect(matchesScoreFilter(NO_EVALUADA, "bajos")).toBe(false);
  });

  it("las bandas sí pasan el filtro 'Todos'", () => {
    expect(matchesScoreFilter(ROJO, PRIORIDAD_TODOS)).toBe(true);
    expect(matchesScoreFilter(NO_EVALUADA, PRIORIDAD_TODOS)).toBe(true);
  });

  it("countSeverity no suma bandas: ROJO no es crítico ni NARANJA es alto", () => {
    const r = countSeverity([ROJO, NARANJA, NO_EVALUADA]);
    expect(r.criticos).toBe(0);
    expect(r.altos).toBe(0);
    expect(r.sinEjes).toBe(3);
  });

  it("countSeverity sí suma los riesgos con ejes — el camino de ARGA, intacto", () => {
    const r = countSeverity([CON_EJES, CON_EJES_ALTO, ROJO]);
    expect(r.criticos).toBe(1);
    expect(r.altos).toBe(1);
    expect(r.sinEjes).toBe(1);
  });

  it("un riesgo sin ejes y sin banda tampoco cae en 'bajos'", () => {
    // Celda hoy despoblada en Cloud (0 filas en ambos tenants) pero ALCANZABLE:
    // ninguna CHECK ha exigido nunca que un riesgo traiga evaluación.
    expect(matchesScoreFilter({}, "bajos")).toBe(false);
    expect(countSeverity([{}])).toEqual({ criticos: 0, altos: 0, sinEjes: 1 });
  });
});

describe("D-2 — y Risk360 usa esas funciones, no una copia propia", () => {
  // BACKSTOP, Y ES LA CAPA DÉBIL. Esto es un grep: `void countSeverity(…)` al
  // lado de un recuento reimplementado en línea lo satisface entero, porque la
  // cadena sigue en el fichero aunque el KPI vuelva a contar bandas como
  // críticos. La arista de verdad se comprueba RENDERIZANDO Risk360 y leyendo
  // el KPI en el DOM, en src/test/grc/perimetro-declarado.test.tsx (#1119);
  // este bloque se conserva solo porque es barato y cubre el caso trivial.
  const RISK360 = read("src/pages/grc/Risk360.tsx");

  it("delega el recuento de severidad y el filtro de prioridad", () => {
    expect(RISK360).toContain("countSeverity(");
    expect(RISK360).toContain("matchesScoreFilter(");
  });

  it("no define su propia versión de ninguna de las dos", () => {
    expect(/function\s+(countSeverity|matchesScoreFilter|riskScore)\b/.test(RISK360)).toBe(false);
  });
});


describe("2026-09-07 — un riesgo puede traer DOS evaluaciones y ninguna se oculta", () => {
  // La CHECK `risks_banda_sin_ejes` hacía esta celda inalcanzable. Retirada por
  // decisión expresa del usuario (migración 20260907T2) para poder sembrar
  // Garrigues con dato simulado persistente, la precedencia deja de ser
  // implícita y pasa a estar escrita en un solo sitio. Estos son tests de
  // COMPORTAMIENTO sobre la función pura: no dependen de cómo se escriba la
  // pantalla que los consume.
  const EJES = { probability: 2, impact: 2 };            // score 4
  const BANDA = { assessed_band: "ROJO" as const };
  const AMBAS = { ...EJES, ...BANDA };

  it("solo ejes: se pintan los ejes y no hay banda que ocultar", () => {
    const l = lecturaRiesgo(EJES);
    expect(l.modo).toBe("EJES");
    expect(l.muestraEjes).toBe(true);
    expect(l.muestraBanda).toBe(false);
    expect(l.score).toBe(4);
    expect(l.banda).toBeNull();
    expect(l.avisoDobleLectura).toBeNull();
  });

  it("solo banda: se pinta la banda y NO se inventa un score", () => {
    const l = lecturaRiesgo(BANDA);
    expect(l.modo).toBe("BANDA");
    expect(l.muestraEjes).toBe(false);
    expect(l.muestraBanda).toBe(true);
    expect(l.score).toBeNull();
    expect(l.banda).toBe("ROJO");
    expect(l.avisoDobleLectura).toBeNull();
  });

  it("las dos: se pintan LAS DOS y se declara que son dos lecturas", () => {
    const l = lecturaRiesgo(AMBAS);
    expect(l.modo).toBe("AMBAS");
    // Lo que el ternario anterior hacía mal: la banda desaparecía.
    expect(l.muestraBanda, "la banda no puede ocultarse tras los ejes").toBe(true);
    expect(l.muestraEjes).toBe(true);
    expect(l.banda).toBe("ROJO");
    expect(l.score).toBe(4);
    expect(l.avisoDobleLectura).toBe(AVISO_DOBLE_LECTURA);
  });

  it("el aviso dice que NO se concilian, en vez de fingir que coinciden", () => {
    expect(AVISO_DOBLE_LECTURA).toMatch(/no se concilian/i);
    // Y no nombra un nivel que la fuente no publica, como el resto del módulo.
    for (const prohibida of ["crítico", "alto", "medio", "bajo"])
      expect(AVISO_DOBLE_LECTURA.toLowerCase()).not.toContain(prohibida);
  });

  it("sin nada: ni ejes ni banda ni aviso", () => {
    const l = lecturaRiesgo({});
    expect(l.modo).toBe("SIN_EVALUAR");
    expect(l.muestraEjes).toBe(false);
    expect(l.muestraBanda).toBe(false);
    expect(l.score).toBeNull();
    expect(l.avisoDobleLectura).toBeNull();
  });

  it("con las dos, la escala 1-25 sigue siendo SOLO de los ejes", () => {
    // Banda ROJA + ejes 2x2. El riesgo entra por sus ejes (score 4 -> bajos) y
    // la banda no lo asciende a crítico: la banda nunca entra en esta escala.
    expect(matchesScoreFilter(AMBAS, "bajos")).toBe(true);
    expect(matchesScoreFilter(AMBAS, "criticos")).toBe(false);
    expect(countSeverity([AMBAS])).toEqual({ criticos: 0, altos: 0, sinEjes: 0 });
    // Y al revés: unos ejes altos no degradan por llevar banda VERDE.
    const verdeAlto = { probability: 5, impact: 5, assessed_band: "VERDE" as const };
    expect(countSeverity([verdeAlto])).toEqual({ criticos: 1, altos: 0, sinEjes: 0 });
  });

  it("las tres pantallas importan el criterio; ninguna lo reimplementa", () => {
    // BACKSTOP BARATO y capa débil declarada: es un grep. La arista real —que
    // la pantalla PINTE las dos lecturas— se lee en el DOM en
    // src/test/grc/perimetro-declarado.test.tsx.
    for (const ruta of [
      "src/pages/grc/RiskDetalle.tsx",
      "src/pages/grc/Risk360.tsx",
      "src/pages/grc/RiskEditor.tsx",
    ]) {
      const fuente = sinComentarios(read(ruta));
      expect(fuente, ruta).toContain("lecturaRiesgo(");
      expect(
        /function\s+lecturaRiesgo\b/.test(fuente),
        `${ruta} define su propia versión del criterio`,
      ).toBe(false);
    }
  });
});
