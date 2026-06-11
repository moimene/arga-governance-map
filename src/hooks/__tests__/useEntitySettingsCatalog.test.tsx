import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/integrations/supabase/client";
// src/hooks/__tests__/useEntitySettingsCatalog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock Supabase client BEFORE importing the hook. The hook reads `supabase`
// at module import time, so the mock must be hoisted. vi.mock() factories run
// before any import in the test file (Vitest hoists them automatically).
//
// Without this mock the test would hit the real Cloud project, and on slow or
// disconnected networks the 5s waitFor times out without the hook ever
// flipping isLoading. The mocked client returns deterministic data
// synchronously through a thenable chain that mimics the PostgREST builder
// API surface used by the hook (from→select→eq→order→order).
const mockCatalogRows = [
  {
    key: "es_cotizada",
    value_type: "enum",
    allowed_values: ["SÍ", "NO"],
    default_value: "NO",
    descripcion: "Test row for unit test",
    categoria: "CONFIG_CONDICIONAL",
    usado_por_plantillas: null,
    estado_catalog: "ACTIVA",
    created_at: "2026-05-11T00:00:00Z",
  },
  {
    key: "sector_regulado",
    value_type: "enum",
    allowed_values: ["BANCA", "SEGUROS", "GENERICO"],
    default_value: "GENERICO",
    descripcion: "Test sector row",
    categoria: "CONFIG_CONDICIONAL",
    usado_por_plantillas: null,
    estado_catalog: "ACTIVA",
    created_at: "2026-05-11T00:00:00Z",
  },
];

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realModule0 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/integrations/supabase/client", () => {
  // Final terminal: the second .order() call returns a thenable that resolves
  // with { data, error }. The hook awaits the builder, so we expose a then().
  const terminal = {
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: mockCatalogRows, error: null }).then(resolve),
  };
  const orderChain = { order: vi.fn(() => terminal) };
  const builder = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => orderChain),
      })),
    })),
  };
  const supabase = {
    from: vi.fn(() => builder),
    // Realtime channel stub: useEffect subscribes/unsubscribes during render.
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  };
  return { supabase };
});

// Import AFTER the mock is registered so the hook resolves to the mocked module.
import { useEntitySettingsCatalog } from "../useEntitySettingsCatalog";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useEntitySettingsCatalog", () => {
  it("loads catalog and exposes Map by key", async () => {
    const { result } = renderHook(() => useEntitySettingsCatalog(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.data).toBeDefined();
    const map = result.current.byKey;
    expect(map.get("es_cotizada")).toBeDefined();
    expect(map.get("es_cotizada")?.value_type).toBe("enum");
  });
});
