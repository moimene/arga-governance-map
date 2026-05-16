import { validateRenderedActaAgainstLegalStructure, type ActaLegalStructureViewModel } from "@/lib/secretaria/acta-legal-structure";
import type { SecretariaDocumentType } from "@/lib/secretaria/document-generation-boundary";

export interface OpenXmlValidationIssue {
  code: string;
  severity: "BLOCKING" | "WARNING";
  field_path: string;
  message: string;
}

export interface OpenXmlValidationResult {
  ok: boolean;
  issues: OpenXmlValidationIssue[];
  documentText: string;
  packageText: string;
}

export interface ValidateGeneratedDocxOpenXmlInput {
  buffer: Uint8Array;
  renderedText: string;
  documentType: SecretariaDocumentType;
  contentHash?: string | null;
  actaLegalStructure?: ActaLegalStructureViewModel | null;
}

function toExactArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function unescapeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function textFromWordXml(xml: string) {
  const chunks = Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)).map((match) =>
    unescapeXml(match[1] ?? ""),
  );
  return chunks.join("");
}

async function loadWordPackageText(buffer: Uint8Array) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(toExactArrayBuffer(buffer));
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    return {
      documentText: "",
      packageText: "",
      missingDocumentXml: true,
    };
  }

  const wordXmlFiles = Object.values(zip.files).filter((file) =>
    /^word\/.*\.xml$/i.test(file.name) && !file.dir,
  );
  const packageTextParts: string[] = [];
  for (const file of wordXmlFiles) {
    const xml = await file.async("string");
    packageTextParts.push(textFromWordXml(xml));
  }

  return {
    documentText: textFromWordXml(documentXml),
    packageText: packageTextParts.join("\n"),
    missingDocumentXml: false,
  };
}

function pushIssue(issues: OpenXmlValidationIssue[], issue: OpenXmlValidationIssue) {
  issues.push(issue);
}

function unresolvedHandlebars(value: string) {
  return Array.from(new Set(value.match(/\{\{[^}]+\}\}/g) ?? []));
}

export async function validateGeneratedDocxOpenXml(
  input: ValidateGeneratedDocxOpenXmlInput,
): Promise<OpenXmlValidationResult> {
  const issues: OpenXmlValidationIssue[] = [];
  const loaded = await loadWordPackageText(input.buffer);

  if (loaded.missingDocumentXml) {
    pushIssue(issues, {
      code: "DOCX_DOCUMENT_XML_MISSING",
      severity: "BLOCKING",
      field_path: "docx.word.document_xml",
      message: "El paquete DOCX no contiene word/document.xml.",
    });
  }

  if (!loaded.documentText.trim()) {
    pushIssue(issues, {
      code: "DOCX_DOCUMENT_TEXT_EMPTY",
      severity: "BLOCKING",
      field_path: "docx.word.document_xml",
      message: "El cuerpo OpenXML del DOCX no contiene texto legal renderizado.",
    });
  }

  const orphanTokens = unresolvedHandlebars(loaded.packageText);
  if (orphanTokens.length > 0) {
    pushIssue(issues, {
      code: "DOCX_ORPHAN_TEMPLATE_VARIABLES",
      severity: "BLOCKING",
      field_path: "docx.word.xml",
      message: `El DOCX contiene variables de plantilla sin resolver: ${orphanTokens.slice(0, 8).join(", ")}.`,
    });
  }

  if (input.contentHash && !loaded.packageText.includes(input.contentHash.slice(0, 16))) {
    pushIssue(issues, {
      code: "DOCX_CONTENT_HASH_FOOTER_MISSING",
      severity: "WARNING",
      field_path: "docx.word.footer",
      message: "No se detecta el hash de contenido en el pie del DOCX.",
    });
  }

  if (input.documentType === "ACTA" && input.actaLegalStructure) {
    for (const issue of validateRenderedActaAgainstLegalStructure(loaded.documentText, input.actaLegalStructure)) {
      pushIssue(issues, {
        code: `DOCX_${issue.code}`,
        severity: issue.severity,
        field_path: "docx.word.document_xml",
        message: issue.message,
      });
    }
  }

  const renderedNormalized = normalizeText(input.renderedText);
  const documentNormalized = normalizeText(loaded.documentText);
  const requiredMarkers = input.documentType === "ACTA"
    ? ["ACTA", "ORDEN DEL DIA", "DESARROLLO DE LA SESION"]
    : [];
  for (const marker of requiredMarkers) {
    if (renderedNormalized.includes(marker) && !documentNormalized.includes(marker)) {
      pushIssue(issues, {
        code: "DOCX_RENDERED_MARKER_MISSING",
        severity: "BLOCKING",
        field_path: "docx.word.document_xml",
        message: `El DOCX no conserva el marcador obligatorio ${marker} presente en el texto validado.`,
      });
    }
  }

  return {
    ok: issues.every((issue) => issue.severity !== "BLOCKING"),
    issues,
    documentText: loaded.documentText,
    packageText: loaded.packageText,
  };
}
