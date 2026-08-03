import type { SecretariaDocumentType } from "@/lib/secretaria/document-generation-boundary";

export const DOCUMENT_OUTPUT_VERSION = "1.1.0";
export const DOCUMENT_DEMO_NOTICE = "DEMO / NO OFICIAL · No constituye evidencia final productiva";

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const ENUM_LABELS: Record<string, string> = {
  NO_UNIVERSAL: "No universal",
  UNIVERSAL: "Universal",
  MEETING: "Sesión formal",
  NO_SESSION: "Acuerdo sin sesión",
  CONSEJO_POR_ESCRITO: "Consejo por escrito y sin sesión",
  CIRCULACION_CONSEJO: "circulación escrita del Consejo",
  UNANIMIDAD_CAPITAL_SL: "acuerdo unánime escrito de los socios",
  SOCIOS_UNANIMIDAD_ESCRITA: "Acuerdo unánime escrito de los socios",
  CONSEJERO_DELEGADO: "consejero delegado",
  COMISION_EJECUTIVA: "comisión ejecutiva",
  NOMBRAMIENTO_CONSEJERO: "nombramiento de consejero",
  APROBACION_CUENTAS: "aprobación de cuentas anuales",
  FORMULACION_CUENTAS: "formulación de cuentas",
  OTROS_LIBRE: "acuerdo de gestión societaria",
  PODER_REPRESENTACION: "otorgamiento o modificación de poderes de representación",
  NOMBRAMIENTO_REPRESENTANTE_FILIAL: "designación de representante de la sociedad en filial o participada",
  DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL: "designación de representante de la socia única en la filial",
  REGISTRO_MERCANTIL: "Registro Mercantil",
  ESCRITURA_PUBLICA: "escritura pública",
  DEMO_OPERATIVA: "demo/operativa",
  ADOPTED: "adoptado",
  REJECTED: "rechazado",
  PRESIDENTE: "Presidente",
  QUIEN_HAGA_SUS_VECES: "quien haga sus veces",
  CONSEJEROS_ART_246_2: "consejeros habilitados conforme al artículo 246.2 LSC",
  SECRETARIO: "Secretario",
  PRESENCIAL: "Presencial",
  TELEMATICA: "Telemática",
  MIXTA: "Mixta",
};

const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;
const ENUM_RE = /\b[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ0-9]*_[A-ZÁÉÍÓÚÑÜ0-9_]+\b/g;
const SNAKE_CASE_RE = /\b[a-záéíóúñü][a-záéíóúñü0-9]*_[a-záéíóúñü0-9_]+\b/g;
const ISO_DATE_TEST_RE = /\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/;
const ENUM_TEST_RE = /\b[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ0-9]*_[A-ZÁÉÍÓÚÑÜ0-9_]+\b/;
const SNAKE_CASE_TEST_RE = /\b[a-záéíóúñü][a-záéíóúñü0-9]*_[a-záéíóúñü0-9_]+\b/;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const UUID_GLOBAL_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export interface DocumentOutputIssue {
  code: string;
  message: string;
}

export function formatSpanishLegalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return value;
  }
  return `${day} de ${MONTHS_ES[month - 1]} de ${year}`;
}

/**
 * Último límite antes de validar/renderizar un documento externo. No elimina
 * contenido jurídico: solo normaliza representaciones inequívocamente técnicas.
 */
export function normalizeVisibleDocumentText(value: string) {
  let normalized = value;
  for (const [machineValue, label] of Object.entries(ENUM_LABELS)) {
    normalized = normalized.replace(new RegExp(`\\b${machineValue}\\b`, "g"), label);
  }
  return normalized
    .replace(
      /Convocatoria documentada en el expediente\s+[0-9a-f-]{36}\.?/gi,
      "La convocatoria se encuentra documentada en el expediente societario.",
    )
    .replace(
      /Acuerdo 360\s*[0-9a-f-]{36}/gi,
      "Expediente de acuerdo vinculado",
    )
    // Defensa final para contenido histórico: los identificadores se conservan
    // en metadatos de auditoría, nunca en el cuerpo entregable.
    .replace(UUID_GLOBAL_RE, "referencia interna reservada")
    .replace(/D\.\/D\.ª\s+(Dña\.|D\.)\s*/gi, "$1 ")
    .replace(/\bDña\.\s+Dña\.\s+/gi, "Dña. ")
    .replace(/\bD\.\s+D\.\s+/g, "D. ")
    .replace(/\bNotar[ií]a\s+Notar[ií]a\b/gi, "Notaría")
    .replace(/^\s*Firma del convocante:\s*$/gim, "")
    .replace(/^\s*Sello de tiempo \(si aplica\):\s*$/gim, "")
    // Las referencias jurídicas se corrigen en la plantilla versionada; el
    // normalizador no reescribe artículos de la LSC.
    .replace(ISO_DATE_RE, (date) => formatSpanishLegalDate(date))
    .replace(/\btrue\b/gi, "Sí")
    .replace(/\bfalse\b/gi, "No")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface DocumentOutputContext {
  meetingDateISO?: string | null;
  approvalDateISO?: string | null;
  emissionDateISO?: string | null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function documentOutputContextFromVariables(
  variables: Record<string, unknown>,
  emissionDateISO?: string | null,
): DocumentOutputContext {
  return {
    meetingDateISO:
      stringValue(variables.fecha_reunion_iso) ??
      stringValue(variables.fecha_junta) ??
      stringValue(variables.fecha),
    approvalDateISO:
      stringValue(variables.fecha_aprobacion_acta_iso) ??
      stringValue(variables.fecha_aprobacion_acta),
    emissionDateISO:
      stringValue(variables.fecha_emision_iso) ??
      stringValue(variables.fecha_emision) ??
      emissionDateISO,
  };
}

function parseDateLike(value?: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim().toLocaleLowerCase("es");
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (numeric) return Date.UTC(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));
  const legal = /^(\d{1,2})\s+de\s+([a-záéíóúñü]+)\s+de\s+(\d{4})$/.exec(trimmed);
  if (legal) {
    const month = MONTHS_ES.indexOf(legal[2] as (typeof MONTHS_ES)[number]);
    if (month >= 0) return Date.UTC(Number(legal[3]), month, Number(legal[1]));
  }
  return null;
}

export function validateVisibleDocumentOutput(
  documentType: SecretariaDocumentType,
  value: string,
  context: DocumentOutputContext = {},
): DocumentOutputIssue[] {
  const issues: DocumentOutputIssue[] = [];
  const text = value.trim();

  if (UUID_RE.test(text)) {
    issues.push({
      code: "VISIBLE_INTERNAL_UUID",
      message: "El documento visible contiene un UUID interno; consérvalo solo en metadatos de auditoría.",
    });
  }
  if (/\b(?:agreement(?:s)?\.id|agreement id|certificaci[oó]n id|request id|snapshot(?: de)? reglas|traza registral|trazabilidad documental|trazabilidad del acto)\b/i.test(text)) {
    issues.push({
      code: "VISIBLE_INTERNAL_TRACE",
      message: "El documento visible contiene trazabilidad técnica reservada al expediente interno.",
    });
  }
  if (/D\.\/D\.ª/i.test(text)) {
    issues.push({
      code: "UNRESOLVED_PERSON_TREATMENT",
      message: "Queda un tratamiento genérico D./D.ª sin resolver.",
    });
  }
  if (ISO_DATE_TEST_RE.test(text)) {
    issues.push({
      code: "VISIBLE_ISO_DATE",
      message: "Queda una fecha ISO en el cuerpo visible del documento.",
    });
  }
  if (ENUM_TEST_RE.test(text) || SNAKE_CASE_TEST_RE.test(text) || /\b(?:true|false)\b/i.test(text)) {
    issues.push({
      code: "VISIBLE_MACHINE_VALUE",
      message: "El documento visible contiene un enum, una clave técnica o un booleano sin humanizar.",
    });
  }
  if (/\b(?:a favor de|en la figura de|se delegan? en)\s*(?:\.|,|\(|\n|$)/i.test(text)) {
    issues.push({
      code: "REQUIRED_RECIPIENT_BLANK",
      message: "El destinatario obligatorio del poder o de la delegación está vacío.",
    });
  }

  if (documentType === "CERTIFICACION") {
    if (!/\bFirma (?:de la Secretar[ií]a|del certificante)\b/i.test(text)) {
      issues.push({
        code: "CERTIFICATION_SIGNATURE_BLOCK_MISSING",
        message: "La certificación no contiene un bloque de firma del certificante.",
      });
    }
    if (!/\bVisto bueno\b/i.test(text)) {
      issues.push({
        code: "CERTIFICATION_APPROVAL_SIGNATURE_MISSING",
        message: "La certificación no contiene el bloque de visto bueno de la Presidencia.",
      });
    }
    if (!/\bcargo vigente y en ejercicio\b/i.test(text)) {
      issues.push({
        code: "CERTIFICATION_CURRENT_ROLE_MISSING",
        message: "La certificación no declara que el cargo certificante está vigente y en ejercicio.",
      });
    }
    if (!/\bel acta (?:fue|ha sido) aprobada\b/i.test(text)) {
      issues.push({
        code: "CERTIFICATION_MINUTE_APPROVAL_MISSING",
        message: "La certificación no indica el sistema y la fecha de aprobación del acta.",
      });
    }
  }

  const meetingDate = parseDateLike(context.meetingDateISO);
  const approvalDate = parseDateLike(context.approvalDateISO);
  const emissionDate = parseDateLike(context.emissionDateISO);
  if (
    (documentType === "ACTA" || documentType === "CERTIFICACION") &&
    meetingDate !== null &&
    approvalDate !== null &&
    approvalDate < meetingDate
  ) {
    issues.push({
      code: "INVALID_MINUTE_APPROVAL_CHRONOLOGY",
      message: "La fecha de aprobación del acta no puede ser anterior a la reunión.",
    });
  }
  if (
    documentType === "CERTIFICACION" &&
    approvalDate !== null &&
    emissionDate !== null &&
    emissionDate < approvalDate
  ) {
    issues.push({
      code: "INVALID_CERTIFICATION_CHRONOLOGY",
      message: "La certificación no puede emitirse antes de la aprobación del acta.",
    });
  }

  if (documentType === "DOCUMENTO_REGISTRAL" || documentType === "SUBSANACION_REGISTRAL") {
    if (!/\b(?:DEMO|NO OFICIAL)\b/i.test(text)) {
      issues.push({
        code: "REGISTRY_DEMO_MARKER_MISSING",
        message: "El documento registral simulado debe identificarse como DEMO o NO OFICIAL.",
      });
    }
    if (!/No acredita por s[ií] solo/i.test(text)) {
      issues.push({
        code: "REGISTRY_SCOPE_NOTICE_MISSING",
        message: "Falta el aviso de alcance que impide confundir el documento interno con un justificante oficial.",
      });
    }
  }

  return issues;
}

export function documentFilenamePrefix(kind: string, requestedPrefix: string) {
  return kind === "DOCUMENTO_REGISTRAL" || kind === "SUBSANACION_REGISTRAL"
    ? `DEMO_${requestedPrefix}`
    : requestedPrefix;
}
