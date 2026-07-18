import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import type { PlantillaCandidate } from "@/lib/secretaria/template-admin/types";
import {
  TEMPLATE_EXPRESSION_PATTERN,
  referenceNamesFromTemplateExpression,
  templateExpressionBody,
} from "@/lib/secretaria/template-admin/template-expression-vars";

// Contrato de presentación sincronizado con gate-pre.ts. Se mantiene local
// porque esos detalles internos no forman parte de la API pública del Gate.
const HELPER_ALLOWLIST = new Set(["if", "else", "each", "unless", "with"]);
const PROTECTED_PREFIXES = ["ENTIDAD.", "ORGANO.", "REUNION.", "EXPEDIENTE.", "SISTEMA.", "QTSP."];

type LayerKeyStyle = "spanish" | "english";

type LayerRowMeta = {
  raw: Record<string, unknown>;
  keys: Record<string, string[]>;
  style: LayerKeyStyle;
  original: Record<string, unknown>;
};

export interface NormalizedCapa2Row {
  variable: string;
  fuente: string;
  condicion: string;
  obligatoriedad: string;
  required: boolean | null;
  descripcionJuridica: string;
  fallback: unknown;
  __meta: LayerRowMeta;
}

export interface NormalizedCapa3Row {
  campo: string;
  descripcion: string;
  obligatoriedad: string;
  required: boolean | null;
  tipo: string;
  label: string;
  defaultValue: unknown;
  opciones: unknown[] | null;
  __meta: LayerRowMeta;
}

export type Capa1ReferenceKind = "value" | "block";

export interface Capa1VariableReference {
  name: string;
  kind: Capa1ReferenceKind;
  helper: string | null;
  raw: string;
  start: number;
  end: number;
}

export interface Capa1BlockHelper {
  name: string;
  allowed: boolean;
  raw: string;
  start: number;
  end: number;
}

export type TemplateNamespaceFamily =
  | "entity"
  | "body"
  | "meeting"
  | "case"
  | "system"
  | "trust"
  | "manual"
  | "other";

export interface TemplateNamespacePresentation {
  code: string;
  label: string;
  family: TemplateNamespaceFamily;
}

export interface Capa1TextToken {
  kind: "text";
  text: string;
  start: number;
  end: number;
}

export interface Capa1ExpressionToken {
  kind: "expression";
  text: string;
  start: number;
  end: number;
  references: Capa1VariableReference[];
  helper: Capa1BlockHelper | null;
  namespace: TemplateNamespacePresentation | null;
}

export type Capa1Token = Capa1TextToken | Capa1ExpressionToken;

export interface Capa2UsagePresentation {
  used: boolean;
  mode: "exact" | "wildcard" | "unused";
  count: number;
  references: string[];
  label: string;
}

export interface Capa2RequirementPresentation {
  label: string;
  source: "explicit" | "condition" | "unknown";
  required: boolean | null;
}

export type Capa3RowIssueCode =
  | "CAPA3_FIELD_REQUIRED"
  | "CAPA3_DUPLICATE_FIELD"
  | "CAPA3_PROTECTED_PREFIX"
  | "CAPA3_DESCRIPTION_REQUIRED";

export interface Capa3RowIssue {
  code: Capa3RowIssueCode;
  severity: "BLOCKING" | "WARNING";
  message: string;
}

export interface Capa3RowValidation {
  index: number;
  campo: string;
  invalid: boolean;
  issues: Capa3RowIssue[];
}

const CAPA2_ALIASES = {
  variable: ["variable", "name"],
  fuente: ["fuente", "source"],
  condicion: ["condicion", "condition"],
  requirement: ["obligatoria", "obligatorio", "required", "requerido", "obligatoriedad"],
  description: [
    "descripcion_juridica",
    "descripcionJuridica",
    "descripcion",
    "description",
    "display",
  ],
  fallback: ["fallback", "valor_fallback", "fallbackValue"],
} as const;

const CAPA3_ALIASES = {
  campo: ["campo", "name", "field"],
  description: ["descripcion", "description", "hint"],
  requirement: ["required", "requerido", "obligatoriedad"],
  tipo: ["tipo", "type"],
  label: ["label", "display"],
  defaultValue: ["default", "valor_defecto", "defaultValue"],
  opciones: ["opciones", "options"],
} as const;

const SPANISH_KEYS = new Set([
  "variable",
  "fuente",
  "condicion",
  "obligatoria",
  "obligatorio",
  "requerido",
  "obligatoriedad",
  "descripcion_juridica",
  "descripcionJuridica",
  "descripcion",
  "valor_fallback",
  "campo",
  "tipo",
  "valor_defecto",
  "opciones",
]);

const ENGLISH_KEYS = new Set([
  "name",
  "source",
  "condition",
  "required",
  "description",
  "display",
  "fallback",
  "fallbackValue",
  "field",
  "hint",
  "type",
  "default",
  "defaultValue",
  "options",
]);

const REQUIREMENT_TRUE = new Set([
  "1",
  "OBLIGATORIA",
  "OBLIGATORIO",
  "REQUIRED",
  "SI",
  "SÍ",
  "SIEMPRE",
  "TRUE",
]);

const REQUIREMENT_FALSE = new Set([
  "0",
  "FALSE",
  "NO",
  "OPCIONAL",
  "OPTIONAL",
]);

const SOURCE_NAMESPACE: Array<{
  prefixes: string[];
  presentation: TemplateNamespacePresentation;
}> = [
  {
    prefixes: ["secretario_manual", "manual.", "manual_"],
    presentation: { code: "MANUAL", label: "Introducción manual", family: "manual" },
  },
  {
    prefixes: ["entities.", "entity_settings.", "secretaria_entity_settings."],
    presentation: { code: "ENTIDAD", label: "Entidad", family: "entity" },
  },
  {
    prefixes: ["governing_bodies.", "body_members.", "bodies."],
    presentation: { code: "ORGANO", label: "Órgano", family: "body" },
  },
  {
    prefixes: ["meetings.", "meeting_"],
    presentation: { code: "REUNION", label: "Reunión", family: "meeting" },
  },
  {
    prefixes: ["agreements.", "case_files.", "minutes.", "certifications.", "expedientes."],
    presentation: { code: "EXPEDIENTE", label: "Expediente", family: "case" },
  },
  {
    prefixes: ["qtsp.", "ead_trust."],
    presentation: { code: "QTSP", label: "Servicios de confianza", family: "trust" },
  },
  {
    prefixes: ["system.", "sistema."],
    presentation: { code: "SISTEMA", label: "Sistema", family: "system" },
  },
];

const VARIABLE_NAMESPACE: Record<string, TemplateNamespacePresentation> = {
  ENTIDAD: { code: "ENTIDAD", label: "Entidad", family: "entity" },
  ORGANO: { code: "ORGANO", label: "Órgano", family: "body" },
  REUNION: { code: "REUNION", label: "Reunión", family: "meeting" },
  EXPEDIENTE: { code: "EXPEDIENTE", label: "Expediente", family: "case" },
  QTSP: { code: "QTSP", label: "Servicios de confianza", family: "trust" },
  SISTEMA: { code: "SISTEMA", label: "Sistema", family: "system" },
  MOTOR: { code: "MOTOR", label: "Regla aplicable", family: "system" },
  USUARIO: { code: "USUARIO", label: "Usuario", family: "system" },
  REGISTRO: { code: "REGISTRO", label: "Registro", family: "case" },
  CUENTAS: { code: "CUENTAS", label: "Cuentas", family: "case" },
  CERTIFICACION: { code: "CERTIFICACION", label: "Certificación", family: "case" },
  ACUERDO: { code: "ACUERDO", label: "Acuerdo", family: "case" },
  ACTO: { code: "ACTO", label: "Acto", family: "case" },
  DECISION: { code: "DECISION", label: "Decisión", family: "case" },
  DELEGACION: { code: "DELEGACION", label: "Delegación", family: "case" },
  COAP: { code: "COAP", label: "Coaprobación", family: "case" },
  OV: { code: "OV", label: "Órgano y voto", family: "case" },
  ADMIN: { code: "ADMIN", label: "Administración", family: "body" },
  ADMIN_SOLIDARIO: {
    code: "ADMIN_SOLIDARIO",
    label: "Administrador solidario",
    family: "body",
  },
  SOCIO_UNICO: { code: "SOCIO_UNICO", label: "Socio único", family: "entity" },
};

const OTHER_NAMESPACE: TemplateNamespacePresentation = {
  code: "OTRO",
  label: "Otra fuente",
  family: "other",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeString(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function ownKeys(raw: Record<string, unknown>, aliases: readonly string[]) {
  return aliases.filter((key) => Object.prototype.hasOwnProperty.call(raw, key));
}

function firstAliasValue(raw: Record<string, unknown>, aliases: readonly string[]) {
  const key = ownKeys(raw, aliases)[0];
  return key ? raw[key] : undefined;
}

function keyStyle(raw: Record<string, unknown>): LayerKeyStyle {
  let spanish = 0;
  let english = 0;
  for (const key of Object.keys(raw)) {
    if (SPANISH_KEYS.has(key)) spanish += 1;
    if (ENGLISH_KEYS.has(key)) english += 1;
  }
  return english > spanish ? "english" : "spanish";
}

function normalizedRequirement(value: unknown): { text: string; required: boolean | null } {
  if (typeof value === "boolean") {
    return { text: value ? "OBLIGATORIO" : "OPCIONAL", required: value };
  }
  const text = safeString(value).trim();
  const normalized = text.toLocaleUpperCase("es");
  if (REQUIREMENT_TRUE.has(normalized)) return { text, required: true };
  if (REQUIREMENT_FALSE.has(normalized)) return { text, required: false };
  if (/^(OBLIGATORI[OA]_SI|CONDICIONAL)/u.test(normalized)) {
    return { text, required: null };
  }
  return { text, required: null };
}

function normalizedRequirementFromRaw(
  raw: Record<string, unknown>,
  aliases: readonly string[],
) {
  const keys = ownKeys(raw, aliases);
  const explicitKey = keys.find(
    (key) => typeof raw[key] === "string" && String(raw[key]).trim().length > 0,
  );
  const booleanKey = keys.find((key) => typeof raw[key] === "boolean");
  const parsed = normalizedRequirement(
    explicitKey ? raw[explicitKey] : booleanKey ? raw[booleanKey] : undefined,
  );
  return {
    text: parsed.text,
    required:
      parsed.required ??
      (booleanKey ? (raw[booleanKey] as boolean) : null),
  };
}

function valuesEqual(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function updateAliases(
  output: Record<string, unknown>,
  aliases: string[],
  fallbackKey: string,
  value: unknown,
  changed: boolean,
  shouldAdd = true,
) {
  if (!changed) return;
  if (aliases.length > 0) {
    for (const key of aliases) output[key] = value;
    return;
  }
  if (shouldAdd) output[fallbackKey] = value;
}

function requirementValueForKey(
  key: string,
  original: unknown,
  text: string,
  required: boolean | null,
) {
  if (typeof original === "boolean") return required ?? false;
  if (["required", "requerido", "obligatoria", "obligatorio"].includes(key) && required !== null) {
    return required;
  }
  return text;
}

function applyRequirement(
  output: Record<string, unknown>,
  keys: string[],
  style: LayerKeyStyle,
  originalRaw: Record<string, unknown>,
  text: string,
  required: boolean | null,
  changed: boolean,
) {
  if (!changed) return;
  const parsedRequired = normalizedRequirement(text).required;
  const effectiveRequired = parsedRequired ?? required;
  if (keys.length > 0) {
    for (const key of keys) {
      output[key] = requirementValueForKey(key, originalRaw[key], text, effectiveRequired);
    }
    const hasTextualAlias = keys.some((key) => typeof originalRaw[key] === "string");
    if (text && parsedRequired === null && !hasTextualAlias) {
      // Un booleano legacy solo puede expresar obligatorio/opcional. Si el
      // editor elige una semántica más rica, conservar el booleano original y
      // añadir la clave textual evita confirmar un cambio que se perdería al
      // recargar.
      output.obligatoriedad = text;
    }
    return;
  }
  if (!text && effectiveRequired === null) return;
  const key = style === "english" ? "required" : "obligatoriedad";
  output[key] = key === "required" && effectiveRequired !== null ? effectiveRequired : text;
}

function normalizeCapa2Row(raw: Record<string, unknown>): NormalizedCapa2Row {
  const requirement = normalizedRequirementFromRaw(raw, CAPA2_ALIASES.requirement);
  const row: NormalizedCapa2Row = {
    variable: safeString(firstAliasValue(raw, CAPA2_ALIASES.variable)),
    fuente: safeString(firstAliasValue(raw, CAPA2_ALIASES.fuente)),
    condicion: safeString(firstAliasValue(raw, CAPA2_ALIASES.condicion)),
    obligatoriedad: requirement.text,
    required: requirement.required,
    descripcionJuridica: safeString(firstAliasValue(raw, CAPA2_ALIASES.description)),
    fallback: firstAliasValue(raw, CAPA2_ALIASES.fallback),
    __meta: {
      raw: { ...raw },
      keys: {
        variable: ownKeys(raw, CAPA2_ALIASES.variable),
        fuente: ownKeys(raw, CAPA2_ALIASES.fuente),
        condicion: ownKeys(raw, CAPA2_ALIASES.condicion),
        requirement: ownKeys(raw, CAPA2_ALIASES.requirement),
        description: ownKeys(raw, CAPA2_ALIASES.description),
        fallback: ownKeys(raw, CAPA2_ALIASES.fallback),
      },
      style: keyStyle(raw),
      original: {},
    },
  };
  row.__meta.original = {
    variable: row.variable,
    fuente: row.fuente,
    condicion: row.condicion,
    obligatoriedad: row.obligatoriedad,
    required: row.required,
    descripcionJuridica: row.descripcionJuridica,
    fallback: row.fallback,
  };
  return row;
}

function normalizeCapa3Row(raw: Record<string, unknown>): NormalizedCapa3Row {
  const requirement = normalizedRequirementFromRaw(raw, CAPA3_ALIASES.requirement);
  const options = firstAliasValue(raw, CAPA3_ALIASES.opciones);
  const row: NormalizedCapa3Row = {
    campo: safeString(firstAliasValue(raw, CAPA3_ALIASES.campo)),
    descripcion: safeString(firstAliasValue(raw, CAPA3_ALIASES.description)),
    obligatoriedad: requirement.text,
    required: requirement.required,
    tipo: safeString(firstAliasValue(raw, CAPA3_ALIASES.tipo)),
    label: safeString(firstAliasValue(raw, CAPA3_ALIASES.label)),
    defaultValue: firstAliasValue(raw, CAPA3_ALIASES.defaultValue),
    opciones: Array.isArray(options) ? options : null,
    __meta: {
      raw: { ...raw },
      keys: {
        campo: ownKeys(raw, CAPA3_ALIASES.campo),
        description: ownKeys(raw, CAPA3_ALIASES.description),
        requirement: ownKeys(raw, CAPA3_ALIASES.requirement),
        tipo: ownKeys(raw, CAPA3_ALIASES.tipo),
        label: ownKeys(raw, CAPA3_ALIASES.label),
        defaultValue: ownKeys(raw, CAPA3_ALIASES.defaultValue),
        opciones: ownKeys(raw, CAPA3_ALIASES.opciones),
      },
      style: keyStyle(raw),
      original: {},
    },
  };
  row.__meta.original = {
    campo: row.campo,
    descripcion: row.descripcion,
    obligatoriedad: row.obligatoriedad,
    required: row.required,
    tipo: row.tipo,
    label: row.label,
    defaultValue: row.defaultValue,
    opciones: row.opciones,
  };
  return row;
}

export function normalizeCapa2Rows(value: unknown): NormalizedCapa2Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map(normalizeCapa2Row);
}

export function normalizeCapa3Rows(value: unknown): NormalizedCapa3Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map(normalizeCapa3Row);
}

export function serializeCapa2Rows(rows: readonly NormalizedCapa2Row[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const { raw, keys, style, original } = row.__meta;
    const output = { ...raw };
    updateAliases(
      output,
      keys.variable,
      style === "english" ? "name" : "variable",
      row.variable,
      row.variable !== original.variable,
      !!row.variable,
    );
    updateAliases(
      output,
      keys.fuente,
      style === "english" ? "source" : "fuente",
      row.fuente,
      row.fuente !== original.fuente,
      !!row.fuente,
    );
    updateAliases(
      output,
      keys.condicion,
      style === "english" ? "condition" : "condicion",
      row.condicion,
      row.condicion !== original.condicion,
      !!row.condicion,
    );
    applyRequirement(
      output,
      keys.requirement,
      style,
      raw,
      row.obligatoriedad,
      row.required,
      row.obligatoriedad !== original.obligatoriedad || row.required !== original.required,
    );
    updateAliases(
      output,
      keys.description,
      style === "english" ? "description" : "descripcion_juridica",
      row.descripcionJuridica,
      row.descripcionJuridica !== original.descripcionJuridica,
      !!row.descripcionJuridica,
    );
    updateAliases(
      output,
      keys.fallback,
      "fallback",
      row.fallback,
      !valuesEqual(row.fallback, original.fallback),
      row.fallback !== undefined,
    );
    return output;
  });
}

export function serializeCapa3Rows(rows: readonly NormalizedCapa3Row[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const { raw, keys, style, original } = row.__meta;
    const output = { ...raw };
    updateAliases(
      output,
      keys.campo,
      style === "english" ? "field" : "campo",
      row.campo,
      row.campo !== original.campo,
      !!row.campo,
    );
    updateAliases(
      output,
      keys.description,
      style === "english" ? "description" : "descripcion",
      row.descripcion,
      row.descripcion !== original.descripcion,
      !!row.descripcion,
    );
    applyRequirement(
      output,
      keys.requirement,
      style,
      raw,
      row.obligatoriedad,
      row.required,
      row.obligatoriedad !== original.obligatoriedad || row.required !== original.required,
    );
    updateAliases(
      output,
      keys.tipo,
      style === "english" ? "type" : "tipo",
      row.tipo,
      row.tipo !== original.tipo,
      !!row.tipo,
    );
    updateAliases(
      output,
      keys.label,
      "label",
      row.label,
      row.label !== original.label,
      !!row.label,
    );
    updateAliases(
      output,
      keys.defaultValue,
      "default",
      row.defaultValue,
      !valuesEqual(row.defaultValue, original.defaultValue),
      row.defaultValue !== undefined,
    );
    updateAliases(
      output,
      keys.opciones,
      style === "english" ? "options" : "opciones",
      row.opciones,
      !valuesEqual(row.opciones, original.opciones),
      row.opciones !== null,
    );
    return output;
  });
}

function canonicalCapa2(rows: readonly NormalizedCapa2Row[]) {
  return serializeCapa2Rows(rows).map((raw, index) => ({
    ...raw,
    variable: rows[index].variable.trim(),
    fuente: rows[index].fuente.trim(),
    condicion: rows[index].condicion.trim() || "SIEMPRE",
  }));
}

function canonicalCapa3(rows: readonly NormalizedCapa3Row[]) {
  return serializeCapa3Rows(rows).map((raw, index) => {
    const row = rows[index];
    const obligatoriedad =
      row.obligatoriedad.trim() ||
      (row.required === true ? "OBLIGATORIO" : row.required === false ? "OPCIONAL" : "");
    return {
      ...raw,
      campo: row.campo.trim(),
      descripcion: row.descripcion.trim(),
      obligatoriedad,
    };
  });
}

export function buildTemplateLayerGateCandidate(
  template: PlantillaProtegidaRow,
  capa1: string,
  capa2: readonly NormalizedCapa2Row[],
  capa3: readonly NormalizedCapa3Row[],
): PlantillaCandidate {
  return {
    id: template.id,
    tipo: template.tipo,
    materia: template.materia,
    materia_acuerdo: template.materia_acuerdo,
    jurisdiccion: template.jurisdiccion,
    version: template.version,
    estado: template.estado,
    organo_tipo: template.organo_tipo,
    adoption_mode: template.adoption_mode,
    tipo_social: template.tipo_social,
    aprobada_por: template.aprobada_por,
    fecha_aprobacion: template.fecha_aprobacion,
    referencia_legal: template.referencia_legal,
    capa1_inmutable: capa1,
    capa2_variables: canonicalCapa2(capa2),
    capa3_editables: canonicalCapa3(capa3),
  };
}

function blockHelperFromExpression(raw: string, start: number, end: number) {
  const body = templateExpressionBody(raw);
  const match = /^#([A-Za-z_][A-Za-z0-9_]*)\b/.exec(body);
  if (!match) return null;
  return {
    name: match[1],
    allowed: HELPER_ALLOWLIST.has(match[1]),
    raw,
    start,
    end,
  } satisfies Capa1BlockHelper;
}

export function extractCapa1VariableReferences(text: string): Capa1VariableReference[] {
  const references: Capa1VariableReference[] = [];
  const pattern = new RegExp(TEMPLATE_EXPRESSION_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;
    const body = templateExpressionBody(raw);
    const helper = /^#([A-Za-z_][A-Za-z0-9_]*)\b/.exec(body)?.[1] ?? null;
    for (const name of referenceNamesFromTemplateExpression(body)) {
      references.push({
        name,
        kind: helper ? "block" : "value",
        helper,
        raw,
        start,
        end,
      });
    }
  }
  return references;
}

export function extractCapa1BlockHelpers(text: string): Capa1BlockHelper[] {
  const helpers: Capa1BlockHelper[] = [];
  const pattern = new RegExp(TEMPLATE_EXPRESSION_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const helper = blockHelperFromExpression(
      match[0],
      match.index,
      match.index + match[0].length,
    );
    if (helper) helpers.push(helper);
  }
  return helpers;
}

export function listCapa1VariableNames(text: string) {
  return [...new Set(extractCapa1VariableReferences(text).map((reference) => reference.name))].sort(
    (left, right) => left.localeCompare(right, "es"),
  );
}

export function variableDeclarationMatchesReference(declaration: string, reference: string) {
  const normalizedDeclaration = declaration.trim();
  const normalizedReference = reference.trim();
  if (!normalizedDeclaration || !normalizedReference) return false;
  if (normalizedDeclaration === normalizedReference) return true;
  if (!normalizedDeclaration.endsWith(".*")) return false;
  return normalizedReference.startsWith(normalizedDeclaration.slice(0, -1));
}

export function capa2UsagePresentation(
  row: Pick<NormalizedCapa2Row, "variable">,
  textOrReferences: string | readonly Capa1VariableReference[],
): Capa2UsagePresentation {
  const references =
    typeof textOrReferences === "string"
      ? extractCapa1VariableReferences(textOrReferences)
      : [...textOrReferences];
  const matches = references.filter((reference) =>
    variableDeclarationMatchesReference(row.variable, reference.name),
  );
  const wildcard = row.variable.trim().endsWith(".*");
  const names = [...new Set(matches.map((reference) => reference.name))];
  if (matches.length === 0) {
    return {
      used: false,
      mode: "unused",
      count: 0,
      references: [],
      label: "No usada en el texto",
    };
  }
  return {
    used: true,
    mode: wildcard ? "wildcard" : "exact",
    count: matches.length,
    references: names,
    label: wildcard
      ? `Usada por comodín (${matches.length})`
      : matches.length === 1
        ? "Usada una vez"
        : `Usada ${matches.length} veces`,
  };
}

function humanizeRequirement(value: string) {
  const compact = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!compact) return "";
  const lower = compact.toLocaleLowerCase("es");
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}

export function capa2RequirementPresentation(
  row: Pick<NormalizedCapa2Row, "obligatoriedad" | "required" | "condicion">,
): Capa2RequirementPresentation {
  const explicit = row.obligatoriedad.trim();
  const normalized = explicit.toLocaleUpperCase("es");
  if (explicit) {
    if (/^(OBLIGATORI[OA]_SI|CONDICIONAL)/u.test(normalized)) {
      return { label: "Condicional", source: "explicit", required: null };
    }
    if (normalized === "RECOMENDADO" || normalized === "RECOMENDADA") {
      return { label: "Recomendada", source: "explicit", required: null };
    }
    if (REQUIREMENT_TRUE.has(normalized)) {
      return { label: "Obligatoria", source: "explicit", required: true };
    }
    if (REQUIREMENT_FALSE.has(normalized)) {
      return { label: "Opcional", source: "explicit", required: false };
    }
    if (row.required === true) {
      return { label: "Obligatoria", source: "explicit", required: true };
    }
    if (row.required === false) {
      return { label: "Opcional", source: "explicit", required: false };
    }
    return { label: humanizeRequirement(explicit), source: "explicit", required: null };
  }

  const condition = row.condicion.trim().toLocaleUpperCase("es");
  if (condition === "SIEMPRE" || condition === "ALWAYS") {
    return { label: "Siempre", source: "condition", required: null };
  }
  if (condition) {
    return { label: "Condicional", source: "condition", required: null };
  }
  return { label: "No informada", source: "unknown", required: null };
}

export function classifyTemplateVariableNamespace(
  variable: string,
  fuente?: string | null,
): TemplateNamespacePresentation {
  const root = variable.trim().split(".")[0]?.toLocaleUpperCase("es") ?? "";
  if (VARIABLE_NAMESPACE[root]) return VARIABLE_NAMESPACE[root];

  const normalizedVariable = variable.trim().toLocaleLowerCase("es");
  for (const entry of SOURCE_NAMESPACE) {
    if (entry.prefixes.some((prefix) => normalizedVariable.startsWith(prefix))) {
      return entry.presentation;
    }
  }

  const normalizedSource = fuente?.trim().toLocaleLowerCase("es") ?? "";
  for (const entry of SOURCE_NAMESPACE) {
    if (entry.prefixes.some((prefix) => normalizedSource.startsWith(prefix))) {
      return entry.presentation;
    }
  }
  return OTHER_NAMESPACE;
}

export function capa2SourceLabel(
  row: Pick<NormalizedCapa2Row, "variable" | "fuente">,
) {
  return classifyTemplateVariableNamespace(row.variable, row.fuente).label;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  boolean: "Sí / No",
  booleano: "Sí / No",
  checkbox: "Sí / No",
  currency: "Importe",
  date: "Fecha",
  email: "Correo electrónico",
  enum: "Lista de opciones",
  fecha: "Fecha",
  long_text: "Texto largo",
  moneda: "Importe",
  multi_select: "Selección múltiple",
  number: "Número",
  numero: "Número",
  número: "Número",
  select: "Lista de opciones",
  selector: "Lista de opciones",
  string: "Texto",
  text: "Texto",
  textarea: "Texto largo",
  texto: "Texto",
  texto_largo: "Texto largo",
  url: "Enlace",
};

export function templateFieldTypeLabel(value?: string | null) {
  const normalized = value?.trim().toLocaleLowerCase("es") ?? "";
  if (!normalized) return "No informado";
  if (FIELD_TYPE_LABELS[normalized]) return FIELD_TYPE_LABELS[normalized];
  return humanizeRequirement(normalized);
}

export function tokenizeCapa1(
  text: string,
  capa2: readonly NormalizedCapa2Row[] = [],
): Capa1Token[] {
  if (!text) return [];
  const tokens: Capa1Token[] = [];
  const references = extractCapa1VariableReferences(text);
  const helpers = extractCapa1BlockHelpers(text);
  const pattern = new RegExp(TEMPLATE_EXPRESSION_PATTERN.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      tokens.push({
        kind: "text",
        text: text.slice(cursor, match.index),
        start: cursor,
        end: match.index,
      });
    }
    const start = match.index;
    const end = start + match[0].length;
    const tokenReferences = references.filter(
      (reference) => reference.start === start && reference.end === end,
    );
    const helper = helpers.find((item) => item.start === start && item.end === end) ?? null;
    const firstReference = tokenReferences[0];
    const declaration = firstReference
      ? capa2.find((row) => variableDeclarationMatchesReference(row.variable, firstReference.name))
      : undefined;
    tokens.push({
      kind: "expression",
      text: match[0],
      start,
      end,
      references: tokenReferences,
      helper,
      namespace: firstReference
        ? classifyTemplateVariableNamespace(firstReference.name, declaration?.fuente)
        : null,
    });
    cursor = end;
  }
  if (cursor < text.length) {
    tokens.push({ kind: "text", text: text.slice(cursor), start: cursor, end: text.length });
  }
  return tokens;
}

export function validateCapa3Rows(rows: readonly NormalizedCapa3Row[]): Capa3RowValidation[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.campo.trim().toLocaleUpperCase("es");
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return rows.map((row, index) => {
    const issues: Capa3RowIssue[] = [];
    const campo = row.campo.trim();
    const normalized = campo.toLocaleUpperCase("es");
    if (!campo) {
      issues.push({
        code: "CAPA3_FIELD_REQUIRED",
        severity: "BLOCKING",
        message: "Indica el identificador del campo editable.",
      });
    } else {
      if ((counts.get(normalized) ?? 0) > 1) {
        issues.push({
          code: "CAPA3_DUPLICATE_FIELD",
          severity: "BLOCKING",
          message: `El campo '${campo}' está duplicado en Capa 3.`,
        });
      }
      if (PROTECTED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
        issues.push({
          code: "CAPA3_PROTECTED_PREFIX",
          severity: "BLOCKING",
          message: `El campo '${campo}' usa un prefijo reservado para variables automáticas.`,
        });
      }
    }
    if (!row.descripcion.trim()) {
      issues.push({
        code: "CAPA3_DESCRIPTION_REQUIRED",
        severity: "WARNING",
        message: "Añade una descripción jurídica para que el uso del campo sea comprensible.",
      });
    }
    return {
      index,
      campo,
      invalid: issues.some((issue) => issue.severity === "BLOCKING"),
      issues,
    };
  });
}
