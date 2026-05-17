/**
 * F4.G20 — Production observability (OTel-shaped events)
 * Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §6
 *
 * Concilio K15: sin alertas, ningún control de seguridad sirve. Este
 * módulo emite eventos estructurados (OTel-compatible shape) que pueden
 * ser consumidos por el SIEM Microsoft Sentinel (decisión técnica
 * confirmada en CLAUDE.md) vía Edge Function feed o por la consola de
 * logs de Supabase como fallback.
 *
 * Tipos de eventos críticos:
 *   - rls.denied             — policy RLS bloqueó una operación.
 *   - service_role.usage     — backend code accedió con service_role.
 *   - signed_url.failure     — Edge Function sign-evidence-url devolvió 4xx/5xx.
 *   - audit_chain.drift      — hash chain validation failed.
 *   - storage.403            — request a storage devolvió 403.
 *
 * Cada evento incluye attributes (key-value) y se serializa como JSON.
 * Por defecto se logea a console.warn() (visible en Supabase function
 * logs); cuando se cablee un endpoint Sentinel se sustituye el sink.
 */

export type ObservabilityEventName =
  | "rls.denied"
  | "service_role.usage"
  | "signed_url.failure"
  | "audit_chain.drift"
  | "storage.403"
  | "evidence_bundle.created"
  | "evidence_bundle.superseded";

export type ObservabilityEvent = {
  name: ObservabilityEventName;
  attributes: Record<string, string | number | boolean | null | undefined>;
  severity?: "info" | "warning" | "error" | "critical";
  timestamp?: string;
};

/** Sink configurable — default = console.warn. Edge Function setea Sentinel feed. */
type ObservabilitySink = (event: ObservabilityEvent) => void;

let activeSink: ObservabilitySink = (event) => {
  console.warn(
    "[observability]",
    JSON.stringify({
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
      severity: event.severity ?? "warning",
    }),
  );
};

export function setObservabilitySink(sink: ObservabilitySink): void {
  activeSink = sink;
}

export function emitObservabilityEvent(event: ObservabilityEvent): void {
  try {
    activeSink({
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
      severity: event.severity ?? "warning",
    });
  } catch (e) {
    // Telemetry must never crash the caller — log fallback only.
    console.error("[observability] sink threw:", e);
  }
}

/** Helper: detect RLS denial in PostgrestError and emit rls.denied event. */
export function emitRlsDenied(args: {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  user_id?: string | null;
  tenant_id?: string | null;
  message?: string;
}): void {
  emitObservabilityEvent({
    name: "rls.denied",
    severity: "warning",
    attributes: {
      table: args.table,
      operation: args.operation,
      user_id: args.user_id ?? null,
      tenant_id: args.tenant_id ?? null,
      message: args.message ?? null,
    },
  });
}

/** Helper: signed URL failures (Edge Function sign-evidence-url). */
export function emitSignedUrlFailure(args: {
  bundle_id: string;
  reason: string;
  http_status?: number;
}): void {
  emitObservabilityEvent({
    name: "signed_url.failure",
    severity: "error",
    attributes: {
      bundle_id: args.bundle_id,
      reason: args.reason,
      http_status: args.http_status ?? null,
    },
  });
}

/** Helper: storage 403 (path-prefix policy rejected). */
export function emitStorage403(args: {
  bucket: string;
  path: string;
  user_id?: string | null;
}): void {
  emitObservabilityEvent({
    name: "storage.403",
    severity: "error",
    attributes: {
      bucket: args.bucket,
      path: args.path,
      user_id: args.user_id ?? null,
    },
  });
}

/** Helper: audit chain validation drift (hash mismatch). */
export function emitAuditChainDrift(args: {
  last_valid_id: string | null;
  detected_at: string;
  delta_count: number;
}): void {
  emitObservabilityEvent({
    name: "audit_chain.drift",
    severity: "critical",
    attributes: {
      last_valid_id: args.last_valid_id ?? null,
      detected_at: args.detected_at,
      delta_count: args.delta_count,
    },
  });
}

/** Helper: service_role usage (track unexpected callers). */
export function emitServiceRoleUsage(args: {
  caller_function: string;
  source: "edge_function" | "backend_script" | "frontend_anomaly";
  reason?: string;
}): void {
  emitObservabilityEvent({
    name: "service_role.usage",
    severity: args.source === "frontend_anomaly" ? "critical" : "info",
    attributes: {
      caller_function: args.caller_function,
      source: args.source,
      reason: args.reason ?? null,
    },
  });
}

/**
 * Configuración recomendada en Sentinel (Microsoft):
 *   - Connector: Custom Logs via Log Analytics workspace.
 *   - Table: ARGAGovernance_CL.
 *   - Alert rule (rls.denied): umbral >50 eventos/min en 1h = paginar Compliance.
 *   - Alert rule (signed_url.failure): umbral >10/min en 5min = paginar Platform.
 *   - Alert rule (audit_chain.drift): umbral >=1 = paginar P0.
 *   - Alert rule (storage.403): umbral >20/5min = paginar Platform.
 *   - Alert rule (service_role.usage frontend_anomaly): umbral >=1 = paginar Security.
 *
 * El feed Edge Function (TODO siguiente sprint) hará:
 *   POST a log-ingestion API de Sentinel con batch de eventos cada 30s.
 */
