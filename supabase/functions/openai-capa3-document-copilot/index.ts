const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_REASONING_EFFORT = "low";
const DEFAULT_VERBOSITY = "low";
const PROMPT_VERSION = "capa3-document-copilot.v1";
const CAPA3_FIELD = /^capa3\.[a-zA-Z_][a-zA-Z0-9_.-]{0,119}$/;
const ALLOWED_ACTA_TARGETS = new Set([
  "narrativa.introduccion",
  "narrativa.deliberaciones",
  "narrativa.incidencias_no_criticas",
]);

type CopilotTask = "CAPA3_FIELDS" | "ACTA_DRAFT_POLISH";

type Capa3Field = {
  campo: string;
  obligatoriedad: string;
  descripcion: string;
};

type RequestBody = {
  task?: CopilotTask;
  fields?: Capa3Field[];
  currentValues?: Record<string, string>;
  baseVariables?: Record<string, unknown>;
  allowedFields?: string[];
  documentType?: string | null;
  templateTipo?: string | null;
  text?: string;
  actaLegalStructure?: Record<string, unknown>;
  allowedTargets?: string[];
  maxProposals?: number;
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

function asString(value: unknown, max = 8000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.slice(0, 6000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return "";

  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 160)) {
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
    result[key] = sanitizeValue(raw, depth + 1);
  }
  return result;
}

function validateCapa3Payload(body: RequestBody) {
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
    task: "CAPA3_FIELDS" as const,
    fields: filteredFields,
    currentValues: asRecord(body.currentValues),
    baseVariables: sanitizeValue(asRecord(body.baseVariables)),
    allowedFields: Array.from(allowed),
    allowedNames: Array.from(allowed).map((field) => field.replace(/^capa3\./, "")),
    documentType: asString(body.documentType, 80),
    templateTipo: asString(body.templateTipo, 120),
  };
}

function validateActaPayload(body: RequestBody) {
  const text = asString(body.text, 30000);
  const allowedTargets = Array.isArray(body.allowedTargets)
    ? body.allowedTargets.filter((target) => ALLOWED_ACTA_TARGETS.has(target))
    : Array.from(ALLOWED_ACTA_TARGETS);
  const maxProposals = Math.max(1, Math.min(Number(body.maxProposals ?? 6) || 6, 10));

  return {
    task: "ACTA_DRAFT_POLISH" as const,
    text,
    actaLegalStructure: sanitizeValue(asRecord(body.actaLegalStructure)),
    allowedTargets,
    maxProposals,
  };
}

function capa3ResponseSchema(allowedNames: string[]) {
  const properties = Object.fromEntries(
    allowedNames.map((name) => [name, { type: ["string", "null"] }]),
  );
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "values"],
    properties: {
      summary: { type: "string" },
      values: {
        type: "object",
        additionalProperties: false,
        required: allowedNames,
        properties,
      },
    },
  };
}

function actaResponseSchema(allowedTargets: string[], maxProposals: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "proposals"],
    properties: {
      summary: { type: "string" },
      proposals: {
        type: "array",
        maxItems: maxProposals,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["target", "currentText", "proposedText", "reason", "confidence", "requiresHumanReview"],
          properties: {
            target: { type: "string", enum: allowedTargets },
            currentText: { type: "string" },
            proposedText: { type: "string" },
            reason: { type: "string" },
            confidence: { type: "number" },
            requiresHumanReview: { type: "boolean" },
          },
        },
      },
    },
  };
}

function buildInstructions(task: CopilotTask) {
  const common = [
    "Eres el Copiloto Capa 3 documental de Secretaria Societaria.",
    "Tu rol es asistir la redaccion editable y revisable, no adoptar acuerdos ni certificar documentos.",
    "Devuelve SOLO JSON conforme al schema.",
    "Todas las sugerencias requieren revision humana.",
  ];

  if (task === "CAPA3_FIELDS") {
    return [
      ...common,
      "Tarea: proponer valores para campos editables Capa 3.",
      "Reglas:",
      "- Solo puedes proponer campos incluidos en allowedFields, quitando el prefijo capa3.",
      "- No redactes ni modifiques Capa 1.",
      "- No inventes hechos juridicos ni evidencia final productiva.",
      "- No introduzcas nombres reales, NIF/CIF reales, emails ni datos no presentes.",
      "- Si falta contexto para un campo, devuelve null o un texto prudente marcado como pendiente de revision.",
    ].join("\n");
  }

  return [
    ...common,
    "Tarea: pulir la formacion narrativa del borrador de acta.",
    "Reglas:",
    "- No modifiques hechos juridicos.",
    "- No cambies sociedad, organo, asistentes, quorum, capital, derechos de voto, votaciones, mayoria, acuerdos, pactos, conflictos, fechas, lugar, hashes, snapshots, evidencias ni identificadores.",
    "- No cambies el orden del dia ni la numeracion.",
    "- No inventes deliberaciones, intervenciones, documentos ni incidencias.",
    "- Cada propuesta debe usar currentText como fragmento exacto existente en el texto recibido.",
    "- proposedText debe ser un reemplazo localizado del currentText, no el acta completa.",
    "- Si no puedes mejorar sin tocar contenido protegido, devuelve proposals vacio.",
  ].join("\n");
}

function buildInput(payload: ReturnType<typeof validateCapa3Payload> | ReturnType<typeof validateActaPayload>) {
  if (payload.task === "CAPA3_FIELDS") {
    return JSON.stringify({
      task: payload.task,
      fields: payload.fields,
      currentValues: payload.currentValues,
      baseVariables: payload.baseVariables,
      allowedFields: payload.allowedFields,
      documentType: payload.documentType,
      templateTipo: payload.templateTipo,
    });
  }

  return JSON.stringify({
    task: payload.task,
    policy: {
      allowedTargets: payload.allowedTargets,
      maxProposals: payload.maxProposals,
      protected: [
        "sociedad",
        "organo",
        "asistentes",
        "quorum",
        "capital",
        "votaciones",
        "texto_acuerdos",
        "fechas",
        "lugar",
        "hashes",
        "snapshots",
        "evidencias",
      ],
    },
    actaLegalStructure: payload.actaLegalStructure,
    draftText: payload.text,
  });
}

function outputText(responseJson: Record<string, unknown>) {
  const direct = asString(responseJson.output_text, 20000);
  if (direct) return direct;
  const output = Array.isArray(responseJson.output) ? responseJson.output : [];
  return output
    .flatMap((item) => {
      const content = asRecord(item).content;
      return Array.isArray(content) ? content : [];
    })
    .filter((item) => asRecord(item).type === "output_text")
    .map((item) => asString(asRecord(item).text, 20000))
    .join("\n");
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return "{\"summary\":\"Sin respuesta estructurada.\",\"values\":{},\"proposals\":[]}";
}

function normalizeCapa3Response(parsed: { summary?: string; values?: Record<string, unknown> }, allowedNames: string[], model: string) {
  const allowed = new Set(allowedNames);
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(asRecord(parsed.values))) {
    if (!allowed.has(key)) continue;
    const textValue = asString(value, 4000);
    if (textValue) values[key] = textValue;
  }
  return {
    summary: asString(parsed.summary, 800) || "Sugerencias Capa 3 generadas.",
    values,
    modelName: model,
    promptVersion: PROMPT_VERSION,
  };
}

function normalizeActaResponse(parsed: { summary?: string; proposals?: Array<Record<string, unknown>> }, model: string) {
  const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
  return {
    summary: asString(parsed.summary, 800) || "Propuestas de formacion del acta generadas.",
    proposals: proposals.map((proposal) => ({
      target: asString(proposal.target, 120),
      currentText: asString(proposal.currentText, 8000),
      proposedText: asString(proposal.proposedText, 8000),
      reason: asString(proposal.reason, 600),
      confidence: typeof proposal.confidence === "number" ? proposal.confidence : 0.5,
      requiresHumanReview: true,
    })),
    modelName: model,
    promptVersion: PROMPT_VERSION,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  const apiKey = Deno.env.get("OPENAI_API_KEY_2") || Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return jsonResponse(500, { error: "openai_api_key_not_configured" });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const task = body.task === "CAPA3_FIELDS" || body.task === "ACTA_DRAFT_POLISH" ? body.task : null;
  if (!task) return jsonResponse(400, { error: "invalid_copilot_task" });

  const payload = task === "CAPA3_FIELDS" ? validateCapa3Payload(body) : validateActaPayload(body);
  if (payload.task === "CAPA3_FIELDS" && (payload.fields.length === 0 || payload.allowedNames.length === 0)) {
    return jsonResponse(400, { error: "no_allowed_capa3_fields" });
  }
  if (payload.task === "ACTA_DRAFT_POLISH" && !payload.text) return jsonResponse(400, { error: "draft_text_required" });
  if (payload.task === "ACTA_DRAFT_POLISH" && payload.allowedTargets.length === 0) {
    return jsonResponse(400, { error: "no_allowed_targets" });
  }

  const model = Deno.env.get("OPENAI_CAPA3_COPILOT_MODEL") || DEFAULT_MODEL;
  const temperature = Number(Deno.env.get("OPENAI_CAPA3_COPILOT_TEMPERATURE") ?? String(DEFAULT_TEMPERATURE));
  const reasoningEffort = oneOf(
    Deno.env.get("OPENAI_CAPA3_COPILOT_REASONING_EFFORT"),
    ["none", "minimal", "low", "medium", "high", "xhigh"] as const,
    DEFAULT_REASONING_EFFORT,
  );
  const verbosity = oneOf(
    Deno.env.get("OPENAI_CAPA3_COPILOT_VERBOSITY"),
    ["low", "medium", "high"] as const,
    DEFAULT_VERBOSITY,
  );
  const schema = payload.task === "CAPA3_FIELDS"
    ? capa3ResponseSchema(payload.allowedNames)
    : actaResponseSchema(payload.allowedTargets, payload.maxProposals);

  // Los modelos de razonamiento (o-series, gpt-5/6+) rechazan `temperature`;
  // los modelos chat (gpt-4o/4.1) rechazan `reasoning` y `text.verbosity`.
  // Enviamos cada familia de parámetros solo cuando el modelo la soporta. Sin
  // este gate, el default documentado `gpt-5.5` fallaba con
  // "Unsupported parameter: 'temperature'". El determinismo lo da el esfuerzo de
  // razonamiento bajo + Structured Outputs (json_schema strict), no la temperatura.
  const isReasoningModel = /^(o\d|gpt-[5-9])/i.test(model);
  const requestBody: Record<string, unknown> = {
    model,
    instructions: buildInstructions(payload.task),
    input: buildInput(payload),
    max_output_tokens: payload.task === "CAPA3_FIELDS" ? 1800 : 2200,
    text: {
      ...(isReasoningModel ? { verbosity } : {}),
      format: {
        type: "json_schema",
        name: payload.task === "CAPA3_FIELDS" ? "capa3_field_suggestions" : "acta_draft_polish",
        strict: true,
        schema,
      },
    },
  };
  if (isReasoningModel) {
    requestBody.reasoning = { effort: reasoningEffort };
  } else {
    requestBody.temperature = Number.isFinite(temperature)
      ? Math.max(0, Math.min(0.2, temperature))
      : DEFAULT_TEMPERATURE;
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!openAiResponse.ok) {
    const detail = await openAiResponse.text().catch(() => "");
    return jsonResponse(502, {
      error: "openai_request_failed",
      status: openAiResponse.status,
      detail: detail.slice(0, 500),
    });
  }

  const responseJson = await openAiResponse.json() as Record<string, unknown>;
  let parsed: { summary?: string; values?: Record<string, unknown>; proposals?: Array<Record<string, unknown>> } = {};
  try {
    parsed = JSON.parse(extractJsonObject(outputText(responseJson)));
  } catch {
    parsed = {};
  }

  if (payload.task === "CAPA3_FIELDS") {
    return jsonResponse(200, normalizeCapa3Response(parsed, payload.allowedNames, model));
  }
  return jsonResponse(200, normalizeActaResponse(parsed, model));
});
