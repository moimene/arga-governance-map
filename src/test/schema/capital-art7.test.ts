// C1 Task 2 — la aritmética del art. 7 de los Estatutos de J&A Garrigues, S.L.P.
// Test PURO: sin red, sin cliente Supabase, sin skip posible. Corre en cualquier
// entorno limpio y no depende de que la migración esté aplicada en Cloud.
//
// El bloque "REGRESIÓN OBLIGATORIA" es el corazón de esta tarea: fija al decimal
// las dos cifras que declara el acta de la Junta de 06/05/2026 y deja escrita la
// desviación entre las dos bases de cómputo candidatas en vez de esconderla.
// Registro canónico: docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md
import { describe, it, expect } from "vitest";
import {
  CAPITAL_ESCRITURADO_EUR, ART7_CLASES, AUTOCARTERA_TITULOS_A,
  SOCIOS_CUOTA, SOCIOS_CLASE_B, CENSO_TOTAL,
  votosTotales, votosAutocartera, baseComputoJunta, baseComputoTodasLasClases,
  pctSobreBaseJunta, pctAutocarteraSobreTotal, pctCapital, repartirCenso,
} from "../../../scripts/garrigues/capital/estructura-art7";
import censo from "../../../scripts/garrigues/censo/socios-acta-2026-05-06.json";

describe("art. 7 de los Estatutos — las cuatro comprobaciones cruzadas", () => {
  it("el capital derivado de las clases es el capital registral", () => {
    const derivado = ART7_CLASES.reduce((a, c) => a + c.totalTitulos * c.nominalEur, 0);
    expect(derivado).toBe(11_104_008);
    expect(derivado).toBe(CAPITAL_ESCRITURADO_EUR);
  });

  it("los votos totales son 17.358", () => {
    expect(votosTotales()).toBe(17_358);
  });

  it("la autocartera es el 2,59 % del acta", () => {
    expect(votosAutocartera()).toBe(450);
    expect(pctAutocarteraSobreTotal()).toBeCloseTo(2.5925, 4);
    expect(Number(pctAutocarteraSobreTotal().toFixed(2))).toBe(2.59);
  });

  it("el censo derivado es el censo exacto del acta: 338 + 8 = 346", () => {
    expect(SOCIOS_CUOTA).toBe(338);
    expect(SOCIOS_CLASE_B).toBe(8);
    expect(CENSO_TOTAL).toBe(346);
  });
});

describe("REGRESIÓN OBLIGATORIA — los 3 presenciales del acta suman 0,8875 %", () => {
  it("sobre la base declarada (votos de clase A no autocartera)", () => {
    expect(baseComputoJunta()).toBe(16_900);
    const votosPresenciales = 3 * 2 * 25; // 3 socios de cuota × 2 A × 25 votos
    expect(votosPresenciales).toBe(150);
    expect(Number(pctSobreBaseJunta(votosPresenciales).toFixed(4))).toBe(0.8876);
    // El acta escribe 0,8875 % (truncamiento a 4 decimales de 0,887574 %).
    expect(pctSobreBaseJunta(votosPresenciales)).toBeGreaterThan(0.8875);
    expect(pctSobreBaseJunta(votosPresenciales)).toBeLessThan(0.8876);
  });

  it("los representados son el complemento 99,1125 % del acta", () => {
    const resto = baseComputoJunta() - 150;
    expect(Number(((resto / baseComputoJunta()) * 100).toFixed(2))).toBe(99.11);
    expect(100 - pctSobreBaseJunta(150)).toBeCloseTo(99.1124, 4);
  });

  it("deja constancia de por qué la base no incluye los 8 votos de clase B", () => {
    // Documenta la desviación en vez de esconderla: sobre la base completa
    // saldría 0,8872 %, que NO es la cifra del acta.
    expect(baseComputoTodasLasClases()).toBe(16_908);
    const sobreTodas = (150 / baseComputoTodasLasClases()) * 100;
    expect(Number(sobreTodas.toFixed(4))).toBe(0.8872);
    expect(baseComputoTodasLasClases() - baseComputoJunta()).toBe(8);
  });

  it("la clase B SÍ vota: los 8 votos están dentro de votosTotales()", () => {
    // La base de 16.900 es un criterio de cómputo declarado, no una afirmación
    // sobre el régimen de voto. El art. 7 da 1 voto por participación de clase B.
    const b = ART7_CLASES.find((c) => c.code === "B");
    expect(b.votosPorTitulo).toBe(1);
    expect(b.totalTitulos * b.votosPorTitulo).toBe(8);
    expect(votosTotales()).toBe(694 * 25 + 8 * 1);
  });
});

describe("reparto del censo real del acta sobre la estructura", () => {
  // Lazy a propósito: con `const holdings = repartirCenso(...)` en el cuerpo del
  // describe, un fallo estructural lanza al cargar el módulo y vitest reporta
  // "no tests" — 0 de 16 aserciones corren, incluida toda la REGRESIÓN
  // OBLIGATORIA. Es la misma forma del gotcha del gate del mapa penal.
  const reparto = () => repartirCenso(censo.presenciales, censo.representados);

  it("el fichero de censo trae el censo del acta: 3 presenciales + 343 representados", () => {
    expect(censo.presenciales).toHaveLength(3);
    expect(censo.representados).toHaveLength(343);
    expect(censo.presenciales.length + censo.representados.length).toBe(CENSO_TOTAL);
  });

  it("produce 346 titularidades: 338 de clase A y 8 de clase B", () => {
    const holdings = reparto();
    expect(holdings).toHaveLength(346);
    expect(holdings.filter((h) => h.clase === "A")).toHaveLength(338);
    expect(holdings.filter((h) => h.clase === "B")).toHaveLength(8);
  });

  it("los títulos cuadran con el art. 7 una vez sumada la autocartera", () => {
    const holdings = reparto();
    const a = holdings.filter((h) => h.clase === "A").reduce((s, h) => s + h.titulos, 0);
    const b = holdings.filter((h) => h.clase === "B").reduce((s, h) => s + h.titulos, 0);
    expect(a + AUTOCARTERA_TITULOS_A).toBe(694);
    expect(b).toBe(8);
  });

  it("el capital reparto + autocartera suma el 100 %", () => {
    const holdings = reparto();
    const pct = holdings.reduce((s, h) => s + h.pctCapital, 0) + pctCapital("A", AUTOCARTERA_TITULOS_A);
    expect(pct).toBeCloseTo(100, 6);
  });

  it("los 3 presenciales son socios de cuota y suman los 150 votos del acta", () => {
    const holdings = reparto();
    const pres = holdings.filter((h) => censo.presenciales.includes(h.nombre));
    expect(pres).toHaveLength(3);
    expect(pres.every((h) => h.clase === "A" && h.titulos === 2)).toBe(true);
    expect(pres.reduce((s, h) => s + h.votos, 0)).toBe(150);
  });

  it("la asignación de clase queda etiquetada INFERIDO en todas las filas", () => {
    const holdings = reparto();
    expect(holdings.every((h) => h.asignacionClase === "INFERIDO")).toBe(true);
  });

  it("la elección de los 8 titulares de clase B es determinista y reproducible", () => {
    const holdings = reparto();
    // Dos ejecuciones del seed deben producir el mismo reparto o el expediente
    // cambiaría solo. Se fijan los 8 nombres: si el criterio de orden dejara de
    // ser estable (locale, ICU, reordenación del fichero), este test lo caza.
    const otraVez = reparto();
    expect(otraVez).toEqual(holdings);
    expect(holdings.filter((h) => h.clase === "B").map((h) => h.nombre)).toEqual([
      "Thomas Alexander Thorndike Piedra",
      "Vicente Bootello Machin",
      "Vicente Climent Escriche",
      "Vicente Lloret Lorca",
      "Víctor Chiquero Mielgo",
      "Xabier Urtiaga Valle",
      "Xavier Asensio Andreu",
      "Xavier Ruiz de Loizaga Sole",
    ]);
  });

  it("los votos de cada holding salen de SU clase, no de la clase A para todos", () => {
    // Hallazgo P1 de la review: nadie asertaba `Holding.votos`, así que poner la
    // tasa de clase A (25) a TODAS las filas —incluidos los 8 de clase B— pasaba
    // en verde. Son justo los 8 votos de los que depende toda la decisión legal.
    const holdings = reparto();
    const b = holdings.filter((h) => h.clase === "B");
    expect(b.every((h) => h.votos === 1)).toBe(true);
    expect(b.reduce((s, h) => s + h.votos, 0)).toBe(8);
    expect(holdings.filter((h) => h.clase === "A").every((h) => h.votos === 50)).toBe(true);
  });

  it("los votos repartidos más la autocartera reconstruyen los 17.358 del art. 7", () => {
    const holdings = reparto();
    const repartidos = holdings.reduce((s, h) => s + h.votos, 0);
    expect(repartidos).toBe(baseComputoTodasLasClases()); // 16.908
    expect(repartidos + votosAutocartera()).toBe(votosTotales()); // 17.358
  });

  it("el orden del reparto no depende del orden del fichero de entrada", () => {
    // Mata el mutante que borra el `sort`: hoy el JSON ya viene ordenado, así
    // que sin este caso quitar la ordenación escapaba en verde y el daño quedaba
    // latente hasta que alguien reordenara el fichero.
    const barajados = [...censo.representados].reverse();
    const conBaraja = repartirCenso(censo.presenciales, barajados);
    const claseB = (hs) => hs.filter((h) => h.clase === "B").map((h) => h.nombre).sort();
    expect(claseB(conBaraja)).toEqual(claseB(reparto()));
  });

  it("rechaza un censo con nombres repetidos", () => {
    const conDuplicado = [...censo.representados.slice(0, 342), censo.representados[0]];
    expect(() => repartirCenso(censo.presenciales, conDuplicado)).toThrow(/repetidos/);
  });

  it("rechaza un censo que no cuadre con la estructura", () => {
    const holdings = reparto();
    expect(() => repartirCenso(censo.presenciales.slice(0, 2), censo.representados)).toThrow(/3 presenciales/);
    expect(() => repartirCenso(censo.presenciales, censo.representados.slice(0, 342))).toThrow(/censo 345/);
  });
});
