// =============================================================================
// Public types
// =============================================================================

export type SecretariaSourceModule = "secretaria";
export type SecretariaGenerationLane = "DOCUMENT_ASSEMBLY_PIPELINE";
export type SecretariaEvidenceStatus = "DEMO_OPERATIVA";

export type SecretariaDocumentType =
  | "CONVOCATORIA"
  | "ACTA"
  | "CERTIFICACION"
  | "INFORME_PRECEPTIVO"
  | "INFORME_DOCUMENTAL_PRE"
  | "ACUERDO_SIN_SESION"
  | "DECISION_UNIPERSONAL"
  | "DOCUMENTO_REGISTRAL"
  | "SUBSANACION_REGISTRAL";

export type SecretariaOrganoTipo =
  | "JUNTA_GENERAL"
  | "CONSEJO"
  | "CONSEJO_ADMIN"
  | "SOCIO_UNICO"
  | "ADMIN_UNICO"
  | "ADMIN_CONJUNTA"
  | "ADMIN_SOLIDARIOS";

export type SecretariaAdoptionMode =
  | "MEETING"
  | "NO_SESSION"
  | "UNIPERSONAL_SOCIO"
  | "UNIPERSONAL_ADMIN"
  | "CO_APROBACION"
  | "SOLIDARIO";

export type SecretariaAIAssist = {
  enabled: boolean;
  allowed_fields: string[];
} | null;

export type SecretariaValidationIssueSeverity = "BLOCKING" | "WARNING" | "INFO";

export type SecretariaValidationIssue = {
  code: string;
  severity: SecretariaValidationIssueSeverity;
  field_path: string;
  message: string;
};

export type SecretariaValidationResult = {
  ok: boolean;
  issues: SecretariaValidationIssue[];
};

export type SecretariaDocumentGenerationRequestV1 = {
  schema_version: "1.0.0";
  request_id: string;
  request_hash_sha256: string;

  source_module: SecretariaSourceModule;
  document_type: SecretariaDocumentType;

  tenant_id: string;
  entity_id: string | null;

  agreement_ids: string[];

  convocatoria_id?: string | null;
  meeting_id?: string | null;
  minute_id?: string | null;
  certification_id?: string | null;
  tramitador_id?: string | null;

  template_profile_id?: string | null;
  template_id?: string | null;

  expected_organo_tipo?: SecretariaOrganoTipo | null;
  expected_adoption_mode?: SecretariaAdoptionMode | null;

  ai_assist?: SecretariaAIAssist;

  evidence_status: SecretariaEvidenceStatus;
  generation_lane: SecretariaGenerationLane;

  requested_by_user_id?: string | null;
  requested_at: string;
};

// Alias estable: callers/scripts no deberían depender del sufijo de versión.
export type SecretariaDocumentGenerationRequest = SecretariaDocumentGenerationRequestV1;

// =============================================================================
// Constants
// =============================================================================

const AI_ALLOWED_FIELDS_DEFAULT = [
  "narrativa.introduccion",
  "narrativa.deliberaciones",
  "narrativa.incidencias_no_criticas",
] as const;
const AI_ALLOWED_CAPA3_FIELD_PATTERN = /^capa3\.[a-zA-Z_][a-zA-Z0-9_.-]{0,119}$/;

// =============================================================================
// Doc type rules
// =============================================================================

type DocTypeRules = {
  agreement_ids: { min: number; max?: number };
  require: Array<"convocatoria_id" | "meeting_id" | "minute_id" | "certification_id" | "tramitador_id">;
  forbid: Array<"convocatoria_id" | "meeting_id" | "minute_id" | "certification_id" | "tramitador_id">;
  require_entity_id: boolean;
};

const DOC_TYPE_RULES: Record<SecretariaDocumentType, DocTypeRules> = {
  CONVOCATORIA: {
    agreement_ids: { min: 0 },
    require: ["convocatoria_id"],
    forbid: ["minute_id", "certification_id", "tramitador_id"],
    require_entity_id: true,
  },
  INFORME_PRECEPTIVO: {
    agreement_ids: { min: 0 },
    require: ["convocatoria_id"],
    forbid: ["minute_id", "certification_id", "tramitador_id"],
    require_entity_id: true,
  },
  INFORME_DOCUMENTAL_PRE: {
    agreement_ids: { min: 0 },
    require: [],
    forbid: ["minute_id", "certification_id", "tramitador_id"],
    require_entity_id: true,
  },
  ACTA: {
    agreement_ids: { min: 1 },
    require: ["meeting_id", "minute_id"],
    forbid: ["certification_id", "tramitador_id"],
    require_entity_id: true,
  },
  CERTIFICACION: {
    agreement_ids: { min: 1 },
    require: ["certification_id"],
    forbid: ["tramitador_id"],
    require_entity_id: true,
  },
  ACUERDO_SIN_SESION: {
    agreement_ids: { min: 1 },
    require: [],
    forbid: ["meeting_id", "minute_id", "tramitador_id"],
    require_entity_id: true,
  },
  DECISION_UNIPERSONAL: {
    agreement_ids: { min: 1 },
    require: [],
    forbid: ["meeting_id", "minute_id", "tramitador_id"],
    require_entity_id: true,
  },
  DOCUMENTO_REGISTRAL: {
    agreement_ids: { min: 1 },
    require: ["tramitador_id"],
    forbid: [],
    require_entity_id: true,
  },
  SUBSANACION_REGISTRAL: {
    agreement_ids: { min: 1 },
    require: ["tramitador_id"],
    forbid: [],
    require_entity_id: true,
  },
};

// =============================================================================
// Internal helpers
// =============================================================================

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function isPresent<T>(x: T | null | undefined): x is T {
  return x !== null && x !== undefined;
}

function assertISODate(value: string): boolean {
  const t = Date.parse(value);
  return !Number.isNaN(t);
}

function compactIds(values: Array<string | null | undefined> | null | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(null);
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto (crypto.subtle) no disponible en este runtime.");
  }
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeOrganoTipo(
  x: SecretariaOrganoTipo | null | undefined,
): SecretariaOrganoTipo | null {
  if (!x) return null;
  if (x === "CONSEJO_ADMIN") return "CONSEJO";
  return x;
}

function pushIssue(issues: SecretariaValidationIssue[], issue: SecretariaValidationIssue): void {
  issues.push(issue);
}

function requireFieldPresent(
  req: SecretariaDocumentGenerationRequestV1,
  field: "convocatoria_id" | "meeting_id" | "minute_id" | "certification_id" | "tramitador_id",
  issues: SecretariaValidationIssue[],
): void {
  const val = req[field];
  if (!isPresent(val) || (typeof val === "string" && val.trim() === "")) {
    pushIssue(issues, {
      code: "MISSING_REQUIRED_REFERENCE",
      severity: "BLOCKING",
      field_path: field,
      message: `Falta referencia obligatoria ${field} para document_type=${req.document_type}.`,
    });
  }
}

function forbidFieldPresent(
  req: SecretariaDocumentGenerationRequestV1,
  field: "convocatoria_id" | "meeting_id" | "minute_id" | "certification_id" | "tramitador_id",
  issues: SecretariaValidationIssue[],
): void {
  const val = req[field];
  if (isPresent(val) && !(typeof val === "string" && val.trim() === "")) {
    pushIssue(issues, {
      code: "FORBIDDEN_REFERENCE",
      severity: "BLOCKING",
      field_path: field,
      message: `La referencia ${field} está prohibida para document_type=${req.document_type}.`,
    });
  }
}

function validateAgreementIds(
  req: SecretariaDocumentGenerationRequestV1,
  issues: SecretariaValidationIssue[],
): void {
  const rules = DOC_TYPE_RULES[req.document_type];
  if (!Array.isArray(req.agreement_ids)) {
    pushIssue(issues, {
      code: "AGREEMENT_IDS_NOT_ARRAY",
      severity: "BLOCKING",
      field_path: "agreement_ids",
      message: "agreement_ids debe ser un array.",
    });
    return;
  }

  const cleaned = req.agreement_ids.filter((x) => isNonEmptyString(x)).map((x) => x.trim());
  const unique = new Set(cleaned);
  if (cleaned.length !== req.agreement_ids.length) {
    pushIssue(issues, {
      code: "AGREEMENT_IDS_EMPTY_OR_INVALID",
      severity: "BLOCKING",
      field_path: "agreement_ids",
      message: "agreement_ids contiene valores vacíos o no string.",
    });
  }
  if (unique.size !== cleaned.length) {
    pushIssue(issues, {
      code: "AGREEMENT_IDS_DUPLICATE",
      severity: "BLOCKING",
      field_path: "agreement_ids",
      message: "agreement_ids contiene duplicados.",
    });
  }
  if (cleaned.length < rules.agreement_ids.min) {
    pushIssue(issues, {
      code: "AGREEMENT_IDS_TOO_FEW",
      severity: "BLOCKING",
      field_path: "agreement_ids",
      message: `Se requieren al menos ${rules.agreement_ids.min} agreement_ids para document_type=${req.document_type}.`,
    });
  }
  if (isPresent(rules.agreement_ids.max) && cleaned.length > rules.agreement_ids.max) {
    pushIssue(issues, {
      code: "AGREEMENT_IDS_TOO_MANY",
      severity: "BLOCKING",
      field_path: "agreement_ids",
      message: `Se permiten como máximo ${rules.agreement_ids.max} agreement_ids para document_type=${req.document_type}.`,
    });
  }
}

function validateAIAssist(
  req: SecretariaDocumentGenerationRequestV1,
  issues: SecretariaValidationIssue[],
): void {
  const ai = req.ai_assist ?? null;
  if (ai === null) return;

  if (ai.enabled !== true && ai.enabled !== false) {
    pushIssue(issues, {
      code: "AI_ASSIST_INVALID",
      severity: "BLOCKING",
      field_path: "ai_assist.enabled",
      message: "ai_assist.enabled debe ser boolean.",
    });
    return;
  }

  if (ai.enabled === false) return;

  if (!Array.isArray(ai.allowed_fields) || ai.allowed_fields.some((x) => !isNonEmptyString(x))) {
    pushIssue(issues, {
      code: "AI_ASSIST_ALLOWED_FIELDS_INVALID",
      severity: "BLOCKING",
      field_path: "ai_assist.allowed_fields",
      message: "ai_assist.allowed_fields debe ser array de strings no vacíos.",
    });
    return;
  }

  const allowed = new Set(ai.allowed_fields.map((s) => s.trim()));
  const hasNarrativeWhitelist = AI_ALLOWED_FIELDS_DEFAULT.every((f) => allowed.has(f));
  const hasCapa3Whitelist = Array.from(allowed).some((f) => AI_ALLOWED_CAPA3_FIELD_PATTERN.test(f));
  if (!hasNarrativeWhitelist && !hasCapa3Whitelist) {
    pushIssue(issues, {
      code: "AI_ASSIST_WHITELIST_MISSING",
      severity: "BLOCKING",
      field_path: "ai_assist.allowed_fields",
      message: "Si ai_assist.enabled=true, debe incluir la whitelist narrativa minima o campos capa3.<campo>.",
    });
  }
  for (const f of allowed) {
    if (
      !(AI_ALLOWED_FIELDS_DEFAULT as readonly string[]).includes(f) &&
      !AI_ALLOWED_CAPA3_FIELD_PATTERN.test(f)
    ) {
      pushIssue(issues, {
        code: "AI_ASSIST_FIELD_NOT_ALLOWED",
        severity: "BLOCKING",
        field_path: "ai_assist.allowed_fields",
        message: `Campo no permitido para IA en este boundary: ${f}.`,
      });
    }
  }
}

// =============================================================================
// Public API: hash
// =============================================================================

/**
 * Calcula el SHA-256 canónico del request.
 *
 * Excluye del hash los metadatos de trazabilidad (`requested_at`, `request_id`,
 * `requested_by_user_id`) para que dos solicitudes con contenido idéntico produzcan
 * el mismo hash aunque cambien sus identificadores. Esto permite deduplicación de
 * solicitudes.
 *
 * NOTA: el hash identifica únicamente el contenido de la solicitud, NO el estado
 * canónico de Cloud al momento del render. Dos solicitudes con el mismo hash pueden
 * producir DOCX distintos si los datos canónicos cambiaron entre invocaciones.
 */
export async function computeRequestHashSha256(
  req: Omit<SecretariaDocumentGenerationRequestV1, "request_hash_sha256">,
): Promise<string> {
  const {
    requested_at: _ignoredAt,
    request_id: _ignoredId,
    requested_by_user_id: _ignoredUser,
    ...rest
  } = req;
  const canonical = stableStringify(rest);
  const data = new TextEncoder().encode(canonical);
  return await sha256Hex(data);
}

// =============================================================================
// Public API: validate
// =============================================================================

export async function validateSecretariaDocumentGenerationRequest(
  req: SecretariaDocumentGenerationRequestV1,
): Promise<SecretariaValidationResult> {
  const issues: SecretariaValidationIssue[] = [];

  if (req.schema_version !== "1.0.0") {
    pushIssue(issues, {
      code: "SCHEMA_VERSION_UNSUPPORTED",
      severity: "BLOCKING",
      field_path: "schema_version",
      message: "schema_version no soportada.",
    });
  }

  if (req.source_module !== "secretaria") {
    pushIssue(issues, {
      code: "SOURCE_MODULE_INVALID",
      severity: "BLOCKING",
      field_path: "source_module",
      message: "source_module debe ser 'secretaria'.",
    });
  }

  if (req.generation_lane !== "DOCUMENT_ASSEMBLY_PIPELINE") {
    pushIssue(issues, {
      code: "GENERATION_LANE_INVALID",
      severity: "BLOCKING",
      field_path: "generation_lane",
      message: "generation_lane debe ser 'DOCUMENT_ASSEMBLY_PIPELINE'.",
    });
  }

  if (req.evidence_status !== "DEMO_OPERATIVA") {
    pushIssue(issues, {
      code: "EVIDENCE_STATUS_INVALID",
      severity: "BLOCKING",
      field_path: "evidence_status",
      message: "evidence_status solo puede ser DEMO_OPERATIVA.",
    });
  }

  if (!isNonEmptyString(req.request_id)) {
    pushIssue(issues, {
      code: "REQUEST_ID_MISSING",
      severity: "BLOCKING",
      field_path: "request_id",
      message: "request_id es obligatorio.",
    });
  }

  if (!isNonEmptyString(req.tenant_id)) {
    pushIssue(issues, {
      code: "TENANT_ID_MISSING",
      severity: "BLOCKING",
      field_path: "tenant_id",
      message: "tenant_id es obligatorio.",
    });
  }

  const rules = DOC_TYPE_RULES[req.document_type];
  if (!rules) {
    pushIssue(issues, {
      code: "DOCUMENT_TYPE_INVALID",
      severity: "BLOCKING",
      field_path: "document_type",
      message: "document_type no reconocido.",
    });
  } else {
    if (rules.require_entity_id && !isPresent(req.entity_id)) {
      pushIssue(issues, {
        code: "ENTITY_ID_REQUIRED",
        severity: "BLOCKING",
        field_path: "entity_id",
        message: `entity_id es obligatorio para document_type=${req.document_type}.`,
      });
    }

    validateAgreementIds(req, issues);

    for (const f of rules.require) requireFieldPresent(req, f, issues);
    for (const f of rules.forbid) forbidFieldPresent(req, f, issues);
  }

  if (!isNonEmptyString(req.template_profile_id) && !isNonEmptyString(req.template_id)) {
    pushIssue(issues, {
      code: "TEMPLATE_SELECTOR_MISSING",
      severity: "BLOCKING",
      field_path: "template_profile_id|template_id",
      message: "Debe existir template_profile_id o template_id (al menos uno).",
    });
  }

  if (!isNonEmptyString(req.request_hash_sha256)) {
    pushIssue(issues, {
      code: "REQUEST_HASH_MISSING",
      severity: "BLOCKING",
      field_path: "request_hash_sha256",
      message: "request_hash_sha256 es obligatorio.",
    });
  } else {
    const { request_hash_sha256: _h, ...forHash } = req;
    const computed = await computeRequestHashSha256(forHash);
    if (computed !== req.request_hash_sha256) {
      pushIssue(issues, {
        code: "REQUEST_HASH_MISMATCH",
        severity: "BLOCKING",
        field_path: "request_hash_sha256",
        message:
          "request_hash_sha256 no coincide con el hash canónico del request (excluyendo requested_at, request_id y requested_by_user_id).",
      });
    }
  }

  if (!isNonEmptyString(req.requested_at) || !assertISODate(req.requested_at)) {
    pushIssue(issues, {
      code: "REQUESTED_AT_INVALID",
      severity: "BLOCKING",
      field_path: "requested_at",
      message: "requested_at debe ser una fecha ISO parseable.",
    });
  }

  validateAIAssist(req, issues);

  return { ok: issues.every((i) => i.severity !== "BLOCKING"), issues };
}

export async function assertSecretariaDocumentGenerationRequestReady(
  req: SecretariaDocumentGenerationRequestV1,
): Promise<SecretariaValidationResult> {
  const validation = await validateSecretariaDocumentGenerationRequest(req);
  if (!validation.ok) {
    const blocking = validation.issues.filter((i) => i.severity === "BLOCKING");
    throw new Error(
      `Secretaria document generation boundary blocked: ${blocking
        .map((i) => `${i.code}@${i.field_path}`)
        .join(", ")}`,
    );
  }
  return validation;
}

// =============================================================================
// Public API: builder (bilingual: V1 snake_case OR legacy camelCase)
// =============================================================================

export type BuildSecretariaDocumentGenerationRequestInput = Omit<
  SecretariaDocumentGenerationRequestV1,
  | "schema_version"
  | "request_id"
  | "request_hash_sha256"
  | "requested_at"
  | "source_module"
  | "generation_lane"
  | "evidence_status"
> & {
  request_id?: string;
  requested_at?: string;
};

type BuildInputLegacy = {
  documentType: SecretariaDocumentType;
  tenantId: string | null | undefined;
  entityId?: string | null;
  agreementIds?: Array<string | null | undefined> | null;
  convocatoriaId?: string | null;
  meetingId?: string | null;
  minuteId?: string | null;
  certificationId?: string | null;
  tramitadorId?: string | null;
  templateProfileId?: string | null;
  templateId?: string | null;
  expectedOrganoTipo?: SecretariaOrganoTipo | null;
  expectedAdoptionMode?: SecretariaAdoptionMode | null;
  requestedByUserId?: string | null;
  requestId?: string;
  requestedAt?: string;
  aiAssist?: SecretariaAIAssist;
};

function isLegacyInput(input: unknown): input is BuildInputLegacy {
  return typeof input === "object" && input !== null && "documentType" in (input as object);
}

export async function buildSecretariaDocumentGenerationRequest(
  input: BuildSecretariaDocumentGenerationRequestInput | BuildInputLegacy,
): Promise<SecretariaDocumentGenerationRequestV1> {
  const obj = input as Record<string, unknown>;
  const hasLegacyKey = "documentType" in obj;
  const hasV1Key = "document_type" in obj;

  if (hasLegacyKey && hasV1Key) {
    throw new Error(
      "buildSecretariaDocumentGenerationRequest: input mezcla camelCase y snake_case (documentType + document_type).",
    );
  }

  let normalized: BuildSecretariaDocumentGenerationRequestInput;
  if (isLegacyInput(input)) {
    normalized = {
      document_type: input.documentType,
      tenant_id: (input.tenantId ?? "").toString().trim(),
      entity_id: input.entityId ?? null,
      agreement_ids: compactIds(input.agreementIds),
      convocatoria_id: input.convocatoriaId ?? null,
      meeting_id: input.meetingId ?? null,
      minute_id: input.minuteId ?? null,
      certification_id: input.certificationId ?? null,
      tramitador_id: input.tramitadorId ?? null,
      template_profile_id: input.templateProfileId ?? null,
      template_id: input.templateId ?? null,
      expected_organo_tipo: input.expectedOrganoTipo ?? null,
      expected_adoption_mode: input.expectedAdoptionMode ?? null,
      ai_assist: input.aiAssist ?? null,
      requested_by_user_id: input.requestedByUserId ?? null,
      request_id: input.requestId,
      requested_at: input.requestedAt,
    };
  } else {
    normalized = input;
  }

  const reqBase: Omit<SecretariaDocumentGenerationRequestV1, "request_hash_sha256"> = {
    schema_version: "1.0.0",
    request_id: normalized.request_id ?? globalThis.crypto.randomUUID(),
    source_module: "secretaria",
    document_type: normalized.document_type,
    tenant_id: (normalized.tenant_id ?? "").toString().trim(),
    entity_id: normalized.entity_id ?? null,
    agreement_ids: compactIds(normalized.agreement_ids ?? []),
    convocatoria_id: normalized.convocatoria_id ?? null,
    meeting_id: normalized.meeting_id ?? null,
    minute_id: normalized.minute_id ?? null,
    certification_id: normalized.certification_id ?? null,
    tramitador_id: normalized.tramitador_id ?? null,
    template_profile_id: normalized.template_profile_id ?? null,
    template_id: normalized.template_id ?? null,
    expected_organo_tipo: normalizeOrganoTipo(normalized.expected_organo_tipo ?? null),
    expected_adoption_mode: normalized.expected_adoption_mode ?? null,
    ai_assist: normalized.ai_assist ?? null,
    evidence_status: "DEMO_OPERATIVA",
    generation_lane: "DOCUMENT_ASSEMBLY_PIPELINE",
    requested_by_user_id: normalized.requested_by_user_id ?? null,
    requested_at: normalized.requested_at ?? new Date().toISOString(),
  };

  const request_hash_sha256 = await computeRequestHashSha256(reqBase);
  return { ...reqBase, request_hash_sha256 };
}
