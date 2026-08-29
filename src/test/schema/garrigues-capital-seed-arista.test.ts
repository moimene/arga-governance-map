// C1 Task 3 — test de ARISTA del seed de capital de la matriz Garrigues.
//
// El mutante que este fichero existe para matar: «el seed vuelve a calcular por su
// cuenta con los mismos números». Probar `estructura-art7.ts` a solas NO lo detecta —
// el módulo sigue verde aunque nadie lo llame. Aquí se prueba la ARISTA seed→módulo
// por dos vías que fallan por motivos distintos:
//
//   (a) PASSTHROUGH observable. `buildMatrizHoldings` recibe holdings con valores
//       imposibles (42,4242 % por 7 títulos de clase B) y debe copiarlos verbatim.
//       Un seed que derive el porcentaje de títulos × nominal / capital devolvería
//       ~6,3e-5 y el test cae. Mata la reimplementación DENTRO del constructor de filas.
//
//   (b) IMPORT-GRAPH del fichero. (a) no cubre `main()`: un mutante que ignore
//       `repartirCenso` y arme el censo con un bucle propio y las mismas constantes
//       pasaría (a) sin despeinarse, porque (a) nunca ejecuta `main()`. Por eso se
//       lee el fuente del seed, se le quitan los comentarios y se exige que importe
//       el módulo, que llame a `repartirCenso`, y que NO contenga ninguna de las
//       constantes del art. 7 en crudo ni las tres constantes locales borradas.
//
// Puro: sin red, sin Cloud, sin skip posible.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildMatrizHoldings, filasMatrizDesdeCenso } from "../../../scripts/seed-garrigues-capital";
import {
  ART7_CLASES, AUTOCARTERA_TITULOS_A, pctCapital, repartirCenso, type Holding,
} from "../../../scripts/garrigues/capital/estructura-art7";
import censo from "../../../scripts/garrigues/censo/socios-acta-2026-05-06.json";

const SEED_PATH = new URL("../../../scripts/seed-garrigues-capital.ts", import.meta.url).pathname;

/** Fuente del seed sin comentarios: lo que se busca son literales de CÓDIGO. */
function codigoDelSeed(): string {
  return readFileSync(SEED_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    // El guard `[^:]` evita comerse el `//` de "https://…" y el resto de esa línea.
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("arista seed→art.7 (a) — el constructor de filas copia, no recalcula", () => {
  const sintetico: Holding[] = [
    { nombre: "SOCIO IMPOSIBLE", clase: "B", titulos: 7, pctCapital: 42.4242, votos: 7, asignacionClase: "INFERIDO" },
    { nombre: "OTRO IMPOSIBLE", clase: "A", titulos: 99, pctCapital: 13.13, votos: 2475, asignacionClase: "INFERIDO" },
  ];

  it("porcentaje y títulos del socio salen del módulo, verbatim", () => {
    const filas = buildMatrizHoldings(sintetico);
    expect(filas[0].porcentaje_capital).toBe(42.4242);
    expect(filas[0].numero_titulos).toBe(7);
    expect(filas[0].classCode).toBe("B");
    expect(filas[1].porcentaje_capital).toBe(13.13);
    expect(filas[1].numero_titulos).toBe(99);
    // Si el seed recalculase, para 7 títulos de clase B saldría ~6,3e-5, no 42,4242.
    expect(pctCapital("B", 7)).toBeLessThan(0.001);
  });

  it("la autocartera se añade siempre y sale del módulo, no de un literal", () => {
    const filas = buildMatrizHoldings(sintetico);
    expect(filas).toHaveLength(sintetico.length + 1);
    const auto = filas.at(-1);
    expect(auto.is_treasury).toBe(true);
    expect(auto.voting_rights).toBe(false);
    expect(auto.nombre).toBeNull();
    expect(auto.numero_titulos).toBe(AUTOCARTERA_TITULOS_A);
    expect(auto.porcentaje_capital).toBe(pctCapital("A", AUTOCARTERA_TITULOS_A));
  });

  it("la procedencia va etiquetada: FIRME en todo, asignacion_clase solo en los socios", () => {
    const filas = buildMatrizHoldings(sintetico);
    expect(filas.every((f) => f.metadata.confianza === "FIRME")).toBe(true);
    expect(filas.every((f) => f.metadata.fuente === "art. 7 de los Estatutos Sociales")).toBe(true);
    expect(filas.filter((f) => !f.is_treasury).every((f) => f.metadata.asignacion_clase === "INFERIDO")).toBe(true);
    expect(filas.at(-1).metadata.asignacion_clase).toBeUndefined();
  });

  it("sobre el censo real cuadra: 347 filas y Σ porcentaje_capital = 100", () => {
    const filas = buildMatrizHoldings(repartirCenso(censo.presenciales, censo.representados));
    expect(filas).toHaveLength(347);
    expect(filas.reduce((a, f) => a + f.porcentaje_capital, 0)).toBeCloseTo(100, 9);
  });
});

describe("arista seed→art.7 (c) — COMPORTAMIENTO sobre el censo real", () => {
  // Este bloque es la red que el guard de texto no puede dar. El mutante que
  // derrotó a (b) —llamada de señuelo a repartirCenso + censo armado a mano,
  // sin un solo literal prohibido— metía a un presencial en clase B y bajaba
  // los presenciales de 150 a 101 votos. Aquí eso cae.
  const votosDe = (fila) => fila.numero_titulos * ART7_CLASES.find((c) => c.code === fila.classCode).votosPorTitulo;

  it("los 3 presenciales del acta suman exactamente 150 votos", () => {
    const filas = filasMatrizDesdeCenso(censo.presenciales, censo.representados);
    const pres = filas.filter((f) => censo.presenciales.includes(f.nombre));
    expect(pres).toHaveLength(3);
    expect(pres.every((f) => f.classCode === "A" && f.numero_titulos === 2)).toBe(true);
    expect(pres.reduce((s, f) => s + votosDe(f), 0)).toBe(150);
  });

  it("el reparto por clases y los títulos son los del art. 7", () => {
    const filas = filasMatrizDesdeCenso(censo.presenciales, censo.representados);
    expect(filas).toHaveLength(347);
    expect(filas.filter((f) => f.classCode === "B")).toHaveLength(8);
    expect(filas.filter((f) => f.classCode === "A" && !f.is_treasury)).toHaveLength(338);
    for (const c of ART7_CLASES) {
      const titulos = filas.filter((f) => f.classCode === c.code).reduce((s, f) => s + f.numero_titulos, 0);
      expect(titulos).toBe(c.totalTitulos);
    }
  });

  it("los votos repartidos reconstruyen los 17.358 del art. 7", () => {
    const filas = filasMatrizDesdeCenso(censo.presenciales, censo.representados);
    expect(filas.reduce((s, f) => s + votosDe(f), 0)).toBe(17_358);
  });

  it("todas las filas llevan la fecha de la Junta y su clase", () => {
    // effective_from y classCode viajaban a Cloud sin que nadie los asertara.
    const filas = filasMatrizDesdeCenso(censo.presenciales, censo.representados);
    expect(filas.every((f) => f.effective_from === "2026-05-06")).toBe(true);
    expect(filas.every((f) => f.classCode === "A" || f.classCode === "B")).toBe(true);
  });
});

describe("arista seed→art.7 (b) — el fuente del seed consume el módulo y no lo duplica", () => {
  it("importa estructura-art7 y llama a repartirCenso", () => {
    const src = codigoDelSeed();
    expect(src).toMatch(/from\s+"\.\/garrigues\/capital\/estructura-art7"/);
    expect(src).toMatch(/\brepartirCenso\s*\(/);
    expect(src).toMatch(/\bbuildMatrizHoldings\s*\(/);
  });

  it("no reintroduce las tres constantes locales borradas", () => {
    const src = codigoDelSeed();
    for (const nombre of ["AUTOCARTERA_PCT", "PRESENCIALES_PCT_TOTAL", "TOTAL_TITULOS"]) {
      expect(src).not.toContain(nombre);
    }
  });

  it("no contiene en crudo ningún número del art. 7", () => {
    const src = codigoDelSeed();
    // 694 participaciones de A, 16.000 € de nominal, 11.104.008 € de capital,
    // 17.358/16.900 votos, el censo derivado 338/346 y los agregados 2,59 / 0,8875
    // del acta. Si alguno reaparece como literal, el seed ha vuelto a tener su
    // propia copia de la aritmética aunque los números coincidan.
    const prohibidos = [
      /\b694\b/, /\b695\b/, /\b16[_]?000\b/, /\b11[_]?104[_]?008\b/,
      /\b17[_]?358\b/, /\b16[_]?900\b/, /\b338\b/, /\b346\b/, /\b347\b/,
      /\b2\.59\b/, /\b0\.8875\b/,
    ];
    for (const re of prohibidos) expect(src).not.toMatch(re);
  });

  it("el preflight de suma existe y aborta con fail, no con un aviso", () => {
    const src = codigoDelSeed();
    expect(src).toMatch(/Math\.abs\(suma - 100\)\s*>\s*1e-6\)\s*fail\(/);
  });

  it("el refresco de parte_votante aborta el seed si falla", () => {
    const src = codigoDelSeed();
    expect(src).toMatch(/fn_refresh_parte_votante_entity/);
    // El aviso anterior era un console.warn: un refresco que no corre deja la
    // proyección con los pesos del reparto viejo y el motor calcula sobre ellos.
    expect(src).not.toMatch(/console\.warn/);
    expect(src).toMatch(/if \(eRpc\) fail\(/);
  });
});
