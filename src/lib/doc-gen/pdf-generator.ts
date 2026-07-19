/**
 * Renderizado a PDF del documento societario, para el camino de FIRMA.
 *
 * Por qué existe, y por qué no basta con que EAD convierta:
 *
 * El proxy hasheaba el DOCX y enviaba `convertToPdf: true`. EAD convertía y
 * firmaba un PDF cuyos bytes son OTROS, de modo que el hash que quedaba
 * registrado como evidencia era el de un documento que nunca se firmó, y el
 * artefacto realmente firmado era un PDF del que no teníamos ni copia ni hash.
 * Para un acta o una certificación eso rompe la cadena: lo citado y lo firmado
 * dejan de ser lo mismo.
 *
 * Con este renderizador, el PDF se produce ANTES de firmar, a partir del MISMO
 * `renderedText` que alimenta `generateDocx`. Así lo que se hashea, lo que se
 * archiva y lo que se firma son el mismo artefacto, y las coordenadas de firma
 * —que son un concepto del espacio PDF— se calculan sobre el documento real.
 *
 * Deliberadamente sobrio: sin logotipos ni marcas propias. La marca probatoria
 * la pone el QTSP (hoja de firmas y banda de contenido certificado); estampar
 * una marca propia de "formalizado" sería falso antes de firmar y alteraría un
 * artefacto sellado después.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface PdfGeneratorInput {
  /** Mismo texto renderizado que recibe `generateDocx`. */
  renderedText: string;
  title: string;
  subtitle?: string;
  templateTipo?: string;
  templateVersion?: string;
  /** Hash del CONTENIDO (texto). El hash del PDF se calcula sobre los bytes. */
  contentHash?: string;
  entityName?: string;
  generatedAt?: string;
}

// A4 en puntos PDF. El origen de coordenadas es la esquina INFERIOR izquierda,
// que es también el sistema que espera EAD para situar la firma.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 56.7; // 2 cm
const MARGIN_TOP = 56.7;
const MARGIN_BOTTOM = 85; // deja aire para el pie y para el sello de firma

const SIZE_TITLE = 13;
const SIZE_SUBTITLE = 10.5;
const SIZE_HEADING = 10.5;
const SIZE_BODY = 10;
const SIZE_FOOTER = 7.5;
const LINE_GAP = 1.45;

const INK = rgb(0.29, 0.29, 0.286); // --g-text-primary
const INK_SOFT = rgb(0.44, 0.44, 0.44);

/**
 * Caracteres de WinAnsi (CP1252) fuera de Latin-1. Incluyen el euro, las
 * comillas tipograficas, la raya y los puntos suspensivos: todos representables,
 * de modo que se conservan TAL CUAL. En un documento juridico no se altera un
 * caracter que el formato admite.
 */
const WINANSI_EXTRA = new Set(
  "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178".split(""),
);

/** Solo para lo que de verdad no se puede representar. */
const CHAR_FALLBACK: Readonly<Record<string, string>> = {
  "\u2192": "->",
  "\u21D2": "=>",
  "\u2265": ">=",
  "\u2264": "<=",
  "\u00A0": " ",
};

/**
 * Un caracter no representable hace que `pdf-lib` lance, y eso perderia el acta
 * entera por un emoji pegado en un campo libre. Se sustituye lo minimo y se
 * conserva todo lo demas.
 */
export function sanitizeForWinAnsi(text: string): string {
  let out = "";
  for (const ch of String(text ?? "")) {
    if (WINANSI_EXTRA.has(ch)) {
      out += ch;
      continue;
    }
    const mapped = CHAR_FALLBACK[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    // Tabulador, salto de linea, ASCII imprimible y Latin-1 (el castellano).
    out += code === 10 || code === 9 || (code >= 32 && code <= 255) ? ch : "?";
  }
  return out;
}

interface ParsedBlock {
  kind: "heading" | "paragraph" | "blank";
  text: string;
}

/**
 * Mismo criterio de estructura que el generador DOCX: encabezado si la línea va
 * en mayúsculas o termina en dos puntos. Si los dos renderizadores divergieran,
 * el PDF firmado y el DOCX de trabajo dejarían de ser el mismo documento.
 */
export function parseBlocks(renderedText: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  for (const rawLine of String(renderedText ?? "").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (blocks.length > 0 && blocks[blocks.length - 1].kind !== "blank") {
        blocks.push({ kind: "blank", text: "" });
      }
      continue;
    }
    const letters = line.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
    const isUpper = letters.length >= 3 && letters === letters.toUpperCase();
    const endsWithColon = line.endsWith(":") && line.length < 120;
    blocks.push({ kind: isUpper || endsWithColon ? "heading" : "paragraph", text: line });
  }
  return blocks;
}

/** Parte el texto en líneas que caben en `maxWidth`, sin cortar palabras. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    // Una palabra sola más ancha que la caja (una URL, un hash) se trocea por
    // caracteres: preferible a desbordar el margen.
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      current = chunk;
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface GeneratedPdf {
  bytes: Uint8Array;
  pageCount: number;
  /** Página y punto sugeridos para el sello de firma (origen inferior izquierdo). */
  signatureAnchor: { page: number; x: number; y: number };
}

export async function generatePdf(input: PdfGeneratorInput): Promise<GeneratedPdf> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  pdf.setTitle(sanitizeForWinAnsi(input.title || "Documento societario"));
  pdf.setProducer("TGMS Secretaria Societaria");
  pdf.setCreator("TGMS Secretaria Societaria");

  const contentWidth = PAGE_WIDTH - MARGIN_X * 2;
  const pages: PDFPage[] = [];
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    cursorY = PAGE_HEIGHT - MARGIN_TOP;
  };

  const draw = (text: string, font: PDFFont, size: number, color = INK, indent = 0) => {
    for (const line of wrapText(sanitizeForWinAnsi(text), font, size, contentWidth - indent)) {
      if (cursorY - size * LINE_GAP < MARGIN_BOTTOM) newPage();
      page.drawText(line, { x: MARGIN_X + indent, y: cursorY - size, size, font, color });
      cursorY -= size * LINE_GAP;
    }
  };

  // Cabecera
  draw(input.title || "Documento societario", bold, SIZE_TITLE);
  cursorY -= 4;
  if (input.subtitle) draw(input.subtitle, regular, SIZE_SUBTITLE, INK_SOFT);
  if (input.entityName && input.entityName !== input.subtitle) {
    draw(input.entityName, regular, SIZE_SUBTITLE, INK_SOFT);
  }
  cursorY -= 6;
  if (cursorY > MARGIN_BOTTOM) {
    page.drawLine({
      start: { x: MARGIN_X, y: cursorY },
      end: { x: PAGE_WIDTH - MARGIN_X, y: cursorY },
      thickness: 0.5,
      color: INK_SOFT,
    });
    cursorY -= 14;
  }

  // Cuerpo
  for (const block of parseBlocks(input.renderedText)) {
    if (block.kind === "blank") {
      cursorY -= SIZE_BODY * 0.6;
      continue;
    }
    if (block.kind === "heading") {
      cursorY -= 4;
      draw(block.text, bold, SIZE_HEADING);
      cursorY -= 2;
      continue;
    }
    draw(block.text, regular, SIZE_BODY);
  }

  // Pie con trazabilidad, en TODAS las páginas.
  const generatedAt = input.generatedAt || new Date().toISOString().slice(0, 10);
  const meta = [
    input.templateTipo && input.templateVersion
      ? `${input.templateTipo} v${input.templateVersion}`
      : input.templateTipo,
    `Generado ${generatedAt}`,
    input.contentHash ? `Contenido SHA-256 ${input.contentHash.slice(0, 16)}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  pages.forEach((p, index) => {
    p.drawText(sanitizeForWinAnsi(meta), {
      x: MARGIN_X,
      y: 38,
      size: SIZE_FOOTER,
      font: regular,
      color: INK_SOFT,
    });
    const pageLabel = `${index + 1} / ${pages.length}`;
    p.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN_X - regular.widthOfTextAtSize(pageLabel, SIZE_FOOTER),
      y: 38,
      size: SIZE_FOOTER,
      font: regular,
      color: INK_SOFT,
    });
  });

  const bytes = await pdf.save();
  return {
    bytes,
    pageCount: pages.length,
    // Última página, zona inferior izquierda libre sobre el pie: es donde el
    // firmante espera encontrar el sello y donde no pisa contenido.
    signatureAnchor: { page: pages.length, x: 70, y: 110 },
  };
}
