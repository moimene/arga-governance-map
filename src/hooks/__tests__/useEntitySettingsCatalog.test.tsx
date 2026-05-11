// src/hooks/__tests__/useEntitySettingsCatalog.test.tsx
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEntitySettingsCatalog } from "../useEntitySettingsCatalog";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useEntitySettingsCatalog", () => {
  it("loads catalog and exposes Map by key", async () => {
    const { result } = renderHook(() => useEntitySettingsCatalog(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Asume seed Task 3 ejecutado — catalog tiene al menos `es_cotizada`
    expect(result.current.data).toBeDefined();
    const map = result.current.byKey;
    expect(map.get("es_cotizada")).toBeDefined();
    expect(map.get("es_cotizada")?.value_type).toBe("enum");
  });
});
