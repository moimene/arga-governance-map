import type {
  MotorPlantillasIssue,
  ValidatePostRenderInput,
} from "./types";
import type { SecretariaValidationResult } from "@/lib/secretaria/document-generation-boundary";

const REQUIRED_SECTION_MARKERS: Record<string, string[]> = {
  CONVOCATORIA: ["CONVOCATORIA", "ORDEN"],
  ACTA: ["ACTA"],
  CERTIFICACION: ["CERTIF"],
  INFORME_PRECEPTIVO: ["INFORME"],
  INFORME_DOCUMENTAL_PRE: ["INFORME", "DOCUMENT"],
  ACUERDO_SIN_SESION: ["ACUERDO"],
  DECISION_UNIPERSONAL: ["DECISION"],
  DOCUMENTO_REGISTRAL: ["REGISTR"],
  SUBSANACION_REGISTRAL: ["SUBSAN"],
};

const MIN_CAPA1_LENGTH = 80;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function pushIssue(issues: MotorPlantillasIssue[], issue: MotorPlantillasIssue) {
  issues.push(issue);
}

function unresolvedHandlebars(text: string) {
  const matches = text.match(/\{\{[^}]+\}\}/g) ?? [];
  return Array.from(new Set(matches.map((value) => value.trim())));
}

export function validatePostRenderDocument(
  input: ValidatePostRenderInput,
): SecretariaValidationResult {
  const issues: MotorPlantillasIssue[] = [];
  const rendered = input.renderedText.trim();
  const normalizedRendered = normalizeText(rendered);
  const capa1 = input.capa1Template?.trim() ?? "";

  if (capa1.length < MIN_CAPA1_LENGTH) {
    pushIssue(issues, {
      code: "CAPA1_TOO_SHORT",
      severity: "WARNING",
      field_path: "template.capa1_inmutable",
      message: `Capa 1 debe tener al menos ${MIN_CAPA1_LENGTH} caracteres para document_type=${input.documentType}.`,
    });
  }

  if (!rendered) {
    pushIssue(issues, {
      code: "RENDERED_TEXT_EMPTY",
      severity: "BLOCKING",
      field_path: "renderedText",
      message: "El render final esta vacio.",
    });
  }

  const orphanTokens = unresolvedHandlebars(rendered);
  if (orphanTokens.length > 0) {
    pushIssue(issues, {
      code: "ORPHAN_TEMPLATE_VARIABLES",
      severity: "BLOCKING",
      field_path: "renderedText",
      message: `Quedan variables Handlebars sin resolver: ${orphanTokens.slice(0, 8).join(", ")}.`,
    });
  }

  const unresolved = Array.from(new Set(input.unresolvedVariables ?? []));
  if (unresolved.length > 0) {
    pushIssue(issues, {
      code: "UNRESOLVED_VARIABLES",
      severity: "WARNING",
      field_path: "variables",
      message: `Variables referenciadas sin valor: ${unresolved.slice(0, 8).join(", ")}.`,
    });
  }

  const markers = REQUIRED_SECTION_MARKERS[input.documentType] ?? [];
  for (const marker of markers) {
    if (!normalizedRendered.includes(marker)) {
      pushIssue(issues, {
        code: "REQUIRED_SECTION_MISSING",
        severity: "WARNING",
        field_path: "renderedText",
        message: `No se detecta la seccion esperada ${marker} para document_type=${input.documentType}.`,
      });
    }
  }

  const hasAgreementReferences =
    input.agreementIds.length === 0 ||
    input.agreementIds.some((id) => rendered.includes(id));
  if (!hasAgreementReferences) {
    pushIssue(issues, {
      code: "AGREEMENT_REFERENCE_NOT_RENDERED",
      severity: "WARNING",
      field_path: "agreement_ids",
      message: "El texto renderizado no contiene referencias visibles a los agreement_ids del request.",
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "BLOCKING"),
    issues,
  };
}
