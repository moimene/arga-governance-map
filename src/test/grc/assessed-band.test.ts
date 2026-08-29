import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ORDEN_BANDAS, ETIQUETA_BANDA, tieneEjes,
  matchesScoreFilter, countSeverity, PRIORIDAD_TODOS,
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

  it("decide por la banda si los ejes se ofrecen", () => {
    expect(src).toContain("assessed_band");
    expect(src).toMatch(/assessed_band\s*(\?|&&|==|!=)/);
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

  it("declara la limitación de la escala", () => {
    expect(src).toContain("NOTA_ESCALA");
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
    // la CHECK permite (sin ejes, sin banda), solo prohíbe banda junto a ejes.
    expect(matchesScoreFilter({}, "bajos")).toBe(false);
    expect(countSeverity([{}])).toEqual({ criticos: 0, altos: 0, sinEjes: 1 });
  });
});

describe("D-2 — y Risk360 usa esas funciones, no una copia propia", () => {
  // El bloque de arriba prueba el COMPORTAMIENTO de las funciones puras, lo que
  // mata cualquier variante semántica del defecto (constante intermedia, tabla
  // de lookup, switch, includes…). Pero no probaría nada si la pantalla dejara
  // de llamarlas y se reimplementara el recuento en línea — que es exactamente
  // el mutante M6 de la review: revertir solo el KPI. Esta es la arista.
  const RISK360 = read("src/pages/grc/Risk360.tsx");

  it("delega el recuento de severidad y el filtro de prioridad", () => {
    expect(RISK360).toContain("countSeverity(");
    expect(RISK360).toContain("matchesScoreFilter(");
  });

  it("no define su propia versión de ninguna de las dos", () => {
    expect(/function\s+(countSeverity|matchesScoreFilter|riskScore)\b/.test(RISK360)).toBe(false);
  });
});
