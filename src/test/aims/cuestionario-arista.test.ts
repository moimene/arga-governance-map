// src/test/aims/cuestionario-arista.test.ts
//
// La ARISTA del cuestionario guiado, no su rótulo.
//
// El criterio —qué rol, qué nivel, qué marcos, qué impide confirmar— vive en
// `src/lib/aims/cuestionario-calificacion.ts`. Los componentes sólo pintan. Lo
// que este gate vigila es exactamente eso: que la pantalla LLAME a la hoja y no
// se traiga una copia de las preguntas ni de la derivación. Verificar en vivo
// que la pantalla dice «Posible proveedor» no probaría nada: coincidiría igual
// si el texto estuviera cableado en el componente.
//
// Se juzga lo que se renderiza, no la prosa que lo justifica: todo se mide
// sobre el fuente SIN COMENTARIOS.
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

const DIR = "src/components/ai-governance/clasificacion";
const FICHEROS = [
  "ClasificacionGuiada.tsx",
  "PreguntaGuiada.tsx",
  "ResultadoProvisional.tsx",
  "HistorialClasificaciones.tsx",
];

const fuente = (f: string) => sinComentarios(readFileSync(`${DIR}/${f}`, "utf8"));
const lineas = (f: string) => readFileSync(`${DIR}/${f}`, "utf8").split("\n").length;

/**
 * Los dos únicos textos de la spec que un componente puede citar literalmente:
 * el banner del art. 5 y el aviso del art. 6.3. Se excluyen ANTES de buscar
 * citas legales propias, para que el gate no se dispare contra lo que la spec
 * manda escribir.
 */
const CITAS_PERMITIDAS = [
  "Este sistema realiza una práctica prohibida por el art. 5 del Reglamento. No puede registrarse.",
  "Un proveedor que considere que un sistema del Anexo III no es de alto riesgo debe documentar su evaluación antes de introducirlo en mercado o ponerlo en servicio (art. 6.3 RIA).",
];

describe("cuestionario guiado — control positivo", () => {
  it("los cuatro componentes existen", () => {
    for (const f of FICHEROS) expect(existsSync(`${DIR}/${f}`)).toBe(true);
  });

  it("ClasificacionGuiada tiene cuerpo real", () => {
    expect(lineas("ClasificacionGuiada.tsx")).toBeGreaterThan(80);
  });
});

describe("cuestionario guiado — la arista con la hoja del criterio", () => {
  it("ClasificacionGuiada importa la hoja y llama a sus dos funciones de decisión", () => {
    const src = fuente("ClasificacionGuiada.tsx");
    expect(src).toContain("@/lib/aims/cuestionario-calificacion");
    expect(src).toContain("resultadoProvisional(");
    expect(src).toContain("bloqueosParaConfirmar(");
  });

  it("PreguntaGuiada pinta la ayuda desde la pregunta, no desde literales suyos", () => {
    const src = fuente("PreguntaGuiada.tsx");
    expect(src).toContain("pregunta.ayuda.queSignifica");
    expect(src).toContain("pregunta.ayuda.ejemplos");
    expect(src).toContain("pregunta.ayuda.comoSaberlo");
  });

  it("ningún componente declara preguntas ni ayuda propias", () => {
    for (const f of FICHEROS) {
      const src = fuente(f);
      expect({ f, titulo: src.includes("titulo:") }).toEqual({ f, titulo: false });
      expect({ f, ayuda: src.includes("queSignifica:") }).toEqual({ f, ayuda: false });
    }
  });

  it("ningún componente cita artículos por su cuenta fuera de los dos textos de la spec", () => {
    for (const f of FICHEROS) {
      let src = fuente(f);
      for (const cita of CITAS_PERMITIDAS) src = src.split(cita).join(" ");
      expect({ f, citas: [...src.matchAll(/art\.\s*3\.3|anexo\s+iii/gi)].map((m) => m[0]) }).toEqual({
        f,
        citas: [],
      });
    }
  });
});

describe("cuestionario guiado — reglas UX Garrigues y tamaño", () => {
  it("no usa colores Tailwind nativos ni hexadecimales", () => {
    const NATIVOS = /\b(text|bg|border)-(red|green|amber|yellow|gray|slate|blue|white|black)-?\d*\b/g;
    const HEX = /#[0-9a-fA-F]{3,6}\b/g;
    for (const f of FICHEROS) {
      const src = fuente(f);
      expect({ f, nativos: [...src.matchAll(NATIVOS)].map((m) => m[0]) }).toEqual({ f, nativos: [] });
      expect({ f, hex: [...src.matchAll(HEX)].map((m) => m[0]) }).toEqual({ f, hex: [] });
    }
  });

  it("ningún componente pasa de 300 líneas", () => {
    for (const f of FICHEROS) {
      expect({ f, cabe: lineas(f) <= 300 }).toEqual({ f, cabe: true });
    }
  });
});
