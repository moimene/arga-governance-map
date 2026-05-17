/**
 * F5.G11 — Contract test: Microsoft Sentinel Log Ingestion shape
 * Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §7
 *
 * Valida que los eventos OTel-shaped que emite
 * `src/lib/telemetry/observability.ts` (F4.G20) tienen la forma esperada
 * por la Data Collection Rule de Microsoft Sentinel cuando se cablee el
 * Edge Function feed (sprint posterior).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

const SentinelSeverity = z.enum(["info", "warning", "error", "critical"]);

const SentinelLogEntrySchema = z.object({
  TimeGenerated: z.string().datetime(),
  OperationName: z.string().min(1),
  Severity: SentinelSeverity,
  Properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

type SentinelLogEntry = z.infer<typeof SentinelLogEntrySchema>;

// Adapter desde el shape de observability.ts al shape Sentinel.
function adaptObservabilityToSentinel(event: {
  name: string;
  severity: "info" | "warning" | "error" | "critical";
  timestamp: string;
  attributes: Record<string, string | number | boolean | null | undefined>;
}): SentinelLogEntry {
  const props: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(event.attributes)) {
    props[k] = v ?? null;
  }
  return {
    TimeGenerated: event.timestamp,
    OperationName: event.name,
    Severity: event.severity,
    Properties: props,
  };
}

describe("Microsoft Sentinel log ingestion contract", () => {
  it("rls.denied event maps cleanly to SentinelLogEntry", () => {
    const adapted = adaptObservabilityToSentinel({
      name: "rls.denied",
      severity: "warning",
      timestamp: "2026-05-16T12:00:00.000Z",
      attributes: {
        table: "agreements",
        operation: "update",
        user_id: null,
        tenant_id: "00000000-0000-0000-0000-000000000001",
      },
    });
    expect(() => SentinelLogEntrySchema.parse(adapted)).not.toThrow();
    expect(adapted.OperationName).toBe("rls.denied");
    expect(adapted.Properties.table).toBe("agreements");
    expect(adapted.Properties.user_id).toBe(null);
  });

  it("audit_chain.drift event with critical severity is valid", () => {
    const adapted = adaptObservabilityToSentinel({
      name: "audit_chain.drift",
      severity: "critical",
      timestamp: "2026-05-16T12:00:01.000Z",
      attributes: {
        last_valid_id: "abc-123",
        detected_at: "2026-05-16T11:59:00.000Z",
        delta_count: 4,
      },
    });
    expect(() => SentinelLogEntrySchema.parse(adapted)).not.toThrow();
    expect(adapted.Severity).toBe("critical");
  });

  it("rejects entry with unknown severity (forward-compat)", () => {
    const bad = {
      TimeGenerated: "2026-05-16T12:00:00.000Z",
      OperationName: "rls.denied",
      Severity: "panic",
      Properties: {},
    };
    expect(() => SentinelLogEntrySchema.parse(bad)).toThrow();
  });

  it("rejects entry with non-primitive Properties values", () => {
    const bad = {
      TimeGenerated: "2026-05-16T12:00:00.000Z",
      OperationName: "test",
      Severity: "info",
      Properties: { nested: { ok: true } },
    };
    expect(() => SentinelLogEntrySchema.parse(bad)).toThrow();
  });
});

// Endpoint productivo esperado (no implementado):
//   POST https://<dce>.eastus-1.ingest.monitor.azure.com/dataCollectionRules/
//        <dcr-immutableid>/streams/Custom-ARGAGovernance_CL?api-version=2023-01-01
//   Authorization: Bearer <client-credentials JWT>
//   Body: SentinelLogEntry[] (batch).
