export interface NoSessionResolutionSource {
  id: string;
  tenant_id: string;
  entity_id: string;
  body_id?: string | null;
  agreement_id?: string | null;
  materia?: string | null;
  status?: string | null;
  resultado?: "APROBADO" | "RECHAZADO" | string | null;
}

export interface NoSessionExistingAgreementRef {
  id: string;
  tenant_id?: string | null;
  entity_id?: string | null;
  adoption_mode?: string | null;
  execution_mode?: unknown;
}

export type NoSessionIdempotencyAction = "CREATE" | "REUSE" | "UPDATE_LINK" | "BLOCK";

export interface NoSessionIdempotencyPlan {
  action: NoSessionIdempotencyAction;
  idempotencyKey: string;
  agreementId: string | null;
  reason: string;
  warnings: string[];
}

const NO_SESSION_CONTRACT_VERSION = "no-session-idempotency.v1";

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function buildNoSessionIdempotencyKey(source: Pick<NoSessionResolutionSource, "tenant_id" | "entity_id" | "id">) {
  return `${NO_SESSION_CONTRACT_VERSION}:${source.tenant_id}:${source.entity_id}:no_session_resolutions:${source.id}`;
}

export function extractNoSessionResolutionId(executionMode: unknown) {
  const root = record(executionMode);
  if (!root) return null;

  const directSource = clean(root.source);
  const directId = clean(root.source_id) ?? clean(root.no_session_resolution_id);
  if ((directSource === "no_session_resolutions" || clean(root.mode) === "NO_SESSION") && directId) return directId;

  const agreement360 = record(root.agreement_360);
  const nestedSource = clean(agreement360?.source);
  const nestedId = clean(agreement360?.source_id) ?? clean(agreement360?.no_session_resolution_id);
  if ((nestedSource === "no_session_resolutions" || clean(agreement360?.origin) === "NO_SESSION") && nestedId) {
    return nestedId;
  }

  return null;
}

export function planNoSessionAgreementIdempotency(input: {
  source: NoSessionResolutionSource;
  existingAgreements?: NoSessionExistingAgreementRef[];
}): NoSessionIdempotencyPlan {
  const source = input.source;
  const idempotencyKey = buildNoSessionIdempotencyKey(source);
  const explicitAgreementId = clean(source.agreement_id);

  if (source.resultado === "RECHAZADO" || source.status === "RECHAZADO") {
    return {
      action: "BLOCK",
      idempotencyKey,
      agreementId: explicitAgreementId,
      reason: "rejected_no_session_resolution_cannot_materialize",
      warnings: [],
    };
  }

  const matches = (input.existingAgreements ?? []).filter((agreement) => {
    if (explicitAgreementId && agreement.id === explicitAgreementId) return true;
    if (agreement.tenant_id && agreement.tenant_id !== source.tenant_id) return false;
    if (agreement.entity_id && agreement.entity_id !== source.entity_id) return false;
    return extractNoSessionResolutionId(agreement.execution_mode) === source.id;
  });

  const ids = Array.from(new Set(matches.map((agreement) => agreement.id)));
  if (ids.length > 1) {
    return {
      action: "BLOCK",
      idempotencyKey,
      agreementId: null,
      reason: "multiple_agreements_for_same_no_session_source",
      warnings: ids.map((id) => `duplicate_agreement:${id}`),
    };
  }

  if (ids.length === 1) {
    return {
      action: "REUSE",
      idempotencyKey,
      agreementId: ids[0],
      reason: "existing_agreement_matches_no_session_source",
      warnings: explicitAgreementId && explicitAgreementId !== ids[0] ? ["source_agreement_id_mismatch"] : [],
    };
  }

  if (explicitAgreementId) {
    return {
      action: "UPDATE_LINK",
      idempotencyKey,
      agreementId: explicitAgreementId,
      reason: "source_has_existing_agreement_id_without_loaded_match",
      warnings: ["existing_agreement_not_loaded"],
    };
  }

  return {
    action: "CREATE",
    idempotencyKey,
    agreementId: null,
    reason: "no_existing_agreement_for_no_session_source",
    warnings: [],
  };
}
