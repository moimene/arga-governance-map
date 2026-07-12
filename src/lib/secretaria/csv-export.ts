export type CsvValue = string | number | boolean | Date | null | undefined;

const UTF8_BOM = "\uFEFF";
const DELIMITER = ";";
const LINE_ENDING = "\r\n";
const DANGEROUS_FORMULA_PREFIXES = new Set(["=", "+", "-", "@"]);

function stringValue(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  return String(value);
}

function protectFormula(text: string): string {
  if (!text) return text;

  const leadingWhitespace = text.match(/^[\s\uFEFF]*/u)?.[0] ?? "";
  const firstEffectiveCharacter = text.slice(leadingWhitespace.length, leadingWhitespace.length + 1);
  const startsWithControlPrefix = leadingWhitespace.includes("\t") || leadingWhitespace.includes("\r");

  return startsWithControlPrefix || DANGEROUS_FORMULA_PREFIXES.has(firstEffectiveCharacter)
    ? `'${text}`
    : text;
}

function escapeCell(value: CsvValue): string {
  const protectedValue = protectFormula(stringValue(value));
  return /[;"\r\n]/u.test(protectedValue)
    ? `"${protectedValue.replace(/"/gu, '""')}"`
    : protectedValue;
}

/**
 * Serializa una matriz rectangular como CSV para Excel en configuración española.
 * Las filas cortas se completan con celdas vacías y los valores que excedan las
 * columnas declaradas se ignoran.
 */
export function serializeCsv(
  columns: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  if (columns.length === 0) return UTF8_BOM;

  const lines = [
    columns.map(escapeCell).join(DELIMITER),
    ...rows.map((row) => columns.map((_, index) => escapeCell(row[index])).join(DELIMITER)),
  ];

  return `${UTF8_BOM}${lines.join(LINE_ENDING)}`;
}

function safeSlug(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

/** Fecha civil local estable para contenido y nombres de exportación. */
export function formatCsvDate(date: Date | string = new Date()): string {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) throw new RangeError("La fecha del CSV no es válida.");
    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const candidate = date.trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/u)?.[1];
  const parsed = candidate ? new Date(`${candidate}T00:00:00.000Z`) : null;
  if (!candidate || !parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) {
    throw new RangeError("La fecha del CSV debe usar el formato YYYY-MM-DD.");
  }
  return candidate;
}

/** Construye un nombre ASCII, sin rutas, con fecha estable y extensión `.csv`. */
export function buildCsvFilename(
  parts: readonly unknown[],
  date: Date | string = new Date(),
): string {
  const prefix = parts
    .map(safeSlug)
    .filter(Boolean)
    .join("-")
    .slice(0, 180)
    .replace(/-+$/u, "");

  return `${prefix || "exportacion"}-${formatCsvDate(date)}.csv`;
}

function safeDownloadFilename(filename: string): string {
  const withoutExtension = filename.trim().replace(/\.csv$/iu, "");
  const safeBase = safeSlug(withoutExtension).slice(0, 200).replace(/-+$/u, "");
  return `${safeBase || "exportacion"}.csv`;
}

/** Dispara la descarga local sin realizar ninguna petición de red. */
export function downloadCsv(content: string, filename: string): void {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("La descarga CSV solo está disponible en un navegador.");
  }

  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = safeDownloadFilename(filename);
  anchor.rel = "noopener";
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
