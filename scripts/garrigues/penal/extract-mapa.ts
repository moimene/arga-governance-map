// scripts/garrigues/penal/extract-mapa.ts
// G5 — extracción determinista del mapa de riesgos penales evaluado 2025.
//
// El nivel evaluado es EXCLUSIVAMENTE color: no hay ningún score textual en
// ninguna celda, y no hay leyenda en ninguna página. Por eso se muestrea el
// píxel en vez de leer texto.
//
// Método: pdftoppm -r 100 -> PPM crudo (P6) -> color dominante por celda.
// Etiquetas: pdftotext -bbox-layout -> coordenadas en puntos, factor 100/72.
//
// FAIL-CLOSE: cualquier ambigüedad lanza. Una extracción que degrada en
// silencio es peor que una que revienta, porque se publica como completa.
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SRC = join(process.cwd(), "version garrigues", "Garr_politicas");
export const PDF_AREAS = join(SRC, "Mapa-evaluado-areas-de-negocio-Garrigues-2025.pdf");
export const PDF_DEPTOS = join(SRC, "Mapa-evaluado-departamentos-internos-Garrigues-2025.pdf");

export const AREAS_NEGOCIO = [
  "Laboral", "Fiscal", "Reestructuraciones e insolvencias", "Litigación y arbitraje",
  "IP", "Administrativo", "Mercantil", "G-advisory", "GLS",
] as const;
export const DEPARTAMENTOS_INTERNOS = [
  "Intangibles", "Servicio Médico", "Fundación Garrigues", "RRHH", "Asesoría jurídica",
  "Servicios Generales", "Tecnología", "Knowledge", "Financiero",
] as const;

export type Celda = "GRIS" | "VERDE_CLARO" | "VERDE_INTENSO" | "AMARILLO" | "NARANJA" | "ROJO";
export type FilaMapa = { articulo: string; delito: string; celdas: Celda[] };
export type MapaExtraido = { columnas: string[]; filas: FilaMapa[] };

const PALETA: Record<string, Celda> = {
  "217,217,217": "GRIS",
  "146,208,80": "VERDE_CLARO",
  "0,176,80": "VERDE_INTENSO",
  "255,255,0": "AMARILLO",
  "255,192,0": "NARANJA",
  "255,0,0": "ROJO",
};
// Verde de marca Garrigues (#009a77). NO es dato: es la banda de cabecera.
const CABECERA = "0,154,119";

const PT2PX = 100 / 72;
const CELDA_ANCHO_MIN = 40;   // las celdas miden 72-96 px …
const CELDA_ANCHO_MAX = 150;  // … y la columna de etiquetas 537. Así se descarta.
const FILA_ALTO_MIN = 6;
const X_FIN_ARTICULO = 155;   // sub-columna del artículo del CP

function run(cmd: string[]): string {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`${cmd[0]} falló: ${p.stderr.toString()}`);
  return p.stdout.toString();
}

type Ppm = { w: number; h: number; d: Uint8Array };

function leerPpm(path: string): Ppm {
  const b = readFileSync(path);
  // Cabecera P6: magic, [comentarios], ancho alto, maxval — separados por whitespace.
  let i = 0;
  const token = () => {
    while (b[i] === 32 || b[i] === 10 || b[i] === 13 || b[i] === 9) i++;
    if (b[i] === 35) { while (b[i] !== 10) i++; return token(); }
    const s = i;
    while (i < b.length && b[i] !== 32 && b[i] !== 10 && b[i] !== 13 && b[i] !== 9) i++;
    return b.subarray(s, i).toString();
  };
  if (token() !== "P6") throw new Error(`${path} no es PPM P6`);
  const w = Number(token()), h = Number(token());
  if (Number(token()) !== 255) throw new Error(`${path}: maxval != 255`);
  i++; // el único whitespace tras maxval
  return { w, h, d: new Uint8Array(b.subarray(i)) };
}

const px = (p: Ppm, x: number, y: number) => {
  const i = (y * p.w + x) * 3;
  return `${p.d[i]},${p.d[i + 1]},${p.d[i + 2]}`;
};
const esCelda = (c: string) => c in PALETA || c === CABECERA;

function columnasDe(p: Ppm): Array<[number, number]> {
  const cols: Array<[number, number]> = [];
  const denso: number[] = [];
  let max = 0;
  for (let x = 0; x < p.w; x++) {
    let n = 0;
    for (let y = 0; y < p.h; y += 3) if (esCelda(px(p, x, y))) n++;
    denso[x] = n;
    if (n > max) max = n;
  }
  const umbral = max * 0.25;
  let s: number | null = null;
  for (let x = 0; x < p.w; x++) {
    if (denso[x] > umbral) {
      if (s === null) s = x;
    } else if (s !== null) {
      const ancho = x - s;
      if (ancho >= CELDA_ANCHO_MIN && ancho <= CELDA_ANCHO_MAX) cols.push([s, x - 1]);
      s = null;
    }
  }
  if (s !== null) {
    const ancho = p.w - s;
    if (ancho >= CELDA_ANCHO_MIN && ancho <= CELDA_ANCHO_MAX) cols.push([s, p.w - 1]);
  }
  return cols;
}

function filasDe(p: Ppm, cols: Array<[number, number]>): Array<[number, number]> {
  // Criterio ABSOLUTO: una fila es una y donde TODAS las columnas de datos
  // tienen color de celda en su centro. Un umbral relativo al máximo de la
  // página trunca en silencio las páginas con pocas filas.
  const centros = cols.map(([a, b]) => (a + b) >> 1);
  const filas: Array<[number, number]> = [];
  let s: number | null = null;
  for (let y = 0; y < p.h; y++) {
    const llena = centros.every((x) => esCelda(px(p, x, y)));
    if (llena) { if (s === null) s = y; }
    else if (s !== null) { if (y - s >= FILA_ALTO_MIN) filas.push([s, y - 1]); s = null; }
  }
  if (s !== null && p.h - s >= FILA_ALTO_MIN) filas.push([s, p.h - 1]);
  return filas;
}

function dominante(p: Ppm, [y0, y1]: [number, number], [x0, x1]: [number, number]): string {
  const c = new Map<string, number>();
  let total = 0;
  for (let y = y0 + 2; y < y1 - 1; y++)
    for (let x = x0 + 4; x < x1 - 3; x += 2) { const k = px(p, x, y); c.set(k, (c.get(k) ?? 0) + 1); total++; }
  if (total === 0) throw new Error(`celda vacía en y=${y0}-${y1} x=${x0}-${x1}`);
  let mejor = "", n = 0;
  for (const [k, v] of c) if (v > n) { mejor = k; n = v; }
  if (n / total < 0.8) throw new Error(`celda no uniforme en y=${y0}-${y1} x=${x0}-${x1}: ${mejor} solo ${Math.round(100 * n / total)}%`);
  return mejor;
}

type Palabra = { x0: number; x1: number; y0: number; cy: number; t: string };

function palabras(pdf: string, pagina: number): Palabra[] {
  const xml = run(["pdftotext", "-bbox-layout", "-f", String(pagina), "-l", String(pagina), pdf, "-"]);
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)<\/word>/g;
  const out: Palabra[] = [];
  for (const m of xml.matchAll(re)) {
    const [x0, y0, x1, y1] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const t = m[5].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
                  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    out.push({ x0: x0 * PT2PX, x1: x1 * PT2PX, y0: y0 * PT2PX, cy: ((y0 + y1) / 2) * PT2PX, t });
  }
  return out;
}

function etiqueta(ws: Palabra[], [y0, y1]: [number, number], xDatos: number) {
  // La región de etiqueta tiene DOS sub-columnas: artículo del CP y texto del
  // delito. Concatenarlas sin separar las mezcla y el resultado deja de coincidir
  // entre los dos mapas, que es justo la validación cruzada que necesitamos.
  const sel = ws.filter((w) => w.cy >= y0 && w.cy <= y1 && w.x1 < xDatos);
  const orden = (a: Palabra, b: Palabra) => (Math.round(a.y0 / 6) - Math.round(b.y0 / 6)) || (a.x0 - b.x0);
  const unir = (p: Palabra[]) => p.sort(orden).map((w) => w.t).join(" ").replace(/\s+/g, " ").trim();
  return {
    articulo: unir(sel.filter((w) => w.x1 < X_FIN_ARTICULO)),
    delito: unir(sel.filter((w) => w.x1 >= X_FIN_ARTICULO)),
  };
}

export function extraerMapa(pdfPath: string, columnas: readonly string[]): MapaExtraido {
  if (!existsSync(pdfPath)) throw new Error(`no existe la fuente: ${pdfPath}`);
  const dir = mkdtempSync(join(tmpdir(), "mapa-penal-"));
  run(["pdftoppm", "-r", "100", pdfPath, join(dir, "pg")]);
  const ppms = readdirSync(dir).filter((f) => f.endsWith(".ppm")).sort();
  if (ppms.length === 0) throw new Error("pdftoppm no produjo páginas");

  const filas: FilaMapa[] = [];
  ppms.forEach((f, idx) => {
    const p = leerPpm(join(dir, f));
    const cols = columnasDe(p);
    if (cols.length !== columnas.length)
      throw new Error(`${f}: ${cols.length} columnas detectadas, se esperaban ${columnas.length}`);
    const ws = palabras(pdfPath, idx + 1);
    for (const banda of filasDe(p, cols)) {
      const celdas = cols.map((c) => dominante(p, banda, c));
      if (celdas.every((c) => c === CABECERA)) continue; // banda de cabecera
      if (celdas.some((c) => c === CABECERA))
        throw new Error(`${f}: fila ${banda[0]}-${banda[1]} mezcla cabecera y dato`);
      const { articulo, delito } = etiqueta(ws, banda, cols[0][0]);
      if (!articulo && !delito) throw new Error(`${f}: fila ${banda[0]}-${banda[1]} sin etiqueta`);
      filas.push({ articulo, delito, celdas: celdas.map((c) => PALETA[c]) });
    }
  });
  return { columnas: [...columnas], filas };
}
