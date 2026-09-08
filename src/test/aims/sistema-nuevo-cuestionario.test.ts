// src/test/aims/sistema-nuevo-cuestionario.test.ts
//
// El alta de un sistema de IA se clasifica con el cuestionario guiado y se
// registra por RPC.
//
// Lo que este gate vigila es la ARISTA, no el rótulo: que la pantalla MONTE el
// cuestionario y LLAME al camino de escritura que pone el tenant en servidor.
// Ver en vivo que el alta dice «Responsable del despliegue» no probaría nada —
// coincidiría igual si el texto estuviera cableado en la página, que es
// exactamente lo que había antes (un radio de rol y un desplegable de nivel con
// «Alto» preseleccionado).
//
// Se juzga lo que se renderiza, no la prosa que lo justifica: todo se mide
// sobre el fuente SIN COMENTARIOS. Sin esto, el comentario que EXPLICA la
// retirada dispara el propio guard, y la salida fácil es borrar la explicación.
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

const ALTA = "src/pages/ai-governance/SistemaNuevo.tsx";
const HOJA_ROL = "src/lib/aims/rol-regulatorio.ts";

const fuente = (f: string) => sinComentarios(readFileSync(f, "utf8"));
const lineas = (f: string) => readFileSync(f, "utf8").split("\n").length;

/**
 * Los tres símbolos que la hoja del cuestionario sustituye. Ya no deben quedar
 * en `src/`: dos derivaciones del rol y del nivel son dos calificaciones
 * jurídicas distintas del mismo sistema según la pantalla que se mire.
 *
 * EXCEPCIONES: ninguna. Si algún día hubiera que dejar un re-export en
 * `rol-regulatorio.ts` para un carril que aún no lo ha retirado, iría listado
 * aquí con su motivo y su fecha.
 */
const RETIRADOS = ["PREGUNTAS_ROL", "PREGUNTAS_CLASIFICACION", "proponerNivel"];

describe("alta de sistema — control positivo", () => {
  it("la pantalla existe y tiene cuerpo real", () => {
    expect(existsSync(ALTA)).toBe(true);
    expect(lineas(ALTA)).toBeGreaterThan(120);
  });

  it("cabe en 400 líneas", () => {
    expect({ lineas: lineas(ALTA) <= 400 }).toEqual({ lineas: true });
  });
});

describe("alta de sistema — la arista con el cuestionario y con la RPC", () => {
  it("monta el cuestionario guiado en modo alta", () => {
    const src = fuente(ALTA);
    expect(src).toContain("@/components/ai-governance/clasificacion/ClasificacionGuiada");
    expect(src).toContain("<ClasificacionGuiada");
    expect(src).toContain('modo="alta"');
  });

  it("registra por la RPC que pone el tenant en servidor, y traduce con la hoja", () => {
    const src = fuente(ALTA);
    expect(src).toContain("@/hooks/useAimsClasificacion");
    expect(src).toContain("useRegistrarSistemaClasificado(");
    expect(src).toContain("aPayloadCuestionario(");
  });

  it("sin clasificación confirmada no se envía el alta (CA-1)", () => {
    const src = fuente(ALTA);
    // El submit sólo existe con clasificación confirmada, y el bloqueo se
    // conserva porque un formulario también se envía con Intro.
    expect(src).toContain("Falta confirmar la clasificación guiada.");
    expect(src).toMatch(/if \(bloqueos\.length > 0 \|\| !confirmada\)/);
    expect(src).toMatch(/confirmada \? \(\s*<button\s+type="submit"/);
  });

  it("no escribe en ai_systems por su cuenta ni manda el tenant", () => {
    const src = fuente(ALTA);
    expect({ createSystem: src.includes("useCreateAiSystem(") }).toEqual({ createSystem: false });
    expect({ tabla: src.includes('from("ai_systems")') }).toEqual({ tabla: false });
    expect({ tenant: src.includes("tenant_id:") }).toEqual({ tenant: false });
  });
});

describe("alta de sistema — retirada completa de la calificación a mano", () => {
  it("ya no hay desplegable de nivel ni radio de rol en la pantalla", () => {
    const src = fuente(ALTA);
    expect({ nivel: /<select[^>]*id="ai-risk-level"/.test(src) }).toEqual({ nivel: false });
    expect({ rol: src.includes('name="regulatory_role"') }).toEqual({ rol: false });
  });

  it("la pantalla no cita los símbolos que la hoja sustituye", () => {
    const src = fuente(ALTA);
    for (const s of RETIRADOS) {
      expect({ s, presente: src.includes(s) }).toEqual({ s, presente: false });
    }
  });

  it("y no quedan en ningún otro sitio de src/", () => {
    for (const s of RETIRADOS) {
      let salida = "";
      try {
        salida = execFileSync("grep", ["-rn", s, "src"], { encoding: "utf8" });
      } catch {
        salida = ""; // grep sale 1 cuando no encuentra nada: es lo que se espera.
      }
      // Un símbolo citado sólo dentro de un comentario no es un consumidor.
      const vivas = salida
        .split("\n")
        .filter((l) => l.trim() !== "")
        .filter((l) => {
          const cuerpo = l.slice(l.indexOf(":", l.indexOf(":") + 1) + 1);
          return sinComentarios(cuerpo).includes(s);
        })
        .filter((l) => !l.startsWith(`${__filename.replace(`${process.cwd()}/`, "")}:`))
        .filter((l) => !l.startsWith("src/test/aims/sistema-nuevo-cuestionario.test.ts:"));
      expect({ s, vivas }).toEqual({ s, vivas: [] });
    }
  });

  it("la hoja de roles conserva lo que sí sigue siendo suyo, y sólo eso", () => {
    // `ROLES_REGULATORIOS` no se pina: es la fuente de `ETIQUETA_ROL` y sin él
    // no compila. `NivelRiesgo` SÍ se retiró de aquí: era un tercer tipo con
    // cero consumidores que duplicaba el de `vocabulario.ts`, y pinarlo
    // convertía este gate en el motivo para conservarlo.
    const src = fuente(HOJA_ROL);
    expect(src).toContain("export const ETIQUETA_ROL");
    expect(src).toContain("export type RolRegulatorio");
    expect({ nivel: src.includes("export type NivelRiesgo") }).toEqual({ nivel: false });
  });
});

describe("alta de sistema — reglas UX Garrigues", () => {
  it("no usa colores Tailwind nativos ni hexadecimales", () => {
    const NATIVOS = /\b(text|bg|border)-(red|green|amber|yellow|gray|slate|blue|white|black)-?\d*\b/g;
    const HEX = /#[0-9a-fA-F]{3,6}\b/g;
    const src = fuente(ALTA);
    expect([...src.matchAll(NATIVOS)].map((m) => m[0])).toEqual([]);
    expect([...src.matchAll(HEX)].map((m) => m[0])).toEqual([]);
  });
});
