/**
 * Reglas semánticas P0 — Sprint 1 (D1).
 * Detectan issues legales conocidos en FUSION_ESCISION y RATIFICACION_ACTOS.
 */

import type { GatePreIssue, PlantillaCandidate } from "./types";

const FUSION_CONDITIONAL_RE = /\{\{\s*#if\s+(requiere_experto|requiereExperto|aplica_experto)\b/i;

const IDENTIFICACION_FIELDS = [
  "enumeracion_actos",
  "identificacion_actos",
  "relacion_actos",
  "actos_a_ratificar",
  "anexo_actos",
];

export function evaluateSemanticRules(t: PlantillaCandidate): GatePreIssue[] {
  const issues: GatePreIssue[] = [];
  const materia = t.materia_acuerdo ?? t.materia ?? "";

  if (materia === "FUSION_ESCISION") {
    const text = t.capa1_inmutable ?? "";
    if (!FUSION_CONDITIONAL_RE.test(text)) {
      issues.push({
        severity: "BLOCKING",
        code: "SEM_FUSION_EXPERTO_CONDICIONAL",
        message:
          "FUSION_ESCISION requiere condicional {{#if requiere_experto}} (art. 53 RDL 5/2023 — simplificadas)",
        field: "capa1_inmutable",
      });
    }
  }

  if (materia === "RATIFICACION_ACTOS") {
    const fields = (t.capa3_editables ?? []) as Array<{
      campo: string;
      obligatoriedad: string;
    }>;
    const hasIdField = fields.some(
      (f) => IDENTIFICACION_FIELDS.includes(f.campo) && f.obligatoriedad === "OBLIGATORIO",
    );
    if (!hasIdField) {
      issues.push({
        severity: "BLOCKING",
        code: "SEM_RATIFICACION_IDENTIFICACION",
        message:
          "RATIFICACION_ACTOS requiere un campo capa3 OBLIGATORIO de identificación de actos (enumeracion_actos, etc.)",
        field: "capa3_editables",
      });
    }
  }

  return issues;
}
