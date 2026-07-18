/**
 * Reglas semánticas P0 — Sprint 1 (D1).
 * Detectan issues legales conocidos en FUSION_ESCISION y RATIFICACION_ACTOS.
 */

import type { GatePreIssue, PlantillaCandidate } from "./types";
import { isAdoptionMetadataRequired, requiresLegalReference } from "./metadata-policy";

const FUSION_CONDITIONAL_RE = /\{\{\s*#if\s+(requiere_experto|requiereExperto|aplica_experto)\b/i;

const IDENTIFICACION_FIELDS = [
  "enumeracion_actos",
  "identificacion_actos",
  "relacion_actos",
  "actos_a_ratificar",
  "anexo_actos",
  // ITEM-083: variante usada por las plantillas reales de RATIFICACION_ACTOS.
  "lista_actos_ratificados",
];

// G5 — Sustituye el probe §6.2 del prompt de auditoría. Una plantilla ACTIVA
// con tipo MODELO_ACUERDO/ACTA/DECISION exige que organo_tipo, adoption_mode
// y referencia_legal estén poblados. La fuente de verdad pasa de docs a motor.

/**
 * @param targetEstado estado al que se pretende transicionar. En la activación
 * gobernada (APROBADA→ACTIVA) el candidato llega todavía como APROBADA: sin
 * este parámetro las reglas de "plantilla vigente" no se evaluaban nunca en el
 * único momento en que importan.
 */
export function evaluateSemanticRules(
  t: PlantillaCandidate,
  targetEstado?: string | null,
): GatePreIssue[] {
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

  // Lote 2 coherencia: el requisito se deriva de la política de metadatos
  // compartida (templateMetadataPolicy/NON_ADOPTABLE_DOCUMENT_TYPES y
  // requiresLegalReference), no de una lista de tipos que no cubría los
  // tipos reales de acta (ACTA_SESION, ACTA_CONSIGNACION, ...).
  if ((targetEstado ?? t.estado) === "ACTIVA") {
    const missing: string[] = [];
    if (!t.organo_tipo || String(t.organo_tipo).trim() === "") missing.push("organo_tipo");
    if (
      isAdoptionMetadataRequired(t.tipo) &&
      (!t.adoption_mode || String(t.adoption_mode).trim() === "")
    ) {
      missing.push("adoption_mode");
    }
    if (
      requiresLegalReference(t) &&
      (!t.referencia_legal || String(t.referencia_legal).trim() === "")
    ) {
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

  // ITEM-026 — namespaces sin proveedor en el resolver. Las plantillas más
  // sensibles (actas formales, certificaciones) usan placeholders cuyos
  // namespaces ningún código construye (ACUERDO.*, DECISION.*, COAP.*,
  // REGISTRO.*...) y se renderizan en blanco. WARNING para hacerlos visibles
  // en la consola de validación; la activación de plantillas nuevas con
  // namespaces huérfanos debe resolverse (proveedor o migración de namespace).
  const orphanNamespaces = detectOrphanNamespaces(t.capa1_inmutable ?? "");
  if (orphanNamespaces.length > 0) {
    issues.push({
      severity: "WARNING",
      code: "SEM_NAMESPACE_SIN_PROVEEDOR",
      message: `La capa 1 usa namespaces sin proveedor en el resolver (renderizarán en blanco): ${orphanNamespaces.join(", ")}. Migrar a namespaces soportados (${[...SUPPORTED_VARIABLE_NAMESPACES].join("/")}) o implementar el proveedor.`,
      field: "capa1_inmutable",
    });
  }

  return issues;
}

/**
 * Namespaces que el resolver (variable-resolver.ts sourceMap) y el pipeline
 * QTSP construyen hoy. Mantener sincronizado con el sourceMap.
 */
export const SUPPORTED_VARIABLE_NAMESPACES = new Set([
  "ENTIDAD",
  "ORGANO",
  "REUNION",
  "EXPEDIENTE",
  "CAP_TABLE",
  "MOTOR",
  "SISTEMA",
  "USUARIO",
  "QTSP",
]);

export function detectOrphanNamespaces(capa1: string): string[] {
  const namespaces = new Set<string>();
  for (const match of capa1.matchAll(/\{\{\s*#?(?:if\s+|each\s+|unless\s+)?([A-Z_]{2,})\.[A-Za-z_]/g)) {
    namespaces.add(match[1]);
  }
  return [...namespaces].filter((ns) => !SUPPORTED_VARIABLE_NAMESPACES.has(ns)).sort();
}
