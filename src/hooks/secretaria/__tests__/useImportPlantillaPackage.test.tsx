import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@tanstack/react-query";
import * as __realModule1 from "@/context/TenantContext";
import * as __realModule2 from "@/hooks/useCurrentUser";
import * as __realModule3 from "@/lib/secretaria/template-admin/import-preflight";
import * as __realModule4 from "@/integrations/supabase/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GatePreResult } from "@/lib/secretaria/template-admin/types";

if (typeof vi.hoisted !== "function") {
  (vi as { hoisted?: <T>(factory: () => T) => T }).hoisted = <T,>(factory: () => T) => factory();
}

const mocks = vi.hoisted(() => ({
  runTemplateImportPreflight: vi.fn(),
  invalidateQueries: vi.fn(),
  plantillaInsertCalls: [] as Array<Record<string, unknown>>,
  changelogInsertCalls: [] as Array<Record<string, unknown>>,
}));

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@tanstack/react-query", { ...__realModule0 }],
  ["@/context/TenantContext", { ...__realModule1 }],
  ["@/hooks/useCurrentUser", { ...__realModule2 }],
  ["@/lib/secretaria/template-admin/import-preflight", { ...__realModule3 }],
  ["@/integrations/supabase/client", { ...__realModule4 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (input: unknown) => Promise<unknown>;
    onSuccess?: (data: unknown) => void;
  }) => ({
    mutateAsync: async (input: unknown) => {
      const data = await mutationFn(input);
      onSuccess?.(data);
      return data;
    },
    isPending: false,
  }),
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({ tenantId: "tenant-1" }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: { id: "user-1", email: "legal@arga-seguros.com" },
  }),
}));

vi.mock("@/lib/secretaria/template-admin/import-preflight", () => ({
  runTemplateImportPreflight: mocks.runTemplateImportPreflight,
}));

vi.mock("@/integrations/supabase/client", () => {
  function changelogLookupChain() {
    const chain = {
      eq: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    return chain;
  }

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "plantillas_protegidas") {
          return {
            insert: vi.fn((row: Record<string, unknown>) => {
              mocks.plantillaInsertCalls.push(row);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: { id: "tpl-new" }, error: null })),
                })),
              };
            }),
            delete: vi.fn(() => ({ eq: vi.fn() })),
          };
        }
        if (table === "plantilla_changelog") {
          return {
            select: vi.fn(() => changelogLookupChain()),
            insert: vi.fn((row: Record<string, unknown>) => {
              mocks.changelogInsertCalls.push(row);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: { id: "log-new" }, error: null })),
                })),
              };
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    },
  };
});

import { useImportPlantillaPackage } from "../useImportPlantillaPackage";

const validPayload = {
  template: {
    tipo: "MODELO_ACUERDO",
    materia: "APROBACION_CUENTAS",
    materia_acuerdo: undefined,
    jurisdiccion: "ES",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Art. 160 LSC",
  },
  capa1_inmutable: "PRIMERO.- Aprobar cuentas.".padEnd(120, "x"),
  capa2_variables: [],
  capa3_editables: [],
};

const warningGate: GatePreResult = {
  ok: true,
  issues: [
    {
      severity: "WARNING",
      code: "GEN_IF_COUNT",
      message: "warning",
    },
  ],
  summary: { blocking: 0, warning: 1, info: 0 },
};

describe("useImportPlantillaPackage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runTemplateImportPreflight.mockResolvedValue({
      ok: false,
      reason: "WARNINGS_NEED_ACK",
      gatePre: warningGate,
    });
    mocks.plantillaInsertCalls = [];
    mocks.changelogInsertCalls = [];
  });

  it("no escribe BORRADOR si hay warnings sin ackMotivo", async () => {
    const hook = useImportPlantillaPackage();
    const outcome = await hook.mutateAsync({ json: { ok: true } });

    expect(outcome).toEqual({
      ok: false,
      reason: "WARNINGS_NEED_ACK",
      gatePre: warningGate,
    });
    expect(mocks.plantillaInsertCalls).toEqual([]);
    expect(mocks.changelogInsertCalls).toEqual([]);
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(mocks.runTemplateImportPreflight).toHaveBeenCalledWith({
      json: { ok: true },
      tenantId: "tenant-1",
      ackMotivo: undefined,
      requireWarningAck: true,
    });
  });

  it("escribe BORRADOR cuando warnings vienen con ackMotivo valido", async () => {
    mocks.runTemplateImportPreflight.mockResolvedValue({
      ok: true,
      payload: validPayload,
      gatePre: warningGate,
    });

    const hook = useImportPlantillaPackage();
    const outcome = await hook.mutateAsync({
      json: { ok: true },
      ackMotivo: "Warnings revisadas por Comite Legal el 12/05/2026.",
    });

    expect(outcome).toEqual({
      ok: true,
      plantillaId: "tpl-new",
      gatePre: warningGate,
    });
    expect(mocks.plantillaInsertCalls).toHaveLength(1);
    expect(mocks.changelogInsertCalls).toHaveLength(1);
    expect(mocks.changelogInsertCalls[0]).toMatchObject({
      tenant_id: "tenant-1",
      plantilla_id: "tpl-new",
      autor: "legal@arga-seguros.com",
    });
    expect(mocks.changelogInsertCalls[0].to_version).toMatch(/^1\.0\.0#idemp:[0-9a-f]{8}$/);
    expect(JSON.parse(mocks.changelogInsertCalls[0].diff_summary as string)).toMatchObject({
      action: "IMPORT",
      logical_to_version: "1.0.0",
      ack_motivo: "Warnings revisadas por Comite Legal el 12/05/2026.",
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["plantillas_protegidas"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["plantilla_changelog"],
    });
  });
});
