/**
 * DOCX Generator — Produces professional Word documents from rendered templates
 *
 * Takes rendered template text and generates a branded DOCX with:
 * - Garrigues branding (Montserrat font, green headers)
 * - Proper document structure (header, body, signature, footer)
 * - Page numbers
 * - Hash reference in footer for traceability
 *
 * Uses the `docx` npm package (pure JS, browser-compatible).
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  AlignmentType,
  PageNumber,
  PageBreak,
  BorderStyle,
  TabStopType,
  ShadingType,
} from "docx";

// ── Constants ────────────────────────────────────────────────────────────────

const BRAND_GREEN = "004438";
const BRAND_BRIGHT = "009A77";
const TEXT_PRIMARY = "4A4A49";
const TEXT_SECONDARY = "50564F";
const FONT = "Montserrat";
const FONT_FALLBACK = "Arial";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EditableField {
  /** Machine key used for traceability in the generation context. */
  key: string;
  /** Human label shown above the field */
  label: string;
  /** Placeholder text inside the field */
  placeholder?: string;
  /** Pre-filled value (if already resolved from capa2) */
  value?: string;
}

export interface DocxGeneratorInput {
  /** Rendered plain text from template-renderer */
  renderedText: string;
  /** Document title (e.g., "ACTA DE LA JUNTA GENERAL ORDINARIA") */
  title: string;
  /** Document subtitle (e.g., entity name) */
  subtitle?: string;
  /** Template tipo for metadata */
  templateTipo: string;
  /** Template version */
  templateVersion: string;
  /** SHA-256 hash for traceability */
  contentHash?: string;
  /** Entity name for header */
  entityName?: string;
  /** Generation date */
  generatedAt?: string;
  /** capa3_editables fields rendered as bookmarked content controls */
  editableFields?: EditableField[];
}

// ── Text parsing ─────────────────────────────────────────────────────────────

interface ParsedSection {
  heading?: string;
  paragraphs: string[];
}

/**
 * Parse rendered text into structured sections.
 * Detects headings by ALL-CAPS lines or lines ending with ":"
 */
function parseRenderedText(text: string): ParsedSection[] {
  const lines = text.split("\n");
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection = { paragraphs: [] };

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      if (currentSection.paragraphs.length > 0) {
        // Preserve paragraph breaks
        currentSection.paragraphs.push("");
      }
      continue;
    }

    // Detect headings: ALL-CAPS lines (at least 3 chars), or known headers
    const isHeading =
      (trimmed.length >= 3 && trimmed === trimmed.toUpperCase() && /^[A-ZÁÉÍÓÚÑÜ\s()—–\-.]+$/.test(trimmed)) ||
      /^(CONSTITUCIÓN|ORDEN DEL DÍA|DELIBERACIONES|TRAZABILIDAD|DATOS DE LA REUNIÓN|DERECHO DE INFORMACIÓN|DERECHO DE REPRESENTACIÓN|COMPLEMENTO DE CONVOCATORIA|CANAL DE NOTIFICACIÓN|INFORMACIÓN AL CONSEJO|ÁMBITO DE DELEGACIÓN)/.test(trimmed);

    if (isHeading) {
      // Save current section if it has content
      if (currentSection.heading || currentSection.paragraphs.some(p => p.trim())) {
        sections.push(currentSection);
      }
      currentSection = { heading: trimmed, paragraphs: [] };
    } else {
      currentSection.paragraphs.push(trimmed);
    }
  }

  // Don't forget the last section
  if (currentSection.heading || currentSection.paragraphs.some(p => p.trim())) {
    sections.push(currentSection);
  }

  return sections;
}

// ── DOCX construction ────────────────────────────────────────────────────────

function buildParagraphs(sections: ParsedSection[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const section of sections) {
    // Heading
    if (section.heading) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 360, after: 120 },
          children: [
            new TextRun({
              text: section.heading,
              bold: true,
              size: 22, // 11pt
              font: FONT,
              color: BRAND_GREEN,
            }),
          ],
        })
      );
    }

    // Paragraphs
    for (const text of section.paragraphs) {
      if (!text.trim()) {
        // Empty line → small spacer
        paragraphs.push(new Paragraph({ spacing: { after: 60 } }));
        continue;
      }

      // Detect list items (lines starting with - or number.)
      const isListItem = /^[-•]\s/.test(text) || /^\d+\.\s/.test(text);

      // Detect signature lines (Fdo.:, Firma electrónica, Validación OCSP, El Secretario)
      const isSignature = /^(Fdo\.|Firma electrónica|Validación OCSP|El Secretario|Le saluda)/.test(text);

      paragraphs.push(
        new Paragraph({
          spacing: { after: isListItem ? 40 : 120 },
          indent: isListItem ? { left: 720 } : undefined,
          alignment: isSignature ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
          children: [
            new TextRun({
              text: text,
              size: 20, // 10pt
              font: FONT,
              color: isSignature ? TEXT_SECONDARY : TEXT_PRIMARY,
              italics: isSignature,
            }),
          ],
        })
      );
    }
  }

  return paragraphs;
}

// ── Editable fields (capa3) ──────────────────────────────────────────────────

function buildEditableFieldParagraphs(fields: EditableField[]): Paragraph[] {
  if (!fields || fields.length === 0) return [];

  const result: Paragraph[] = [];

  result.push(new Paragraph({ children: [new PageBreak()] }));

  result.push(
    new Paragraph({
      spacing: { before: 360, after: 240 },
      children: [
        new TextRun({
          text: "CAMPOS EDITABLES",
          bold: true,
          size: 22,
          font: FONT,
          color: BRAND_GREEN,
        }),
      ],
    })
  );

  result.push(
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: "Los siguientes campos pueden ser completados o modificados por el destinatario del documento sin alterar el texto jurídico inmutable.",
          size: 18,
          font: FONT,
          color: TEXT_SECONDARY,
          italics: true,
        }),
      ],
    })
  );

  for (const field of fields) {
    const displayValue = field.value || field.placeholder || `[${field.label.toUpperCase()}]`;

    result.push(
      new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [
          new TextRun({
            text: field.label,
            bold: true,
            size: 18,
            font: FONT,
            color: TEXT_PRIMARY,
          }),
        ],
      })
    );

    result.push(
      new Paragraph({
        spacing: { after: 160 },
        shading: {
          type: ShadingType.CLEAR,
          fill: "D8ECE7",
        },
        border: {
          left: { style: BorderStyle.SINGLE, size: 8, color: BRAND_GREEN },
        },
        children: [
          new TextRun({
            text: ` ${displayValue} `,
            size: 20,
            font: FONT,
            color: field.value ? TEXT_PRIMARY : "666666",
            italics: !field.value,
          }),
        ],
        indent: { left: 360 },
      })
    );
  }

  return result;
}

function stableDateFromGeneratedAt(generatedAt: string): Date {
  const normalized = generatedAt.includes("T")
    ? generatedAt
    : `${generatedAt}T00:00:00.000Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return new Date("2000-01-01T00:00:00.000Z");
  return parsed;
}

async function stabilizeDocxPackage(buffer: ArrayBuffer, generatedAt: string): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const fixedDate = stableDateFromGeneratedAt(generatedAt);
  const fixedIso = fixedDate.toISOString();

  const core = zip.file("docProps/core.xml");
  if (core) {
    const xml = await core.async("string");
    const stableXml = xml
      .replace(
        /<dcterms:created xsi:type="dcterms:W3CDTF">[^<]*<\/dcterms:created>/,
        `<dcterms:created xsi:type="dcterms:W3CDTF">${fixedIso}</dcterms:created>`,
      )
      .replace(
        /<dcterms:modified xsi:type="dcterms:W3CDTF">[^<]*<\/dcterms:modified>/,
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${fixedIso}</dcterms:modified>`,
      );
    zip.file("docProps/core.xml", stableXml, { date: fixedDate });
  }

  for (const file of Object.values(zip.files)) {
    file.date = fixedDate;
  }

  const stableBuffer = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
  });
  return new Uint8Array(stableBuffer);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a DOCX document from rendered template text.
 *
 * @returns Uint8Array buffer of the DOCX file
 */
export async function generateDocx(input: DocxGeneratorInput): Promise<Uint8Array> {
  const sections = parseRenderedText(input.renderedText);
  const bodyParagraphs = buildParagraphs(sections);

  const generatedAt = input.generatedAt || new Date().toISOString().split("T")[0];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: 20, // 10pt default
            color: TEXT_PRIMARY,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,  // A4
              height: 16838,
            },
            margin: {
              top: 1800,    // ~1.25 inch
              right: 1440,  // 1 inch
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: BRAND_GREEN,
                    space: 4,
                  },
                },
                spacing: { after: 200 },
                children: [
                  new TextRun({
                    text: input.entityName || "TGMS — Secretaría Societaria",
                    size: 16, // 8pt
                    font: FONT,
                    color: BRAND_GREEN,
                    bold: true,
                  }),
                  new TextRun({
                    text: `\t${generatedAt}`,
                    size: 16,
                    font: FONT,
                    color: TEXT_SECONDARY,
                  }),
                ],
                tabStops: [
                  { type: TabStopType.RIGHT, position: 9026 },
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: BRAND_BRIGHT,
                    space: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: `${input.templateTipo} v${input.templateVersion}`,
                    size: 14, // 7pt
                    font: FONT,
                    color: TEXT_SECONDARY,
                  }),
                  new TextRun({
                    text: input.contentHash ? `  |  Hash: ${input.contentHash.substring(0, 16)}…` : "",
                    size: 14,
                    font: FONT,
                    color: TEXT_SECONDARY,
                  }),
                  new TextRun({
                    text: "\tPágina ",
                    size: 14,
                    font: FONT,
                    color: TEXT_SECONDARY,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                    font: FONT,
                    color: TEXT_SECONDARY,
                  }),
                ],
                tabStops: [
                  { type: TabStopType.RIGHT, position: 9026 },
                ],
              }),
            ],
          }),
        },
        children: [
          // Title
          new Paragraph({
            spacing: { after: 200 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: input.title,
                bold: true,
                size: 28, // 14pt
                font: FONT,
                color: BRAND_GREEN,
              }),
            ],
          }),
          // Subtitle
          ...(input.subtitle
            ? [
                new Paragraph({
                  spacing: { after: 400 },
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: input.subtitle,
                      size: 22, // 11pt
                      font: FONT,
                      color: TEXT_SECONDARY,
                    }),
                  ],
                }),
              ]
            : []),
          // Body
          ...bodyParagraphs,
          // Editable fields (capa3_editables) rendered with bookmarks
          ...buildEditableFieldParagraphs(input.editableFields ?? []),
        ],
      },
    ],
  });

  const blobCapable = typeof window !== "undefined" && typeof Blob !== "undefined";
  const packed = blobCapable ? await Packer.toBlob(doc) : null;
  const buffer =
    packed && typeof packed.arrayBuffer === "function"
      ? await packed.arrayBuffer()
      : await Packer.toArrayBuffer(doc);
  return stabilizeDocxPackage(buffer, generatedAt);
}

/**
 * Compute a simple SHA-256-like hash of the rendered text for traceability.
 * Uses the SubtleCrypto API (browser-native).
 */
export async function computeContentHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Trigger a browser download of the DOCX buffer.
 */
export function downloadDocx(buffer: Uint8Array, filename: string): void {
  const blob = new Blob([buffer.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  window.dispatchEvent(new CustomEvent("tgms:docx-download", { detail: { filename } }));
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
