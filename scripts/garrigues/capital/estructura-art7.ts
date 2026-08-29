/**
 * Estructura de capital de J&A Garrigues, S.L.P. — art. 7 de los Estatutos.
 * ÚNICA fuente de verdad de clases, nominales, votos y reparto. Puro, sin red.
 *
 * FIRME (art. 7): las clases, sus nominales, sus votos por participación, el
 * número de participaciones de cada clase y la autocartera.
 * INFERIDO y etiquetado: QUÉ socio concreto tiene qué participación y cuáles
 * son los 8 titulares de clase B. El Anexo 2 del acta no está transcrito y ese
 * emparejamiento no es público. No se inventan números de participación.
 *
 * BASE DE CÓMPUTO DE LA JUNTA — criterio declarado, decisión del usuario
 * 2026-08-29: los porcentajes de asistencia del acta se computan sobre los
 * VOTOS DE CLASE A NO AUTOCARTERA (16.900). Es la única lectura que reproduce
 * las dos cifras del acta al decimal: 150/16.900 = 0,887574 % (el 0,8875 % de
 * los presenciales) y su complemento 99,1124 % (el 99,1125 % de los
 * representados). Sobre la base completa de 16.908 votos saldría 0,887154 %
 * → 0,8872 %, que no es lo que dice el acta.
 * NO se afirma que la clase B carezca de voto: el art. 7 le da 1 voto por
 * participación y `votosTotales()` los cuenta. El residuo son esos 8 votos,
 * el 0,047 % de la base.
 *
 * Registro canónico de la decisión:
 *   docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md
 *
 * Alcance: reconstrucción demo sin efecto jurídico. El expediente real de la
 * Junta de 06/05/2026 existe en el Registro Mercantil; esto lo reproduce.
 */

export type ClaseCode = "A" | "B";

export type Art7Clase = {
  code: ClaseCode;
  nombre: string;
  nominalEur: number;
  votosPorTitulo: number;
  totalTitulos: number;
};

export type Holding = {
  nombre: string;
  clase: ClaseCode;
  titulos: number;
  pctCapital: number;
  votos: number;
  /** El emparejamiento socio↔clase no es público: el Anexo 2 no está transcrito. */
  asignacionClase: "INFERIDO";
};

export const CAPITAL_ESCRITURADO_EUR = 11_104_008;

// Congelado: este módulo se declara única fuente de verdad, así que nadie puede
// mutarlo en caliente. Sin freeze, `ART7_CLASES[0].totalTitulos = 999` cambiaba
// votosTotales() mientras SOCIOS_CUOTA y CENSO_TOTAL seguían con el valor viejo
// —el módulo desincronizado consigo mismo— y ningún test lo veía.
export const ART7_CLASES: readonly Art7Clase[] = Object.freeze([
  Object.freeze({ code: "A" as const, nombre: "Participaciones Clase A", nominalEur: 16_000, votosPorTitulo: 25, totalTitulos: 694 }),
  Object.freeze({ code: "B" as const, nombre: "Participaciones Clase B", nominalEur: 1, votosPorTitulo: 1, totalTitulos: 8 }),
]);

const clase = (c: ClaseCode) => ART7_CLASES.find((x) => x.code === c);

export const AUTOCARTERA_TITULOS_A = 18;
export const TITULOS_POR_SOCIO_CUOTA = 2;
// Derivado de la clase A, NO del literal 694: si el total de la clase cambiara,
// el censo lo sigue en vez de descuadrar con un mensaje confuso.
export const SOCIOS_CUOTA = (clase("A").totalTitulos - AUTOCARTERA_TITULOS_A) / TITULOS_POR_SOCIO_CUOTA; // 338
export const SOCIOS_CLASE_B = clase("B").totalTitulos; // 8 — un titular por participación de clase B
export const CENSO_TOTAL = SOCIOS_CUOTA + SOCIOS_CLASE_B; // 346

export function votosTotales() {
  return ART7_CLASES.reduce((acc, c) => acc + c.totalTitulos * c.votosPorTitulo, 0); // 17.358
}
export function votosAutocartera() {
  return AUTOCARTERA_TITULOS_A * clase("A").votosPorTitulo; // 450
}
/** Base declarada de cómputo de la Junta: votos de clase A no autocartera. */
export function baseComputoJunta() {
  return (clase("A").totalTitulos - AUTOCARTERA_TITULOS_A) * clase("A").votosPorTitulo; // 16.900
}
/** Base alternativa, solo para la nota de conciliación: todos los votos computables. */
export function baseComputoTodasLasClases() {
  return votosTotales() - votosAutocartera(); // 16.908
}
export function pctSobreBaseJunta(votos: number) {
  return (votos / baseComputoJunta()) * 100;
}
export function pctAutocarteraSobreTotal() {
  return (votosAutocartera() / votosTotales()) * 100; // 2,5925 %
}
export function pctCapital(code: ClaseCode, titulos: number) {
  return ((titulos * clase(code).nominalEur) / CAPITAL_ESCRITURADO_EUR) * 100;
}

/**
 * Reparte el censo real del acta sobre la estructura del art. 7.
 * Los 3 presenciales son socios de cuota (2A) — lo exige la regresión del acta.
 * Los 8 titulares de clase B se toman de la COLA del listado de representados
 * ordenado alfabéticamente: elección determinista y arbitraria, etiquetada
 * `asignacionClase: "INFERIDO"` porque el dato no es público.
 */
export function repartirCenso(presenciales: string[], representados: string[]): Holding[] {
  if (presenciales.length !== 3) throw new Error(`art7: se esperaban 3 presenciales, llegaron ${presenciales.length}`);
  if (presenciales.length + representados.length !== CENSO_TOTAL) {
    throw new Error(`art7: censo ${presenciales.length + representados.length} ≠ ${CENSO_TOTAL}`);
  }
  // Sin esto, un nombre repetido fuera de la cola de clase B pasa en silencio y
  // el seed escribe dos holdings del mismo socio; uno DENTRO de la cola deja 9
  // titularidades de clase B y descuadra los títulos.
  const todos = [...presenciales, ...representados];
  if (new Set(todos).size !== CENSO_TOTAL) {
    throw new Error(`art7: el censo tiene nombres repetidos (${CENSO_TOTAL - new Set(todos).size} duplicados)`);
  }
  const ordenados = [...representados].sort((a, b) => a.localeCompare(b, "es"));
  const claseB = new Set(ordenados.slice(-SOCIOS_CLASE_B));

  const holding = (nombre: string, code: ClaseCode, titulos: number): Holding => ({
    nombre, clase: code, titulos,
    pctCapital: pctCapital(code, titulos),
    votos: titulos * clase(code).votosPorTitulo,
    asignacionClase: "INFERIDO",
  });

  return [
    ...presenciales.map((n) => holding(n, "A", TITULOS_POR_SOCIO_CUOTA)),
    ...ordenados.map((n) => (claseB.has(n) ? holding(n, "B", 1) : holding(n, "A", TITULOS_POR_SOCIO_CUOTA))),
  ];
}
