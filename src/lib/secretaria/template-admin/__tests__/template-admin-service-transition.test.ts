import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/integrations/supabase/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlantillaCandidate } from "../types";

const mockState = {
  current: null as PlantillaCandidate | null,
  rpcCalls: [] as Array<{ name: string; params: Record<string, unknown> }>,
  rpcData: null as Record<string, unknown> | null,
  rpcError: null as unknown,
  rpcResponses: [] as Array<{
    data: Record<string, unknown> | null;
    error: unknown;
  }>,
};

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realModule0 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/integrations/supabase/client", () => {
  function selectChain() {
    const chain = {
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: mockState.current, error: null })),
    };
    return chain;
  }

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table !== "plantillas_protegidas") throw new Error(`Unexpected table ${table}`);
        return { select: vi.fn(() => selectChain()) };
      }),
      rpc: vi.fn(async (name: string, params: Record<string, unknown>) => {
        mockState.rpcCalls.push({ name, params });
        const queued = mockState.rpcResponses.shift();
        if (queued) return queued;
        return { data: mockState.rpcData, error: mockState.rpcError };
      }),
    },
  };
});

import { transitionTemplateState } from "../template-admin-service";

const baseTemplate = (overrides: Partial<PlantillaCandidate> = {}): PlantillaCandidate => ({
  id: "tpl-1",
  tipo: "MODELO_ACUERDO",
  materia: "APROBACION_CUENTAS",
  materia_acuerdo: null,
  jurisdiccion: "ES",
  version: "1.0.0",
  estado: "REVISADA",
  organo_tipo: "JUNTA_GENERAL",
  adoption_mode: "MEETING",
  tipo_social: null,
  aprobada_por: null,
  fecha_aprobacion: null,
  referencia_legal: "Art. 160 LSC",
  capa1_inmutable: "PRIMERO.- Aprobar cuentas.".padEnd(120, "x"),
  capa2_variables: [],
  capa3_editables: [],
  ...overrides,
});

describe("template-admin-service — transición RPC", () => {
  beforeEach(() => {
    mockState.current = baseTemplate();
    mockState.rpcCalls = [];
    mockState.rpcError = null;
    mockState.rpcResponses = [];
    mockState.rpcData = {
      ok: true,
      plantilla_id: "tpl-1",
      from: "REVISADA",
      to: "APROBADA",
      changelog_id: "log-1",
      operation_id: "00000000-0000-4000-8000-000000000001",
      replayed: false,
      bindings_moved: 0,
    };
  });

  it("transición a APROBADA falla sin aprobadaPor/fechaAprobacion", async () => {
    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "APROBADA",
        motivo: "aprobación legal",
        actor: "legal@arga-seguros.com",
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toEqual({ ok: false, reason: "MISSING_APPROVAL_DATA" });
    expect(mockState.rpcCalls).toEqual([]);
  });

  it("APROBADA exige una aprobación nueva aunque la fila conserve metadatos antiguos", async () => {
    mockState.current = baseTemplate({
      aprobada_por: "Aprobador histórico",
      fecha_aprobacion: "2025-01-15",
    });

    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "APROBADA",
        motivo: "nueva revisión jurídica",
        actor: "legal@arga-seguros.com",
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toEqual({ ok: false, reason: "MISSING_APPROVAL_DATA" });
    expect(mockState.rpcCalls).toEqual([]);
  });

  it("envía una única RPC con CAS, operation UUID y sin actor ni tenant", async () => {
    const operationId = "00000000-0000-4000-8000-000000000001";
    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "APROBADA",
        motivo: "aprobación legal",
        actor: "actor-no-confiable@example.com",
        aprobadaPor: "Comité Legal Garrigues",
        fechaAprobacion: "2026-05-12",
        operationId,
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toMatchObject({
      ok: true,
      plantillaId: "tpl-1",
      changelogId: "log-1",
      operationId,
      replayed: false,
      bindingsMoved: 0,
    });
    expect(mockState.rpcCalls).toEqual([
      {
        name: "fn_secretaria_transition_template_state",
        params: {
          p_template_id: "tpl-1",
          p_expected_from: "REVISADA",
          p_to_state: "APROBADA",
          p_motivo: "aprobación legal",
          p_operation_id: operationId,
          p_expected_predecessor_id: null,
          p_aprobada_por: "Comité Legal Garrigues",
          p_fecha_aprobacion: "2026-05-12",
          p_ack_warnings: false,
        },
      },
    ]);
    const sentParams = mockState.rpcCalls[0].params;
    expect(sentParams).not.toHaveProperty("actor");
    expect(sentParams).not.toHaveProperty("p_actor");
    expect(sentParams).not.toHaveProperty("tenant_id");
    expect(sentParams).not.toHaveProperty("p_tenant_id");
  });

  it("genera operation UUID cuando el caller no lo aporta", async () => {
    await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "APROBADA",
        motivo: "aprobación legal",
        actor: "legal@arga-seguros.com",
        aprobadaPor: "Comité Legal Garrigues",
        fechaAprobacion: "2026-05-12",
      },
      { tenantId: "tenant-1" },
    );

    expect(mockState.rpcCalls[0].params.p_operation_id).toEqual(expect.any(String));
    expect(String(mockState.rpcCalls[0].params.p_operation_id)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("repite una sola vez el mismo payload si el commit pudo confirmarse y se perdió la respuesta", async () => {
    const operationId = "00000000-0000-4000-8000-000000000777";
    mockState.rpcResponses = [
      { data: null, error: { message: "TypeError: Failed to fetch" } },
      {
        data: {
          ok: true,
          plantilla_id: "tpl-1",
          from: "REVISADA",
          to: "APROBADA",
          changelog_id: "log-1",
          operation_id: operationId,
          replayed: true,
          bindings_moved: 0,
        },
        error: null,
      },
    ];

    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "APROBADA",
        motivo: "aprobación legal",
        actor: "legal@arga-seguros.com",
        aprobadaPor: "Comité Legal Garrigues",
        fechaAprobacion: "2026-05-12",
        operationId,
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toMatchObject({ ok: true, operationId, replayed: true });
    expect(mockState.rpcCalls).toHaveLength(2);
    expect(mockState.rpcCalls[1]).toEqual(mockState.rpcCalls[0]);
  });

  it("no reintenta errores SQL deterministas", async () => {
    mockState.rpcData = null;
    mockState.rpcError = { code: "42501", message: "active ADMIN_TENANT role required" };

    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "APROBADA",
        motivo: "aprobación legal",
        actor: "legal@arga-seguros.com",
        aprobadaPor: "Comité Legal Garrigues",
        fechaAprobacion: "2026-05-12",
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toMatchObject({ ok: false, reason: "RPC_FAILED" });
    expect(mockState.rpcCalls).toHaveLength(1);
  });

  it("mapea el guard de asignaciones activas a una salida accionable", async () => {
    mockState.current = baseTemplate({ estado: "ACTIVA" });
    mockState.rpcData = null;
    mockState.rpcError = {
      code: "23514",
      message:
        "ACTIVE_BINDINGS_REQUIRE_REPLACEMENT: active bindings must move through atomic replacement",
    };

    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "ARCHIVADA",
        motivo: "retirada de la versión vigente",
        actor: "legal@arga-seguros.com",
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "ACTIVE_BINDINGS_REQUIRE_REPLACEMENT",
    });
    expect(mockState.rpcCalls).toHaveLength(1);
  });
});
