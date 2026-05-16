import { describe, expect, it, vi } from "vitest";
import {
  buildNormativeEventRpcPayload,
  recordNormativeMaintenanceEvent,
  runNormativeFrameworkBackfill,
} from "@/lib/secretaria/normative-maintenance-cloud";

describe("normative-maintenance-cloud", () => {
  it("mapea el evento de mantenimiento al contrato RPC gobernado", () => {
    const payload = buildNormativeEventRpcPayload({
      tenantId: "tenant-1",
      action: "effective_rule_viewed",
      societyId: "soc-1",
      matter: "AUMENTO_CAPITAL",
      userRole: "legal_ops",
      before: { status: "INCOMPLETO" },
      after: { status: "OK" },
      durationMs: 42,
      attributes: { source_count: 5 },
    });

    expect(payload).toEqual({
      tenant_id: "tenant-1",
      entity_id: "soc-1",
      event_name: "effective_rule_viewed",
      matter: "AUMENTO_CAPITAL",
      user_role: "legal_ops",
      before_state: { status: "INCOMPLETO" },
      after_state: { status: "OK" },
      duration_ms: 42,
      attributes: { source_count: 5 },
      event_dedupe_key: null,
    });
  });

  it("registra eventos mediante fn_secretaria_record_normative_event", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "event-id", error: null });

    await expect(
      recordNormativeMaintenanceEvent(
        { rpc },
        {
          tenantId: "tenant-1",
          action: "template_assigned",
          societyId: "soc-1",
          userRole: "editor",
        },
      ),
    ).resolves.toBe("event-id");

    expect(rpc).toHaveBeenCalledWith("fn_secretaria_record_normative_event", {
      p_event: expect.objectContaining({
        tenant_id: "tenant-1",
        entity_id: "soc-1",
        event_name: "template_assigned",
        user_role: "editor",
      }),
    });
  });

  it("ejecuta el backfill en modo simulación o aplicación", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        run_id: "run-1",
        mode: "APPLY",
        tenant_id: "tenant-1",
        entities_scanned: 3,
        entities_updated: 3,
        details: [],
      },
      error: null,
    });

    await expect(
      runNormativeFrameworkBackfill({ rpc }, { tenantId: "tenant-1", apply: true }),
    ).resolves.toMatchObject({ mode: "APPLY", entities_scanned: 3 });

    expect(rpc).toHaveBeenCalledWith("fn_secretaria_backfill_normative_framework", {
      p_tenant_id: "tenant-1",
      p_apply: true,
    });
  });

  it("propaga errores de RPC con mensaje jurídico-operativo", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "function missing" } });

    await expect(
      runNormativeFrameworkBackfill({ rpc }, { tenantId: "tenant-1", apply: false }),
    ).rejects.toThrow("function missing");
  });
});
