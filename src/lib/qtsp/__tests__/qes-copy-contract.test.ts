import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Contrato de producto para EAD Trust.
 *
 * La aplicación usa EAD como interposición, mensajería y e-archiving. No exige
 * ni afirma QES, firma avanzada o firma simple. Las firmas societarias que sean
 * obligatorias se acreditan separadamente y nunca se infieren de la custodia.
 */

const RAIZ = resolve(process.cwd(), "src");

function ficheros(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === "__tests__" || nombre === "node_modules") continue;
      ficheros(ruta, acc);
    } else if (/\.tsx?$/.test(nombre)) {
      acc.push(ruta);
    }
  }
  return acc;
}

/**
 * Solo literales de cadena y texto JSX: los identificadores de código no los lee
 * nadie.
 *
 * El extractor recorre el fuente COMPLETO, no línea a línea. Con el enfoque por
 * líneas se escapaba el texto JSX repartido en varias —que es justo como se
 * escribe el copy largo— y una afirmación de firma cualificada pasó el filtro.
 */
function textoVisible(src: string): string[] {
  const sinComentarios = src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const salida: string[] = [];
  for (const m of sinComentarios.matchAll(/"([^"]{3,})"|'([^']{3,})'|>([^<>{}]{3,})</g)) {
    salida.push((m[1] ?? m[2] ?? m[3] ?? "").replace(/\s+/g, " ").trim());
  }
  return salida;
}

describe("ninguna superficie atribuye un nivel de firma electrónica a EAD", () => {
  // Codex adversarial: el copy visible también sale de hooks y librerías
  // (mensajes de progreso, etiquetas), no solo de páginas y componentes.
  const paginasYComponentes = [
    ...ficheros(join(RAIZ, "pages")),
    ...ficheros(join(RAIZ, "components")),
    ...ficheros(join(RAIZ, "hooks")),
  ];

  it("no queda QES ni un nivel simple, avanzado o cualificado en texto visible", () => {
    const infractores: string[] = [];
    for (const f of paginasYComponentes) {
      const src = readFileSync(f, "utf8");
      for (const t of textoVisible(src)) {
        // Vocabulario de DATOS del proveedor, no prosa: el conjunto de tipos de
        // artefacto que un manifest puede traer etiquetados. Un token suelto no
        // afirma nada ante el usuario; lo que se persigue son las afirmaciones.
        if (/^(QES|QSEAL|TSQ|NOTIFICATION)$/.test(t.trim())) continue;
        // El disclaimer que NIEGA eficacia cualificada es correcto y debe quedarse.
        if (/sin eficacia jur[ií]dica cualificada/i.test(t)) continue;
        // "mayoría cualificada" es un concepto societario, nada que ver con firma.
        if (/mayor[ií]a cualificada/i.test(t)) continue;
        // Referirse al proveedor como QTSP es correcto: lo es.
        if (/\bQTSP\b/.test(t) && !/QES|firma cualificada/i.test(t)) continue;
        if (
          /\bQES\b/.test(t)
          || /firma\s+(?:electr[óo]nica\s+)?(?:simple|avanzada|cualificada)/i.test(t)
        ) {
          infractores.push(`${f.replace(process.cwd() + "/", "")}: ${t.slice(0, 90)}`);
        }
      }
    }
    expect(infractores).toEqual([]);
  });
});
