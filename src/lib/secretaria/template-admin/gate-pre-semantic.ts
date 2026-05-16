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

// G5 — Sustituye el probe §6.2 del prompt de auditoría. Una plantilla ACTIVA
// con tipo MODELO_ACUERDO/ACTA/DECISION exige que organo_tipo, adoption_mode
// y referencia_legal estén poblados. La fuente de verdad pasa de docs a motor.
const ACTIVA_REQUIRED_TYPES = ["MODELO_ACUERDO", "ACTA", "DECISION"] as const;

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

  if (
    t.estado === "ACTIVA" &&
    (ACTIVA_REQUIRED_TYPES as readonly string[]).includes(t.tipo)
  ) {
    const missing: string[] = [];
    if (!t.organo_tipo || String(t.organo_tipo).trim() === "") missing.push("organo_tipo");
    if (!t.adoption_mode || String(t.adoption_mode).trim() === "") missing.push("adoption_mode");
    if (!t.referencia_legal || String(t.referencia_legal).trim() === "") {
      missing.push("referencia_legal");
    }
    if (missing.length > 0) {
      issues.push({
        severity: "BLOCKING",
        code: "SEM_ACTIVA_CAMPOS_REQUERIDOS",
        message: `Plantilla ACTIVA de tipo ${t.tipo} requiere campos poblados: ${missing.join(", ")}`,
        field: missing[0],
      });
    }
  }

  return issues;
}
