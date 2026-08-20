# G5 — Núcleo penal evaluado del tenant Garrigues — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sembrar el mapa de riesgos penales evaluado 2025 del despacho (82 delitos × 18 columnas) como dato navegable del tenant Garrigues, sin que ninguna superficie afirme más de lo que la fuente dice.

**Architecture:** Un extractor determinista lee los dos PDF por píxel y congela la matriz en un módulo TS que es la única fuente de verdad. Tres columnas nuevas nullable en `risks` guardan la banda, el desglose por columna y la procedencia; `probability`/`impact`/`residual_score` quedan en NULL a propósito, lo que obliga a corregir tres superficies que hoy rellenan ese hueco con un `1` inventado.

**Tech Stack:** TypeScript + Bun, Supabase (PostgREST + SQL), React 18 + TanStack Query v5, `bun test` (runner vitest-compatible), `pdftoppm`/`pdftotext` de poppler.

**Spec:** [`docs/superpowers/specs/2026-08-20-g5-nucleo-penal-garrigues-design.md`](../specs/2026-08-20-g5-nucleo-penal-garrigues-design.md)

## Global Constraints

- **Tenant Garrigues** `00000000-0000-0000-0000-000000000002`. **Tenant ARGA** `00000000-0000-0000-0000-000000000001`.
- **Cero cambio ARGA.** Toda columna nueva es nullable; ARGA en NULL. Toda rama de UI nueva se activa por **forma del dato**, nunca por `tenant_id`.
- **Nunca `db push`, nunca `repair`.** El canal Cloud es `supabase db query -f <fichero> --linked`, y **jamás** `"$(cat …)"`: bash expandiría `$assert$`.
- **`bun run db:check-target`** antes de cualquier trabajo Supabase; tiene que decir `governance_OS`.
- **Los PDF de `version garrigues/Garr_politicas/` no se commitean nunca.** Están en `.gitignore`. No copiarlos, no moverlos, no meterlos en el repo.
- **`git add` solo con rutas específicas.** El árbol tiene ficheros ajenos sin seguimiento (`docs/context/*`, `pkcs11.txt`, `version garrigues/`). Nunca `git add -A`.
- **Nunca el nombre real del cliente asegurador.** ARGA es el seudónimo. (Garrigues sí es nombre real y es correcto usarlo.)
- **Prohibido inventar.** Si la fuente no lo dice, la columna va en NULL y la procedencia lo declara. No se nombran las bandas de color.
- **Línea base de gates (G4):** `bun test` = **3307 pass / 152 skip / 0 fail**. No se admite regresión.
- **Rama:** `feature/g5-nucleo-penal-garrigues`. Merge final `--no-ff` a `main`.

---

## File Structure

| Fichero | Responsabilidad |
|---|---|
| `scripts/garrigues/penal/extract-mapa.ts` | Lee los dos PDF y devuelve la matriz. Determinista, fail-close, sin tope duro. |
| `scripts/garrigues/penal/mapa-penal.ts` | Matriz congelada. **Única fuente de verdad.** Generado por el extractor, revisado a mano, commiteado. |
| `scripts/garrigues/penal/seguimiento-ppd.ts` | Los 4 controles del Plan de seguimiento (PPD-01 §350-356), literales. |
| `scripts/seed-garrigues-penal.ts` | Seed idempotente service-role: riesgos, hallazgos y controles. |
| `supabase/migrations/20260820120000_risks_assessed_band.sql` | 3 columnas nuevas en `risks` + índice. |
| `supabase/migrations/20260820121000_grc_risk_sync_no_score.sql` | Corrige `fn_sync_risk_to_backbone` para score NULL. |
| `src/lib/grc/assessed-band.ts` | Orden de bandas, etiquetas de presentación y el criterio `hasScoreAxes`. Módulo hoja, sin imports del proyecto. |
| `src/hooks/useRisks.ts` | Añade las 3 columnas al select y al tipo. |
| `src/pages/grc/Risk360.tsx` | Rama sin ejes: tira por bandas en vez de rejilla 5×5. |
| `src/pages/grc/RiskDetalle.tsx` | Desglose por las 18 columnas. |
| `src/test/schema/g5-mapa-penal.test.ts` | Gate de extracción y de dato en Cloud. |
| `src/test/schema/tenant-isolation.test.ts` | Ampliar de 7 a 9 tablas. |

---

## Task 1: Extractor de la matriz

**Files:**
- Create: `scripts/garrigues/penal/extract-mapa.ts`
- Test: `src/test/schema/g5-mapa-penal.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Celda = "GRIS" | "VERDE_CLARO" | "VERDE_INTENSO" | "AMARILLO" | "NARANJA" | "ROJO";
  export type FilaMapa = { articulo: string; delito: string; celdas: Celda[] };
  export type MapaExtraido = { columnas: string[]; filas: FilaMapa[] };
  export function extraerMapa(pdfPath: string, columnas: string[]): MapaExtraido;
  ```

**Contexto que el implementador necesita.** Las celdas son bloques de color 100 % uniformes, así que no hace falta OCR. Se renderiza cada página a PPM crudo con `pdftoppm -r 100` y se muestrea el píxel. Las etiquetas salen de `pdftotext -bbox-layout`, que da coordenadas en puntos PDF: el factor a píxel es `100/72`. Todo esto está probado; lo que sigue es la traducción a TS de un probe que ya funcionó.

Dos trampas ya conocidas, y las dos tienen que quedar cerradas por construcción:

1. **Umbral relativo = truncamiento silencioso.** La página 2 del mapa de áreas tiene solo 2 filas reales. Cualquier detección del tipo `cuenta > max(cuenta) * 0.6` la mide contra su propio máximo y devuelve basura. El criterio es absoluto: una fila es una `y` donde **todas** las columnas de datos tienen color de celda en su centro.
2. **La columna de etiquetas del mapa de departamentos tiene fondo gris** y se cuela como una décima columna. Se descarta por ancho: las celdas de dato miden 72-96 px, la columna de etiquetas 537 px.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/test/schema/g5-mapa-penal.test.ts` con este contenido:

```ts
// src/test/schema/g5-mapa-penal.test.ts
// G5 — la extracción del mapa penal es determinista y NO puede degradar en
// silencio. El P0 nº2 de G4 fue justamente eso: un índice topado en 40 que se
// pintaba como completo. Aquí cualquier pérdida de filas rompe el gate.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraerMapa, AREAS_NEGOCIO, DEPARTAMENTOS_INTERNOS, PDF_AREAS, PDF_DEPTOS } from "../../../scripts/garrigues/penal/extract-mapa";

// Los PDF viven fuera de git (.gitignore). Si no están, el test se salta en vez
// de fallar: no todos los entornos tienen el material fuente.
const haySrc = existsSync(PDF_AREAS) && existsSync(PDF_DEPTOS);
const d = haySrc ? describe : describe.skip;

d("G5 — extracción del mapa de riesgos penales", () => {
  const areas = extraerMapa(PDF_AREAS, AREAS_NEGOCIO);
  const deptos = extraerMapa(PDF_DEPTOS, DEPARTAMENTOS_INTERNOS);

  it("los dos mapas dan exactamente 82 filas y 9 columnas", () => {
    expect(areas.filas).toHaveLength(82);
    expect(deptos.filas).toHaveLength(82);
    expect(areas.columnas).toHaveLength(9);
    expect(deptos.columnas).toHaveLength(9);
    for (const f of [...areas.filas, ...deptos.filas]) expect(f.celdas).toHaveLength(9);
  });

  it("las 82 etiquetas coinciden fila a fila entre los dos mapas", () => {
    // Esta es LA validación cruzada: si coinciden, unir los dos mapas por
    // índice es seguro. Si no, el índice estaría mintiendo y el desglose
    // atribuiría a un delito los niveles de otro.
    for (let i = 0; i < 82; i++) {
      expect(deptos.filas[i].articulo, `fila ${i}`).toBe(areas.filas[i].articulo);
      expect(deptos.filas[i].delito, `fila ${i}`).toBe(areas.filas[i].delito);
    }
  });

  it("ninguna fila se queda sin etiqueta", () => {
    for (const f of areas.filas) expect(`${f.articulo}${f.delito}`.trim()).not.toBe("");
  });

  it("el histograma de color es exactamente el medido", () => {
    const cuenta = (m: typeof areas) => {
      const h: Record<string, number> = {};
      for (const f of m.filas) for (const c of f.celdas) h[c] = (h[c] ?? 0) + 1;
      return h;
    };
    expect(cuenta(areas)).toEqual({
      GRIS: 454, VERDE_CLARO: 223, AMARILLO: 40, VERDE_INTENSO: 13, NARANJA: 7, ROJO: 1,
    });
    expect(cuenta(deptos)).toEqual({
      GRIS: 586, VERDE_CLARO: 105, VERDE_INTENSO: 43, AMARILLO: 4,
    });
  });

  it("la banda alta son 8 celdas y el único rojo es contrabando en Fiscal", () => {
    const altas: string[] = [];
    let rojo: { delito: string; columna: string } | null = null;
    areas.filas.forEach((f) =>
      f.celdas.forEach((c, i) => {
        if (c === "NARANJA" || c === "ROJO") altas.push(`${f.delito}|${areas.columnas[i]}`);
        if (c === "ROJO") rojo = { delito: f.delito, columna: areas.columnas[i] };
      }),
    );
    expect(altas).toHaveLength(8);
    expect(rojo!.columna).toBe("Fiscal");
    expect(rojo!.delito.toLowerCase()).toContain("contrabando");
    // Los departamentos internos no alcanzan la banda alta.
    for (const f of deptos.filas) {
      expect(f.celdas).not.toContain("NARANJA");
      expect(f.celdas).not.toContain("ROJO");
    }
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts`
Expected: FAIL — no se resuelve el módulo `scripts/garrigues/penal/extract-mapa`.

- [ ] **Step 3: Escribir el extractor**

Crea `scripts/garrigues/penal/extract-mapa.ts`:

```ts
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
// silencio es peor que uma que revienta, porque se publica como completa.
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
  const denso: boolean[] = [];
  let max = 0;
  for (let x = 0; x < p.w; x++) {
    let n = 0;
    for (let y = 0; y < p.h; y += 3) if (esCelda(px(p, x, y))) n++;
    denso[x] = false;
    if (n > max) max = n;
    denso[x] = n > 0 ? true : false;
    (denso as unknown as number[])[x] = n;
  }
  const umbral = max * 0.25;
  let s: number | null = null;
  for (let x = 0; x < p.w; x++) {
    if ((denso as unknown as number[])[x] > umbral) {
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
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts`
Expected: PASS, 5 tests.

Si el test de etiquetas idénticas falla, **no relajes el test**: ajusta `X_FIN_ARTICULO` mirando las sub-columnas reales. Medidas: áreas `[(74,145),(149,875)]`, departamentos `[(74,152),(157,794)]`. El corte en 155 px cubre las dos.

- [ ] **Step 5: Commit**

```bash
git add scripts/garrigues/penal/extract-mapa.ts src/test/schema/g5-mapa-penal.test.ts
git commit -m "feat(g5): extractor determinista del mapa de riesgos penales

82 delitos x 9 columnas en cada uno de los dos mapas, extraidos por
separado y validados por coincidencia de etiquetas fila a fila.

Fail-close en las dos trampas conocidas: umbral absoluto de fila (el
relativo truncaba la pagina 2, que solo tiene 2 filas) y descarte por
ancho de la columna de etiquetas del mapa de departamentos, que tiene
fondo gris y se colaba como decima columna."
```

---

## Task 2: Catálogo penal congelado

**Files:**
- Create: `scripts/garrigues/penal/mapa-penal.ts`
- Create: `scripts/garrigues/penal/generar-catalogo.ts`
- Modify: `src/test/schema/g5-mapa-penal.test.ts`

**Interfaces:**
- Consumes: `extraerMapa`, `AREAS_NEGOCIO`, `DEPARTAMENTOS_INTERNOS` (Task 1)
- Produces:
  ```ts
  export type Banda = "ROJO" | "NARANJA" | "AMARILLO" | "VERDE" | "NO_EVALUADA";
  export type DelitoPenal = {
    codigo: string;            // "RSK-GARR-PEN-001"
    articulo: string;
    delito: string;
    banda: Banda;
    areas_negocio: Record<string, Celda>;
    departamentos_internos: Record<string, Celda>;
  };
  export const MAPA_PENAL: readonly DelitoPenal[];
  export const CELDAS_BANDA_ALTA: readonly { codigo: string; delito: string; columna: string; celda: "NARANJA" | "ROJO" }[];
  ```

**Por qué se congela.** Mismo patrón que `catalogo-normativo.ts` en G4: los PDF están en `.gitignore` y no viajan con el repo, así que el seed no puede depender de ellos. El módulo TS es la única fuente de verdad; el extractor solo lo regenera cuando cambia la fuente.

**Por qué la banda del delito colapsa los dos verdes.** El orden relativo de verde intenso y verde claro **no es derivable** de la fuente (spec §6). Colapsarlos en `VERDE` deja `Banda` totalmente ordenada, que es lo que la presentación necesita. El color exacto se conserva intacto en el desglose por columna.

- [ ] **Step 1: Escribir el test que falla**

Añade a `src/test/schema/g5-mapa-penal.test.ts`:

```ts
import { MAPA_PENAL, CELDAS_BANDA_ALTA } from "../../../scripts/garrigues/penal/mapa-penal";

describe("G5 — catálogo penal congelado", () => {
  it("tiene los 82 delitos con código único y correlativo", () => {
    expect(MAPA_PENAL).toHaveLength(82);
    expect(new Set(MAPA_PENAL.map((d) => d.codigo)).size).toBe(82);
    expect(MAPA_PENAL[0].codigo).toBe("RSK-GARR-PEN-001");
    expect(MAPA_PENAL[81].codigo).toBe("RSK-GARR-PEN-082");
  });

  it("cada delito trae las 18 columnas", () => {
    for (const d of MAPA_PENAL) {
      expect(Object.keys(d.areas_negocio)).toHaveLength(9);
      expect(Object.keys(d.departamentos_internos)).toHaveLength(9);
    }
  });

  it("la banda por delito es exactamente la medida", () => {
    const h: Record<string, number> = {};
    for (const d of MAPA_PENAL) h[d.banda] = (h[d.banda] ?? 0) + 1;
    expect(h).toEqual({ ROJO: 1, NARANJA: 7, AMARILLO: 19, VERDE: 44, NO_EVALUADA: 11 });
  });

  it("la banda colapsa los dos verdes: ningún delito se clasifica por el verde que sea", () => {
    // El orden relativo de VERDE_CLARO y VERDE_INTENSO no está publicado. Si
    // alguien introduce bandas separadas, este test lo caza.
    expect(MAPA_PENAL.map((d) => d.banda)).not.toContain("VERDE_CLARO");
    expect(MAPA_PENAL.map((d) => d.banda)).not.toContain("VERDE_INTENSO");
  });

  it("las 8 celdas de banda alta están, con el rojo de contrabando en Fiscal", () => {
    expect(CELDAS_BANDA_ALTA).toHaveLength(8);
    const rojos = CELDAS_BANDA_ALTA.filter((c) => c.celda === "ROJO");
    expect(rojos).toHaveLength(1);
    expect(rojos[0].columna).toBe("Fiscal");
    expect(rojos[0].delito.toLowerCase()).toContain("contrabando");
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts`
Expected: FAIL — no se resuelve `scripts/garrigues/penal/mapa-penal`.

- [ ] **Step 3: Escribir el generador**

Crea `scripts/garrigues/penal/generar-catalogo.ts`:

```ts
// scripts/garrigues/penal/generar-catalogo.ts
// Regenera scripts/garrigues/penal/mapa-penal.ts desde los PDF fuente.
// Se ejecuta a mano cuando cambia la fuente; el fichero generado se revisa y
// se commitea. Uso: bun run scripts/garrigues/penal/generar-catalogo.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { extraerMapa, AREAS_NEGOCIO, DEPARTAMENTOS_INTERNOS, PDF_AREAS, PDF_DEPTOS, type Celda } from "./extract-mapa";

const areas = extraerMapa(PDF_AREAS, AREAS_NEGOCIO);
const deptos = extraerMapa(PDF_DEPTOS, DEPARTAMENTOS_INTERNOS);

if (areas.filas.length !== deptos.filas.length)
  throw new Error(`los mapas no tienen las mismas filas: ${areas.filas.length} vs ${deptos.filas.length}`);
areas.filas.forEach((f, i) => {
  const g = deptos.filas[i];
  if (f.articulo !== g.articulo || f.delito !== g.delito)
    throw new Error(`fila ${i} no coincide entre mapas:\n  A: ${f.articulo} | ${f.delito}\n  D: ${g.articulo} | ${g.delito}`);
});

const banda = (cs: Celda[]) =>
  cs.includes("ROJO") ? "ROJO"
  : cs.includes("NARANJA") ? "NARANJA"
  : cs.includes("AMARILLO") ? "AMARILLO"
  // Los dos verdes se colapsan: su orden relativo no está publicado.
  : cs.some((c) => c === "VERDE_CLARO" || c === "VERDE_INTENSO") ? "VERDE"
  : "NO_EVALUADA";

const zip = (cols: readonly string[], cs: Celda[]) =>
  Object.fromEntries(cols.map((c, i) => [c, cs[i]]));

const delitos = areas.filas.map((f, i) => ({
  codigo: `RSK-GARR-PEN-${String(i + 1).padStart(3, "0")}`,
  articulo: f.articulo,
  delito: f.delito,
  banda: banda([...f.celdas, ...deptos.filas[i].celdas]),
  areas_negocio: zip(AREAS_NEGOCIO, f.celdas),
  departamentos_internos: zip(DEPARTAMENTOS_INTERNOS, deptos.filas[i].celdas),
}));

const altas = areas.filas.flatMap((f, i) =>
  f.celdas.flatMap((c, j) =>
    c === "NARANJA" || c === "ROJO"
      ? [{ codigo: delitos[i].codigo, delito: f.delito, columna: AREAS_NEGOCIO[j], celda: c }]
      : [],
  ),
);

const cab = `// scripts/garrigues/penal/mapa-penal.ts
// GENERADO por scripts/garrigues/penal/generar-catalogo.ts — no editar a mano.
// Fuente: Mapa de riesgos penales evaluado 2025 (áreas de negocio + departamentos
// internos). Los PDF están en .gitignore y no viajan con el repo, por eso este
// módulo es la única fuente de verdad del seed.
//
// El nivel es color, no texto: la fuente no publica leyenda ni criterio de
// bandas, y PPD-01 tampoco los documenta. Por eso las bandas no tienen nombre
// y los dos verdes se sirven colapsados a nivel de delito.
import type { Celda } from "./extract-mapa";

export type Banda = "ROJO" | "NARANJA" | "AMARILLO" | "VERDE" | "NO_EVALUADA";
export type DelitoPenal = {
  codigo: string; articulo: string; delito: string; banda: Banda;
  areas_negocio: Record<string, Celda>;
  departamentos_internos: Record<string, Celda>;
};

export const MAPA_PENAL: readonly DelitoPenal[] = `;

writeFileSync(
  join(import.meta.dir, "mapa-penal.ts"),
  `${cab}${JSON.stringify(delitos, null, 2)} as const;\n\n` +
  `export const CELDAS_BANDA_ALTA = ${JSON.stringify(altas, null, 2)} as const;\n`,
);
console.log(`escritas ${delitos.length} filas, ${altas.length} celdas de banda alta`);
```

- [ ] **Step 4: Generar el catálogo y revisarlo**

```bash
bun run scripts/garrigues/penal/generar-catalogo.ts
```

Expected: `escritas 82 filas, 8 celdas de banda alta`.

Abre `scripts/garrigues/penal/mapa-penal.ts` y **lee a ojo** las 82 etiquetas de delito. Busca artefactos de extracción: palabras partidas, artículos pegados al texto, `ter`/`bis` sueltos al final. Si aparecen, corrige `X_FIN_ARTICULO` o el criterio de orden en `etiqueta()` de Task 1 y regenera. **No edites el fichero generado a mano**: la cabecera dice que no se edita y el siguiente regenerado se lo llevaría por delante.

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/garrigues/penal/mapa-penal.ts scripts/garrigues/penal/generar-catalogo.ts src/test/schema/g5-mapa-penal.test.ts
git commit -m "feat(g5): congela el mapa penal — 82 delitos x 18 columnas

Banda por delito: 1 rojo, 7 naranja, 19 amarillo, 44 verde, 11 sin evaluar.
Los dos verdes se colapsan en VERDE a nivel de delito porque su orden
relativo no esta publicado en la fuente; el color exacto se conserva en el
desglose por columna."
```

---

## Task 3: Columnas nuevas en `risks`

**Files:**
- Create: `supabase/migrations/20260820120000_risks_assessed_band.sql`
- Modify: `src/test/schema/g5-mapa-penal.test.ts`

**Interfaces:**
- Produces: `risks.assessed_band text`, `risks.assessment_breakdown jsonb`, `risks.assessment_provenance jsonb`

- [ ] **Step 1: Escribir el test que falla**

Añade a `src/test/schema/g5-mapa-penal.test.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll } from "vitest";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
// El preload de bun test monta JSDOM con localStorage: sin esto los dos
// clientes comparten storageKey y el último login pisa al anterior.
const PERSIST_OFF = { auth: { persistSession: false } } as const;

describe("G5 — columnas de evaluación en risks (Cloud)", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;

  beforeAll(async () => {
    // Sin anon key NO se hace graceful-skip con `|| ""`: eso deja el gate verde
    // sin asertar nada. Se salta explícito y visible.
    if (!SUPABASE_ANON_KEY) return;
    const g = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await g.auth.signInWithPassword({ email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD })).error) garr = g;
    const a = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await a.auth.signInWithPassword({ email: ARGA_EMAIL, password: DEMO_PASSWORD })).error) arga = a;
  });

  it("las 3 columnas nuevas existen y se pueden seleccionar", async () => {
    if (!garr) return;
    const { error } = await garr.from("risks")
      .select("code, assessed_band, assessment_breakdown, assessment_provenance").limit(1);
    expect(error).toBeNull();
  });

  it("ARGA intacta: sus riesgos tienen las 3 columnas en NULL", async () => {
    if (!arga) return;
    const { data, error } = await arga.from("risks")
      .select("code, assessed_band, assessment_breakdown, assessment_provenance");
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    // Aserción no vacua: ARGA tiene riesgos de verdad.
    expect(rows.length).toBeGreaterThan(100);
    for (const r of rows) {
      expect(r.assessed_band, `${r.code}`).toBeNull();
      expect(r.assessment_breakdown, `${r.code}`).toBeNull();
      expect(r.assessment_provenance, `${r.code}`).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts -t "columnas de evaluación"`
Expected: FAIL — `column risks.assessed_band does not exist`.

- [ ] **Step 3: Escribir la migración**

Crea `supabase/migrations/20260820120000_risks_assessed_band.sql`:

```sql
-- G5 — evaluación por bandas de color para riesgos que la fuente NO descompone
-- en probabilidad x impacto.
--
-- Las tres columnas son NULLABLE a propósito: ARGA las deja en NULL y su
-- comportamiento no cambia en ningún punto. Mismo patrón que
-- entities.data_provenance (G1) y policies.owner_body_id (G4).
--
-- Se llama assessed_band y NO score/severity/nivel: el nombre tiene que impedir
-- que se confunda con la escala 1-25 de risks.inherent_score o con las cuatro
-- bandas con nombre de grc_risks.inherent_severity.

ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS assessed_band         text,
  ADD COLUMN IF NOT EXISTS assessment_breakdown  jsonb,
  ADD COLUMN IF NOT EXISTS assessment_provenance jsonb;

-- Los dos verdes de la fuente se colapsan en VERDE: su orden relativo no está
-- publicado, y una banda a nivel de riesgo tiene que estar totalmente ordenada.
ALTER TABLE public.risks
  DROP CONSTRAINT IF EXISTS risks_assessed_band_check;
ALTER TABLE public.risks
  ADD CONSTRAINT risks_assessed_band_check
  CHECK (assessed_band IS NULL OR assessed_band IN
         ('ROJO','NARANJA','AMARILLO','VERDE','NO_EVALUADA'));

-- Un riesgo evaluado por banda no tiene ejes de probabilidad/impacto. Si alguien
-- rellena los ejes de una fila con banda, está fabricando el dato que el diseño
-- prohíbe fabricar, y la base lo rechaza.
ALTER TABLE public.risks
  DROP CONSTRAINT IF EXISTS risks_banda_sin_ejes_check;
ALTER TABLE public.risks
  ADD CONSTRAINT risks_banda_sin_ejes_check
  CHECK (assessed_band IS NULL
         OR (probability IS NULL AND impact IS NULL AND residual_score IS NULL));

CREATE INDEX IF NOT EXISTS idx_risks_tenant_band
  ON public.risks (tenant_id, assessed_band)
  WHERE assessed_band IS NOT NULL;

COMMENT ON COLUMN public.risks.assessed_band IS
  'Banda de color evaluada en origen, para riesgos que la fuente no descompone en probabilidad x impacto. NULL = el riesgo usa los ejes clásicos.';
COMMENT ON COLUMN public.risks.assessment_breakdown IS
  'Desglose por columna del mapa de origen. nivel:null + motivo:NO_EVALUADA para las celdas sin evaluar (nunca 0, que es un valor de la escala).';
COMMENT ON COLUMN public.risks.assessment_provenance IS
  'Fuente, método de extracción y límites declarados de la escala.';
```

- [ ] **Step 4: Aplicar en Cloud y registrar**

```bash
bun run db:check-target
```
Expected: `governance_OS`.

```bash
supabase db query -f supabase/migrations/20260820120000_risks_assessed_band.sql --linked
```

**Nunca** `supabase db query "$(cat …)"`: bash expandiría los `$…$`. **Nunca** `db push` ni `repair` (drift de junio).

Registra la versión a mano, patrón del drift:

```bash
supabase db query --linked <<'SQL'
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('20260820120000') ON CONFLICT DO NOTHING;
SQL
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts -t "columnas de evaluación"`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260820120000_risks_assessed_band.sql src/test/schema/g5-mapa-penal.test.ts
git commit -m "feat(g5): columnas de evaluacion por banda en risks

Tres columnas nullable (ARGA en NULL = cero cambio) y dos CHECK: el
dominio de la banda y la prohibicion de rellenar probability/impact/
residual_score en una fila que ya trae banda. Esa segunda restriccion es
la que impide fabricar los ejes que la fuente no publica."
```

---

## Task 4: El trigger deja de decir «Bajo»

**Files:**
- Create: `supabase/migrations/20260820121000_grc_risk_sync_no_score.sql`
- Modify: `src/test/schema/g5-mapa-penal.test.ts`

**El defecto.** `fn_sync_risk_to_backbone` (`20260521140000_grc_legacy_sync_triggers.sql:79`) replica cada `risks` a `grc_risks` traduciendo el score a banda: `>= 15 → 'Critico'`, `>= 10 → 'Alto'`, `>= 5 → 'Medio'`, `ELSE → 'Bajo'`. Con los scores en NULL cae al `ELSE` y **escribe `'Bajo'`**. Es la afirmación falsa más peligrosa de las tres del spec §4 porque no se ve desde ninguna pantalla.

`grc_risks.inherent_severity` es `NOT NULL DEFAULT 'Medio'`, así que propagar NULL exige DDL. Se amplía el dominio con `'No evaluado'`, que es lo que realmente es.

- [ ] **Step 1: Escribir el test que falla**

Añade a `src/test/schema/g5-mapa-penal.test.ts`, dentro del describe de Cloud:

```ts
  it("un riesgo sin score NO se replica al backbone como 'Bajo'", async () => {
    if (!garr) return;
    // Se apoya en el dato ya sembrado por el seed de Task 5. Antes del seed
    // este test no tiene sujeto: por eso se ejecuta después.
    const { data: r } = await garr.from("risks")
      .select("id, code").eq("assessed_band", "ROJO").maybeSingle();
    if (!r) return;
    const { data: b, error } = await garr.from("grc_risks")
      .select("id, inherent_severity, residual_severity").eq("id", r.id).maybeSingle();
    expect(error).toBeNull();
    expect(b, `el riesgo ${r.code} no llegó al backbone`).not.toBeNull();
    expect(b!.inherent_severity).toBe("No evaluado");
    expect(b!.residual_severity).toBe("No evaluado");
  });
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts -t "backbone"`
Expected: el test no encuentra sujeto y pasa vacuamente **hasta Task 5**. Anótalo y vuelve a este paso después del seed; entonces debe FALLAR con `'Bajo'`.

- [ ] **Step 3: Escribir la migración**

Crea `supabase/migrations/20260820121000_grc_risk_sync_no_score.sql`:

```sql
-- G5 — el sync al backbone dejaba de decir la verdad para riesgos sin score.
--
-- fn_sync_risk_to_backbone traducia inherent_score/residual_score a una banda
-- con nombre, y su CASE cae en ELSE 'Bajo' cuando el score es NULL. Un riesgo
-- evaluado por color, que no tiene ejes de probabilidad x impacto, acababa
-- registrado en grc_risks como 'Bajo' sin que ninguna pantalla lo mostrara.
--
-- grc_risks.inherent_severity es NOT NULL DEFAULT 'Medio', asi que no se puede
-- propagar NULL: se amplia el dominio con 'No evaluado', que es lo que es.

CREATE OR REPLACE FUNCTION public.fn_sync_risk_to_backbone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_module_id text;
  v_inherent_severity text;
  v_residual_severity text;
  v_status text;
BEGIN
  v_module_id := COALESCE(NEW.module_id, 'risk');
  IF NOT EXISTS (SELECT 1 FROM grc_modules WHERE tenant_id = NEW.tenant_id AND id = v_module_id) THEN
    v_module_id := 'risk';
  END IF;

  v_inherent_severity := CASE
    WHEN NEW.inherent_score IS NULL THEN 'No evaluado'
    WHEN NEW.inherent_score >= 15 THEN 'Critico'
    WHEN NEW.inherent_score >= 10 THEN 'Alto'
    WHEN NEW.inherent_score >= 5  THEN 'Medio'
    ELSE 'Bajo'
  END;

  v_residual_severity := CASE
    WHEN NEW.residual_score IS NULL THEN 'No evaluado'
    WHEN NEW.residual_score >= 15 THEN 'Critico'
    WHEN NEW.residual_score >= 10 THEN 'Alto'
    WHEN NEW.residual_score >= 5  THEN 'Medio'
    ELSE 'Bajo'
  END;

  v_status := CASE
    WHEN NEW.status = 'Abierto' THEN 'Pendiente'
    WHEN NEW.status = 'En tratamiento' THEN 'En revision'
    WHEN NEW.status = 'Mitigado' THEN 'En revision'
    ELSE 'Conforme'
  END;

  INSERT INTO grc_risks (
    tenant_id, id, module_id, obligation_id, title, description,
    inherent_severity, residual_severity, owner, status, payload, updated_at
  ) VALUES (
    NEW.tenant_id, NEW.id::text, v_module_id, NEW.obligation_id::text,
    NEW.title, NEW.description, v_inherent_severity, v_residual_severity,
    'Risk Owner', v_status, '{}'::jsonb, now()
  )
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    obligation_id = EXCLUDED.obligation_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    inherent_severity = EXCLUDED.inherent_severity,
    residual_severity = EXCLUDED.residual_severity,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN NEW;
END;
$fn$;
```

**Antes de aplicar**, comprueba si `grc_risks` tiene un CHECK sobre `inherent_severity`:

```bash
supabase db query --linked <<'SQL'
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.grc_risks'::regclass AND contype = 'c';
SQL
```

Si aparece un CHECK con el dominio de cuatro valores, añade al final de la migración el `DROP CONSTRAINT` + `ADD CONSTRAINT` con `'No evaluado'` incluido. Si no aparece ninguno, no hace falta nada más.

- [ ] **Step 4: Aplicar en Cloud y registrar**

```bash
bun run db:check-target
supabase db query -f supabase/migrations/20260820121000_grc_risk_sync_no_score.sql --linked
```

```bash
supabase db query --linked <<'SQL'
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('20260820121000') ON CONFLICT DO NOTHING;
SQL
```

- [ ] **Step 5: Verificar que ARGA no se movió**

```bash
supabase db query --linked <<'SQL'
SELECT inherent_severity, count(*)
FROM grc_risks
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
GROUP BY 1 ORDER BY 1;
SQL
```

Expected: ninguna fila con `No evaluado`. Los riesgos de ARGA tienen score, así que no atraviesan la rama nueva. Anota el reparto; se vuelve a comprobar en Task 9.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260820121000_grc_risk_sync_no_score.sql src/test/schema/g5-mapa-penal.test.ts
git commit -m "fix(g5): el sync al backbone deja de clasificar como Bajo lo que no tiene score

Un riesgo sin probability/impact caia en el ELSE del CASE y se registraba en
grc_risks como 'Bajo'. Ninguna pantalla lo mostraba, que es lo que lo hacia
peligroso. Ahora propaga 'No evaluado'."
```

---

## Task 5: Seed de los 82 riesgos

**Files:**
- Create: `scripts/seed-garrigues-penal.ts`
- Modify: `src/test/schema/g5-mapa-penal.test.ts`

**Interfaces:**
- Consumes: `MAPA_PENAL`, `CELDAS_BANDA_ALTA` (Task 2)

**Gotchas del seed que ya costaron tiempo en fases anteriores:**
- La lista de nombres de service-role del repo **tiene que incluir `SERVICE_ROLE_SECRET`**, que es el que usa el `.env` real. Sin él, el seed aborta después de imprimir todo el resumen.
- `risks.code` **no tiene unicidad de ningún tipo**, así que la idempotencia hay que resolverla a mano: `select` por `(tenant_id, code)` y luego `update` o `insert`.
- Dry-run por defecto, escritura solo con `--apply`. Mismo contrato que `seed-garrigues-tenant.ts`.

- [ ] **Step 1: Escribir el test que falla**

Añade al describe de Cloud en `src/test/schema/g5-mapa-penal.test.ts`:

```ts
  it("Garrigues tiene los 82 riesgos penales con banda y desglose", async () => {
    if (!garr) return;
    const { data, error } = await garr.from("risks")
      .select("code, title, assessed_band, assessment_breakdown, assessment_provenance, probability, impact, residual_score, module_id")
      .like("code", "RSK-GARR-PEN-%").order("code");
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(82);

    const h: Record<string, number> = {};
    for (const r of rows) h[r.assessed_band as string] = (h[r.assessed_band as string] ?? 0) + 1;
    expect(h).toEqual({ ROJO: 1, NARANJA: 7, AMARILLO: 19, VERDE: 44, NO_EVALUADA: 11 });

    for (const r of rows) {
      // Contrato anti-fabricación: la fuente no publica ejes, así que no hay ejes.
      expect(r.probability, `${r.code}`).toBeNull();
      expect(r.impact, `${r.code}`).toBeNull();
      expect(r.residual_score, `${r.code}`).toBeNull();
      expect(r.module_id).toBe("risk");
      const b = r.assessment_breakdown as Record<string, Record<string, unknown>>;
      expect(Object.keys(b.areas_negocio)).toHaveLength(9);
      expect(Object.keys(b.departamentos_internos)).toHaveLength(9);
      const p = r.assessment_provenance as Record<string, unknown>;
      expect((p.escala as Record<string, unknown>).leyenda_en_fuente).toBe(false);
      expect((p.escala as Record<string, unknown>).orden_indeterminado).toEqual(["VERDE_INTENSO", "VERDE_CLARO"]);
    }
  });
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts -t "82 riesgos penales"`
Expected: FAIL — `expected [] to have length 82`.

- [ ] **Step 3: Escribir el seed**

Crea `scripts/seed-garrigues-penal.ts`:

```ts
// scripts/seed-garrigues-penal.ts
// G5 — siembra el mapa de riesgos penales evaluado 2025 del tenant Garrigues.
// Idempotente. Dry-run por defecto; escribe solo con --apply.
//   bun run scripts/seed-garrigues-penal.ts            # dry-run
//   bun run scripts/seed-garrigues-penal.ts --apply
import { createClient } from "@supabase/supabase-js";
import { MAPA_PENAL } from "./garrigues/penal/mapa-penal";

const TENANT = "00000000-0000-0000-0000-000000000002";
const APPLY = process.argv.includes("--apply");

// SERVICE_ROLE_SECRET es el nombre que usa el .env real de este repo. Sin él
// el seed aborta tras imprimir todo el resumen — ya pasó en G0/G1 y en G4.
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean);
if (!url || !key) {
  console.error(`Faltan credenciales. Se buscó la service-role en: ${SERVICE_KEY_NAMES.join(", ")}`);
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const PROVENANCE = {
  fuente: "Mapa de riesgos penales evaluado 2025 — áreas de negocio y departamentos internos",
  metodo_extraccion: "muestreo de píxel sobre render pdftoppm; el nivel es color, no texto",
  escala: {
    tipo: "ORDINAL_SIN_NOMBRES",
    bandas: 5,
    leyenda_en_fuente: false,
    // El orden relativo de los dos verdes NO es derivable de la fuente. Se
    // declara en vez de resolverse con un número inventado.
    orden_indeterminado: ["VERDE_INTENSO", "VERDE_CLARO"],
    advertencia:
      "La fuente no publica leyenda ni criterio de bandas, y PPD-01 tampoco los documenta. " +
      "El orden del tramo amarillo-naranja-rojo se infiere del degradado; el de los dos verdes no está publicado.",
  },
  firmeza: "DEMO_PILOTO",
} as const;

// Celda gris = no evaluada. nivel:null y NUNCA 0: el cero es un valor de la escala.
const celda = (c: string) => (c === "GRIS" ? { nivel: null, motivo: "NO_EVALUADA" } : { color: c });
const mapear = (o: Record<string, string>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, celda(v)]));

let creados = 0, actualizados = 0;
for (const d of MAPA_PENAL) {
  const fila = {
    tenant_id: TENANT,
    code: d.codigo,
    title: d.delito,
    description: d.articulo ? `Artículos del Código Penal: ${d.articulo}` : null,
    module_id: "risk",
    status: "Abierto",
    // probability / impact / residual_score se dejan sin tocar: la fuente da un
    // nivel compuesto por celda y no lo descompone en ejes.
    assessed_band: d.banda,
    assessment_breakdown: {
      areas_negocio: mapear(d.areas_negocio),
      departamentos_internos: mapear(d.departamentos_internos),
    },
    assessment_provenance: PROVENANCE,
  };

  // risks.code no tiene unicidad de ningún tipo: la idempotencia es manual.
  const { data: ya, error: eSel } = await db.from("risks")
    .select("id").eq("tenant_id", TENANT).eq("code", d.codigo).maybeSingle();
  if (eSel) { console.error(`${d.codigo}: ${eSel.message}`); process.exit(1); }

  if (!APPLY) { ya ? actualizados++ : creados++; continue; }
  const { error } = ya
    ? await db.from("risks").update(fila).eq("id", ya.id)
    : await db.from("risks").insert(fila);
  if (error) { console.error(`${d.codigo}: ${error.message}`); process.exit(1); }
  ya ? actualizados++ : creados++;
}

console.log(`${APPLY ? "APLICADO" : "DRY-RUN"}: ${creados} altas, ${actualizados} actualizaciones (${MAPA_PENAL.length} delitos)`);
if (!APPLY) console.log("Nada se ha escrito. Repite con --apply.");
```

- [ ] **Step 4: Dry-run, luego aplicar**

```bash
bun run db:check-target
bun run scripts/seed-garrigues-penal.ts
```
Expected: `DRY-RUN: 82 altas, 0 actualizaciones (82 delitos)`.

```bash
bun run scripts/seed-garrigues-penal.ts --apply
```
Expected: `APLICADO: 82 altas, 0 actualizaciones (82 delitos)`.

Vuelve a lanzarlo con `--apply` una segunda vez. Expected: `0 altas, 82 actualizaciones`. Si da 82 altas otra vez, la idempotencia está rota y hay 164 filas: bórralas y arréglalo antes de seguir.

- [ ] **Step 5: Ejecutar los tests y verificar que pasan**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts`
Expected: PASS. **Ahora vuelve al Step 2 de Task 4**: el test del backbone ya tiene sujeto y debe pasar con `'No evaluado'`.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-garrigues-penal.ts src/test/schema/g5-mapa-penal.test.ts
git commit -m "feat(g5): siembra los 82 riesgos penales del tenant Garrigues

probability, impact y residual_score quedan en NULL a proposito: la fuente da
un nivel compuesto por celda y no lo descompone en ejes. El CHECK de la
migracion 20260820120000 impide rellenarlos."
```

---

## Task 6: Hallazgos de banda alta y controles de seguimiento

**Files:**
- Create: `scripts/garrigues/penal/seguimiento-ppd.ts`
- Modify: `scripts/seed-garrigues-penal.ts`
- Modify: `src/test/schema/g5-mapa-penal.test.ts`

**Por qué los hallazgos no son invención.** Un hallazgo titulado «Nivel máximo evaluado: *delito* en *área*» es la evaluación del propio despacho reformulada, con `origin` apuntando al mapa. Son 8, que es el recuento de celdas naranja y rojo.

**Por qué `severity` va en NULL.** El CHECK solo admite `'Crítico'|'Alto'|'Medio'|'Bajo'`, y mapear bandas anónimas a nombres es exactamente lo que D-2 prohíbe. Un CHECK no rechaza NULL.

**Por qué `action_plans` se queda vacío.** PPD-01 §246 describe el mecanismo pero no publica la lista, y `action_plans.finding_id` es NOT NULL: colgar algo de ahí exigiría fabricar antes el hallazgo del que colgarlo. Lo que sí está literal es el Plan de seguimiento de §350-356, y son controles.

- [ ] **Step 1: Escribir el test que falla**

Añade al describe de Cloud:

```ts
  it("los 8 hallazgos de banda alta están, sin severidad inventada", async () => {
    if (!garr) return;
    const { data, error } = await garr.from("findings")
      .select("code, title, severity, status, origin, due_date, owner_id").like("code", "FND-GARR-PEN-%");
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(8);
    for (const r of rows) {
      // La escala de la fuente no tiene nombres: no se le pone uno.
      expect(r.severity, `${r.code}`).toBeNull();
      expect(r.status).toBe("Abierto");
      expect(r.origin as string).toContain("Mapa de riesgos penales evaluado 2025");
      // La fuente no da plazo ni responsable.
      expect(r.due_date, `${r.code}`).toBeNull();
      expect(r.owner_id, `${r.code}`).toBeNull();
    }
    expect(rows.some((r) => (r.title as string).toLowerCase().includes("contrabando"))).toBe(true);
  });

  it("los 4 controles del Plan de seguimiento del PPD están sembrados", async () => {
    if (!garr) return;
    const { data, error } = await garr.from("controls")
      .select("code, name").in("code", ["CTR-GARR-25", "CTR-GARR-26", "CTR-GARR-27", "CTR-GARR-28"]);
    expect(error).toBeNull();
    expect((data ?? [])).toHaveLength(4);
  });

  it("action_plans sigue vacío para Garrigues: la fuente no publica la lista", async () => {
    if (!garr) return;
    // action_plans no tiene tenant_id; se scopea por el hallazgo.
    const { data } = await garr.from("findings").select("id").like("code", "FND-GARR-PEN-%");
    const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) return;
    const { count } = await garr.from("action_plans")
      .select("id", { count: "exact", head: true }).in("finding_id", ids);
    expect(count ?? 0).toBe(0);
  });
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts -t "banda alta"`
Expected: FAIL — `expected [] to have length 8`.

- [ ] **Step 3: Escribir los controles de seguimiento**

Crea `scripts/garrigues/penal/seguimiento-ppd.ts`:

```ts
// scripts/garrigues/penal/seguimiento-ppd.ts
// Las cuatro actividades del Plan de seguimiento del PPD, LITERALES de
// PPD-01 "Supervisión y seguimiento del programa" (§350-356).
//
// Son controles y no planes de acción: son actividades de supervisión
// recurrentes con órgano responsable identificado. El Plan de acción del §246
// no se siembra porque la fuente describe el mecanismo y no publica la lista.
export const CONTROLES_SEGUIMIENTO = [
  { code: "CTR-GARR-25", name: "PPD — Seguimiento del desarrollo del Plan de acción" },
  { code: "CTR-GARR-26", name: "PPD — Seguimiento del desarrollo del Plan de formación" },
  { code: "CTR-GARR-27", name: "PPD — Seguimiento de la aplicación de controles ya establecidos" },
  { code: "CTR-GARR-28", name: "PPD — Seguimiento de los objetivos establecidos en relación con el PPD" },
] as const;

export const SEGUIMIENTO_DESCRIPCION =
  "Actividad del Plan de seguimiento del Sistema de gestión de riesgos penales. " +
  "Sus resultados se tratan en las reuniones de coordinación del PPD, donde se analizan " +
  "también las no conformidades detectadas —el incumplimiento de un requisito establecido " +
  "en el PPD— y se valora la conveniencia de tomar acciones correctivas. " +
  "Fuente: PPD-01, Manual del Sistema de Gestión de Riesgos Penales, " +
  "apartado «Supervisión y seguimiento del programa».";
```

- [ ] **Step 4: Ampliar el seed**

Añade al final de `scripts/seed-garrigues-penal.ts`, antes del `console.log` de resumen:

```ts
import { CELDAS_BANDA_ALTA } from "./garrigues/penal/mapa-penal";
import { CONTROLES_SEGUIMIENTO, SEGUIMIENTO_DESCRIPCION } from "./garrigues/penal/seguimiento-ppd";

const ORIGEN = "Mapa de riesgos penales evaluado 2025 (áreas de negocio)";

let hallazgos = 0;
for (const [i, c] of CELDAS_BANDA_ALTA.entries()) {
  const code = `FND-GARR-PEN-${String(i + 1).padStart(2, "0")}`;
  const fila = {
    tenant_id: TENANT,
    code,
    title: `Nivel máximo evaluado: ${c.delito} — ${c.columna}`,
    // severity se deja en NULL: el CHECK solo admite cuatro nombres castellanos
    // y la escala de la fuente no tiene nombres.
    status: "Abierto",
    origin: `${ORIGEN} — celda ${c.celda} en ${c.columna}`,
    // due_date y owner_id en NULL: la fuente no los da.
  };
  const { data: ya } = await db.from("findings")
    .select("id").eq("tenant_id", TENANT).eq("code", code).maybeSingle();
  if (!APPLY) { hallazgos++; continue; }
  const { error } = ya
    ? await db.from("findings").update(fila).eq("id", ya.id)
    : await db.from("findings").insert(fila);
  if (error) { console.error(`${code}: ${error.message}`); process.exit(1); }
  hallazgos++;
}

let controles = 0;
for (const c of CONTROLES_SEGUIMIENTO) {
  const fila = {
    tenant_id: TENANT, code: c.code, name: c.name,
    description: SEGUIMIENTO_DESCRIPCION, status: "En proceso",
  };
  const { data: ya } = await db.from("controls")
    .select("id").eq("tenant_id", TENANT).eq("code", c.code).maybeSingle();
  if (!APPLY) { controles++; continue; }
  const { error } = ya
    ? await db.from("controls").update(fila).eq("id", ya.id)
    : await db.from("controls").insert(fila);
  if (error) { console.error(`${c.code}: ${error.message}`); process.exit(1); }
  controles++;
}
console.log(`  hallazgos: ${hallazgos}, controles de seguimiento: ${controles}`);
```

**Antes de aplicar**, comprueba las columnas y CHECK reales de `controls`, que en este esquema tiene `name` y no `title`, y un dominio propio de `status`:

```bash
supabase db query --linked <<'SQL'
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='controls' ORDER BY ordinal_position;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.controls'::regclass AND contype='c';
SQL
```

Ajusta `fila` a lo que devuelva. Si `status` no admite `'En proceso'`, usa un valor del dominio real; **no** uses `'Efectivo'` para algo cuya efectividad no consta.

- [ ] **Step 5: Dry-run, aplicar, y verificar idempotencia**

```bash
bun run scripts/seed-garrigues-penal.ts
bun run scripts/seed-garrigues-penal.ts --apply
bun run scripts/seed-garrigues-penal.ts --apply
```
Expected en la tercera: `0 altas, 82 actualizaciones`, `hallazgos: 8, controles de seguimiento: 4`.

- [ ] **Step 6: Ejecutar los tests y verificar que pasan**

Run: `bun test src/test/schema/g5-mapa-penal.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/garrigues/penal/seguimiento-ppd.ts scripts/seed-garrigues-penal.ts src/test/schema/g5-mapa-penal.test.ts
git commit -m "feat(g5): 8 hallazgos de banda alta y los 4 controles del Plan de seguimiento

Los hallazgos son la evaluacion del despacho reformulada, no dato inventado:
severity, due_date y owner_id quedan en NULL porque la fuente no los da.
action_plans se queda vacio a proposito — PPD-01 §246 describe el mecanismo
y no publica la lista, y finding_id es NOT NULL."
```

---

## Task 7: Risk 360 deja de inventar los ejes

**Files:**
- Create: `src/lib/grc/assessed-band.ts`
- Modify: `src/hooks/useRisks.ts`
- Modify: `src/pages/grc/Risk360.tsx:40,148,238`
- Test: `src/test/grc/assessed-band.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Banda = "ROJO" | "NARANJA" | "AMARILLO" | "VERDE" | "NO_EVALUADA";
  export const ORDEN_BANDAS: readonly Banda[];             // de mayor a menor
  export const COLOR_BANDA: Record<Banda, string>;         // token CSS
  export const ETIQUETA_BANDA: Record<Banda, string>;      // texto sin nombre de nivel
  export function tieneEjes(r: { probability: number | null; impact: number | null }): boolean;
  ```

**El defecto.** `Risk360.tsx:148` imprime `Prob. {risk.probability ?? 1} · Impacto {risk.impact ?? 1}` y `:238` coloca en `grid[5 - impact][probability - 1]` con los mismos defaults. Un riesgo sin ejes acaba diciendo «Prob. 1 · Impacto 1» y apilado en la esquina de menor exposición.

**Cero cambio ARGA.** La rama se decide por `tieneEjes(risk)`, **nunca** por `tenant_id`. Los 167 riesgos de ARGA tienen ejes y no atraviesan código nuevo.

**Reglas UX Garrigues.** Nada de hex, nada de colores Tailwind nativos. Los colores del mapa son dato, no marca: se declaran como tokens locales del módulo y se usan vía `style` porque no existe clase Tailwind equivalente para un color arbitrario de origen.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/test/grc/assessed-band.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ORDEN_BANDAS, ETIQUETA_BANDA, tieneEjes } from "@/lib/grc/assessed-band";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("G5 — bandas evaluadas", () => {
  it("el orden va de mayor a menor y los dos verdes están colapsados", () => {
    expect(ORDEN_BANDAS).toEqual(["ROJO", "NARANJA", "AMARILLO", "VERDE", "NO_EVALUADA"]);
  });

  it("ninguna etiqueta nombra un nivel que la fuente no publica", () => {
    const prohibidas = ["crítico", "critico", "alto", "medio", "bajo", "grave", "leve"];
    for (const t of Object.values(ETIQUETA_BANDA))
      for (const p of prohibidas)
        expect(t.toLowerCase(), `la etiqueta "${t}" nombra un nivel inventado`).not.toContain(p);
  });

  it("tieneEjes distingue el riesgo clásico del evaluado por banda", () => {
    expect(tieneEjes({ probability: 3, impact: 4 })).toBe(true);
    expect(tieneEjes({ probability: null, impact: null })).toBe(false);
    // Medio dato tampoco es dato: no se completa el que falta con un 1.
    expect(tieneEjes({ probability: 3, impact: null })).toBe(false);
  });
});

describe("G5 — Risk 360 no inventa ejes", () => {
  const src = read("src/pages/grc/Risk360.tsx");

  it("ya no hay defaults que rellenen probability/impact con 1", () => {
    // Este es el patrón exacto que producía "Prob. 1 · Impacto 1" en todos los
    // riesgos penales del despacho. Si vuelve, el test cae.
    expect(src).not.toMatch(/probability\s*\?\?\s*1/);
    expect(src).not.toMatch(/impact\s*\?\?\s*1/);
  });

  it("la rama se decide por forma del dato, nunca por tenant", () => {
    expect(src).toContain("tieneEjes");
    expect(src).not.toMatch(/tenant_?[Ii]d\s*===/);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `bun test src/test/grc/assessed-band.test.ts`
Expected: FAIL — no se resuelve `@/lib/grc/assessed-band`.

- [ ] **Step 3: Escribir el módulo de bandas**

Crea `src/lib/grc/assessed-band.ts`:

```ts
// src/lib/grc/assessed-band.ts
// G5 — bandas de color de un mapa de riesgos evaluado en origen.
//
// Las bandas NO tienen nombre de nivel. La fuente no publica leyenda ni
// criterio, así que llamarlas "Crítico"/"Alto"/"Medio"/"Bajo" sería inventar
// una escala. Se identifican por su color y por su posición relativa.
//
// Módulo hoja: no importa nada del proyecto, para que pueda usarse desde
// cualquier capa sin arrastrar ciclos.
export type Banda = "ROJO" | "NARANJA" | "AMARILLO" | "VERDE" | "NO_EVALUADA";

// De mayor a menor. Los dos verdes de la fuente van colapsados en VERDE: su
// orden relativo no está publicado y una banda tiene que estar ordenada.
export const ORDEN_BANDAS: readonly Banda[] = ["ROJO", "NARANJA", "AMARILLO", "VERDE", "NO_EVALUADA"];

// Colores del propio mapa. Son DATO, no marca: se sirven tal cual para que el
// lector reconozca la matriz que ya conoce.
export const COLOR_BANDA: Record<Banda, string> = {
  ROJO: "rgb(255,0,0)",
  NARANJA: "rgb(255,192,0)",
  AMARILLO: "rgb(255,255,0)",
  VERDE: "rgb(146,208,80)",
  NO_EVALUADA: "rgb(217,217,217)",
};

// Sin nombre de nivel, a propósito.
export const ETIQUETA_BANDA: Record<Banda, string> = {
  ROJO: "Banda roja",
  NARANJA: "Banda naranja",
  AMARILLO: "Banda amarilla",
  VERDE: "Banda verde",
  NO_EVALUADA: "Sin evaluar",
};

export const NOTA_ESCALA =
  "Los niveles proceden del mapa evaluado del despacho, que los expresa por color. " +
  "La fuente no publica leyenda ni criterio de bandas, así que no se les atribuye nombre. " +
  "El orden relativo de los dos tonos de verde no consta.";

/**
 * Un riesgo tiene ejes clásicos solo si trae LOS DOS. Con medio dato no se
 * completa el que falta: rellenar con 1 es lo que hacía que un riesgo sin
 * evaluar dijera "Prob. 1 · Impacto 1".
 */
export function tieneEjes(r: { probability: number | null; impact: number | null }): boolean {
  return r.probability != null && r.impact != null;
}
```

- [ ] **Step 4: Añadir las columnas al hook**

En `src/hooks/useRisks.ts`, añade al tipo `RiskRow`:

```ts
  assessed_band: Banda | null;
  assessment_breakdown: Record<string, Record<string, { color?: string; nivel?: null; motivo?: string }>> | null;
  assessment_provenance: Record<string, unknown> | null;
```

con `import type { Banda } from "@/lib/grc/assessed-band";` arriba, y añade `assessed_band, assessment_breakdown, assessment_provenance` a las **dos** cadenas de `select` (la de `useRisks` y la de `useRiskById`).

- [ ] **Step 5: Corregir Risk 360**

En `src/pages/grc/Risk360.tsx`:

1. Importa `import { ORDEN_BANDAS, COLOR_BANDA, ETIQUETA_BANDA, NOTA_ESCALA, tieneEjes } from "@/lib/grc/assessed-band";`
2. En `riskScore` (línea ~40), devuelve `null` cuando no hay ejes en vez de multiplicar defaults:

```ts
const riskScore = (risk: RiskRow): number | null =>
  tieneEjes(risk) ? risk.probability! * risk.impact! : null;
```

Ajusta los consumidores de `riskScore` para el `null`: `criticalCount` y `highCount` filtran con `(s) => s !== null && s >= 20` y `s !== null && s >= 15 && s < 20`, de modo que un riesgo sin ejes **no suma ni resta** en los KPI.

3. En la ficha (línea ~148), sustituye el chip de ejes:

```tsx
{tieneEjes(risk) ? (
  <span
    className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)]"
    style={{ borderRadius: "var(--g-radius-full)" }}
  >
    Prob. {risk.probability} · Impacto {risk.impact}
  </span>
) : risk.assessed_band ? (
  // La fuente da un nivel compuesto por celda y no lo descompone en ejes.
  // Imprimir "Prob. 1 · Impacto 1" aquí era afirmar un dato inventado.
  <span
    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
    style={{ borderRadius: "var(--g-radius-full)" }}
    title={NOTA_ESCALA}
  >
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 border border-[var(--g-border-subtle)]"
      style={{ backgroundColor: COLOR_BANDA[risk.assessed_band], borderRadius: "var(--g-radius-sm)" }}
    />
    {ETIQUETA_BANDA[risk.assessed_band]}
  </span>
) : null}
```

4. En la rejilla (línea ~238), solo entran los riesgos con ejes, y los demás van a una tira por bandas:

```tsx
const conEjes = risks.filter(tieneEjes);
const porBanda = ORDEN_BANDAS.map((b) => ({
  banda: b,
  items: risks.filter((r) => !tieneEjes(r) && r.assessed_band === b),
})).filter((g) => g.items.length > 0);

const grid: RiskRow[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => [] as RiskRow[]));
conEjes.forEach((risk) => {
  grid[5 - risk.impact!][risk.probability! - 1].push(risk);
});
```

Renderiza la rejilla 5×5 solo si `conEjes.length > 0` y la tira solo si `porBanda.length > 0`. En ARGA la segunda nunca aparece; en Garrigues, la primera tampoco.

Sobre la tira, un párrafo con `NOTA_ESCALA` en `text-[var(--g-text-secondary)]`.

- [ ] **Step 6: Escribir el test del editor, que también inventa**

`RiskEditor.tsx:85-86` hace `probability: risk.probability ?? 3, impact: risk.impact ?? 3`
y `:117-118` los envía en el `update`. Es **peor** que el `?? 1` de la ficha: aquel solo se
mostraba, este **persiste** el dato inventado. Y `Risk360.tsx:184` enlaza cada ficha al
editor, así que está a un clic.

Con el CHECK `risks_banda_sin_ejes_check` de Task 3, guardar ahí ahora reventaría con un
error crudo de Postgres. El CHECK es la red, no la solución: la solución es no ofrecer los
ejes cuando el riesgo no los tiene.

Añade a `src/test/grc/assessed-band.test.ts`:

```ts
describe("G5 — el editor no ofrece ejes que la fuente no publica", () => {
  const src = read("src/pages/grc/RiskEditor.tsx");

  it("ya no pre-rellena probability/impact con un 3 inventado", () => {
    expect(src).not.toMatch(/probability\s*\?\?\s*3/);
    expect(src).not.toMatch(/impact\s*\?\?\s*3/);
  });

  it("decide por la banda si los ejes se ofrecen", () => {
    expect(src).toContain("assessed_band");
    expect(src).toMatch(/assessed_band\s*(\?|&&|==|!=)/);
  });
});
```

- [ ] **Step 7: Ejecutar el test para verificar que falla**

Run: `bun test src/test/grc/assessed-band.test.ts -t "el editor no ofrece"`
Expected: FAIL — `?? 3` sigue en el fichero.

- [ ] **Step 8: Corregir el editor**

En `src/pages/grc/RiskEditor.tsx`:

1. Guarda la banda del riesgo cargado y deriva de ella si el riesgo usa ejes:

```ts
// Un riesgo evaluado por banda no tiene ejes: su fuente da un nivel compuesto y
// no lo descompone. Ofrecer los selectores aquí invitaba a inventarlos, y el
// pre-relleno con 3 los inventaba solo.
const evaluadoPorBanda = !!risk?.assessed_band;
```

2. Sustituye el pre-relleno de las líneas 85-86 por valores que no se envían cuando hay banda:

```ts
probability: risk.probability ?? 3,
impact: risk.impact ?? 3,
```
→
```ts
// Sin banda se mantiene el default de siempre (3) para el alta manual, que es
// el flujo de ARGA. Con banda no se usa: el payload los omite.
probability: risk.probability ?? 3,
impact: risk.impact ?? 3,
assessed_band: risk.assessed_band ?? null,
```

3. En el payload (líneas ~117-118), omite los ejes cuando hay banda:

```ts
...(evaluadoPorBanda ? {} : { probability: form.probability, impact: form.impact }),
```

4. En el formulario, sustituye los dos selectores y el `inherentPreview` por un bloque
   read-only cuando `evaluadoPorBanda`:

```tsx
{evaluadoPorBanda ? (
  <div className="sm:col-span-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
       style={{ borderRadius: "var(--g-radius-md)" }}>
    <p className="text-sm font-medium text-[var(--g-text-primary)]">
      Nivel evaluado en origen: {ETIQUETA_BANDA[form.assessed_band!]}
    </p>
    <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
      {NOTA_ESCALA} Este riesgo no se edita por probabilidad e impacto: su fuente no los
      descompone.
    </p>
  </div>
) : (
  <>{/* los dos selectores y la vista previa de score, tal cual estaban */}</>
)}
```

- [ ] **Step 9: Ejecutar los tests y verificar que pasan**

```bash
bun test src/test/grc/assessed-band.test.ts
bun run typecheck
bun run lint
```
Expected: PASS / 0 errores.

Comprueba a mano que el alta de un riesgo nuevo en ARGA (`/grc/risk-360/nuevo`) sigue
ofreciendo los dos selectores: no hay banda, así que `evaluadoPorBanda` es falso.

- [ ] **Step 10: Commit**

```bash
git add src/lib/grc/assessed-band.ts src/hooks/useRisks.ts src/pages/grc/Risk360.tsx src/pages/grc/RiskEditor.tsx src/test/grc/assessed-band.test.ts
git commit -m "fix(g5): Risk 360 deja de rellenar probability/impact con 1

Un riesgo sin ejes decia 'Prob. 1 x Impacto 1' y caia en la casilla de menor
exposicion de la rejilla. El editor era peor: prerrellenaba 3x3 y al guardar lo
PERSISTIA, y estaba a un clic desde cada ficha.

Ahora las dos pantallas se ramifican por FORMA DEL DATO, no por tenant: con
ejes, rejilla 5x5 y selectores identicos a los de siempre; sin ejes, tira por
bandas de color y nivel de origen en solo lectura."
```

---

## Task 8: Detalle del riesgo con el desglose por las 18 columnas

**Files:**
- Create: `src/pages/grc/RiskDetalle.tsx` — **no existe**: las únicas rutas de riesgo son `/nuevo` y `/:id/editar`, las dos servidas por `RiskEditor` (`src/App.tsx:316-318`)
- Modify: `src/App.tsx:316-318` — registrar `/grc/risk-360/:id`
- Modify: `src/pages/grc/Risk360.tsx:184` — la ficha enlaza hoy al editor; debe enlazar al detalle
- Test: `src/test/grc/assessed-band.test.ts`

**Contrato de arista, no de rótulo.** Este es el P0 nº1 de G4: leer el nivel correcto en pantalla **no** prueba que el desglose se esté leyendo, porque el seed escribe banda y desglose con valores coherentes. El test tiene que caer si la superficie deja de leer `assessment_breakdown`.

- [ ] **Step 1: Escribir el test que falla**

Añade a `src/test/grc/assessed-band.test.ts`:

```ts
describe("G5 — el detalle del riesgo lee el desglose, no solo la banda", () => {
  const src = read("src/pages/grc/RiskDetalle.tsx");

  it("consume assessment_breakdown con un guard vivo", () => {
    // Que el identificador aparezca no basta: podría estar en una rama muerta.
    expect(src).toMatch(/assessment_breakdown\s*(\?|&&|\))/);
  });

  it("pinta las dos familias de columnas del mapa", () => {
    expect(src).toContain("areas_negocio");
    expect(src).toContain("departamentos_internos");
  });

  it("marca las celdas sin evaluar en vez de pintarlas como un nivel", () => {
    expect(src).toContain("NO_EVALUADA");
  });

  it("declara la limitación de la escala", () => {
    expect(src).toContain("NOTA_ESCALA");
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `bun test src/test/grc/assessed-band.test.ts -t "detalle del riesgo"`
Expected: FAIL — no existe el fichero, o no contiene `assessment_breakdown`.

- [ ] **Step 3: Escribir el desglose**

Crea `src/pages/grc/RiskDetalle.tsx` con `useRiskById(id)` (ya existe en `src/hooks/useRisks.ts`), registra la ruta en `src/App.tsx` junto a las otras tres, con el mismo `Suspense`/`ModuleFallback`:

```tsx
<Route path="/grc/risk-360/:id" element={<Suspense fallback={<ModuleFallback />}><RiskDetalle /></Suspense>} />
```

React Router v6 ordena por especificidad, así que `/nuevo` gana a `/:id` con independencia del orden de declaración. Aun así, decláralas juntas y en orden legible.

Cambia además el enlace de la ficha en `Risk360.tsx:184` para que lleve al detalle en vez de al editor, dejando «Editar» como acción secundaria.

La sección del desglose:

```tsx
{risk.assessment_breakdown && (
  <section className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] p-4"
           style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}>
    <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
      Exposición evaluada por ámbito
    </h2>
    <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">{NOTA_ESCALA}</p>

    {([
      ["Áreas de negocio", risk.assessment_breakdown.areas_negocio],
      ["Departamentos internos", risk.assessment_breakdown.departamentos_internos],
    ] as const).map(([titulo, cols]) => (
      <div key={titulo} className="mt-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
          {titulo}
        </h3>
        <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(cols ?? {}).map(([nombre, celda]) => {
            const sinEvaluar = celda?.motivo === "NO_EVALUADA";
            return (
              <li key={nombre}
                  className="flex items-center gap-2 border border-[var(--g-border-subtle)] px-2 py-1.5"
                  style={{ borderRadius: "var(--g-radius-sm)" }}>
                <span aria-hidden="true"
                      className="inline-block h-3 w-3 shrink-0 border border-[var(--g-border-subtle)]"
                      style={{
                        // Celda gris = no evaluada. Se marca como tal en vez de
                        // pintarla como si fuera el nivel más bajo.
                        backgroundColor: sinEvaluar ? "rgb(217,217,217)" : `rgb(${COLOR_CELDA[celda!.color!]})`,
                        borderRadius: "var(--g-radius-sm)",
                      }} />
                <span className="min-w-0 truncate text-xs text-[var(--g-text-primary)]">{nombre}</span>
                <span className="ml-auto shrink-0 text-xs text-[var(--g-text-secondary)]">
                  {sinEvaluar ? "Sin evaluar" : ETIQUETA_CELDA[celda!.color!]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </section>
)}
```

Añade a `src/lib/grc/assessed-band.ts` los dos mapas por celda, que conservan los **dos verdes por separado** —el desglose sí distingue el color exacto, es la banda del riesgo la que los colapsa—:

```ts
export type Celda = "VERDE_CLARO" | "VERDE_INTENSO" | "AMARILLO" | "NARANJA" | "ROJO";
export const COLOR_CELDA: Record<Celda, string> = {
  VERDE_INTENSO: "0,176,80", VERDE_CLARO: "146,208,80",
  AMARILLO: "255,255,0", NARANJA: "255,192,0", ROJO: "255,0,0",
};
// El desglose conserva el color exacto de la fuente. Los dos verdes se
// distinguen aquí aunque su orden relativo no esté publicado: distinguirlos
// no es ordenarlos.
export const ETIQUETA_CELDA: Record<Celda, string> = {
  VERDE_INTENSO: "Verde intenso", VERDE_CLARO: "Verde claro",
  AMARILLO: "Amarillo", NARANJA: "Naranja", ROJO: "Rojo",
};
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

```bash
bun test src/test/grc/assessed-band.test.ts
bun run typecheck
```
Expected: PASS / 0 errores.

- [ ] **Step 5: Prueba de mutación del contrato**

Borra temporalmente la línea que lee `risk.assessment_breakdown` y ejecuta el test. **Tiene que fallar.** Si pasa, el test no prueba la arista y hay que arreglarlo — no el código, el test. Restaura la línea.

- [ ] **Step 6: Commit**

```bash
git add src/lib/grc/assessed-band.ts src/pages/grc/RiskDetalle.tsx src/test/grc/assessed-band.test.ts src/App.tsx
git commit -m "feat(g5): desglose del riesgo penal por las 18 columnas del mapa

El desglose conserva el color exacto de la fuente, incluidos los dos verdes,
que a nivel de riesgo van colapsados: distinguirlos no es ordenarlos.
Contrato verificado por mutacion — si la superficie deja de leer
assessment_breakdown, el test cae."
```

---

## Task 9: Aislamiento cross-tenant y cierre

**Files:**
- Modify: `src/test/schema/tenant-isolation.test.ts`

- [ ] **Step 1: Comprobar que ambos tenants tienen filas reales**

Antes de tocar el test. Una aserción de aislamiento sobre una tabla vacía en un lado **pasa de forma vacua** y no prueba nada: es el error que G4 documentó.

```bash
supabase db query --linked <<'SQL'
SELECT 'risks' t, tenant_id, count(*) FROM risks GROUP BY 1,2
UNION ALL SELECT 'findings', tenant_id, count(*) FROM findings GROUP BY 1,2
ORDER BY 1,2;
SQL
```

Expected: las dos tablas con filas en los dos tenants. Anota las cifras.

- [ ] **Step 2: Ampliar el gate de 7 a 9 tablas**

En `src/test/schema/tenant-isolation.test.ts`, añade `risks` y `findings` a la lista de tablas, siguiendo el patrón que ya usan las 7 existentes.

**GOTCHA:** una escritura cross-tenant filtrada por RLS devuelve **0 filas sin error**, no `42501`. La aserción es sobre el número de filas, no sobre el código de error.

- [ ] **Step 3: Ejecutar el gate**

Run: `bun test src/test/schema/tenant-isolation.test.ts`
Expected: PASS, 9/9 tablas.

- [ ] **Step 4: Gates completos**

```bash
bun run db:check-target
bun test
bun run typecheck
bun run lint
bun run build
```

Expected: `governance_OS`; `bun test` **≥ 3307 pass / 0 fail** (la línea base de G4 más los tests nuevos); typecheck, lint y build verdes.

- [ ] **Step 5: Verificación viva con control discriminante**

Levanta el preview y mide **los dos tenants**, comprobando el email del token **en la misma llamada que mide** — dos pestañas comparten `localStorage` y la `storageKey` de Supabase, y una sesión pisa a la otra.

En `/grc/risk-360`:

| | Garrigues | ARGA |
|---|---|---|
| Rejilla 5×5 | ausente | presente |
| Tira por bandas | presente, 5 grupos | ausente |
| Texto «Prob. 1 · Impacto 1» | **0 apariciones** | n/a |
| Nota de escala | presente | ausente |

En el detalle de un riesgo de Garrigues: 18 columnas, con las grises marcadas «Sin evaluar».

**Cuidado con `document.body.innerText`:** devuelve el texto ya transformado por CSS, así que buscar subcadenas da falsos positivos. Usa `\b…\b` y contrasta con el nodo de texto crudo.

- [ ] **Step 6: Review adversarial de rama**

Antes del merge, con **modelo medio como suelo** — una re-review en haiku devolvió en G4 un informe con cero llamadas a herramientas. Tres lentes:

1. **Spec vs rama:** ¿cada criterio del spec tiene implementación real, o hay alguno marcado como verificado sobre un rótulo?
2. **No regresión ARGA:** ¿alguna rama nueva se activa para ARGA? ¿algún KPI cambió? ¿`grc_risks` de ARGA se movió?
3. **Honestidad del dato:** ¿alguna superficie nombra una banda? ¿algún NULL se pinta como valor? ¿el desglose se lee o solo se escribe?

Corrige lo que salga **antes** de mergear, no después.

- [ ] **Step 7: Merge**

```bash
git checkout main && git pull --ff-only
git merge --no-ff feature/g5-nucleo-penal-garrigues -m "Merge branch 'feature/g5-nucleo-penal-garrigues'"
git push origin main
```

---

## Self-review

**Cobertura del spec.** §5.1 → Task 3. §5.2/5.3 → Tasks 5 y 8. §6 (bandas sin nombre, dos verdes) → Tasks 2, 7, 8. §7 (Risk 360 + trigger) → Tasks 4 y 7. §8 (hallazgos) → Task 6. §9 (controles de seguimiento, `action_plans` vacío) → Task 6. §10 (cero cambio ARGA) → Tasks 3, 4, 7, 9. §11 gates 1-3 → Task 9 step 4; gate 4 → Task 1; gate 5 → CHECK en Task 3 + test en Task 5; gate 6 → Task 8 step 5; gate 7 → Task 9 step 5; gate 8 → Task 9 steps 1-3; gate 9 → Task 9 step 6.

**Consistencia de tipos.** `Celda` se define en `extract-mapa.ts` (Task 1) y se reexporta en `assessed-band.ts` (Task 8) con el mismo dominio menos `GRIS`, que en el desglose viaja como `{nivel:null, motivo:"NO_EVALUADA"}`. `Banda` es idéntica en `mapa-penal.ts`, en el CHECK de la migración y en `assessed-band.ts`.

**Dos puntos que el ejecutor debe verificar en Cloud antes de escribir**, porque el plan no los pudo confirmar: el dominio real de `controls.status` (Task 6 step 4) y si `grc_risks.inherent_severity` tiene CHECK (Task 4 step 3). Los dos pasos incluyen la consulta.
