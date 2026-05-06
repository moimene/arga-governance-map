import { expandLegalStructuredVariables } from "./legal-template-normalizer";

export interface NormalizedCapa3Field {
  campo: string;
  obligatoriedad: string;
  descripcion: string;
}

export interface NormalizedCapa3Draft {
  values: Record<string, string>;
  emptyKeys: string[];
  ignoredKeys: string[];
  legacyKeyMap: Record<string, string>;
}

interface RawCapa3Field {
  campo?: unknown;
  obligatoriedad?: unknown;
  descripcion?: unknown;
  tipo?: unknown;
  label?: unknown;
}

const SAFE_FIELD_NAME = /^[a-zA-Z_][a-zA-Z0-9_.-]*$/;
const DEFAULT_OBLIGATORIEDAD = "OPCIONAL";
const KNOWN_OBLIGATORIEDAD = new Set([
  "OBLIGATORIO",
  "RECOMENDADO",
  "OPCIONAL",
  "OBLIGATORIO_SI_TELEMATICA",
]);

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function defaultDescription(campo: string) {
  return campo.replace(/_/g, " ");
}

function normalizeObligatoriedad(value: unknown) {
  const normalized = asString(value, DEFAULT_OBLIGATORIEDAD).trim().toUpperCase();
  return KNOWN_OBLIGATORIEDAD.has(normalized) ? normalized : DEFAULT_OBLIGATORIEDAD;
}

function normalizeDraftKey(value: unknown) {
  return asString(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeDraftValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function stripListPrefix(value: string) {
  return value.replace(/^(?:[-*]|\d+[.)-])\s*/, "").trim();
}

function recordText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeDraftValue(record[key]);
    if (value) return value;
  }
  return "";
}

function structuredListText(value: unknown, textKeys: string[]) {
  if (!Array.isArray(value)) return "";

  return value
    .map((item, index) => {
      if (typeof item === "string") return stripListPrefix(item);
      if (!isRecord(item)) return "";

      const text = recordText(item, textKeys);
      if (!text) return "";

      const ordinal =
        normalizeDraftValue(item.ordinal) ||
        normalizeDraftValue(item.order_number) ||
        normalizeDraftValue(item.agenda_item_index) ||
        String(index + 1);
      return `${ordinal}. ${stripListPrefix(text)}`;
    })
    .filter(Boolean)
    .join("\n");
}

function enrichStructuredTextValues(values: Record<string, unknown>) {
  const output = { ...values };

  if (!hasText(output.orden_dia_texto)) {
    const text = structuredListText(output.orden_dia ?? output.agenda_items ?? output.puntos_orden_dia, [
      "descripcion_punto",
      "titulo",
      "title",
      "resolution_text",
      "texto",
      "description",
      "materia",
    ]);
    if (text) output.orden_dia_texto = text;
  }

  if (!hasText(output.acuerdos_texto)) {
    const text = structuredListText(output.acuerdos ?? output.snapshot_puntos ?? output.snapshot_certificables, [
      "texto",
      "resolution_text",
      "titulo",
      "title",
      "descripcion_punto",
      "materia",
    ]);
    if (text) output.acuerdos_texto = text;
  }

  if (!hasText(output.miembros_presentes_texto)) {
    const text = structuredListText(output.miembros_presentes ?? output.asistentes ?? output.attendees, [
      "nombre",
      "full_name",
      "name",
      "person_name",
      "cargo",
      "role",
    ]);
    if (text) output.miembros_presentes_texto = text;
  }

  return output;
}

export function isRequiredCapa3Field(field: Pick<NormalizedCapa3Field, "obligatoriedad">) {
  return field.obligatoriedad === "OBLIGATORIO";
}

export function normalizeCapa3Fields(value: unknown): NormalizedCapa3Field[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: NormalizedCapa3Field[] = [];

  for (const field of value) {
    if (!isRecord(field)) continue;
    const raw = field as RawCapa3Field;
    const campo = asString(raw.campo).trim().slice(0, 120);
    if (!campo || !SAFE_FIELD_NAME.test(campo) || seen.has(campo)) continue;
    seen.add(campo);

    normalized.push({
      campo,
      obligatoriedad: normalizeObligatoriedad(raw.obligatoriedad),
      descripcion:
        (asString(raw.descripcion).trim() ||
          asString(raw.label).trim() ||
          defaultDescription(campo)).slice(0, 240),
    });
  }

  return normalized;
}

export function normalizeCapa3Draft(
  fields: NormalizedCapa3Field[],
  draftValues: Record<string, unknown> | null | undefined,
): NormalizedCapa3Draft {
  const values: Record<string, string> = {};
  const emptyKeys = new Set<string>();
  const ignoredKeys = new Set<string>();
  const legacyKeyMap: Record<string, string> = {};
  const exactFields = new Set(fields.map((field) => field.campo));
  const canonicalFields = fields.reduce<Record<string, string>>((acc, field) => {
    const canonical = normalizeDraftKey(field.campo);
    if (canonical && !acc[canonical]) acc[canonical] = field.campo;
    return acc;
  }, {});
  const sourcePriority: Record<string, "exact" | "legacy"> = {};

  if (!draftValues || typeof draftValues !== "object" || Array.isArray(draftValues)) {
    return { values, emptyKeys: [], ignoredKeys: [], legacyKeyMap };
  }

  for (const [rawKey, rawValue] of Object.entries(draftValues)) {
    const target = exactFields.has(rawKey) ? rawKey : canonicalFields[normalizeDraftKey(rawKey)];
    if (!target) {
      ignoredKeys.add(rawKey);
      continue;
    }

    const nextPriority = rawKey === target ? "exact" : "legacy";
    const previousPriority = sourcePriority[target];
    const normalizedValue = normalizeDraftValue(rawValue);

    if (!normalizedValue) {
      emptyKeys.add(target);
      continue;
    }
    if (previousPriority === "exact" && nextPriority === "legacy") continue;

    values[target] = normalizedValue;
    sourcePriority[target] = nextPriority;
    if (rawKey !== target) legacyKeyMap[rawKey] = target;
  }

  return {
    values,
    emptyKeys: Array.from(emptyKeys).sort(),
    ignoredKeys: Array.from(ignoredKeys).sort(),
    legacyKeyMap,
  };
}

export function buildInitialCapa3Values(
  fields: NormalizedCapa3Field[],
  seedValues: Record<string, unknown> = {},
) {
  const expanded = expandLegalStructuredVariables(seedValues);
  const enriched = enrichStructuredTextValues({ ...expanded, ...seedValues });
  return normalizeCapa3Draft(fields, enriched).values;
}
