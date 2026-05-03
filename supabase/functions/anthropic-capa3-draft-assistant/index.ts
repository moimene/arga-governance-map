const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "claude-opus-4-7";
const ANTHROPIC_VERSION = "2023-06-01";
const CAPA3_FIELD = /^capa3\.[a-zA-Z_][a-zA-Z0-9_.-]{0,119}$/;

type Capa3Field = {
  campo: string;
  obligatoriedad: string;
  descripcion: string;
};

type RequestBody = {
  fields?: Capa3Field[];
  currentValues?: Record<string, string>;
  baseVariables?: Record<string, unknown>;
  allowedFields?: string[];
  documentType?: string | null;
  templateTipo?: string | null;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown, max = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function sanitizeVariables(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.slice(0, 1200);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeVariables(item, depth + 1));
  if (typeof value !== "object") return "";

  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("api_key") ||
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("email") ||
      lower.includes("nif") ||
      lower.includes("cif") ||
      lower.includes("tax_id")
    ) {
      result[key] = "[redacted]";
      continue;
    }
    result[key] = sanitizeVariables(raw, depth + 1);
  }
  return result;
}

function validateBody(body: RequestBody) {
  const fields = Array.isArray(body.fields) ? body.fields : [];
  const allowedFields = Array.isArray(body.allowedFields) ? body.allowedFields : [];
  const allowed = new Set(allowedFields.filter((field) => CAPA3_FIELD.test(field)));
  const filteredFields = fields
    .filter((field) => field && typeof field === "object")
    .map((field) => ({
      campo: asString(field.campo, 120),
      obligatoriedad: asString(field.obligatoriedad, 80),
      descripcion: asString(field.descripcion, 240),
    }))
    .filter((field) => field.campo && allowed.has(`capa3.${field.campo}`));

  return {
    fields: filteredFields,
    currentValues: asRecord(body.currentValues),
    baseVariables: sanitizeVariables(asRecord(body.baseVariables)),
    allowedFields: Array.from(allowed),
    documentType: asString(body.documentType, 80),
    templateTipo: asString(body.templateTipo, 120),
  };
}

function buildPrompt(payload: ReturnType<typeof validateBody>) {
  return [
    "Eres asistente de Secretaria Societaria para preparar borradores de Capa 3.",
    "Devuelve SOLO JSON valido, sin markdown, con la forma {\"values\":{\"campo\":\"texto\"}}.",
    "Reglas:",
    "- Solo puedes proponer campos incluidos en allowedFields, quitando el prefijo capa3.",
    "- No redactes ni modifiques Capa 1.",
    "- No afirmes evidencia final productiva ni cierre legal definitivo.",
    "- No introduzcas nombres reales, NIF/CIF reales, emails ni datos no presentes.",
    "- Si falta contexto, usa texto prudente marcado como pendiente de revision.",
    "- Las sugerencias son no vinculantes y requieren revision humana.",
    "",
    JSON.stringify(payload),
  ].join("\n");
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return "{}";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse(500, { error: "anthropic_api_key_not_configured" });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const payload = validateBody(body);
  if (payload.fields.length === 0 || payload.allowedFields.length === 0) {
    return jsonResponse(400, { error: "no_allowed_capa3_fields" });
  }

  const model = Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_MODEL;
  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      temperature: 0.2,
      messages: [{ role: "user", content: buildPrompt(payload) }],
    }),
  });

  if (!anthropicResponse.ok) {
    const detail = await anthropicResponse.text().catch(() => "");
    return jsonResponse(502, {
      error: "anthropic_request_failed",
      status: anthropicResponse.status,
      detail: detail.slice(0, 500),
    });
  }

  const responseJson = await anthropicResponse.json();
  const text = Array.isArray(responseJson.content)
    ? responseJson.content
      .filter((item: { type?: string }) => item.type === "text")
      .map((item: { text?: string }) => item.text ?? "")
      .join("\n")
    : "";

  let parsed: { values?: Record<string, unknown> } = {};
  try {
    parsed = JSON.parse(extractJsonObject(text));
  } catch {
    parsed = {};
  }

  const allowedNames = new Set(payload.allowedFields.map((field) => field.replace(/^capa3\./, "")));
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(asRecord(parsed.values))) {
    if (!allowedNames.has(key)) continue;
    const textValue = asString(value, 4000);
    if (textValue) values[key] = textValue;
  }

  return jsonResponse(200, {
    values,
    modelName: model,
  });
});
