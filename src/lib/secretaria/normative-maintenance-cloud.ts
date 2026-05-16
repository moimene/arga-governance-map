import type {
  NormativeMaintenanceAuditEventContract,
  NormativeMaintenanceRole,
} from "@/lib/secretaria/mesa-control-societaria";

export type NormativeFrameworkCloudStatus =
  | "OK"
  | "INCOMPLETO"
  | "REQUIERE_REVISION"
  | "CONFLICTO_JURISDICCIONAL";

export interface NormativeFrameworkStatusRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  status: NormativeFrameworkCloudStatus;
  jurisdiction: string | null;
  company_form: string | null;
  rule_set_company_form: string | null;
  has_rule_set: boolean;
  has_organs: boolean;
  has_statutes: boolean;
  has_pactos: boolean;
  has_minimum_templates: boolean;
  has_conflict_of_laws: boolean;
  source_coverage_pct: number;
  missing_items: string[];
  diagnostics: Record<string, unknown>;
  last_backfill_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NormativeMaintenanceCloudEvent {
  tenantId: string;
  action: NormativeMaintenanceAuditEventContract["action"];
  societyId?: string | null;
  matter?: string | null;
  userRole: NormativeMaintenanceRole;
  before?: unknown;
  after?: unknown;
  durationMs?: number;
  attributes?: Record<string, unknown>;
  eventDedupeKey?: string | null;
}

export interface NormativeBackfillResult {
  run_id: string;
  mode: "DRY_RUN" | "APPLY";
  tenant_id: string;
  profile_hash?: string;
  entities_scanned: number;
  entities_updated: number;
  counts_by_status?: Partial<Record<NormativeFrameworkCloudStatus, number>>;
  details: Array<{
    entity_id: string;
    entity_name: string | null;
    status: NormativeFrameworkCloudStatus;
    missing_items: string[];
    source_coverage_pct: number;
  }>;
}

type RpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function requireNoRpcError(error: { message?: string } | null, context: string) {
  if (error) throw new Error(error.message ?? context);
}

export function buildNormativeEventRpcPayload(input: NormativeMaintenanceCloudEvent) {
  return {
    tenant_id: input.tenantId,
    entity_id: input.societyId ?? null,
    event_name: input.action,
    matter: input.matter ?? null,
    user_role: input.userRole,
    before_state: input.before ?? null,
    after_state: input.after ?? null,
    duration_ms: input.durationMs ?? null,
    attributes: input.attributes ?? {},
    event_dedupe_key: input.eventDedupeKey ?? null,
  };
}

export async function recordNormativeMaintenanceEvent(
  client: RpcClient,
  input: NormativeMaintenanceCloudEvent,
): Promise<string> {
  const { data, error } = await client.rpc("fn_secretaria_record_normative_event", {
    p_event: buildNormativeEventRpcPayload(input),
  });
  requireNoRpcError(error, "No se pudo registrar el evento normativo.");
  return String(data);
}

export async function runNormativeFrameworkBackfill(
  client: RpcClient,
  input: { tenantId: string; apply: boolean },
): Promise<NormativeBackfillResult> {
  const { data, error } = await client.rpc("fn_secretaria_backfill_normative_framework", {
    p_tenant_id: input.tenantId,
    p_apply: input.apply,
  });
  requireNoRpcError(error, "No se pudo ejecutar el backfill normativo.");
  return data as NormativeBackfillResult;
}
