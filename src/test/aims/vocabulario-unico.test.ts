import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { buildEvaluationPayload } from "@/lib/aims/evaluacion-payload";
import {
  ESTADOS_EVALUACION,
  ESTADOS_INCIDENTE,
  ESTADOS_SISTEMA,
  SEVERIDADES_INCIDENTE,
} from "@/lib/aims/vocabulario";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

/**
 * Un estado, una severidad, un nivel de riesgo: UN conjunto de valores y UNA
 * función que los traduce, compartida por lectura y escritura.
 *
 * Hasta el 2026-09-08 cada pantalla declaraba su lista y su mapa: la misma
 * columna se pintaba distinta en dos sitios y un valor nuevo llegaba a una
 * lista y no a la de al lado.
 *
 * Este gate mira las tres capas, de la más fuerte a la más débil, y lo dice:
 *  (a) COMPORTAMIENTO — lo que el producto escribe cabe en el vocabulario;
 *  (b) ARISTA — cada pantalla importa la hoja Y la llama;
 *  (c) CAPA DÉBIL — ninguna pantalla vuelve a declarar su propia lista. Es un
 *      grep sobre el fuente: se derrota renombrando la constante. Por eso no
 *      va sola.
 */

const PANTALLAS = [
  "src/pages/ai-governance/Sistemas.tsx",
  "src/pages/ai-governance/Evaluaciones.tsx",
  "src/pages/ai-governance/Incidentes.tsx",
  "src/pages/ai-governance/IncidenteNuevo.tsx",
  "src/pages/ai-governance/SistemaNuevo.tsx",
  "src/pages/ai-governance/Dashboard.tsx",
  "src/pages/ai-governance/SistemaDetalle.tsx",
];

const ALTA_INCIDENTE = "src/pages/ai-governance/IncidenteNuevo.tsx";

const read = (f: string) => readFileSync(f, "utf8");

/** Los tres estados que el camino de escritura de evaluaciones puede producir. */
function estadosQueElProductoEscribe(): string[] {
  const REQ = { code: "RISK_MGMT", title: "Gestión de riesgos", measures: [{ id: "M1" }, { id: "M2" }] };
  const MEDIDAS = [{ id: "M1", description: "Identificar" }, { id: "M2", description: "Evaluar" }];
  const L8 = { maturity: "L8", justification: "El sistema no trata datos biométricos." };
  return [
    buildEvaluationPayload({ M1: { maturity: "L5" }, M2: L8 }, MEDIDAS, [REQ]).status,
    buildEvaluationPayload({ M1: { maturity: "L1" }, M2: { maturity: "L5" } }, MEDIDAS, [REQ]).status,
    buildEvaluationPayload({}, MEDIDAS, [REQ]).status,
  ];
}

describe("control positivo del instrumento", () => {
  it("las siete pantallas existen y el directorio no ha encogido", () => {
    // Los tres bucles de abajo asertan AUSENCIA o recorren esta lista: una
    // lista vacía o un directorio encogido los pondría verdes a los tres.
    for (const f of PANTALLAS) expect(existsSync(f), `${f} no existe`).toBe(true);
    expect(PANTALLAS.length).toBe(7);
    expect(readdirSync("src/pages/ai-governance").length).toBeGreaterThanOrEqual(10);
  });
});

describe("(a) comportamiento — lo que el producto escribe cabe en el vocabulario", () => {
  it("los tres estados de evaluación que se escriben están declarados", () => {
    const escritos = estadosQueElProductoEscribe();
    // Control positivo: si `buildEvaluationPayload` devolviera siempre lo
    // mismo, la inclusión de abajo sería vacua.
    expect(escritos).toEqual(["CONFORME", "CON_GAPS", "BORRADOR"]);
    for (const e of escritos) {
      expect(ESTADOS_EVALUACION as readonly string[], `el producto escribe ${e} y no está en el vocabulario`).toContain(e);
    }
  });

  it("el alta de incidentes no ofrece ningún valor fuera del vocabulario", () => {
    // Los tres campos del perímetro regulatorio (RGPD 33/34, DORA) son un sí/no
    // propio, no un estado del incidente.
    const SI_NO = ["SI", "NO"];
    const src = sinComentarios(read(ALTA_INCIDENTE));
    const literales = [...src.matchAll(/<option value="([A-Z_]{2,})">/g)].map((m) => m[1]);
    // Control positivo: el barrido encuentra algo, o «ninguno está fuera» no
    // significaría nada.
    expect(literales.length, "el barrido de <option> no encuentra nada").toBeGreaterThan(0);
    const vocabulario = [...SEVERIDADES_INCIDENTE, ...ESTADOS_INCIDENTE, ...SI_NO] as string[];
    for (const v of literales) {
      expect(vocabulario, `${ALTA_INCIDENTE}: ofrece ${v}, que no declara ningún vocabulario`).toContain(v);
    }
    // Y severidad y estado se generan de la hoja: no hay lista escrita a mano.
    expect(src).toContain("SEVERIDADES_INCIDENTE.map");
    expect(src).toContain("ESTADOS_INCIDENTE.map");
  });

  it("el alta de sistemas genera su estado del vocabulario", () => {
    const src = sinComentarios(read("src/pages/ai-governance/SistemaNuevo.tsx"));
    expect(src).toContain("ESTADOS_SISTEMA.map");
    expect([...ESTADOS_SISTEMA]).toEqual(["ACTIVO", "EN_EVALUACION", "RETIRADO"]);
  });
});

describe("(b) arista — cada pantalla importa la hoja y la llama", () => {
  it("las siete importan @/lib/aims/vocabulario", () => {
    for (const f of PANTALLAS) {
      const src = sinComentarios(read(f));
      expect(/from "@\/lib\/aims\/vocabulario"/.test(src), `${f}: no importa el vocabulario`).toBe(true);
    }
  });

  it("y ninguna se queda en el import: lo llaman", () => {
    // Verificar el import sin verificar la llamada deja pasar un import muerto,
    // que es exactamente cómo se derrotó un guard de este repo el 2026-09-06.
    for (const f of PANTALLAS) {
      const src = sinComentarios(read(f));
      const llama = /\betiqueta\(|\bopcionesFiltro\(|\bclaseNivelRiesgo\(|\bSEVERIDADES_INCIDENTE\b|\bESTADOS_INCIDENTE\b|\bESTADOS_SISTEMA\b/.test(src);
      expect(llama, `${f}: importa el vocabulario y no lo usa`).toBe(true);
    }
  });
});

describe("(c) capa débil — ninguna pantalla vuelve a declarar su lista", () => {
  it("no hay constantes locales de opciones, etiquetas ni colores de nivel", () => {
    const PROHIBIDO = /const\s+(SYSTEM_STATUS_BASE|SEVERITY|STATUS|RISK|FRAMEWORK)_?(OPTIONS|LEVELS|LABEL|COLORS)\b|const\s+(INCIDENT_STATUS_LABEL|SEVERITY_LABEL|ASSESSMENT_STATUS_LABEL)\b/;
    for (const f of readdirSync("src/pages/ai-governance")) {
      if (!f.endsWith(".tsx")) continue;
      const ruta = `src/pages/ai-governance/${f}`;
      const m = sinComentarios(read(ruta)).match(PROHIBIDO);
      expect(m?.[0] ?? null, `${ruta}: vuelve a declarar su propio vocabulario`).toBeNull();
    }
  });
});
