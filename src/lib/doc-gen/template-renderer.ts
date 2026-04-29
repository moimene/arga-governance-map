/**
 * Template Renderer — Handlebars-based rendering for plantillas protegidas
 *
 * Compiles capa1_inmutable templates with Handlebars, resolves variables,
 * and produces the final rendered text ready for DOCX generation.
 *
 * Custom helpers:
 * - {{fechaES date}} → "19 de abril de 2026"
 * - {{uppercase text}} → "TEXTO"
 * - {{lowercase text}} → "texto"
 * - {{eq a b}} → boolean equality (for {{#if (eq x "y")}})
 * - {{or a b}} → boolean OR
 * - {{and a b}} → boolean AND
 * - {{gt a b}} → a > b
 * - {{gte a b}} → a >= b
 * - {{porcentaje num decimals}} → "45,67%"
 */

import Handlebars from "handlebars";

const HELPER_NAMES = new Set([
  "fechaES",
  "uppercase",
  "lowercase",
  "eq",
  "or",
  "and",
  "gt",
  "gte",
  "porcentaje",
  "ordinalES",
  "if",
  "unless",
  "each",
  "with",
  "lookup",
  "log",
]);

const SPECIAL_PATHS = new Set(["this", ".", "..", "@index", "@key", "@first", "@last"]);

// ── Spanish date formatting ──────────────────────────────────────────────────

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatFechaES(date: unknown): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(String(date));
  if (isNaN(d.getTime())) return String(date);
  return `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

// ── Register helpers ─────────────────────────────────────────────────────────

function registerCustomHelpers(hbs: typeof Handlebars): void {
  hbs.registerHelper("fechaES", (date: string | Date) => formatFechaES(date));

  hbs.registerHelper("uppercase", (text: string) =>
    typeof text === "string" ? text.toUpperCase() : ""
  );

  hbs.registerHelper("lowercase", (text: string) =>
    typeof text === "string" ? text.toLowerCase() : ""
  );

  hbs.registerHelper("eq", (a: unknown, b: unknown) => a === b);
  hbs.registerHelper("or", (a: unknown, b: unknown) => a || b);
  hbs.registerHelper("and", (a: unknown, b: unknown) => a && b);
  hbs.registerHelper("gt", (a: number, b: number) => a > b);
  hbs.registerHelper("gte", (a: number, b: number) => a >= b);

  hbs.registerHelper("porcentaje", (num: number, decimals?: number) => {
    const dec = typeof decimals === "number" ? decimals : 2;
    if (typeof num !== "number") return "";
    return num.toFixed(dec).replace(".", ",") + "%";
  });

  // Ordinal helper: 1 → "Primero", 2 → "Segundo", etc. (fallback to number)
  const ORDINALES = [
    "", "Primero", "Segundo", "Tercero", "Cuarto", "Quinto",
    "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo",
  ];
  hbs.registerHelper("ordinalES", (n: number) =>
    ORDINALES[n] || `${n}º`
  );
}

// ── Core rendering ───────────────────────────────────────────────────────────

export interface RenderTemplateInput {
  /** The capa1_inmutable Handlebars template text */
  template: string;
  /** Merged variables from capa2 (auto-resolved) + capa3 (user input) */
  variables: Record<string, unknown>;
}

export interface RenderTemplateOutput {
  /** Rendered plain text */
  text: string;
  /** List of variables that were referenced but had no value */
  unresolvedVariables: string[];
  /** Whether rendering completed without errors */
  ok: boolean;
  /** Error message if rendering failed */
  error?: string;
}

function preprocessTemplate(template: string) {
  return template
    .replace(/\{\{#if\s+([\w.]+)\s*==\s*'([^']+)'\}\}/g, "{{#if (eq $1 \"$2\")}}")
    .replace(/\{\{#if\s+([\w.]+)\s*==\s*"([^"]+)"\}\}/g, '{{#if (eq $1 "$2")}}');
}

function pathName(node: unknown): string | null {
  const value = node as { type?: string; original?: string; parts?: string[]; data?: boolean; value?: unknown } | null;
  if (!value || value.type !== "PathExpression") return null;
  const original = value.original ?? value.parts?.join(".");
  if (!original || SPECIAL_PATHS.has(original)) return null;
  if (original.startsWith("@")) return null;
  return original;
}

function addVariable(vars: Set<string>, rawName: string | null) {
  if (!rawName) return;
  const normalized = rawName.replace(/^this\./, "");
  const root = normalized.split(".")[0];
  if (!root || HELPER_NAMES.has(root) || SPECIAL_PATHS.has(root)) return;
  vars.add(normalized);
}

function isHelperInvocation(node: { path?: unknown; params?: unknown[]; hash?: { pairs?: unknown[] } }) {
  const name = pathName(node.path);
  if (!name) return false;
  return HELPER_NAMES.has(name) || (node.params?.length ?? 0) > 0 || (node.hash?.pairs?.length ?? 0) > 0;
}

function visitTemplateNode(node: unknown, vars: Set<string>) {
  if (!node || typeof node !== "object") return;
  const typed = node as {
    type?: string;
    path?: unknown;
    params?: unknown[];
    hash?: { pairs?: Array<{ value?: unknown }> };
    program?: unknown;
    inverse?: unknown;
    body?: unknown[];
    value?: unknown;
  };

  if (typed.type === "PathExpression") {
    addVariable(vars, pathName(typed));
    return;
  }

  if (
    typed.type === "MustacheStatement" ||
    typed.type === "SubExpression" ||
    typed.type === "BlockStatement" ||
    typed.type === "PartialStatement"
  ) {
    const helperName = pathName(typed.path);
    if (typed.type === "BlockStatement" && helperName === "each") {
      typed.params?.forEach((param) => visitTemplateNode(param, vars));
      typed.hash?.pairs?.forEach((pair) => visitTemplateNode(pair.value, vars));
      visitTemplateNode(typed.inverse, vars);
      return;
    }
    if (!isHelperInvocation(typed)) {
      addVariable(vars, pathName(typed.path));
    }
    typed.params?.forEach((param) => visitTemplateNode(param, vars));
    typed.hash?.pairs?.forEach((pair) => visitTemplateNode(pair.value, vars));
    visitTemplateNode(typed.program, vars);
    visitTemplateNode(typed.inverse, vars);
    return;
  }

  typed.body?.forEach((child) => visitTemplateNode(child, vars));
}

function hasValue(variables: Record<string, unknown>, varName: string) {
  const parts = varName.split(".");
  let current: unknown = variables;
  for (const part of parts) {
    if (current === undefined || current === null) return false;
    if (typeof current !== "object" || !(part in current)) return false;
    current = (current as Record<string, unknown>)[part];
  }
  if (current === undefined || current === null) return false;
  if (typeof current === "string" && current.trim() === "") return false;
  return true;
}

/**
 * Compile and render a capa1 Handlebars template with the given variables.
 *
 * The template uses `{{variable}}` syntax, with `{{#if}}`, `{{#each}}`,
 * `{{#unless}}` blocks. Custom helpers are registered for Spanish formatting.
 *
 * Unresolved variables render as empty strings (Handlebars default).
 * We track which variables were missing for UX feedback.
 */
export function renderTemplate(input: RenderTemplateInput): RenderTemplateOutput {
  try {
    // Create isolated Handlebars instance
    const hbs = Handlebars.create();
    registerCustomHelpers(hbs);

    const processedTemplate = preprocessTemplate(input.template);

    // Compile template
    const compiled = hbs.compile(processedTemplate, {
      noEscape: true, // We want raw text, not HTML-escaped
      strict: false,  // Don't throw on missing variables
    });

    const referencedVars = extractVariableNames(processedTemplate);
    const unresolvedVariables = referencedVars.filter((varName) => !hasValue(input.variables, varName));

    // Render
    const text = compiled(input.variables);

    return {
      text,
      unresolvedVariables,
      ok: true,
    };
  } catch (e) {
    return {
      text: "",
      unresolvedVariables: [],
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Validate a template without rendering — checks for syntax errors.
 */
export function validateTemplate(template: string): { ok: boolean; error?: string } {
  try {
    const hbs = Handlebars.create();
    registerCustomHelpers(hbs);
    hbs.precompile(preprocessTemplate(template));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Extract all variable names from a Handlebars template.
 * Returns top-level variables (not loop-internal ones from #each).
 */
export function extractVariableNames(template: string): string[] {
  const vars = new Set<string>();
  try {
    const ast = Handlebars.parse(preprocessTemplate(template));
    visitTemplateNode(ast, vars);
  } catch {
    const pattern = /\{\{(?!#|\/|!|>|else)([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    let match;
    while ((match = pattern.exec(template)) !== null) {
      addVariable(vars, match[1]);
    }
  }
  return Array.from(vars);
}

export function findMissingVariables(template: string, variables: Record<string, unknown>) {
  return extractVariableNames(template).filter((varName) => !hasValue(variables, varName));
}
