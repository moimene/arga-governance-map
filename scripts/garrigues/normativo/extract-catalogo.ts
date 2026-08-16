#!/usr/bin/env bun
/**
 * G4 Task 2 — Extractor del catálogo normativo interno de Garrigues.
 *
 * Lee los PDF del sistema normativo (32 PI + núcleo) y produce
 * `catalogo-normativo.ts`, única fuente de verdad del seed de la Task 3.
 * No inventa nada: lo que el PDF no dice queda null y etiquetado.
 *
 * Los PDF viven en `version garrigues/Garr_politicas/`, que es material
 * fuente NO versionado. Las 32 PI están completas solo dentro del zip
 * `OneDrive_1_2-8-2026 (1).zip`; la carpeta suelta tiene 20.
 *
 * Los nombres dentro del zip están en UTF-8 con normalización NFD (bytes
 * i+combining-acute, no el codepoint í precompuesto). `unzip` de macOS los
 * mangla ("Pol+?tica"); `tar` (bsdtar/libarchive) los decodifica bien, y
 * luego se normalizan a NFC antes de usarlos como título/nombre de fichero.
 *
 * Los 38 documentos NO son homogéneos entre sí:
 * - Formato de índice: compacto "N. Título" en una línea (mayoría de las PI)
 *   o partido "N.\n\nTítulo\n\n" en líneas separadas (PI-11, PI-24, PI-30..32,
 *   Manual PBC/FT). El parser de índice soporta ambos.
 * - Numeración de apartados: arábiga en las 32 PI y en el Manual PBC/FT;
 *   el Código Ético usa capítulos en números romanos (I., II., …) con
 *   "Artículo N.-" dentro de cada capítulo — no tiene apartado "Objeto".
 * - Apartado "Objeto": la mayoría de las PI lo traen como "1. Objeto" (a
 *   veces "2. Objeto y alcance…" cuando hay una Introducción previa, p.ej.
 *   PI-24). El Código Ético usa "Artículo 1.- Finalidad" en su lugar. Varios
 *   documentos (PI-26, Manual PBC/FT) no tienen apartado "Objeto" en
 *   absoluto: el propósito se declara dentro de la prosa de otro apartado
 *   ("Objetivos", "Ámbito de aplicación objetivo") con la frase "tiene como
 *   objeto" / "El objeto de est[ae] … es …". Por eso `parseObjeto` prueba 3
 *   patrones en cascada: cabecera "Objeto", cabecera "Finalidad"
 *   (Artículo N.-) y, si ninguna aparece, esa frase.
 * - El apartado "Objeto" no es siempre el nº 1 (PI-24 lo trae en el nº 2) y
 *   la misma cabecera "N. Objeto" aparece primero, más corta, en el propio
 *   índice — justo antes del apartado siguiente — y solo luego en el
 *   cuerpo real. Por eso la extracción NO se basa en línea en blanco (varios
 *   PDF, p.ej. PI-27, no traen ninguna línea en blanco durante páginas) ni
 *   en "el último match del documento" (en documentos largos, p.ej. PI-24 a
 *   45 páginas, puede reaparecer "objeto" por casualidad mucho más allá del
 *   apartado real). En su lugar, cada intento de cabecera calcula su cuerpo
 *   línea a línea hasta el siguiente apartado real (arábigo/romano/Artículo)
 *   y se descarta si queda vacío (eso es lo que pasa con la mención del
 *   índice, cuyo "cuerpo" es ya la cabecera siguiente); se devuelve el
 *   primer cuerpo no vacío encontrado recorriendo el documento en orden.
 *
 * No todas las fuentes son PDF. PPD-01 y el Catálogo ejemplificativo (PPD-CAT)
 * están en la carpeta como `.md` (volcado de la página de SharePoint del
 * Sistema Normativo Interno), no como PDF. Antes se cableaban con `file: null`
 * y salían etiquetados "citado en fuente, no incorporado" TENIENDO su texto
 * delante: eso es afirmar en pantalla algo que la fuente desmiente.
 * `readSourceText` normaliza el markdown a la misma forma que `pdftotext -layout`
 * (cabeceras sin `#`, sin énfasis, sin escapes de pandoc) para que los mismos
 * parsers valgan para ambos formatos, sin una segunda ruta paralela.
 *
 * El valor de procedencia sigue llamándose `PDF_EXTRAIDO` por compatibilidad
 * con el dato ya sembrado y con el badge de `PoliticaDetalle`, cuya etiqueta
 * — "Extraído del documento fuente" — ya es agnóstica del formato. El fichero
 * real viaja en `source_file` y se muestra en el tooltip.
 *
 * Uso: bun run scripts/garrigues/normativo/extract-catalogo.ts [--write]
 * Sin --write imprime un resumen y no toca el JSON.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = "version garrigues/Garr_politicas";
const ZIP = join(ROOT, "OneDrive_1_2-8-2026 (1).zip");
const WRITE = process.argv.includes("--write");
const OUT = "scripts/garrigues/normativo/catalogo-normativo.ts";

// Páginas leídas por documento. 20 cubre con margen el índice más largo
// (Manual PBC/FT, índice de 2 páginas) y el apartado más tardío (LGTBI-01,
// cuyo único apartado "Objeto" real está en la página 18 dentro del anexo
// de protocolo — el cuerpo principal no trae uno propio).
const HEAD_PAGES = 20;

const MESES: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

function run(cmd: string[]): string {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  return new TextDecoder().decode(p.stdout);
}

/**
 * Texto de las primeras HEAD_PAGES páginas: basta para edición, objeto e
 * índice. `-layout` es imprescindible: sin él, poppler serializa tablas e
 * índices en columnas separadas por posición, y el texto sale entrelazado
 * con los números de página fuera de orden (detectado por el coordinador
 * en PI-11/24 y el Manual PBC/FT — no era un problema de regex, era el
 * texto de entrada). Con `-layout` el índice sale tabulado y en orden.
 */
function pdfHead(path: string): string {
  return run(["pdftotext", "-layout", "-f", "1", "-l", String(HEAD_PAGES), path, "-"]);
}

/**
 * Markdown → la misma forma de texto plano que produce `pdftotext -layout`,
 * para que `parseEdicion`/`parseOutline`/`parseObjeto` funcionen sin una
 * segunda implementación. Quita cabeceras `#`, énfasis `**`/`*` y los escapes
 * de pandoc (`1\.` → `1.`), que si no impiden que `matchArabicHeading`
 * reconozca los apartados.
 *
 * Además retira dos cosas que NO son contenido del documento sino cromo de la
 * impresión del navegador desde SharePoint, y que se cuelan en el resumen
 * porque el volcado de PPD-CAT trae el documento entero en UNA sola línea:
 * las URL y el bloque de cabecera de impresión completo
 * ("2/8/26, 11:48 <título> https://… 1/11"), tratado como una unidad para no
 * dejar el número de página suelto.
 */
function mdToText(raw: string): string {
  const scrubbed = raw
    .replace(/\r/g, "")
    .replace(/\d{1,2}\/\d{1,2}\/\d{2},\s*\d{1,2}:\d{2}[\s\S]{0,400}?\d{1,3}\/\d{1,3}(?=\s)/g, " ")
    .replace(/https?:\/\/\S+/g, " ");
  return scrubbed
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s{0,3}#{1,6}\s*/, "")
        .replace(/\*\*|__|\*/g, "")
        .replace(/\\([.\-*_[\]])/g, "$1")
        .replace(/\t/g, "  ")
        .trimEnd(),
    )
    .join("\n");
}

/** Texto de la fuente, sea PDF o volcado markdown. */
function readSourceText(path: string): string {
  if (/\.md$/i.test(path)) return mdToText(readFileSync(path, "utf8"));
  return pdfHead(path);
}

/**
 * "Edición 03, marzo 2020" → { edicion, version: 3, date: "2020-03-01" }
 * También soporta "Edición 02, Julio de 2025" (mes + "de" + año, PI-30).
 */
function parseEdicion(text: string) {
  const m = text.match(/Edici[óo]n\s+(\d+)\s*,\s*([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/i);
  if (!m) return { edicion: null, version: 1, date: null };
  const mes = MESES[m[2].toLowerCase()] ?? null;
  return {
    edicion: m[0],
    version: Number(m[1]),
    date: mes ? `${m[3]}-${mes}-01` : null,
  };
}

// Número arábigo de apartado, opcionalmente con título en la misma línea:
// "1. Objeto", "3.1 Altas de…" (sin punto final, PI-15/17), "2." suelto
// (cabecera partida real) o "2" suelto (casi siempre un número de página de
// pdftotext, p.ej. el "18" al pie de página de LGTBI-01 o el "2"/"1" que se
// cuela en el propio índice de PI-11/26/28 — NO es un apartado).
//
// OJO con el backtracking: `\d+(?:\.\d+)*\.` con el punto final OBLIGATORIO
// rompe en sub-niveles sin punto ("3.1 Altas…") porque el motor retrocede
// el grupo `(?:\.\d+)*` a cero repeticiones para poder consumir el único
// punto disponible como el "final", partiendo "3.1" en marcador "3." +
// título "1 Altas…". Por eso el punto va FUERA y es opcional; solo se exige
// cuando la línea es un número suelto sin título (para distinguirlo de un
// número de página).
const ARABIC_NUM = /^(\d+(?:\.\d+)*)(\.?)(?:\s+(\S.*))?$/;
function matchArabicHeading(line: string): { number: string; title: string } | null {
  const m = line.match(ARABIC_NUM);
  if (!m) return null;
  const [, number, dot, title] = m;
  if (!title && !dot) return null; // número suelto sin punto: número de página
  return { number, title: title ?? "" };
}
function isArabicHeading(l: string): boolean {
  return matchArabicHeading(l) !== null;
}
// Sin /i: "Artículo" siempre va en mayúscula inicial cuando es cabecera real
// (verificado: 0 apariciones en minúscula como cabecera en los 38
// documentos). Con /i, una cita legal en prosa ("…la letra "o" del
// artículo 2.1 de la Ley 10/2010)…") que por el ajuste de línea de
// `-layout` cae al principio de una línea envuelta se confundía con una
// cabecera real y cortaba el resumen de PBC-FT-10 a media frase — no era
// el maxChars, era este falso positivo.
const ARTICULO_HEADING = /^Art[íi]culo\s+\d+\.-?/;
const ROMAN_HEADING = /^[IVXLCDM]+\.(\s|$)/;
function isHeadingLine(l: string): boolean {
  return isArabicHeading(l) || ARTICULO_HEADING.test(l) || ROMAN_HEADING.test(l);
}
function headingNumber(l: string): string {
  const arabic = matchArabicHeading(l);
  if (arabic) return arabic.number;
  return l.match(/^(Art[íi]culo\s+\d+|\S+)/i)?.[1] ?? l;
}

/**
 * Índice numerado tras "Índice"/"ÍNDICE". Recorre línea a línea soportando
 * tanto el formato compacto "N. Título" como el partido "N.\n\nTítulo\n\n",
 * y tres estilos de numeración: arábiga ("1.", "3.1"), romana de capítulo
 * ("I.", "II.", solo el Código Ético) y "Artículo N.-" (también CE). Se
 * detiene en cuanto encuentra una línea de prosa real (no-cabecera) que no
 * pudo fundirse como continuación de un título, o en cuanto un número de
 * apartado de nivel superior SE REPITE — eso solo pasa cuando la cabecera
 * partida del cuerpo real ("1.\n\nObjeto\n\n<prosa>") vuelve a aparecer tras
 * haber sido ya listada en el índice compacto (PI-01, PI-05, PI-13, PI-18,
 * PI-21: índices de solo 2 entradas donde ambas señales conviven).
 */
// Con `-layout`, cada línea de índice trae "N.   Título   <núm. página>"
// tabulado — el número de página va separado del título por 2+ espacios
// (a diferencia de un guarismo que forme parte real del título). Se retira
// por línea, ANTES de fundir continuaciones, porque en una entrada
// envuelta en 2 líneas el número de página solo va al final de la última.
function stripTrailingPageNumber(l: string): string {
  return l.replace(/\s{2,}\d{1,4}\s*$/, "").trim();
}

/**
 * Líneas que se repiten MUCHAS veces en todo el documento: son la cabecera o
 * el pie que aparece en cada hoja (p.ej. "Sistema normativo interno-Código
 * Ético"), nunca contenido. El umbral es 4, no 2: una cláusula legítima puede
 * citarse literalmente dos veces en el mismo documento (comprobado en
 * LGTBI-01) sin ser cabecera de página — un `>= 2` ingenuo la borraba y dejaba
 * el resumen con un hueco a media frase.
 */
const RUNNING_HEADER_MIN_REPEATS = 4;

function runningHeaders(lines: string[]): Set<string> {
  const freq = new Map<string, number>();
  for (const l of lines) {
    if (l.length < 20) continue;
    freq.set(l, (freq.get(l) ?? 0) + 1);
  }
  const out = new Set<string>();
  for (const [l, n] of freq) if (n >= RUNNING_HEADER_MIN_REPEATS) out.add(l);
  return out;
}

function parseOutline(text: string): string[] {
  // Sin \b: JS no considera "í" carácter de palabra, así que \bíndice\b
  // nunca casa (bug detectado en dry-run — los 38 documentos salían sin
  // índice pese a que el texto sí lo trae).
  const start = text.search(/índice/i);
  if (start < 0) return [];
  const normalize = (l: string) => stripTrailingPageNumber(l.trim());
  const allLines = text.split("\n").map(normalize);
  // Mismas cabeceras/pies repetidos en cada hoja que ya filtra
  // `captureUntilHeading`. Aquí hacen falta porque un índice que salta de
  // página trae la cabecera EN MEDIO de las entradas, y el bucle de
  // continuación la fundía en el título anterior ("Artículo 28.- Redes
  // sociales… Sistema normativo interno-Código Ético Edición 04, noviembre
  // 2023" — visible en el catálogo generado antes de este arreglo).
  const running = runningHeaders(allLines);
  const lines = text.slice(start).split("\n").map(normalize);

  const entries: string[] = [];
  const seenNumbers = new Set<string>();
  let i = 1; // línea 0 es la propia palabra "Índice"
  // Sin tope artificial de entradas: el índice termina donde lo dice el
  // documento (prosa real, o un número de apartado que se repite porque ya
  // empezó el cuerpo). Un tope de 40 truncaba en silencio los dos índices
  // largos — PBC-FT-10 (62 entradas, se perdía todo el §8 de medidas de
  // control interno) y el Código Ético (51, se perdía el capítulo VI del
  // Canal Interno de Información) — y la pantalla los presentaba completos.
  outer: while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }
    if (!isHeadingLine(line)) break; // prosa real: fin del índice
    const number = headingNumber(line);
    if (seenNumbers.has(number)) break outer; // repetido: cuerpo real, no índice
    seenNumbers.add(number);
    let entry = line;
    i++;
    // Funde continuaciones cortas (título envuelto o partido en líneas
    // separadas) hasta el siguiente marcador o un límite de longitud.
    while (i < lines.length && entry.length < 220) {
      const next = lines[i];
      if (!next) {
        i++;
        continue;
      }
      if (isHeadingLine(next)) break;
      // "1" suelto sin punto ni título: número de página de pie de página
      // (aquí, el de la propia página 1, justo antes de que empiece el
      // cuerpo) — no es continuación del título, se ignora sin fundirlo.
      if (/^\d{1,4}$/.test(next)) {
        i++;
        continue;
      }
      if (running.has(next)) {
        i++;
        continue;
      }
      entry = `${entry} ${next}`.trim();
      i++;
    }
    // Limpieza cosmética: los índices con "líder de puntos" (p.ej. PI-26,
    // que además lo usa como carácter Unicode "…" repetido, no solo ".")
    // dejan el número de página de esa línea pegado al final del título
    // ("Introducción……….2"); se retira si es un resto de 2+ separadores
    // (puntos/elipsis/espacios) seguido de dígitos al final, sin tocar
    // títulos que legítimamente terminan en cifra tras un solo espacio. En
    // bucle porque una entrada envuelta en 2 líneas puede arrastrar dos
    // restos numéricos seguidos (uno por línea fundida).
    let cleaned = entry.replace(/\s+/g, " ").trim();
    let prev: string;
    do {
      prev = cleaned;
      cleaned = cleaned.replace(/[.…\s]{2,}\d{1,4}$/, "").trim();
    } while (cleaned !== prev);
    entries.push(cleaned);
  }
  return entries;
}

/**
 * Corta en el último límite de frase (". " o ") ", p.ej. el cierre de un
 * ítem de enumeración "(iii) …") que quepa dentro de `maxChars`, en vez de
 * cortar a ciegas por conteo de caracteres — una frase colgando a media
 * preposición se ve al instante en un resumen legal. Si no hay ningún
 * límite de frase, mejor cortar en el último espacio (sin partir palabras)
 * que dejarla colgando.
 */
function truncateAtSentence(text: string, maxChars: number): string {
  const slice = text.slice(0, maxChars);
  const cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(") "));
  if (cut > 0) return slice.slice(0, cut + 1).trim();
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
}

/**
 * Concatena líneas desde `startIdx` hasta que `stopTest` casa una línea (el
 * siguiente apartado real). `transform` puede quitar ruido de cada línea
 * antes de incluirla (p.ej. la numeración de cláusula interna "1.   Este
 * documento…" de cada Artículo del Código Ético — con `-layout` el número y
 * el texto van en la MISMA línea, así que hay que pelar el número y
 * conservar el texto). Devolver `null` desde `transform` sí descarta la
 * línea (numeración suelta sin texto).
 *
 * Dos filtros universales se aplican ANTES de `transform`, para cualquier
 * llamador, no solo el que los pidió — así no hace falta duplicarlos en
 * cada `transform` a medida (root cause, no parche por caso):
 * - Un número suelto sin punto ni título ("2", "18") es casi siempre un
 *   número de página de pdftotext, nunca contenido real.
 * - Una línea que `runningHeaders` marca como cabecera o pie repetido en
 *   cada hoja (p.ej. "Sistema normativo interno-Código Ético" / "Edición 04,
 *   noviembre 2023" en el Código Ético: ~19-20 apariciones en 20 páginas).
 *
 * El corte por `maxChars` ya no trunca a ciegas dentro del bucle: se junta
 * todo el texto hasta `stopTest` y solo si excede `maxChars` se recorta al
 * final, en el último límite de frase (`truncateAtSentence`).
 */
function captureUntilHeading(
  lines: string[],
  startIdx: number,
  stopTest: (l: string) => boolean,
  transform: (l: string) => string | null = (l) => l,
  maxChars = 3000,
): string | null {
  const running = runningHeaders(lines);

  const out: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (stopTest(l)) break;
    if (/^\d{1,4}$/.test(l)) continue; // número de página suelto
    if (running.has(l)) continue; // cabecera/pie repetido en cada página
    const t = transform(l);
    if (t === null) continue;
    out.push(t);
  }
  const joined = out.join(" ").replace(/\s+/g, " ").trim();
  if (joined.length < 40) return null;
  return joined.length > maxChars ? truncateAtSentence(joined, maxChars) : joined;
}

/**
 * Cabecera arábiga "N. Objeto…" (compacta) o "N." + "Objeto…" (partida).
 *
 * También "Finalidad": es el mismo apartado con otro rótulo, como ya
 * reconocía `findArticuloFinalidad` para el Código Ético. PPD-01 lo numera en
 * arábigo ("2.1 Finalidad") y sin esto se quedaba sin objeto.
 */
const OBJETO_HEADING = /^(Objeto|Finalidad)\b/i;

function findArabicObjeto(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    let bodyStart = -1;
    const arabic = matchArabicHeading(line);
    if (arabic && OBJETO_HEADING.test(arabic.title)) {
      bodyStart = i + 1;
    } else if (arabic && !arabic.title) {
      let j = i + 1;
      while (j < lines.length && !lines[j]) j++;
      if (j < lines.length && OBJETO_HEADING.test(lines[j])) bodyStart = j + 1;
    }
    if (bodyStart < 0) continue;
    const body = captureUntilHeading(lines, bodyStart, isArabicHeading);
    if (body) return body;
  }
  return null;
}

// Marcador de cláusula interna con `-layout`: "N.   Texto…" — un único
// nivel, punto y 2+ espacios antes del texto. Deliberadamente más estricto
// que matchArabicHeading: una cita legal envuelta en dos líneas ("…el
// artículo\n10.4 de sus estatutos…") también empieza por un número, pero es
// multinivel ("10.4"), sin punto final y con un solo espacio — no debe
// pelarse o se pierde la cita.
const CLAUSE_MARKER = /^(\d+)\.\s{2,}(\S.*)$/;

/** Cabecera "Artículo N.- Finalidad" (Código Ético; sin apartado "Objeto"). */
function findArticuloFinalidad(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    if (!/^Art[íi]culo\s+\d+\.-?\s+Finalidad\b/i.test(lines[i])) continue;
    const body = captureUntilHeading(
      lines,
      i + 1,
      (l) => ARTICULO_HEADING.test(l) || ROMAN_HEADING.test(l),
      (l) => {
        // Numeración de cláusula interna del artículo ("1.   Este documento…"):
        // pela el "1." y conserva el texto; si va suelta sin texto, la descarta.
        const clause = l.match(CLAUSE_MARKER);
        if (clause) return clause[2];
        if (/^\d+\.$/.test(l)) return null; // "1." suelta, sin texto
        return l;
      },
    );
    if (body) return body;
  }
  return null;
}

/**
 * Fallback: el "objeto" declarado en prosa bajo otra cabecera (PI-26 lo
 * dice bajo "2. Objetivos"; el Manual de PBC/FT bajo "3.1 Ámbito de
 * aplicación objetivo"), reconocible por la frase "tiene como objeto" o
 * "El objeto de est(e|a) …".
 */
function findObjetoSentence(lines: string[], pattern: RegExp, maxChars?: number): string | null {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const at = l.search(pattern);
    if (at < 0) continue;
    // Comienzo de la FRASE que contiene el patrón, no de la línea. En los PDF
    // con `-layout` una línea es una línea visual y la frase suele empezarla
    // (offset 0, comportamiento idéntico al anterior); un volcado markdown de
    // SharePoint trae el documento entero en UNA línea y arrancar desde su
    // inicio se llevaría por delante toda la cabecera de la página.
    const before = l.slice(0, at);
    const cut = Math.max(before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("! "));
    const head = cut < 0 ? l : l.slice(cut + 2);
    const body = captureUntilHeading(
      [head, ...lines.slice(i + 1)],
      0,
      (ll) => isArabicHeading(ll) || ARTICULO_HEADING.test(ll) || ROMAN_HEADING.test(ll),
      (ll) => ll,
      maxChars,
    );
    if (body) return body;
  }
  return null;
}

// Frase que declara el objeto cuando no hay apartado que lo rotule. Los dos
// primeros patrones son los históricos (PI-26 lo dice bajo "2. Objetivos"; el
// Manual PBC/FT bajo "3.1 Ámbito de aplicación objetivo").
const OBJETO_FRASE = /tiene como objeto\b|^El objeto de est[ae]\b/i;
// Apertura normativa estándar, probada en SEGUNDA pasada para no cambiar el
// resumen de ningún documento que ya resolvía con los patrones anteriores.
const OBJETO_FRASE_DEBIL = /El presente documento\b/i;
// Una fuente sin apartados numerados (volcado de SharePoint en una sola línea)
// no tiene "siguiente cabecera" donde parar, así que el único límite posible
// es de longitud, recortado al último final de frase. 900 deja en PPD-CAT su
// declaración de propósito y su párrafo de alcance ("meramente
// ejemplificativo… no es una lista cerrada"), que es justo lo que un abogado
// necesita leer antes del catálogo, y corta antes de que empiece el contenido.
const OBJETO_SIN_ESTRUCTURA_MAX = 900;

function parseObjeto(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim());
  return (
    findArabicObjeto(lines) ??
    findArticuloFinalidad(lines) ??
    findObjetoSentence(lines, OBJETO_FRASE) ??
    findObjetoSentence(lines, OBJETO_FRASE_DEBIL, OBJETO_SIN_ESTRUCTURA_MAX)
  );
}

type Entry = {
  policy_code: string; title: string;
  normative_tier: "POLITICA" | "NORMA" | "PROCEDIMIENTO" | "DOCUMENTO";
  edicion: string | null; effective_date: string | null; current_version: number;
  summary: string | null; content_outline: string[];
  source_file: string | null;
  provenance: "PDF_EXTRAIDO" | "CITADO_NO_INCORPORADO";
};

// PI-22: el nombre del fichero fuente viene truncado con "......pdf" (límite
// de longitud de ruta en el origen OneDrive). El título real, íntegro, se
// lee en la cabecera de la página 1 del propio PDF — no se inventa nada,
// solo se prioriza esa fuente sobre el nombre de fichero para este único
// caso conocido.
const TITLE_OVERRIDES: Record<string, string> = {
  "PI-22": "Política sobre calidad, prevención de riesgos laborales, medio ambiente y Responsabilidad social corporativa",
};

// Núcleo no-PI. `file` null ⇒ citado en fuente, no incorporado.
//
// PPD-01 y PPD-CAT SÍ están en la carpeta, en `.md` (volcado de SharePoint).
// Estuvieron cableados a null y se sembraron como "no incorporados" teniendo
// su texto delante. De los tres documentos citados-no-incorporados solo
// quedan los dos que realmente lo están: PPD-02 (identificado como documento
// independiente en PPD-01 §3) y el Código de Conducta del Socio, que el
// Código Ético cita dos veces —en su art. 1 ("Cuando quien incurra en dicha
// vulneración sea un socio, será aplicable el régimen disciplinario previsto
// en el Código de Conducta del Socio") y en su art. 2— y PI-30 §7 repite.
// Ninguno de los dos está en la carpeta, en ningún formato.
const NUCLEO: Array<{ code: string; title: string; tier: Entry["normative_tier"]; file: string | null }> = [
  { code: "CE-2023",   title: "Código Ético", tier: "POLITICA", file: "Codigo-Etico-2023-ES.pdf" },
  { code: "PPD-01",    title: "Manual del Sistema de Gestión de Riesgos Penales", tier: "NORMA", file: "PPD-01. Manual del Sistema de Gestión de Riesgos Penales.md" },
  { code: "PPD-02",    title: "Modelo Organizativo del Programa de Prevención de Delitos", tier: "NORMA", file: null },
  { code: "PBC-FT-10", title: "Manual de Prevención del Blanqueo de Capitales y de la Financiación del Terrorismo", tier: "NORMA", file: "Manual PBC_FT v.10 noviembre 2025.pdf" },
  { code: "PPD-CAT",   title: "Catálogo ejemplificativo de situaciones susceptibles de generar riesgos penales", tier: "DOCUMENTO", file: "Catálogo ejemplificativo de situaciones susceptibles de generar riesgos penales Dentro de los elementos de ejecución de la prevención del Programa de Prevención de Delitos (en adelante, “PPD”) de Garrigues, los responsables de Depart.md" },
  { code: "CCS",       title: "Código de Conducta del Socio", tier: "POLITICA", file: null },
  { code: "LGTBI-01",  title: "Medidas para la igualdad de las personas LGTBI y protocolo", tier: "PROCEDIMIENTO", file: "Medidas_para_la_igualdad_de_las_personas_LGTBI_y_protocolo.pdf" },
];

/**
 * Erratas DEL DOCUMENTO FUENTE que se reproducen fielmente en el resumen.
 *
 * No se corrigen en silencio: eso falsearía la cita del documento. Se anotan
 * con la convención editorial "[sic]" — el corchete deja claro que la
 * aclaración es de la consola y que el error es del original.
 *
 * PBC-FT-10 §3.1 data la Ley 10/2010 el "18 de abril"; la Ley es de 28 de
 * abril («BOE» núm. 103, de 29/04/2010) y el propio Manual la cita bien en
 * otros dos puntos. La extracción es correcta: el fallo está en el PDF.
 *
 * `find` debe existir; si una reedición del documento lo corrige, el
 * extractor aborta en vez de aplicar la nota a ciegas o dejar de aplicarla
 * sin avisar.
 */
const ERRATAS_FUENTE: Record<string, { find: string; replace: string }> = {
  "PBC-FT-10": {
    find: "Ley 10/2010, de 18 de abril, de prevención",
    replace:
      "Ley 10/2010, de 18 [sic en el documento fuente: la Ley 10/2010 es de 28 de abril] de abril, de prevención",
  },
};

function applyErrata(code: string, summary: string | null): string | null {
  const errata = ERRATAS_FUENTE[code];
  if (!errata || !summary) return summary;
  if (!summary.includes(errata.find)) {
    console.error(`✗ ${code}: la errata registrada ("${errata.find}") ya no aparece en el resumen extraído. Revisa ERRATAS_FUENTE contra el documento.`);
    process.exit(1);
  }
  return summary.replace(errata.find, errata.replace);
}

function main() {
  if (!existsSync(ZIP)) {
    console.error(`✗ No encuentro ${ZIP}. Este script necesita el material fuente.`);
    process.exit(1);
  }
  const dir = mkdtempSync(join(tmpdir(), "garr-pi-"));
  // `tar` (bsdtar/libarchive) decodifica bien los nombres UTF-8/NFD del zip;
  // `unzip` de macOS los mangla en mojibake ("Pol+?tica"). El zip es plano
  // (sin subcarpetas), así que no hace falta "junk paths".
  run(["tar", "-xf", join(process.cwd(), ZIP), "-C", dir]);

  const entries: Entry[] = [];

  for (const raw of readdirSync(dir).sort()) {
    const f = raw.normalize("NFC");
    const m = f.match(/^PI-(\d{2})[.\s]\s*(.+?)\.pdf$/i);
    if (!m) continue;
    const text = readSourceText(join(dir, raw));
    const { edicion, version, date } = parseEdicion(text);
    const code = `PI-${m[1]}`;
    const filenameTitle = m[2].replace(/\s*\.{3,}\s*$/, "").trim();
    entries.push({
      policy_code: code,
      title: TITLE_OVERRIDES[code] ?? filenameTitle,
      normative_tier: "POLITICA",
      edicion, effective_date: date, current_version: version,
      summary: parseObjeto(text),
      content_outline: parseOutline(text),
      source_file: f,
      provenance: "PDF_EXTRAIDO",
    });
  }

  for (const n of NUCLEO) {
    const path = n.file ? join(ROOT, n.file) : null;
    // Un fichero declarado que no existe NO puede degradar en silencio a
    // "citado, no incorporado": esa etiqueta afirma en pantalla que el
    // despacho no aportó el documento. Si falta, es un error de ruta.
    if (path && !existsSync(path)) {
      console.error(`✗ ${n.code}: declara la fuente "${n.file}" y no existe en ${ROOT}.`);
      process.exit(1);
    }
    if (path) {
      const text = readSourceText(path);
      const { edicion, version, date } = parseEdicion(text);
      entries.push({
        policy_code: n.code, title: n.title, normative_tier: n.tier,
        edicion, effective_date: date, current_version: version,
        summary: applyErrata(n.code, parseObjeto(text)), content_outline: parseOutline(text),
        source_file: n.file, provenance: "PDF_EXTRAIDO",
      });
    } else {
      entries.push({
        policy_code: n.code, title: n.title, normative_tier: n.tier,
        edicion: null, effective_date: null, current_version: 1,
        summary: null, content_outline: [], source_file: null,
        provenance: "CITADO_NO_INCORPORADO",
      });
    }
  }

  const sinObjeto = entries.filter((e) => e.provenance === "PDF_EXTRAIDO" && !e.summary);
  const sinIndice = entries.filter((e) => e.provenance === "PDF_EXTRAIDO" && e.content_outline.length === 0);
  console.log(`${entries.length} documentos · ${sinObjeto.length} sin objeto · ${sinIndice.length} sin índice`);
  for (const e of [...sinObjeto, ...sinIndice]) console.log(`  ⚠ ${e.policy_code} (${e.source_file})`);

  if (WRITE) {
    // Se emite un módulo TS (no JSON) para seguir el patrón de
    // entities-catalog.ts y que el consumidor tenga tipos sin depender de
    // la resolución de módulos JSON.
    const header = `// GENERADO por scripts/garrigues/normativo/extract-catalogo.ts — NO EDITAR A MANO.
// Fuente: PDF del sistema normativo interno de Garrigues (material no versionado).
// Regenerar: bun run scripts/garrigues/normativo/extract-catalogo.ts --write

export type NormativoEntry = {
  policy_code: string;
  title: string;
  normative_tier: "POLITICA" | "NORMA" | "PROCEDIMIENTO" | "DOCUMENTO";
  edicion: string | null;
  effective_date: string | null;
  current_version: number;
  summary: string | null;
  content_outline: string[];
  source_file: string | null;
  provenance: "PDF_EXTRAIDO" | "CITADO_NO_INCORPORADO";
};

export const NORMATIVO_CATALOG: NormativoEntry[] = `;
    writeFileSync(OUT, header + JSON.stringify(entries, null, 2) + ";\n");
    console.log(`✓ escrito ${OUT}`);
  } else {
    console.log("(dry-run — usa --write para escribir el catálogo)");
  }
}

main();
