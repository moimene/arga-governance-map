import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  generatePdf,
  parseBlocks,
  sanitizeForWinAnsi,
  wrapText,
} from "../pdf-generator";
import { StandardFonts } from "pdf-lib";

/**
 * El PDF se genera ANTES de firmar para que lo hasheado, lo archivado y lo
 * firmado sean el mismo artefacto. Antes se hasheaba el DOCX y EAD firmaba un
 * PDF convertido con otros bytes: el hash registrado como evidencia era el de
 * un documento que nunca se firmó.
 */

const ACTA = `ACTA DE LA JUNTA GENERAL ORDINARIA

En Madrid, a 19 de julio de 2026, se reúne la Junta General Ordinaria.

PRIMERO.- Aprobar las cuentas anuales del ejercicio.

SEGUNDO.- Aplicar el resultado conforme a la propuesta del órgano de administración.`;

describe("parseBlocks — misma estructura que el generador DOCX", () => {
  it("detecta encabezados por mayúsculas y por dos puntos", () => {
    const blocks = parseBlocks(ACTA);
    const headings = blocks.filter((b) => b.kind === "heading").map((b) => b.text);
    expect(headings).toContain("ACTA DE LA JUNTA GENERAL ORDINARIA");
    // "PRIMERO.- Aprobar las cuentas..." NO es encabezado: no va en mayúsculas
    // ni termina en dos puntos. Es exactamente el criterio del generador DOCX,
    // y los dos renderizadores deben estructurar igual el mismo texto.
    expect(headings.some((h) => h.startsWith("PRIMERO"))).toBe(false);
    expect(parseBlocks("ORDEN DEL DIA:").filter((b) => b.kind === "heading")).toHaveLength(1);
  });

  it("el cuerpo corriente no se toma por encabezado", () => {
    const blocks = parseBlocks(ACTA);
    const parrafo = blocks.find((b) => b.text.startsWith("En Madrid"));
    expect(parrafo?.kind).toBe("paragraph");
  });

  it("colapsa líneas en blanco consecutivas en una sola separación", () => {
    const blocks = parseBlocks("Uno\n\n\n\nDos");
    expect(blocks.filter((b) => b.kind === "blank")).toHaveLength(1);
  });
});

describe("sanitizeForWinAnsi — el castellano se conserva, nada revienta", () => {
  it("conserva tildes, eñes y signos de apertura", () => {
    const t = "Año, ¿resolución? ¡Sí! — 100 €";
    expect(sanitizeForWinAnsi(t)).toContain("Año");
    expect(sanitizeForWinAnsi(t)).toContain("¿resolución?");
    expect(sanitizeForWinAnsi(t)).toContain("€");
  });

  it("PRESERVA comillas tipográficas y raya: WinAnsi las admite", () => {
    // En un documento jurídico no se altera un carácter que el formato admite.
    const t = "\u201Ccita\u201D y \u2018otra\u2019 \u2014 fin\u2026";
    expect(sanitizeForWinAnsi(t)).toBe(t);
  });

  it("solo sustituye lo que de verdad no es representable", () => {
    expect(sanitizeForWinAnsi("a \u2192 b")).toBe("a -> b");
    expect(sanitizeForWinAnsi("x\u00A0y")).toBe("x y");
  });

  it("un carácter fuera del juego no aborta el documento", () => {
    // Sin esto, pdf-lib lanza y se pierde el acta entera por un emoji.
    expect(sanitizeForWinAnsi("acuerdo 🚀 firmado")).toBe("acuerdo ? firmado");
  });
});

describe("wrapText — nada desborda el margen", () => {
  it("parte por palabras sin cortarlas", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("palabra ".repeat(40).trim(), font, 10, 200);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(200);
  });

  it("trocea una palabra sola más ancha que la caja (un hash, una URL)", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("a".repeat(400), font, 10, 120);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(120);
  });
});

describe("generatePdf — produce un PDF real y firmable", () => {
  it("genera un PDF válido y releíble", async () => {
    const { bytes, pageCount } = await generatePdf({
      renderedText: ACTA,
      title: "ACTA DE LA JUNTA GENERAL ORDINARIA",
      subtitle: "Grupo ARGA Seguros",
      templateTipo: "ACTA_JUNTA",
      templateVersion: "1.1.0",
      contentHash: "a".repeat(64),
      generatedAt: "2026-07-19",
    });
    expect(bytes.length).toBeGreaterThan(500);
    // Cabecera PDF: el artefacto es un PDF de verdad, no un buffer cualquiera.
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const releido = await PDFDocument.load(bytes);
    expect(releido.getPageCount()).toBe(pageCount);
    expect(releido.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("el ancla de firma cae dentro de la última página y sobre el pie", async () => {
    // Las coordenadas de EAD son espacio PDF con origen inferior izquierdo.
    const { pageCount, signatureAnchor } = await generatePdf({
      renderedText: ACTA,
      title: "ACTA",
    });
    expect(signatureAnchor.page).toBe(pageCount);
    expect(signatureAnchor.x).toBeGreaterThan(0);
    expect(signatureAnchor.y).toBeGreaterThan(38); // por encima del pie
    expect(signatureAnchor.y).toBeLessThan(841.89);
  });

  it("pagina cuando el contenido no cabe", async () => {
    const largo = Array.from({ length: 300 }, (_, i) => `Párrafo ${i} del acuerdo social.`).join("\n\n");
    const { pageCount } = await generatePdf({ renderedText: largo, title: "ACTA LARGA" });
    expect(pageCount).toBeGreaterThan(1);
  });

  it("un texto con caracteres exóticos no rompe la generación", async () => {
    const { bytes } = await generatePdf({
      renderedText: "PRIMERO.- Acuerdo 🚀 con “comillas” y —raya—.",
      title: "ACTA",
    });
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("dos generaciones del mismo texto producen el mismo contenido visible", async () => {
    // No se compara byte a byte: el PDF lleva metadatos propios. Lo que importa
    // es que el renderizado sea determinista en estructura.
    const input = { renderedText: ACTA, title: "ACTA", generatedAt: "2026-07-19" };
    const a = await generatePdf(input);
    const b = await generatePdf(input);
    expect(a.pageCount).toBe(b.pageCount);
    expect(a.signatureAnchor).toEqual(b.signatureAnchor);
  });
});

describe("bordes del renderizado", () => {
  it("un texto vacío no rompe: produce un PDF con la cabecera", async () => {
    // El acuerdo puede llegar sin cuerpo si la composición falla aguas arriba.
    // Debe salir un PDF válido, no una excepción a mitad del flujo de firma.
    const { bytes, pageCount } = await generatePdf({ renderedText: "", title: "ACTA" });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(pageCount).toBe(1);
  });

  it("solo espacios en blanco tampoco rompe", async () => {
    const { pageCount } = await generatePdf({ renderedText: "\n\n   \n\t\n", title: "ACTA" });
    expect(pageCount).toBe(1);
  });

  it("una línea larguísima sin espacios se trocea y no desborda", async () => {
    const { bytes } = await generatePdf({ renderedText: "x".repeat(5000), title: "ACTA" });
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("el ancla de firma sigue siendo válida en un documento de una sola página", async () => {
    const { pageCount, signatureAnchor } = await generatePdf({ renderedText: "Breve.", title: "A" });
    expect(pageCount).toBe(1);
    expect(signatureAnchor.page).toBe(1);
  });

  it("sin título no se cae", async () => {
    const { bytes } = await generatePdf({ renderedText: "Cuerpo.", title: "" });
    expect(bytes.length).toBeGreaterThan(500);
  });
});
