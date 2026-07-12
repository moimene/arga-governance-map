/**
 * Gate PRE headless: validación pre-activación de plantillas.
 * Función pura; reutilizable por importador, ValidacionTab y runtime.
 * Sprint 1 — Spec §5.
 */

import type {
  EstadoPlantilla,
  GatePreIssue,
  GatePreResult,
  PlantillaCandidate,
} from "./types";
import { isOrganoCanonico, normalizeOrganoTipo } from "./organo-canonico";
import { detectActiveDuplicate } from "./functional-key";
import { evaluateSemanticRules } from "./gate-pre-semantic";
// ITEM-138: SEMVER y la lista de fuentes legales se centralizan en patterns.ts
// (compartido con template-import-schema) para que gate e importer no diverjan.
// META_REF_LEGAL_FORMAT usa la forma laxa: cualquier mención reconocible de
// fuente legal (acepta "LSC (cuentas anuales)", "Arts. 295 LSC"; rechaza "n/a", "").
import { SEMVER, REF_LEGAL_PATTERN_LAX as REF_LEGAL_PATTERN } from "./patterns";
import { listTemplateExpressionVariables } from "./template-expression-vars";

const VARIABLE_PATTERN =
  /\{\{\s*([\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}\p{N}_]+)*)\s*\}\}/gu;
const HELPER_ALLOWLIST = new Set(["if", "else", "each", "unless", "with"]);
const PROTECTED_PREFIXES = ["ENTIDAD.", "ORGANO.", "REUNION.", "EXPEDIENTE.", "SISTEMA.", "QTSP."];
export type GatePreContext = {
  tenantId: string;
  existingActiveTemplates: PlantillaCandidate[];
  targetEstado?: EstadoPlantilla;
};

export function validateTemplateForActivation(
  template: PlantillaCandidate,
  ctx: GatePreContext,
): GatePreResult {
  const target = ctx.targetEstado ?? "ACTIVA";
  const issues: GatePreIssue[] = [];
  collectMetadataIssues(template, issues, target);
  collectCapa1Issues(template, issues);
  collectCapa2Issues(template, issues);
  collectCapa3Issues(template, issues);
  collectDuplicateIssue(template, ctx, issues);
  collectSemanticIssues(template, issues);
  collectInfoIssues(template, issues);
  return summarize(issues);
}

function summarize(issues: GatePreIssue[]): GatePreResult {
  const summary = { blocking: 0, warning: 0, info: 0 };
  for (const i of issues) summary[i.severity.toLowerCase() as keyof typeof summary] += 1;
  return { ok: summary.blocking === 0, issues, summary };
}

function collectMetadataIssues(
  t: PlantillaCandidate,
  issues: GatePreIssue[],
  target: EstadoPlantilla,
): void {
  const organoOk =
    t.organo_tipo &&
    isOrganoCanonico(t.organo_tipo);
  if (!organoOk) {
    const normalized = t.organo_tipo ? normalizeOrganoTipo(t.organo_tipo) : null;
    issues.push({
      severity: "BLOCKING",
      code: "META_ORGANO_NULL",
      message: normalized
        ? `organo_tipo '${t.organo_tipo}' es alias; normalizar a '${normalized}'`
        : `organo_tipo '${t.organo_tipo ?? "<null>"}' no es canónico`,
      field: "organo_tipo",
    });
  }
  if (!t.version || !SEMVER.test(t.version)) {
    issues.push({
      severity: "BLOCKING",
      code: "META_VERSION_SEMVER",
      message: `version '${t.version}' no cumple semver (ej. 1.0.0)`,
      field: "version",
    });
  }
  // META_REF_LEGAL_FORMAT: se exime a plantillas SOPORTE_INTERNO (informes
  // preceptivos/documentales internos) que no requieren cita legal explícita.
  const isSoporteInterno = t.organo_tipo === "SOPORTE_INTERNO";
  if (!isSoporteInterno && (!t.referencia_legal || !REF_LEGAL_PATTERN.test(t.referencia_legal))) {
    issues.push({
      severity: "BLOCKING",
      code: "META_REF_LEGAL_FORMAT",
      message:
        "referencia_legal debe mencionar fuente legal (LSC/RRM/RDL/LMV/CCom/RDLey/LOSSEAR/CC/CNMV)",
      field: "referencia_legal",
    });
  }
  const requiresApproval = target === "APROBADA" || target === "ACTIVA";
  if (requiresApproval) {
    if (!t.aprobada_por || t.aprobada_por === "" || /^(falta|pendiente)/i.test(t.aprobada_por)) {
      issues.push({
        severity: "BLOCKING",
        code: "META_APROBADA_POR",
        message: "aprobada_por requerido para llegar a APROBADA/ACTIVA",
        field: "aprobada_por",
      });
    }
    if (!t.fecha_aprobacion) {
      issues.push({
        severity: "BLOCKING",
        code: "META_APROBADA_POR",
        message: "fecha_aprobacion requerida para llegar a APROBADA/ACTIVA",
        field: "fecha_aprobacion",
      });
    }
  } else if (!t.aprobada_por || !t.fecha_aprobacion) {
    issues.push({
      severity: "INFO",
      code: "META_APROBADA_POR_PENDING",
      message: "aprobada_por/fecha_aprobacion pendientes; requeridos al promover a APROBADA",
      field: !t.aprobada_por ? "aprobada_por" : "fecha_aprobacion",
    });
  }
}

function collectCapa1Issues(t: PlantillaCandidate, issues: GatePreIssue[]): void {
  const text = t.capa1_inmutable ?? "";
  if (text.length < 100) {
    issues.push({
      severity: "BLOCKING",
      code: "CAPA1_LENGTH",
      message: `capa1_inmutable tiene ${text.length} chars; mínimo 100`,
      field: "capa1_inmutable",
    });
  }
  // Detectar helpers fuera del allowlist: {{#name ... }}
  const helperRe = /\{\{\s*#([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = helperRe.exec(text)) !== null) {
    if (!HELPER_ALLOWLIST.has(m[1])) {
      issues.push({
        severity: "BLOCKING",
        code: "CAPA2_HELPER_PROHIBIDO",
        message: `helper '{{#${m[1]}}}' no está en allowlist (if/else/each/unless/with)`,
        field: "capa1_inmutable",
      });
    }
  }
}

function isFrameworkPrefix(varName: string): boolean {
  // Variables resueltas por el framework (no exigen entrada en capa2_variables).
  // Incluye prefijos protegidos uppercase (legacy) + namespaces convencionales
  // de los resolvers de variables del proyecto (variable-resolver.ts).
  for (const p of PROTECTED_PREFIXES) {
    if (varName.startsWith(p)) return true;
  }
  // Namespaces uppercase adicionales usados por plantillas reales.
  const upperNs = [
    "MOTOR.",
    "USUARIO.",
    "REGISTRO.",
    "CUENTAS.",
    "CERTIFICACION.",
    "ACUERDO.",
    "ACTO.",
    "DECISION.",
    "DELEGACION.",
    "COAP.",
    "OV.",
    "ADMIN.",
    "ADMIN_SOLIDARIO.",
    "SOCIO_UNICO.",
  ];
  for (const p of upperNs) {
    if (varName.startsWith(p)) return true;
  }
  return false;
}

function isDeclared(variable: string, declared: Set<string>): boolean {
  if (declared.has(variable)) return true;
  // Aceptar declaraciones tipo "prefijo.*" en capa2_variables: si una entrada
  // declarada termina en ".*", cubre cualquier variable usada con ese prefijo.
  for (const d of declared) {
    if (d.endsWith(".*")) {
      const prefix = d.slice(0, -1); // "prefijo."
      if (variable.startsWith(prefix)) return true;
    }
  }
  return false;
}

function collectCapa2Issues(t: PlantillaCandidate, issues: GatePreIssue[]): void {
  const text = t.capa1_inmutable ?? "";
  const declared = new Set((t.capa2_variables ?? []).map((v) => v.variable));
  const used = listTemplateExpressionVariables(text);
  for (const v of used) {
    if (!isDeclared(v, declared) && v.includes(".") && !isFrameworkPrefix(v)) {
      issues.push({
        severity: "BLOCKING",
        code: "CAPA2_VAR_NO_CATALOGADA",
        message: `variable '${v}' usada en capa1 pero ausente de capa2_variables`,
        field: "capa2_variables",
      });
    }
    if (v.startsWith("entity_id") || v.startsWith("entity_name")) {
      issues.push({
        severity: "BLOCKING",
        code: "ENTITY_REF_FORBIDDEN",
        message: `variable '${v}' referencia entity directamente; usar entities.* via entity_settings`,
        field: "capa2_variables",
      });
    }
  }
}

function collectCapa3Issues(t: PlantillaCandidate, issues: GatePreIssue[]): void {
  for (const f of t.capa3_editables ?? []) {
    const normalizedField = f.campo.toLocaleUpperCase("es");
    if (PROTECTED_PREFIXES.some((p) => normalizedField.startsWith(p))) {
      issues.push({
        severity: "BLOCKING",
        code: "CAPA3_PREFIJO_PROTEGIDO",
        message: `campo '${f.campo}' usa prefijo reservado de capa2`,
        field: "capa3_editables",
      });
    }
  }
}

function collectDuplicateIssue(
  t: PlantillaCandidate,
  ctx: GatePreContext,
  issues: GatePreIssue[],
): void {
  const dup = detectActiveDuplicate(t, ctx.existingActiveTemplates, ctx.tenantId);
  if (dup) {
    issues.push({
      severity: "BLOCKING",
      code: "DUP_ACTIVE_FUNCTIONAL_KEY",
      message: `duplicado activo: plantilla ${dup.id} ya cubre esta clave funcional`,
      hint: `archivar ${dup.id} antes de activar esta`,
    });
  }
}

function collectSemanticIssues(t: PlantillaCandidate, issues: GatePreIssue[]): void {
  for (const i of evaluateSemanticRules(t)) issues.push(i);
}

function collectInfoIssues(t: PlantillaCandidate, issues: GatePreIssue[]): void {
  // GEN_IF_COUNT
  const ifRe = /\{\{\s*#if\b/g;
  const ifCount = (t.capa1_inmutable ?? "").match(ifRe)?.length ?? 0;
  if (ifCount > 3) {
    issues.push({
      severity: "WARNING",
      code: "GEN_IF_COUNT",
      message: `capa1 tiene ${ifCount} ramas {{#if}}; revisar si la plantilla debería desdoblarse`,
      field: "capa1_inmutable",
    });
  }

  // LEGACY_FUENTE_ENTIDAD
  for (const v of t.capa2_variables ?? []) {
    if (v.fuente === "ENTIDAD") {
      issues.push({
        severity: "WARNING",
        code: "LEGACY_FUENTE_ENTIDAD",
        message: `variable '${v.variable}' usa fuente legacy ENTIDAD; preferir entities.name`,
        field: "capa2_variables",
      });
    }
  }

  // CAPA2_UNUSED_VARIABLE
  const text = t.capa1_inmutable ?? "";
  const used = listTemplateExpressionVariables(text);
  for (const v of t.capa2_variables ?? []) {
    if (![...used].some((name) => isDeclared(name, new Set([v.variable])))) {
      issues.push({
        severity: "INFO",
        code: "CAPA2_UNUSED_VARIABLE",
        message: `variable '${v.variable}' declarada en capa2 pero no usada en capa1`,
        field: "capa2_variables",
      });
    }
  }
}

export { SEMVER, REF_LEGAL_PATTERN, VARIABLE_PATTERN, HELPER_ALLOWLIST, PROTECTED_PREFIXES };
