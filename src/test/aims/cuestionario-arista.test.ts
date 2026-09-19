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
    // 2026-09-14: el modo viaja a la hoja, que redacta el bloqueo del art. 5
    // según sea alta o reclasificación; y el banner lo pinta desde `bloqueos`.
    expect(src).toContain("bloqueosParaConfirmar(respuestas, justificacion, tieneOwner, modo)");
    expect(src).toContain("{bloqueos[0]}");
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

// F1.T10 (programa de cobertura RIA, 2026-09-19; cierra GC-18 y GC-26 en su
// parte v1.1). Las ayudas del art. 5 y del art. 6.3 enseñaban lo contrario de
// la norma: «Marque Sí SOLO si…» excluía por instrucción las letras d) a g),
// «casi seguro es No» empujaba a negar, y el ejemplo de la excepción del 6.3
// era un scoring crediticio, que el último párrafo del 6.3 declara siempre de
// alto riesgo si elabora perfiles. Las ayudas del art. 5 quedan PROVISIONALES
// hasta el veredicto de Harvey H-02A: el estado del lote se lee del registro.
describe("F1.T10 — ayudas del cuestionario v1.1", () => {
  type Peticion = { id: string; estado?: string };
  const registro = JSON.parse(readFileSync("docs/legal/harvey/registro.json", "utf8")) as { peticiones: Peticion[] };
  const h02aConVeredicto = registro.peticiones.some((p) => p.id === "H-02A" && p.estado === "RESPONDIDA");
  // Sin distinguir mayúsculas ni tilde: «solo si» excluye igual que «SOLO si».
  // `\b` al final para no morder «sólo sistemas».
  const PROHIBIDAS = [/\bs[óo]lo si\b/i, /casi seguro/i, /ante la duda/i];

  const textoDe = (p: { titulo: string; ayuda: { queSignifica: string; ejemplos: string[]; comoSaberlo: string } }) =>
    [p.titulo, p.ayuda.queSignifica, ...p.ayuda.ejemplos, p.ayuda.comoSaberlo].join("\n");

  it("el registro de Harvey se lee (control positivo del instrumento)", () => {
    // Si el lector no viera nada, `h02aConVeredicto` sería false por ceguera y
    // el rótulo se exigiría por el motivo equivocado.
    expect(registro.peticiones.some((p) => p.id === "H-01" && p.estado === "RESPONDIDA")).toBe(true);
    for (const re of PROHIBIDAS.slice(0, 2)) {
      expect(re.test("Marque «Sí» SOLO si el sistema… la respuesta casi seguro es «No»")).toBe(true);
    }
    for (const frase of ["Marque «Sí» solo si", "sólo si el sistema", "Sólo si, además,"]) {
      expect({ frase, casa: PROHIBIDAS[0].test(frase) }).toEqual({ frase, casa: true });
    }
    expect(PROHIBIDAS[0].test("se aplica a sólo sistemas de IA")).toBe(false);
  });

  it("ninguna ayuda instruye a excluir letras ni a responder «No» por defecto", async () => {
    const { PREGUNTAS } = await import("@/lib/aims/cuestionario-calificacion");
    expect(PREGUNTAS.length).toBe(9);
    for (const p of PREGUNTAS) {
      const t = textoDe(p);
      for (const re of PROHIBIDAS) expect({ id: p.id, hit: t.match(re)?.[0] ?? null }).toEqual({ id: p.id, hit: null });
    }
  });

  it("Q2_1 nombra las diez letras del art. 5.1 y el 5.1 bis, acota la h) y no exige intención en la c)", async () => {
    const { PREGUNTAS } = await import("@/lib/aims/cuestionario-calificacion");
    const q = PREGUNTAS.find((p) => p.id === "Q2_1")!.ayuda.queSignifica;
    // Como elemento de la enumeración («: a) …; b) …»), no como subcadena: «punto
    // 1 a)» del anexo III no puede pasar por la letra a) del art. 5.
    const enumera = (letra: string) => new RegExp(`(?:^|[:;]\\s)${letra.replace(/[()]/g, "\\$&")}\\s`).test(q);
    expect(enumera("a)") && !new RegExp("(?:^|[:;]\\s)a\\)\\s").test("punto 1 a) del anexo")).toBe(true);
    for (const letra of ["a)", "b)", "b bis)", "b ter)", "c)", "d)", "e)", "f)", "g)", "h)"]) {
      expect({ letra, nombrada: enumera(letra) }).toEqual({ letra, nombrada: true });
    }
    expect(q).toContain("5.1 bis");
    expect(q).toMatch(/no exige intenci[óo]n/i);
    expect(q).toMatch(/fines de garant[íi]a del cumplimiento del Derecho/);
    expect(q).toMatch(/anexo III, punto 1 a\)/);
    // b bis) y b ter) cotejadas con el consolidado 02024R1689-20260727 (ledger).
    expect(q).toMatch(/partes íntimas de una persona física identificable/);
    expect(q).toContain("Directiva 2011/93/UE");
  });

  it("Q2_3 no pone de ejemplo un scoring y avisa de que el perfilado excluye la excepción", async () => {
    const { PREGUNTAS } = await import("@/lib/aims/cuestionario-calificacion");
    const q23 = PREGUNTAS.find((p) => p.id === "Q2_3")!;
    expect(textoDe(q23).match(/scoring/i)?.[0] ?? null).toBeNull();
    expect(q23.ayuda.queSignifica).toMatch(/perfiles de personas f[íi]sicas/);
    // Q2_3 no lleva rótulo porque solo cambia lo validado (C10, y el último
    // párrafo del 6.3 cotejado literal): el resto es el texto de la spec del
    // equipo legal. Quién documenta la excepción (art. 6.4) es de H-02, que no
    // tiene veredicto: no entra en la ayuda hasta entonces.
    const ART_6_4 = /art(?:ículo|\.)\s*6(?:\.|, apartado )4/i;
    expect(ART_6_4.test("la documenta el proveedor (art. 6.4)"), "control positivo del patrón").toBe(true);
    expect(textoDe(q23).match(ART_6_4)?.[0] ?? null).toBeNull();
    expect(q23.provisional).toBeUndefined();
  });

  it("mientras H-02A no tenga veredicto, la ayuda del art. 5 va rotulada provisional", async () => {
    const { PREGUNTAS, ROTULO_PROVISIONAL } = await import("@/lib/aims/cuestionario-calificacion");
    expect(ROTULO_PROVISIONAL).toMatch(/provisional, pendiente de validaci[óo]n/i);
    const q21 = PREGUNTAS.find((p) => p.id === "Q2_1")!;
    // Con veredicto (CORRECTO o INCORRECTO) el rótulo se va: o se valida o se
    // revierte. Un «pendiente de validación» que sobrevive al veredicto miente.
    if (!h02aConVeredicto) expect(q21.provisional).toBe(ROTULO_PROVISIONAL);
    else expect(q21.provisional).toBeUndefined();
  });

  it("PreguntaGuiada PINTA el rótulo: con Q2_1 sí, con Q2_3 no", async () => {
    // Render, no grep del fuente: un `{false && pregunta.provisional && …}`
    // deja el literal en el fichero y el rótulo fuera de la pantalla.
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: Pregunta } = await import("@/components/ai-governance/clasificacion/PreguntaGuiada");
    const { PREGUNTAS, ROTULO_PROVISIONAL } = await import("@/lib/aims/cuestionario-calificacion");
    const pinta = (id: string) =>
      renderToStaticMarkup(
        createElement(Pregunta, { pregunta: PREGUNTAS.find((p) => p.id === id)!, valor: undefined, onChange: () => {} }),
      );
    const q21 = pinta("Q2_1");
    const q23 = pinta("Q2_3");
    // Control positivo: la ayuda llega al marcado (va en un panel `hidden`).
    expect(q23).toContain("¿Qué significa esto?");
    expect(q23).not.toContain(ROTULO_PROVISIONAL);
    if (!h02aConVeredicto) expect(q21).toContain(ROTULO_PROVISIONAL);
    else expect(q21).not.toContain(ROTULO_PROVISIONAL);
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
