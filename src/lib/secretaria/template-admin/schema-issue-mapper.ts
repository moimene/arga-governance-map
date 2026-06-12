/**
 * schema-issue-mapper — traduce los issues de Zod del schema de importación
 * a mensajes legibles en castellano para el Comité Legal (perfil no técnico).
 *
 * ITEM-088: el TemplateImportWizard mostraba `JSON.stringify(error.issues)`
 * crudo en un <pre> (paths tipo ["template","referencia_legal"], códigos
 * 'invalid_string' y mensajes en inglés de Zod). Este mapper produce el
 * mismo shape que los issues del Gate PRE (`code` + `message` + `hint`),
 * para renderizarlos con el mismo componente visual.
 *
 * Es importer logic reutilizable (3 sitios de consumo en el wizard: parse
 * local, PARSE_FAILED de preflight y PARSE_FAILED del commit), por eso vive
 * en la librería canónica `template-admin/` y no inline en el componente.
 */

/** Shape de salida — alineado con los issues del Gate PRE para reúso visual. */
export type SchemaIssue = {
  /** Path del campo en notación punteada, p. ej. `template.referencia_legal`. */
  code: string;
  /** Mensaje accionable en castellano. */
  message: string;
  /** Pista opcional (valores válidos cercanos, formato esperado, etc.). */
  hint?: string;
};

/** Subconjunto de ZodIssue que consumimos (tolerante a versiones de Zod). */
type RawZodIssue = {
  code?: string;
  path?: Array<string | number>;
  message?: string;
  expected?: unknown;
  options?: unknown[];
  validation?: string;
  minimum?: number;
  type?: string;
};

/** Etiquetas en castellano para los segmentos de path más habituales. */
const FIELD_LABELS: Record<string, string> = {
  schema_version: "versión de schema",
  template: "plantilla",
  tipo: "tipo de documento",
  materia: "materia",
  materia_acuerdo: "materia del acuerdo",
  jurisdiccion: "jurisdicción",
  version: "versión",
  organo_tipo: "tipo de órgano",
  adoption_mode: "modo de adopción",
  referencia_legal: "referencia legal",
  tipo_social: "tipo social",
  capa1_inmutable: "capa 1 (texto inmutable)",
  capa2_variables: "capa 2 (variables)",
  capa3_editables: "capa 3 (campos editables)",
  variable: "variable",
  fuente: "fuente",
  condicion: "condición",
  campo: "campo",
  obligatoriedad: "obligatoriedad",
  notas_legal: "notas legales",
};

function fieldPath(path: Array<string | number> | undefined): string {
  if (!path || path.length === 0) return "(raíz del paquete)";
  return path
    .map((seg) => (typeof seg === "number" ? `[${seg + 1}]` : seg))
    .join(".");
}

function fieldLabel(path: Array<string | number> | undefined): string {
  if (!path || path.length === 0) return "el paquete";
  const last = path[path.length - 1];
  if (typeof last === "number") {
    const parent = path[path.length - 2];
    const base = typeof parent === "string" ? FIELD_LABELS[parent] ?? parent : "elemento";
    return `${base} nº ${last + 1}`;
  }
  return FIELD_LABELS[last] ?? String(last);
}

/** Lista hasta `max` valores válidos para una pista de enum. */
function sampleValues(options: unknown[] | undefined, max = 12): string | null {
  if (!options || options.length === 0) return null;
  const vals = options.map((o) => String(o));
  if (vals.length <= max) return vals.join(", ");
  return `${vals.slice(0, max).join(", ")}… (${vals.length} valores admitidos)`;
}

/** Mapea un único ZodIssue a un mensaje en castellano + pista. */
function mapOne(issue: RawZodIssue): SchemaIssue {
  const path = issue.path;
  const code = fieldPath(path);
  const label = fieldLabel(path);

  switch (issue.code) {
    case "invalid_enum_value": {
      const valid = sampleValues(issue.options);
      return {
        code,
        message: `${label}: el valor indicado no está en el catálogo soportado.`,
        hint: valid ? `Valores válidos: ${valid}` : undefined,
      };
    }
    case "invalid_literal":
      return {
        code,
        message: `${label}: debe ser exactamente "${String(issue.expected ?? "")}".`,
        hint: "Usa la plantilla base v1 descargable como referencia.",
      };
    case "invalid_type":
      if (issue.expected === "string" && issue.message?.toLowerCase().includes("required")) {
        return { code, message: `${label}: falta este campo obligatorio.` };
      }
      return {
        code,
        message: `${label}: tipo de dato incorrecto (se esperaba ${String(issue.expected ?? "otro valor")}).`,
      };
    case "invalid_string":
      if (issue.validation === "regex" && path?.[path.length - 1] === "version") {
        return {
          code,
          message: `${label}: el formato de versión no es válido.`,
          hint: "Usa formato semver: MAJOR.MINOR.PATCH (p. ej. 1.0.0).",
        };
      }
      if (issue.validation === "regex" && path?.[path.length - 1] === "referencia_legal") {
        return {
          code,
          message: `${label}: la cita legal no tiene un formato reconocido.`,
          hint: 'Acepta "Art. 160 LSC", "LSC art. 15", o leyes sueltas (LSC, RRM, RDL, LMV, LGSM…).',
        };
      }
      if (issue.validation === "regex" && path?.[path.length - 1] === "variable") {
        return {
          code,
          message: `${label}: el nombre de variable no es válido.`,
          hint: "Usa segmentos alfanuméricos separados por puntos (p. ej. entities.name).",
        };
      }
      return {
        code,
        message: `${label}: ${issue.message ?? "el valor no cumple el formato esperado."}`,
      };
    case "too_small":
      return {
        code,
        message:
          issue.type === "string"
            ? `${label}: el texto es demasiado corto (mínimo ${issue.minimum ?? "?"} caracteres).`
            : `${label}: faltan elementos (mínimo ${issue.minimum ?? "?"}).`,
      };
    case "unrecognized_keys":
      return {
        code,
        message: `${label}: contiene claves no permitidas que deben eliminarse.`,
        hint: issue.message ?? undefined,
      };
    default:
      return {
        code,
        message: `${label}: ${issue.message ?? "valor no válido."}`,
      };
  }
}

/**
 * Convierte el array de issues de un ZodError (o cualquier shape `unknown`
 * que lo contenga) en una lista de issues legibles. Tolerante a entradas
 * malformadas: devuelve `[]` si no puede interpretar la estructura.
 */
export function mapSchemaIssues(input: unknown): SchemaIssue[] {
  const issues = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as { issues?: unknown }).issues)
    ? (input as { issues: unknown[] }).issues
    : null;
  if (!issues) return [];
  return issues
    .filter((i): i is RawZodIssue => !!i && typeof i === "object")
    .map(mapOne);
}
