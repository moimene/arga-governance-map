const VARIABLE_NAME_PATTERN =
  /^[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}\p{N}_*]+)*$/u;
const VARIABLE_IN_EXPRESSION_PATTERN =
  /[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}\p{N}_*]+)*/gu;

export const TEMPLATE_EXPRESSION_PATTERN = /\{\{\{?[\s\S]*?\}\}\}?/g;

const IGNORED_EXPRESSION_WORDS = new Set([
  "as",
  "else",
  "eq",
  "false",
  "gt",
  "gte",
  "if",
  "lookup",
  "lt",
  "lte",
  "ne",
  "null",
  "true",
  "undefined",
  "unless",
  "with",
]);

export function templateExpressionBody(raw: string) {
  const opening = raw.startsWith("{{{") ? 3 : 2;
  const closing = raw.endsWith("}}}") ? 3 : 2;
  return raw.slice(opening, raw.length - closing).trim();
}

export function referenceNamesFromTemplateExpression(body: string) {
  if (!body || /^[!/>]/.test(body) || body === "else") return [];
  const block = /^#([A-Za-z_][A-Za-z0-9_]*)\b([\s\S]*)$/.exec(body);
  if (!block) {
    return VARIABLE_NAME_PATTERN.test(body) && body !== "this" && !body.startsWith("this.")
      ? [body]
      : [];
  }

  const args = block[2]
    .replace(/(['"])(?:\\.|(?!\1)[\s\S])*\1/g, " ")
    .replace(/\bas\s+\|[^|]*\|/g, " ");
  return (args.match(VARIABLE_IN_EXPRESSION_PATTERN) ?? []).filter(
    (name) =>
      !IGNORED_EXPRESSION_WORDS.has(name) &&
      name !== "this" &&
      !name.startsWith("this.") &&
      !/^\d/u.test(name),
  );
}

export function listTemplateExpressionVariables(text: string) {
  const names = new Set<string>();
  const pattern = new RegExp(TEMPLATE_EXPRESSION_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    for (const name of referenceNamesFromTemplateExpression(
      templateExpressionBody(match[0]),
    )) {
      names.add(name);
    }
  }
  return names;
}
