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

// ── Spanish date formatting ──────────────────────────────────────────────────

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatFechaES(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
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

    // Pre-process: handle `{{#if var == 'value'}}` pseudo-syntax
    // Handlebars doesn't support inline comparison, so we convert these
    // to use the eq helper: {{#if (eq var "value")}}
    const processedTemplate = input.template
      .replace(/\{\{#if\s+(\w+)\s*==\s*'([^']+)'\}\}/g, "{{#if (eq $1 \"$2\")}}")
      .replace(/\{\{#if\s+(\w+)\s*==\s*"([^"]+)"\}\}/g, '{{#if (eq $1 "$2")}}');

    // Compile template
    const compiled = hbs.compile(processedTemplate, {
      noEscape: true, // We want raw text, not HTML-escaped
      strict: false,  // Don't throw on missing variables
    });

    // Track unresolved variables
    const unresolvedVariables: string[] = [];

    // Extract variable names from template (simple scan)
    const varPattern = /\{\{(?!#|\/|!|>|else)([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;
    let match;
    const referencedVars = new Set<string>();
    while ((match = varPattern.exec(input.template)) !== null) {
      referencedVars.add(match[1]);
    }

    // Check which are unresolved
    for (const varName of referencedVars) {
      // Skip loop-internal variables (they come from #each context)
      if (varName.includes(".")) continue;
      // Skip helpers
      if (["fechaES", "uppercase", "lowercase", "ordinalES", "porcentaje"].includes(varName)) continue;

      if (!(varName in input.variables) || input.variables[varName] === undefined || input.variables[varName] === null) {
        unresolvedVariables.push(varName);
      }
    }

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
    hbs.precompile(template);
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
  const pattern = /\{\{(?!#|\/|!|>|else)([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  let match;
  while ((match = pattern.exec(template)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars);
}
