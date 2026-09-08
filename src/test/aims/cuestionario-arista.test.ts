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
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

const DIR = "src/components/ai-governance/clasificacion";
const FICHEROS = [
  "ClasificacionGuiada.tsx",
  "PreguntaGuiada.tsx",
  "ResultadoProvisional.tsx",
  "HistorialClasificaciones.tsx",
  "ResumenClasificacionConfirmada.tsx",
];

const fuente = (f: string) => sinComentarios(readFileSync(`${DIR}/${f}`, "utf8"));
const lineas = (f: string) => readFileSync(`${DIR}/${f}`, "utf8").split("\n").length;

/**
 * Los DOS únicos textos que un componente puede citar literalmente. Se excluyen
 * ANTES de buscar citas legales propias, para que el gate no se dispare contra
 * lo que la spec manda escribir. Cada uno con su motivo y su fecha; añadir uno
 * es una decisión, no un trámite — y cambiarle una coma vuelve a ponerlo rojo,
 * que es lo que debe pasar con una cita legal nueva.
 */
const CITAS_PERMITIDAS = [
  // De la spec: el banner del art. 5 y el aviso del art. 6.3.
  "Este sistema realiza una práctica prohibida por el art. 5 del Reglamento. No puede registrarse.",
  "Un proveedor que considere que un sistema del Anexo III no es de alto riesgo debe documentar su evaluación antes de introducirlo en mercado o ponerlo en servicio (art. 6.3 RIA).",
];

describe("cuestionario guiado — control positivo", () => {
  it("los cinco componentes existen y son todo el directorio", () => {
    for (const f of FICHEROS) expect(existsSync(`${DIR}/${f}`)).toBe(true);
    // Sin esto, añadir un componente nuevo al directorio lo dejaría fuera de
    // los cuatro bucles de abajo sin que nada se pusiera rojo.
    expect(readdirSync(DIR).filter((f) => f.endsWith(".tsx")).sort()).toEqual([...FICHEROS].sort());
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
    // Antes sólo buscaba `art. 3.3` y `anexo iii`, así que CUALQUIER otra cita
    // pasaba: `Motivación del art. 6.3 *` llevaba ahí desde el principio.
    // Ahora se prohíbe toda cita numerada en el FUENTE. Lo que viene por props
    // (`pregunta.articulo`, `m.articulos`, `m.nota`) no es fuente y sigue
    // pasando, que es justamente lo que debe pasar: el artículo lo pone la
    // hoja, no el componente.
    //
    // El `\b` tras `art` es lo que separa una cita de un identificador:
    // `art. 6` y `arts. 9` casan; `articulos` y `art63-motivacion` no.
    //
    // CAPA DÉBIL declarada: es un grep sobre el fuente. Una cita construida en
    // una variable (`"art. " + n`) no se ve. Contra eso protege la arista de
    // arriba —que el texto venga de la hoja—, no este regex.
    const CITA = /\bart(?:s|ículos?)?\b\.?\s*\d/gi;
    for (const f of FICHEROS) {
      let src = fuente(f);
      for (const cita of CITAS_PERMITIDAS) src = src.split(cita).join(" ");
      expect({ f, citas: [...src.matchAll(CITA)].map((m) => m[0]) }).toEqual({ f, citas: [] });
    }
  });

  it("y el guard vería una cita nueva (control positivo del instrumento)", () => {
    // Un regex que no casa nada deja el bucle de arriba verde para siempre.
    const CITA = /\bart(?:s|ículos?)?\b\.?\s*\d/gi;
    expect("Motivación del art. 6.3".match(CITA)).not.toBeNull();
    expect("obligaciones de los arts. 9–15".match(CITA)).not.toBeNull();
    expect("el artículo 50 del Reglamento".match(CITA)).not.toBeNull();
    // Y no se dispara contra identificadores ni contra el campo de la hoja.
    expect("{m.articulos} — {m.titulo}".match(CITA)).toBeNull();
    expect('id="art63-motivacion"'.match(CITA)).toBeNull();
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
