import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Contrato de veracidad del nivel de firma.
 *
 * EAD Enterprise Suite 1.4.2 NO expone tipo cualificado: su techo es `ADVANCED`
 * (avanzada con OTP, art. 26 eIDAS) e `INTERPOSITION` es simple (art. 25.1).
 * Nuestro proxy emite `INTERPOSITION`. Por tanto ninguna superficie puede
 * rotular "QES" ni "firma cualificada": no es criterio jurídico opinable, es que
 * el proveedor no la emite.
 *
 * Qué nivel resulta suficiente para actas y certificaciones SÍ es criterio del
 * Comité Legal, y va aparte.
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

/** Solo literales de cadena y texto JSX: los identificadores de código no los lee nadie. */
function textoVisible(src: string): string[] {
  const salida: string[] = [];
  for (const linea of src.split("\n")) {
    const sinComentario = linea.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
    if (!sinComentario.trim()) continue;
    for (const m of sinComentario.matchAll(/"([^"]{4,})"|'([^']{4,})'|>([^<>{}]{4,})</g)) {
      salida.push(m[1] ?? m[2] ?? m[3] ?? "");
    }
  }
  return salida;
}

describe("ninguna superficie afirma firma cualificada", () => {
  const paginasYComponentes = [
    ...ficheros(join(RAIZ, "pages")),
    ...ficheros(join(RAIZ, "components")),
  ];

  it("no queda 'QES' ni 'firma cualificada' en texto que lea el usuario", () => {
    const infractores: string[] = [];
    for (const f of paginasYComponentes) {
      const src = readFileSync(f, "utf8");
      for (const t of textoVisible(src)) {
        // El disclaimer que NIEGA eficacia cualificada es correcto y debe quedarse.
        if (/sin eficacia jur[ií]dica cualificada/i.test(t)) continue;
        // "mayoría cualificada" es un concepto societario, nada que ver con firma.
        if (/mayor[ií]a cualificada/i.test(t)) continue;
        // Referirse al proveedor como QTSP es correcto: lo es.
        if (/\bQTSP\b/.test(t) && !/QES|firma cualificada/i.test(t)) continue;
        if (/\bQES\b/.test(t) || /firma\s+(electr[óo]nica\s+)?cualificada/i.test(t)) {
          infractores.push(`${f.replace(process.cwd() + "/", "")}: ${t.slice(0, 90)}`);
        }
      }
    }
    expect(infractores).toEqual([]);
  });
});
