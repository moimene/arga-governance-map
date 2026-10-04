// scripts/aims/harvey/enviar-lote.ts — MOI-169. Genera el prompt de un lote H-nn de Harvey.
//
// FUENTE: la especificación §9 (docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md),
// porque el catálogo TS del programa RIA no está en esta rama. H-11 sale de su fichero propio
// (docs/legal/harvey/2026-09-27-lote-H-11.md, hasta «## Estado de envío»).
//
// El prompt NUNCA se teclea a mano: este script lo produce, calcula su SHA-256 y lo escribe tal cual
// (sin salto de línea final) para pegarlo sin tocarlo en la consola EU de Harvey. `shasum -a 256` del
// fichero escrito debe coincidir con el SHA que imprime.
//
// Uso: bun scripts/aims/harvey/enviar-lote.ts H-02 [--marco-desde-catalogo] [--out fichero]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const ENCABEZADO_COMUN =
  "Responda para cada punto CORRECTO, INCORRECTO o CORRECTO CON MATIZ, con el fundamento en dos o tres líneas y el artículo exacto del Reglamento (UE) 2024/1689 en su versión consolidada tras el Reglamento (UE) 2026/1744 (texto consolidado a 27-07-2026). No resuma ni reformule los puntos: conteste punto por punto.";

const ROOT = resolve(import.meta.dir, "../../..");
export const RUTA_SPEC = resolve(ROOT, "docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md");
export const RUTA_VERIFICACION = resolve(ROOT, "docs/legal/2026-09-19-verificacion-omnibus-puntos-abiertos.md");
export const RUTA_H11 = resolve(ROOT, "docs/legal/harvey/2026-09-27-lote-H-11.md");

export type Rellenos = { art213?: string; marco?: string };
export type LotePrompt = { lote: string; prompt: string; sha256: string };

/** Puntos del prompt de un lote tal como los publica §9: líneas «> …» o texto tras «- Prompt:». */
export function extraerPuntos(spec: string, lote: string): string[] {
  const lineas = spec.split("\n");
  const ini = lineas.findIndex((l) => l.startsWith(`**${lote} — `));
  if (ini < 0) throw new Error(`Lote ${lote} no encontrado en §9`);
  let fin = lineas.length;
  for (let i = ini + 1; i < lineas.length; i++) {
    if (lineas[i].startsWith("**H-") || lineas[i].startsWith("---")) { fin = i; break; }
  }
  const bloque = lineas.slice(ini, fin);
  const p = bloque.findIndex((l) => l.startsWith("- Prompt"));
  if (p < 0) throw new Error(`Lote ${lote} sin «- Prompt»`);
  const resto = bloque[p].replace(/^- Prompt[^:]*:\s*/, "").trim();
  if (resto) return [resto.replace(/^«/, "").replace(/»\.?$/, "")];
  const puntos: string[] = [];
  for (let i = p + 1; i < bloque.length && !bloque[i].startsWith("- "); i++) {
    const m = bloque[i].match(/^\s*>\s?(.*)$/);
    if (m && m[1].trim()) puntos.push(m[1].trim());
  }
  if (!puntos.length) throw new Error(`Lote ${lote} sin puntos`);
  return puntos;
}

/** Texto literal de `art-2-13` en la verificación F0.T2, sin las «» envolventes. No se parafrasea. */
export function textoArt213(verificacion: string): string {
  const fila = verificacion.split("\n").find((l) => l.startsWith("| `art-2-13`"));
  if (!fila) throw new Error("Fila art-2-13 no encontrada");
  const m = fila.split("|")[4]?.trim().match(/^«(.*)»$/s);
  if (!m) throw new Error("Literal de art-2-13 no reconocible");
  return m[1];
}

function aplicarRellenos(texto: string, lote: string, r: Rellenos): string {
  let t = texto;
  if (lote === "H-02") {
    if (!r.art213) throw new Error("H-02 exige el literal de art-2-13");
    t = t.replace("[texto del apartado tras el cotejo de F0.T2]", `«${r.art213}»`);
  }
  if (lote === "H-14") {
    if (!r.marco) throw new Error("H-14 exige la lista de marco operativo (--marco-desde-catalogo o --marco fichero)");
    t = t.replace(/\[lista generada: ([^\]]*)\]/, "$1").replace("[lista]", r.marco);
  }
  const resto = t.match(/\[(texto|lista)[^\]]*\]/);
  if (resto) throw new Error(`Hueco sin rellenar en ${lote}: ${resto[0]}`);
  return t;
}

export function construirPrompt(lote: string, spec: string, rellenos: Rellenos = {}, h11 = ""): LotePrompt {
  let cuerpo: string;
  if (lote === "H-11") {
    cuerpo = h11.split("\n## Estado de envío")[0].trim();
  } else {
    const puntos = extraerPuntos(spec, lote).map((x) => aplicarRellenos(x, lote, rellenos));
    cuerpo = `Actúa como abogado experto en el Reglamento (UE) 2024/1689 de Inteligencia Artificial (RIA), modificado por el Reglamento (UE) 2026/1744. Valida los puntos siguientes uno por uno. Solo se te plantean criterios de derecho público y hechos simulados.\n\n${puntos.join("\n\n")}`;
  }
  const prompt = `${ENCABEZADO_COMUN}\n\n${cuerpo}`;
  return { lote, prompt, sha256: createHash("sha256").update(prompt).digest("hex") };
}

/** Lista de marco operativo para H-14, desde el catálogo del repo (medidas ISO 42001 neutrales al rol). */
export async function marcoDesdeCatalogo(): Promise<string> {
  const { DESPLIEGUE_REQUIREMENTS, PROCEDENCIA_DESPLIEGUE } = await import("../../../src/lib/aims/perfil-aplicabilidad");
  const medidas = DESPLIEGUE_REQUIREMENTS.flatMap((r) => r.measures);
  return medidas
    .filter((m) => PROCEDENCIA_DESPLIEGUE[m.code]?.fuente === "ISO_42001" && PROCEDENCIA_DESPLIEGUE[m.code]?.caracter === "MARCO_OPERATIVO")
    .map((m) => `${m.code}: ${m.description} (${PROCEDENCIA_DESPLIEGUE[m.code].norma})`)
    .join("; ");
}

if (import.meta.main) {
  const [lote, ...args] = process.argv.slice(2);
  const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const rellenos: Rellenos = { art213: textoArt213(readFileSync(RUTA_VERIFICACION, "utf8")) };
  if (args.includes("--marco-desde-catalogo")) rellenos.marco = await marcoDesdeCatalogo();
  else if (val("--marco")) rellenos.marco = readFileSync(val("--marco")!, "utf8").trim();
  const r = construirPrompt(lote, readFileSync(RUTA_SPEC, "utf8"), rellenos, readFileSync(RUTA_H11, "utf8"));
  const out = val("--out") ?? resolve(ROOT, `docs/legal/harvey/${new Date().toISOString().slice(0, 10)}-${lote}-prompt.md`);
  writeFileSync(out, r.prompt);
  console.log(`${lote} → ${out}\nSHA-256 ${r.sha256}\n${r.prompt.length} caracteres`);
}
