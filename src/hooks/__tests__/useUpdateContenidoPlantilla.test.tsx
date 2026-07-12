import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@tanstack/react-query";
import * as __realModule1 from "@/context/TenantContext";
import * as __realModule2 from "@/hooks/useCurrentUser";
import * as __realModule3 from "@/integrations/supabase/client";
import { describe, it, expect, beforeEach, vi } from "vitest";

if (typeof vi.hoisted !== "function") {
  (vi as { hoisted?: <T>(factory: () => T) => T }).hoisted = <T,>(factory: () => T) => factory();
}

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  current: {
    version: "1.0.0",
    estado: "BORRADOR",
    capa1_inmutable: "Texto anterior",
    capa2_variables: [],
    capa3_editables: [],
    notas_legal: null,
  } as Record<string, unknown> | null,
  updateCalls: [] as Array<Record<string, unknown>>,
  updatedRow: { id: "tpl-1" } as { id: string } | null,
  changelogInsertError: null as unknown,
  changelogInsertCalls: [] as Array<Record<string, unknown>>,
}));

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@tanstack/react-query", { ...__realModule0 }],
  ["@/context/TenantContext", { ...__realModule1 }],
  ["@/hooks/useCurrentUser", { ...__realModule2 }],
  ["@/integrations/supabase/client", { ...__realModule3 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useQuery: vi.fn(),
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

vi.mock("@/integrations/supabase/client", () => {
  function currentSelectChain() {
    const chain = {
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: mocks.current, error: null })),
    };
    return chain;
  }

  function updateChain(payload: Record<string, unknown>) {
    mocks.updateCalls.push(payload);
    const chain = {
      error: null,
      eq: vi.fn(() => chain),
      select: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: mocks.updatedRow, error: null })),
    };
    return chain;
  }

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
            select: vi.fn(() => currentSelectChain()),
            update: vi.fn((payload: Record<string, unknown>) => updateChain(payload)),
          };
        }
        if (table === "plantilla_changelog") {
          return {
            select: vi.fn(() => changelogLookupChain()),
            insert: vi.fn((row: Record<string, unknown>) => {
              mocks.changelogInsertCalls.push(row);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: mocks.changelogInsertError ? null : { id: "log-1" },
                    error: mocks.changelogInsertError,
                  })),
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

import { useUpdateContenidoPlantilla } from "../usePlantillasProtegidas";

describe("useUpdateContenidoPlantilla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.current = {
      version: "1.0.0",
      estado: "BORRADOR",
      capa1_inmutable: "Texto anterior",
      capa2_variables: [],
      capa3_editables: [],
      notas_legal: null,
    };
    mocks.updateCalls = [];
    mocks.updatedRow = { id: "tpl-1" };
    mocks.changelogInsertCalls = [];
    mocks.changelogInsertError = null;
  });

  it("guarda contenido BORRADOR y registra changelog", async () => {
    const hook = useUpdateContenidoPlantilla();

    await hook.mutateAsync({
      id: "tpl-1",
      capa1_inmutable: "Texto nuevo",
      motivo: "Corrección legal de borrador",
    });

    expect(mocks.updateCalls).toEqual([{ capa1_inmutable: "Texto nuevo" }]);
    expect(mocks.changelogInsertCalls).toHaveLength(1);
    expect(mocks.changelogInsertCalls[0]).toMatchObject({
      tenant_id: "tenant-1",
      plantilla_id: "tpl-1",
      bump_type: "PATCH",
      autor: "legal@arga-seguros.com",
    });
    expect(JSON.parse(mocks.changelogInsertCalls[0].diff_summary as string)).toMatchObject({
      action: "CONTENT",
      layers: ["capa1"],
      logical_to_version: "1.0.0",
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["plantilla_changelog"],
    });
  });

  it("revierte contenido si falla el changelog", async () => {
    mocks.changelogInsertError = { message: "log failed" };
    const hook = useUpdateContenidoPlantilla();

    await expect(
      hook.mutateAsync({ id: "tpl-1", capa1_inmutable: "Texto nuevo" }),
    ).rejects.toBeTruthy();

    expect(mocks.updateCalls).toEqual([
      { capa1_inmutable: "Texto nuevo" },
      { capa1_inmutable: "Texto anterior" },
    ]);
  });

  it("rechaza edición si la plantilla no está en BORRADOR", async () => {
    mocks.current = { ...mocks.current!, estado: "ACTIVA" };
    const hook = useUpdateContenidoPlantilla();

    await expect(
      hook.mutateAsync({ id: "tpl-1", capa1_inmutable: "Texto nuevo" }),
    ).rejects.toThrow(/BORRADOR/);

    expect(mocks.updateCalls).toEqual([]);
    expect(mocks.changelogInsertCalls).toEqual([]);
  });

  it("rechaza el guardado si el borrador cambia de estado durante la actualización", async () => {
    mocks.updatedRow = null;
    const hook = useUpdateContenidoPlantilla();

    await expect(
      hook.mutateAsync({ id: "tpl-1", capa1_inmutable: "Texto nuevo" }),
    ).rejects.toThrow(/cambió de estado/);

    expect(mocks.changelogInsertCalls).toEqual([]);
  });
});
