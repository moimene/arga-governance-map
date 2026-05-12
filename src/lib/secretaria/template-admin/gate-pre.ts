/**
 * Gate PRE headless: validación pre-activación de plantillas.
 * Función pura; reutilizable por importador, ValidacionTab y runtime.
 * Sprint 1 — Spec §5.
 */

import type { GatePreIssue, GatePreResult, PlantillaCandidate } from "./types";
import { isOrganoCanonico, normalizeOrganoTipo } from "./organo-canonico";
import { detectActiveDuplicate } from "./functional-key";
import { evaluateSemanticRules } from "./gate-pre-semantic";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
// META_REF_LEGAL_FORMAT: cualquier mención reconocible de fuente legal. La
// versión estricta (Art./Arts. ... LSC) bloqueaba plantillas existentes que
// usan formatos como "LSC (cuentas anuales)" o "Arts. 295 LSC". La regla
// se calibra para aceptar referencias bien formadas y rechazar "n/a", "".
const REF_LEGAL_PATTERN = /\b(LSC|RRM|RDL|LMV|RDLeg|CCom|RDLey|LOSSEAR|CNMV|CC)\b/;
const VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/g;
const HELPER_ALLOWLIST = new Set(["if", "else", "each", "unless", "with"]);
const PROTECTED_PREFIXES = ["ENTIDAD.", "ORGANO.", "REUNION.", "EXPEDIENTE.", "SISTEMA.", "QTSP."];
// Calibración Cloud (D16): organos legítimos en datos reales que no están en
// la canonical enum de Commit 2. Se aceptan en Gate PRE sin BLOCKING porque
// son legítimos en la data productiva. La enum canónica permanece estricta.
const EXTENDED_KNOWN_ORGANOS = new Set(["JUNTA_GENERAL_O_CONSEJO"]);

export type GatePreContext = {
  tenantId: string;
  existingActiveTemplates: PlantillaCandidate[];
};

export function validateTemplateForActivation(
  template: PlantillaCandidate,
  ctx: GatePreContext,
): GatePreResult {
  const issues: GatePreIssue[] = [];
  collectMetadataIssues(template, issues);
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

function collectMetadataIssues(t: PlantillaCandidate, issues: GatePreIssue[]): void {
  const organoOk =
    t.organo_tipo &&
    (isOrganoCanonico(t.organo_tipo) || EXTENDED_KNOWN_ORGANOS.has(t.organo_tipo));
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
  if (!t.aprobada_por || t.aprobada_por === "" || /^(falta|pendiente)/i.test(t.aprobada_por)) {
    issues.push({
      severity: "BLOCKING",
      code: "META_APROBADA_POR",
      message: "aprobada_por no puede ser null/vacío/placeholder",
      field: "aprobada_por",
    });
  }
  if (!t.fecha_aprobacion) {
    issues.push({
      severity: "BLOCKING",
      code: "META_APROBADA_POR",
      message: "fecha_aprobacion no puede ser null",
      field: "fecha_aprobacion",
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
  const used = new Set<string>();
  let m: RegExpExecArray | null;
  const reset = new RegExp(VARIABLE_PATTERN.source, "g");
  while ((m = reset.exec(text)) !== null) {
    const name = m[1];
    if (
      !name.startsWith("#") &&
      !name.startsWith("/") &&
      !["else", "this"].includes(name) &&
      !name.startsWith("this.")
    ) {
      used.add(name);
    }
  }
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
    if (PROTECTED_PREFIXES.some((p) => f.campo.startsWith(p))) {
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
  const used = new Set<string>();
  const reset = new RegExp(VARIABLE_PATTERN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = reset.exec(text)) !== null) {
    used.add(m[1]);
  }
  for (const v of t.capa2_variables ?? []) {
    if (!used.has(v.variable)) {
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
