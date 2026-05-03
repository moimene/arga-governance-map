import { supabase } from "@/integrations/supabase/client";
import { computeContentHash } from "@/lib/doc-gen/docx-generator";
import { validatePostRenderDocument } from "./post-render-validation";
import type { PreparedDocumentComposition } from "./types";

export const DOCUMENT_DRAFTS_TABLE = "secretaria_document_drafts";

export type EditableDocumentDraftState =
  | "EDITABLE_DRAFT"
  | "DRAFT_CONFIGURED"
  | "PENDING_REVIEW"
  | "IN_REVIEW"
  | "APPROVED"
  | "PROMOTED"
  | "ARCHIVED"
  | "REJECTED"
  | "REGENERATION_NEEDED";

export interface DocumentDraftSchemaGate {
  supported: boolean;
  table: string;
  missing: string[];
  error?: string | null;
}

export interface EditableDocumentDraftRow {
  id: string;
  tenant_id: string;
  document_request_id: string;
  draft_key_sha256: string;
  request_hash_sha256: string;
  document_type: string;
  agreement_id: string | null;
  template_id: string | null;
  template_tipo: string | null;
  template_version: string | null;
  version: number;
  draft_state: EditableDocumentDraftState;
  rendered_body_text: string;
  system_trace_text: string;
  capa3_values: Record<string, unknown>;
  post_render_validation: Record<string, unknown>;
  content_hash_sha256: string | null;
  configured_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface SaveEditableDocumentDraftInput {
  prepared: PreparedDocumentComposition;
  renderedBodyText: string;
  draftState?: EditableDocumentDraftState;
  version?: number;
  contentHashSha256?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SaveEditableDocumentDraftResult {
  ok: boolean;
  schemaGate: DocumentDraftSchemaGate;
  draft?: EditableDocumentDraftRow | null;
  error?: string | null;
}

export interface LoadEditableDocumentDraftInput {
  prepared: PreparedDocumentComposition;
  version?: number | null;
}

export interface LoadEditableDocumentDraftResult {
  ok: boolean;
  schemaGate: DocumentDraftSchemaGate;
  draft?: EditableDocumentDraftRow | null;
  error?: string | null;
}

type SupabaseLikeError = {
  code?: string;
  message: string;
};

type QueryResult = {
  data: unknown;
  error: SupabaseLikeError | null;
};

type SelectBuilder = PromiseLike<QueryResult> & {
  eq: (column: string, value: string | number) => SelectBuilder;
  order: (column: string, options: { ascending: boolean }) => SelectBuilder;
  limit: (count: number) => SelectBuilder;
  maybeSingle: () => Promise<QueryResult>;
};

type MutationBuilder = {
  select: (columns: string) => {
    maybeSingle: () => Promise<QueryResult>;
  };
};

type DraftTableBuilder = {
  select: (columns: string) => SelectBuilder;
  upsert: (payload: Record<string, unknown>, options: { onConflict: string }) => MutationBuilder;
};

type DraftSupabaseClient = {
  from: (table: string) => DraftTableBuilder;
};

const REQUIRED_DOCUMENT_DRAFT_COLUMNS = [
  `${DOCUMENT_DRAFTS_TABLE}.id`,
  `${DOCUMENT_DRAFTS_TABLE}.tenant_id`,
  `${DOCUMENT_DRAFTS_TABLE}.document_request_id`,
  `${DOCUMENT_DRAFTS_TABLE}.draft_key_sha256`,
  `${DOCUMENT_DRAFTS_TABLE}.request_hash_sha256`,
  `${DOCUMENT_DRAFTS_TABLE}.document_type`,
  `${DOCUMENT_DRAFTS_TABLE}.agreement_id`,
  `${DOCUMENT_DRAFTS_TABLE}.template_id`,
  `${DOCUMENT_DRAFTS_TABLE}.version`,
  `${DOCUMENT_DRAFTS_TABLE}.draft_state`,
  `${DOCUMENT_DRAFTS_TABLE}.rendered_body_text`,
  `${DOCUMENT_DRAFTS_TABLE}.system_trace_text`,
  `${DOCUMENT_DRAFTS_TABLE}.capa3_values`,
  `${DOCUMENT_DRAFTS_TABLE}.post_render_validation`,
  `${DOCUMENT_DRAFTS_TABLE}.content_hash_sha256`,
  `${DOCUMENT_DRAFTS_TABLE}.updated_at`,
];

function draftClient(): DraftSupabaseClient {
  return supabase as unknown as DraftSupabaseClient;
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  const type = typeof value;
  if (type === "number" || type === "boolean" || type === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (type === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(null);
}

function systemTraceFor(prepared: PreparedDocumentComposition) {
  return prepared.systemTraceText || "";
}

function isSchemaMissing(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    message.includes(DOCUMENT_DRAFTS_TABLE)
  );
}

function gateFromError(error: SupabaseLikeError | null | undefined): DocumentDraftSchemaGate {
  if (!error || !isSchemaMissing(error)) {
    return {
      supported: !error,
      table: DOCUMENT_DRAFTS_TABLE,
      missing: error ? [] : [],
      error: error?.message ?? null,
    };
  }

  return staticDocumentDraftSchemaGate(error.message);
}

function parseDraftRow(value: unknown): EditableDocumentDraftRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as EditableDocumentDraftRow;
}

export function staticDocumentDraftSchemaGate(error?: string | null): DocumentDraftSchemaGate {
  return {
    supported: false,
    table: DOCUMENT_DRAFTS_TABLE,
    missing: REQUIRED_DOCUMENT_DRAFT_COLUMNS,
    error: error ?? "secretaria_document_drafts no existe en el contrato Cloud actual.",
  };
}

export async function probeDocumentDraftSchema(): Promise<DocumentDraftSchemaGate> {
  const { error } = await draftClient()
    .from(DOCUMENT_DRAFTS_TABLE)
    .select(
      "id, tenant_id, document_request_id, draft_key_sha256, request_hash_sha256, document_type, agreement_id, template_id, version, draft_state, rendered_body_text, system_trace_text, capa3_values, post_render_validation, content_hash_sha256, updated_at",
    )
    .limit(1);

  if (error) return gateFromError(error);

  return {
    supported: true,
    table: DOCUMENT_DRAFTS_TABLE,
    missing: [],
    error: null,
  };
}

export async function computeEditableDocumentDraftKey(
  prepared: PreparedDocumentComposition,
): Promise<string> {
  return computeContentHash(
    stableStringify({
      request_hash_sha256: prepared.request.request_hash_sha256,
      document_type: prepared.request.document_type,
      agreement_ids: prepared.request.agreement_ids,
      template_id: prepared.template.id,
      template_tipo: prepared.template.tipo,
      template_version: prepared.template.version,
      capa3_values: prepared.capa3Values,
    }),
  );
}

export async function buildEditableDocumentDraftPayload(
  input: SaveEditableDocumentDraftInput,
): Promise<Record<string, unknown>> {
  const renderedBodyText = input.renderedBodyText.trim();
  const renderedText = `${renderedBodyText}${systemTraceFor(input.prepared)}`;
  const postRenderValidation = validatePostRenderDocument({
    documentType: input.prepared.request.document_type,
    renderedText,
    capa1Template: input.prepared.template.capa1_inmutable,
    agreementIds: input.prepared.request.agreement_ids,
    unresolvedVariables: input.prepared.unresolvedVariables,
  });
  const draftState = input.draftState ?? "EDITABLE_DRAFT";
  const now = new Date().toISOString();

  return {
    tenant_id: input.prepared.request.tenant_id,
    document_request_id: input.prepared.request.request_id,
    draft_key_sha256: await computeEditableDocumentDraftKey(input.prepared),
    request_hash_sha256: input.prepared.request.request_hash_sha256,
    document_type: input.prepared.request.document_type,
    agreement_id: input.prepared.request.agreement_ids[0] ?? null,
    template_id: input.prepared.template.id ?? null,
    template_tipo: input.prepared.template.tipo ?? null,
    template_version: input.prepared.template.version ?? null,
    version: input.version ?? 1,
    draft_state: draftState,
    rendered_body_text: renderedBodyText,
    system_trace_text: systemTraceFor(input.prepared),
    capa3_values: input.prepared.capa3Values,
    post_render_validation: postRenderValidation,
    content_hash_sha256: input.contentHashSha256 ?? null,
    configured_at: draftState === "DRAFT_CONFIGURED" ? now : null,
    updated_by: input.actorId ?? null,
    updated_at: now,
    metadata: {
      ...(input.metadata ?? {}),
      source_request_id: input.prepared.request.request_id,
      evidence_status: input.prepared.request.evidence_status,
      generation_lane: input.prepared.request.generation_lane,
    },
  };
}

export async function saveEditableDocumentDraft(
  input: SaveEditableDocumentDraftInput,
): Promise<SaveEditableDocumentDraftResult> {
  const payload = await buildEditableDocumentDraftPayload(input);
  const { data, error } = await draftClient()
    .from(DOCUMENT_DRAFTS_TABLE)
    .upsert(payload, { onConflict: "tenant_id,draft_key_sha256,version" })
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      schemaGate: gateFromError(error),
      draft: null,
      error: error.message,
    };
  }

  return {
    ok: true,
    schemaGate: {
      supported: true,
      table: DOCUMENT_DRAFTS_TABLE,
      missing: [],
      error: null,
    },
    draft: parseDraftRow(data),
    error: null,
  };
}

export async function loadLatestEditableDocumentDraft(
  input: LoadEditableDocumentDraftInput,
): Promise<LoadEditableDocumentDraftResult> {
  const draftKey = await computeEditableDocumentDraftKey(input.prepared);
  let query = draftClient()
    .from(DOCUMENT_DRAFTS_TABLE)
    .select("*")
    .eq("tenant_id", input.prepared.request.tenant_id)
    .eq("draft_key_sha256", draftKey);

  if (input.version) {
    query = query.eq("version", input.version);
  } else {
    query = query.order("version", { ascending: false });
  }

  const { data, error } = await query.limit(1);

  if (error) {
    return {
      ok: false,
      schemaGate: gateFromError(error),
      draft: null,
      error: error.message,
    };
  }

  const rows = Array.isArray(data) ? data : [];
  return {
    ok: true,
    schemaGate: {
      supported: true,
      table: DOCUMENT_DRAFTS_TABLE,
      missing: [],
      error: null,
    },
    draft: parseDraftRow(rows[0] ?? null),
    error: null,
  };
}
