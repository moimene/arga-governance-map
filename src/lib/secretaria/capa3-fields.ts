import { expandLegalStructuredVariables } from "./legal-template-normalizer";

export interface NormalizedCapa3Field {
  campo: string;
  obligatoriedad: string;
  descripcion: string;
  tipo?: string;
  /**
   * Default value sugerido (Codex P2 round 5): permite que
   * `entity_settings` o `plantilla_capa3_overrides_por_entidad` propaguen un
   * valor por defecto al render del formulario. `buildDefaultCapa3Values`
   * lo aplica si el campo está vacío.
   */
  default?: string;
  min_items?: number;
  max_items?: number | null;
  item_schema?: Record<string, NormalizedCapa3ItemField>;
  /**
   * Lista cerrada de opciones permitidas (Codex P2 round 5): si está presente
   * y tiene >=1 elemento, `Capa3Form` renderiza un `<select>` en lugar de
   * `<input>`/`<textarea>`. Valores fuera de la lista quedan descartados.
   */
  opciones?: string[];
}

export interface NormalizedCapa3ItemField {
  key: string;
  tipo: string;
  label: string;
  help_text?: string;
  placeholder?: string;
  requerido: boolean;
  min_length?: number;
  options?: string[];
}

export type Capa3ArrayItem = Record<string, string>;
export type Capa3Value = string | Capa3ArrayItem[];
export type Capa3Values = Record<string, Capa3Value>;

export interface NormalizedCapa3Draft {
  values: Capa3Values;
  emptyKeys: string[];
  ignoredKeys: string[];
  legacyKeyMap: Record<string, string>;
  /**
   * Valores que llegaron informados pero quedaron fuera por no estar entre las
   * `opciones` del campo. Se conservan para poder avisar al usuario en vez de
   * perderlos en silencio (Codex adversarial P1).
   */
  discardedValues: Record<string, string>;
}

interface RawCapa3Field {
  campo?: unknown;
  obligatoriedad?: unknown;
  descripcion?: unknown;
  tipo?: unknown;
  label?: unknown;
  default?: unknown;
  opciones?: unknown;
  min_items?: unknown;
  max_items?: unknown;
  item_schema?: unknown;
  help_text?: unknown;
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

export function capa3ValueToText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (!isRecord(item)) return "";
        return Object.values(item)
          .map((entry) => normalizeDraftValue(entry))
          .filter(Boolean)
          .join(" · ");
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function capa3ValueHasContent(value: unknown) {
  if (Array.isArray(value)) {
    return value.some((item) => {
      if (typeof item === "string") return item.trim().length > 0;
      if (!isRecord(item)) return false;
      return Object.values(item).some((entry) => normalizeDraftValue(entry).length > 0);
    });
  }
  return capa3ValueToText(value).length > 0;
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

export function isArrayCapa3Field(
  field: Pick<NormalizedCapa3Field, "tipo" | "item_schema">,
) {
  const tipo = field.tipo?.toLowerCase();
  return tipo === "array" || tipo === "array_repeatable" || !!field.item_schema;
}

function normalizeOpciones(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    // Acepta strings y números; rechaza objects/arrays/null para no exponer
    // shapes complejos al render del <select>.
    if (typeof item === "string" || typeof item === "number") {
      const s = String(item).trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out.length > 0 ? out : undefined;
}

function normalizeInteger(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

function normalizeMaxItems(value: unknown): number | null | undefined {
  if (value === null) return null;
  return normalizeInteger(value);
}

function normalizeItemSchema(value: unknown): Record<string, NormalizedCapa3ItemField> | undefined {
  if (!isRecord(value)) return undefined;

  const schema: Record<string, NormalizedCapa3ItemField> = {};
  for (const [rawKey, rawSpec] of Object.entries(value)) {
    const key = rawKey.trim().slice(0, 120);
    if (!key || !SAFE_FIELD_NAME.test(key) || !isRecord(rawSpec)) continue;
    const spec = rawSpec as {
      tipo?: unknown;
      label?: unknown;
      help_text?: unknown;
      placeholder?: unknown;
      requerido?: unknown;
      min_length?: unknown;
      options?: unknown;
      opciones?: unknown;
    };
    const tipo = asString(spec.tipo, "text").trim().toLowerCase() || "text";
    const label = asString(spec.label).trim() || defaultDescription(key);
    const minLength = normalizeInteger(spec.min_length);
    const options = normalizeOpciones(spec.options ?? spec.opciones);
    schema[key] = {
      key,
      tipo,
      label,
      requerido: spec.requerido === true,
      ...(asString(spec.help_text).trim() ? { help_text: asString(spec.help_text).trim() } : {}),
      ...(asString(spec.placeholder).trim() ? { placeholder: asString(spec.placeholder).trim() } : {}),
      ...(minLength !== undefined ? { min_length: minLength } : {}),
      ...(options ? { options } : {}),
    };
  }

  return Object.keys(schema).length > 0 ? schema : undefined;
}

function parseArrayDraftValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed.startsWith("[")) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeArrayDraftValue(
  field: NormalizedCapa3Field,
  value: unknown,
): Capa3ArrayItem[] {
  const rawItems = parseArrayDraftValue(value);
  const schema = field.item_schema ?? {};
  const schemaKeys = Object.keys(schema);

  return rawItems
    .map((item) => {
      const row: Capa3ArrayItem = {};
      if (isRecord(item)) {
        const keys = schemaKeys.length > 0 ? schemaKeys : Object.keys(item);
        for (const key of keys) {
          const normalized = normalizeDraftValue(item[key]);
          if (normalized) row[key] = normalized;
        }
      } else if (typeof item === "string" && schemaKeys.length === 1) {
        const normalized = normalizeDraftValue(item);
        if (normalized) row[schemaKeys[0]] = normalized;
      }
      return row;
    })
    .filter((item) => Object.values(item).some((entry) => entry.trim().length > 0));
}

function normalizeCapa3Value(field: NormalizedCapa3Field, value: unknown): Capa3Value {
  if (isArrayCapa3Field(field)) return normalizeArrayDraftValue(field, value);
  const normalized = normalizeDraftValue(value);
  // Contrato `opciones` (lista cerrada): los valores fuera de la lista quedan
  // descartados también al normalizar drafts/seeds, no solo en `default`.
  // Sin este filtro, la expansión de alias legales (p.ej.
  // firma_organo_administracion → cargo_convocante en legal-template-normalizer)
  // siembra un valor inválido que el <select> no puede mostrar (renderiza como
  // "sin seleccionar") pero que validateCapa3 rechaza con "valor fuera de las
  // opciones permitidas" — un bloqueo invisible para el usuario.
  if (
    normalized &&
    field.opciones &&
    field.opciones.length > 0 &&
    !field.opciones.includes(normalized)
  ) {
    return "";
  }
  return normalized;
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

    const opciones = normalizeOpciones(raw.opciones);
    const tipo = asString(raw.tipo).trim().toLowerCase();
    const itemSchema = normalizeItemSchema(raw.item_schema);
    const minItems = normalizeInteger(raw.min_items);
    const maxItems = normalizeMaxItems(raw.max_items);
    // Codex P2 round 5+16: preservar `default` y `opciones`. Round 16: el
    // empty string "" es un override explícito válido (SQL contract:
    // NULL = no override, "" = clear el campo). Antes el truthiness check
    // `defaultValueRaw &&` lo descartaba.
    //
    // Distinguimos:
    //   raw.default === undefined → no override (skip)
    //   raw.default === null      → no override (skip)
    //   raw.default === ""        → override explícito (preservar "")
    //   raw.default === "value"   → override explícito (preservar)
    let defaultValue: string | undefined;
    if (raw.default !== undefined && raw.default !== null) {
      const normalized = normalizeDraftValue(raw.default); // boolean/number → string, trim
      // Si hay opciones explícitas y el default NO está vacío,
      // validar que esté dentro (defensa). "" siempre permitido (clear).
      if (normalized === "" || !opciones || opciones.includes(normalized)) {
        defaultValue = normalized;
      }
    }

    const entry: NormalizedCapa3Field = {
      campo,
      obligatoriedad: normalizeObligatoriedad(raw.obligatoriedad),
      descripcion:
        (asString(raw.descripcion).trim() ||
          asString(raw.help_text).trim() ||
          asString(raw.label).trim() ||
          defaultDescription(campo)).slice(0, 240),
    };
    if (tipo) entry.tipo = tipo;
    if (itemSchema) {
      entry.tipo = tipo || "array_repeatable";
      entry.item_schema = itemSchema;
    }
    if (minItems !== undefined) entry.min_items = minItems;
    if (maxItems !== undefined) entry.max_items = maxItems;
    if (defaultValue !== undefined) entry.default = defaultValue;
    if (opciones !== undefined) entry.opciones = opciones;
    normalized.push(entry);
  }

  return normalized;
}

export function normalizeCapa3Draft(
  fields: NormalizedCapa3Field[],
  draftValues: Record<string, unknown> | null | undefined,
): NormalizedCapa3Draft {
  const values: Capa3Values = {};
  const emptyKeys = new Set<string>();
  const ignoredKeys = new Set<string>();
  const legacyKeyMap: Record<string, string> = {};
  const discardedValues: Record<string, string> = {};
  const exactFields = new Set(fields.map((field) => field.campo));
  const canonicalFields = fields.reduce<Record<string, string>>((acc, field) => {
    const canonical = normalizeDraftKey(field.campo);
    if (canonical && !acc[canonical]) acc[canonical] = field.campo;
    return acc;
  }, {});
  const sourcePriority: Record<string, "exact" | "legacy"> = {};

  if (!draftValues || typeof draftValues !== "object" || Array.isArray(draftValues)) {
    return { values, emptyKeys: [], ignoredKeys: [], legacyKeyMap, discardedValues: {} };
  }

  for (const [rawKey, rawValue] of Object.entries(draftValues)) {
    const target = exactFields.has(rawKey) ? rawKey : canonicalFields[normalizeDraftKey(rawKey)];
    if (!target) {
      ignoredKeys.add(rawKey);
      continue;
    }

    const nextPriority = rawKey === target ? "exact" : "legacy";
    const previousPriority = sourcePriority[target];
    const field = fields.find((candidate) => candidate.campo === target);
    if (!field) {
      ignoredKeys.add(rawKey);
      continue;
    }
    const normalizedValue = normalizeCapa3Value(field, rawValue);

    // Codex adversarial (2ª pasada): la poda PARCIAL de un array también es
    // pérdida de datos. Antes solo se avisaba cuando el array se vaciaba por
    // completo, de modo que "10 filas entran, 3 sobreviven" pasaba en silencio
    // y el documento se generaba con siete filas menos sin que nadie lo supiera.
    if (isArrayCapa3Field(field) && Array.isArray(normalizedValue)) {
      const incoming = parseArrayDraftValue(rawValue).length;
      const dropped = incoming - normalizedValue.length;
      if (dropped > 0) {
        discardedValues[target] =
          `${dropped} de ${incoming} fila(s) no compatibles con el formato del campo`;
      }
    }

    if (!capa3ValueHasContent(normalizedValue)) {
      // Codex adversarial (P1): distinguir "vino vacío" de "traía un valor que
      // la lista cerrada rechaza". Sin esta distinción, un valor persistido
      // legítimo (borrador guardado, override de sociedad, sugerencia del
      // asistente) desaparecía en silencio y el documento se generaba sin él.
      if (isArrayCapa3Field(field)) {
        // Un array que llega como texto no parseable no pasa por el conteo de
        // filas de arriba; se avisa aquí con el valor literal.
        if (!Array.isArray(normalizedValue) || parseArrayDraftValue(rawValue).length === 0) {
          const discarded = normalizeDraftValue(rawValue);
          if (discarded) discardedValues[target] = discarded;
        }
      } else {
        const discarded = normalizeDraftValue(rawValue);
        if (discarded) discardedValues[target] = discarded;
      }
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
    discardedValues,
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
