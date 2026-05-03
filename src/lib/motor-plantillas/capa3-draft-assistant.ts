import type { NormalizedCapa3Field } from "@/lib/secretaria/capa3-fields";
import type { SecretariaDocumentType } from "@/lib/secretaria/document-generation-boundary";

export type Capa3DraftAssistantMode = "LOCAL_DEMO" | "MODEL_ADAPTER";

export interface Capa3DraftSuggestion {
  field: string;
  value: string;
  reason: string;
  confidence: number;
  requiresHumanReview: true;
}

export interface Capa3DraftAssistantProviderInput {
  fields: NormalizedCapa3Field[];
  currentValues: Record<string, string>;
  baseVariables: Record<string, unknown>;
  allowedFields: string[];
  documentType?: SecretariaDocumentType | string | null;
  templateTipo?: string | null;
}

export interface Capa3DraftAssistantProviderOutput {
  values: Record<string, string>;
  modelName?: string;
}

export type Capa3DraftAssistantProvider = (
  input: Capa3DraftAssistantProviderInput,
) => Promise<Capa3DraftAssistantProviderOutput>;

export interface SuggestCapa3DraftInput {
  fields: NormalizedCapa3Field[];
  currentValues?: Record<string, string>;
  baseVariables?: Record<string, unknown>;
  allowedFields?: string[];
  overwrite?: boolean;
  documentType?: SecretariaDocumentType | string | null;
  templateTipo?: string | null;
  provider?: Capa3DraftAssistantProvider;
}

export interface SuggestCapa3DraftResult {
  mode: Capa3DraftAssistantMode;
  modelName: string;
  values: Record<string, string>;
  suggestions: Capa3DraftSuggestion[];
  skippedFields: string[];
  allowedFields: string[];
  disclaimer: string;
}

const LOCAL_MODEL_NAME = "capa3-local-demo-assistant@0.1.0";
const CAPA3_AI_FIELD_PATTERN = /^capa3\.[a-zA-Z_][a-zA-Z0-9_.-]{0,119}$/;

function fieldPath(field: Pick<NormalizedCapa3Field, "campo">) {
  return `capa3.${field.campo}`;
}

export function buildCapa3AiAllowedFields(fields: NormalizedCapa3Field[]) {
  return fields.map(fieldPath).filter((value) => CAPA3_AI_FIELD_PATTERN.test(value));
}

function stringValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function arrayText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item, index) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return stringValue(record.descripcion_punto) ||
          stringValue(record.titulo) ||
          stringValue(record.descripcion) ||
          stringValue(record.texto) ||
          stringValue(record.label) ||
          `Elemento ${index + 1}`;
      }
      return "";
    })
    .filter(Boolean)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

function firstVariable(variables: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(variables[key]);
    if (value) return value;
  }
  return "";
}

function firstArrayVariable(variables: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = arrayText(variables[key]);
    if (value) return value;
  }
  return "";
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function localSuggestionForField(
  field: NormalizedCapa3Field,
  variables: Record<string, unknown>,
) {
  const key = field.campo.toLowerCase();
  const description = field.descripcion || field.campo;

  const direct = firstVariable(variables, [
    field.campo,
    key,
    `capa3.${field.campo}`,
  ]);
  if (direct) return { value: direct, reason: "Valor disponible en el contexto documental." };

  if (key.includes("orden_dia")) {
    const value = firstArrayVariable(variables, ["orden_dia", "agenda_items", "puntos_orden_dia"]);
    if (value) return { value, reason: "Borrador derivado de puntos del orden del dia." };
  }

  if (key.includes("acuerdos") || key.includes("transcripcion")) {
    const value =
      firstArrayVariable(variables, ["acuerdos_certificados", "certification_point_refs", "canonical_agreement_ids"]) ||
      firstVariable(variables, ["contenido_acuerdo", "texto_decision", "propuesta_texto", "propuesta_acuerdo"]);
    if (value) return { value, reason: "Borrador derivado del texto o referencias del acuerdo." };
  }

  if (key.includes("documentacion")) {
    const value = firstArrayVariable(variables, ["documentos_disponibles", "documentos_adjuntos", "snapshot_puntos"]);
    if (value) return { value, reason: "Borrador derivado de la documentacion registrada." };
  }

  if (key.includes("fecha")) {
    return {
      value: firstVariable(variables, ["fecha", "fecha_emision", "fecha_generacion", "fecha_junta"]) || todayIso(),
      reason: "Fecha sugerida desde el contexto o fecha actual.",
    };
  }

  if (key.includes("hora_inicio") || key.includes("hora_primera")) {
    return { value: firstVariable(variables, ["hora_inicio", "hora", "hora_junta"]) || "10:00", reason: "Hora inicial sugerida para revision." };
  }

  if (key.includes("hora_fin")) {
    return { value: firstVariable(variables, ["hora_fin"]) || "11:00", reason: "Hora final sugerida para revision." };
  }

  if (key.includes("lugar") || key.includes("ciudad")) {
    return { value: firstVariable(variables, ["lugar", "lugar_junta", "ciudad"]) || "Madrid", reason: "Lugar sugerido desde el contexto demo." };
  }

  if (key.includes("certificante")) {
    return {
      value: firstVariable(variables, ["secretario", "nombre_certificante", "firma"]) || "Secretaría del órgano",
      reason: "Certificante sugerido desde la autoridad documental disponible.",
    };
  }

  if (key.includes("cargo")) {
    return { value: firstVariable(variables, ["cargo_certificante", "cargo_firmante"]) || "Secretaría del órgano", reason: "Cargo sugerido para revision." };
  }

  if (key.includes("objeto_informe")) {
    return { value: "Validar la suficiencia documental y los requisitos societarios aplicables al expediente.", reason: "Texto base acotado a Capa 3." };
  }

  if (key.includes("fundamento")) {
    return { value: "Normativa societaria aplicable, estatutos sociales y reglas internas vigentes.", reason: "Fundamento genérico pendiente de revisión legal." };
  }

  if (key.includes("conclusion")) {
    return { value: "No se identifican incidencias bloqueantes con la información disponible, sin perjuicio de revisión final por Secretaría.", reason: "Conclusión operativa de borrador." };
  }

  if (key.includes("firma_qes")) {
    return { value: "Pendiente de firma QES EAD Trust en entorno productivo.", reason: "Referencia demo segura, no productiva." };
  }

  if (key.includes("nif") || key.includes("cif")) {
    return { value: "No informado en demo", reason: "Evita introducir identificadores reales." };
  }

  if (field.obligatoriedad === "OBLIGATORIO") {
    return { value: `Borrador pendiente de revisión: ${description}.`, reason: "Campo obligatorio sin fuente estructurada suficiente." };
  }

  return null;
}

function suggestionFromValue(field: NormalizedCapa3Field, value: string, reason: string): Capa3DraftSuggestion {
  return {
    field: field.campo,
    value,
    reason,
    confidence: reason.includes("contexto") || reason.includes("derivado") ? 0.78 : 0.52,
    requiresHumanReview: true,
  };
}

export async function suggestCapa3Draft(
  input: SuggestCapa3DraftInput,
): Promise<SuggestCapa3DraftResult> {
  const allowedFields = input.allowedFields ?? buildCapa3AiAllowedFields(input.fields);
  const allowedFieldNames = new Set(
    allowedFields
      .filter((field) => CAPA3_AI_FIELD_PATTERN.test(field))
      .map((field) => field.replace(/^capa3\./, "")),
  );
  const currentValues = input.currentValues ?? {};
  const baseVariables = input.baseVariables ?? {};
  const values: Record<string, string> = { ...currentValues };
  const suggestions: Capa3DraftSuggestion[] = [];
  const skippedFields: string[] = [];

  if (input.provider) {
    const providerOutput = await input.provider({
      fields: input.fields,
      currentValues,
      baseVariables,
      allowedFields,
      documentType: input.documentType,
      templateTipo: input.templateTipo,
    });
    for (const field of input.fields) {
      if (!allowedFieldNames.has(field.campo)) {
        skippedFields.push(field.campo);
        continue;
      }
      if (!input.overwrite && currentValues[field.campo]?.trim()) continue;
      const value = stringValue(providerOutput.values[field.campo]);
      if (!value) continue;
      values[field.campo] = value;
      suggestions.push(suggestionFromValue(field, value, "Sugerido por adaptador de modelo configurado."));
    }
    return {
      mode: "MODEL_ADAPTER",
      modelName: providerOutput.modelName ?? "configured-model-adapter",
      values,
      suggestions,
      skippedFields,
      allowedFields,
      disclaimer: "Sugerencias no vinculantes: requieren revisión y aceptación humana antes de componer el documento.",
    };
  }

  for (const field of input.fields) {
    if (!allowedFieldNames.has(field.campo)) {
      skippedFields.push(field.campo);
      continue;
    }
    if (!input.overwrite && currentValues[field.campo]?.trim()) continue;
    const suggested = localSuggestionForField(field, baseVariables);
    if (!suggested?.value) continue;
    values[field.campo] = suggested.value;
    suggestions.push(suggestionFromValue(field, suggested.value, suggested.reason));
  }

  return {
    mode: "LOCAL_DEMO",
    modelName: LOCAL_MODEL_NAME,
    values,
    suggestions,
    skippedFields,
    allowedFields,
    disclaimer: "Borrador demo no vinculante: no modifica Capa 1 y requiere revisión humana antes de generar.",
  };
}
