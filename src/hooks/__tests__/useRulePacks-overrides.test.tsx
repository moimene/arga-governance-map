import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realSupabaseModule from "@/integrations/supabase/client";
import * as __realTenantModule from "@/context/TenantContext";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ENTITY_ID = "6d7ed736-f263-4531-a59d-c6ca0cd41602";
const tenantState: { tenantId: string | null } = { tenantId: TENANT_ID };
const queryCalls: Array<{ kind: "from" | "select" | "eq"; key: string; value?: string }> = [];
const overrideRows = [
  {
    id: "override-1",
    entity_id: ENTITY_ID,
    rule_pack_id: "pack-1",
    materia: "AUMENTO_CAPITAL",
    clave: "votacion.mayoria",
    valor: 0.75,
    fuente: "ESTATUTOS",
    referencia: "art. 18 Estatutos",
  },
];

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realSupabaseModule }],
  ["@/context/TenantContext", { ...__realTenantModule }],
];

__afterAllRestore(() => {
  for (const [specifier, exports] of __realModulesForRestore) {
    __bunMockRestore.module(specifier, () => exports);
  }
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      queryCalls.push({ kind: "from", key: table });
      const chain: {
        select: (columns: string) => typeof chain;
        eq: (column: string, value: string) => typeof chain;
        then: <T>(
          resolve: (value: { data: typeof overrideRows; error: null }) => T,
          reject?: (reason: unknown) => unknown,
        ) => Promise<T>;
      } = {
        select: (columns) => {
          queryCalls.push({ kind: "select", key: columns });
          return chain;
        },
        eq: (column, value) => {
          queryCalls.push({ kind: "eq", key: column, value });
          return chain;
        },
        then: (resolve, reject) =>
          Promise.resolve({ data: overrideRows, error: null }).then(resolve, reject),
      };
      return chain;
    }),
  },
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({ tenantId: tenantState.tenantId }),
}));

import { useRuleParamOverrides } from "../useRulePacks";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

describe("useRuleParamOverrides", () => {
  beforeEach(() => {
    tenantState.tenantId = TENANT_ID;
    queryCalls.length = 0;
  });

  it("loads only the overrides scoped to tenant and entity with a stable cache key", async () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useRuleParamOverrides(ENTITY_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(overrideRows);
    expect(queryCalls).toEqual([
      { kind: "from", key: "rule_param_overrides" },
      { kind: "select", key: "*" },
      { kind: "eq", key: "tenant_id", value: TENANT_ID },
      { kind: "eq", key: "entity_id", value: ENTITY_ID },
    ]);
    const queryKey = ["ruleParamOverrides", TENANT_ID, ENTITY_ID];
    expect(queryClient.getQueryData(queryKey)).toEqual(overrideRows);
    expect(queryClient.getQueryCache().find({ queryKey })?.options.staleTime).toBe(60_000);
  });

  it("does not query without entityId or tenantId", async () => {
    const first = createWrapper();
    const withoutEntity = renderHook(() => useRuleParamOverrides(), { wrapper: first.wrapper });
    expect(withoutEntity.result.current.fetchStatus).toBe("idle");
    expect(queryCalls).toHaveLength(0);
    withoutEntity.unmount();

    tenantState.tenantId = null;
    const second = createWrapper();
    const withoutTenant = renderHook(() => useRuleParamOverrides(ENTITY_ID), {
      wrapper: second.wrapper,
    });
    expect(withoutTenant.result.current.fetchStatus).toBe("idle");
    expect(queryCalls).toHaveLength(0);
    withoutTenant.unmount();
  });
});
