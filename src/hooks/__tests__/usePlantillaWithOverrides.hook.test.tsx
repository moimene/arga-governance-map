// src/hooks/__tests__/usePlantillaWithOverrides.hook.test.tsx
/**
 * Codex P2 — verify that consumers can distinguish "overrides still loading"
 * from "overrides loaded (possibly empty)".
 *
 * Without `hasLoadedOverrides`, GenerarDocumentoStepper's effectivePlantilla
 * would replace canonical capa3 with the EMPTY_CAPA3 placeholder while the
 * Supabase query is still in-flight, hiding required Step 2 fields.
 *
 * This test mocks the Supabase client + the canonical plantilla loader so the
 * overrides query never actually resolves (returns an unresolved Promise),
 * forcing isLoading=true and hasLoadedOverrides=false. The canonical
 * capa3_editables array is exposed via the pure merge.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/integrations/supabase/client", () => {
  // overrides query never resolves → isLoading=true, isSuccess=false forever.
  function makeChain() {
    const chain: {
      eq: (col: string, val: string) => typeof chain;
      then: <T>(resolve: (v: { data: unknown; error: null }) => T) => Promise<T>;
    } = {
      eq: () => chain,
      then: () => new Promise<never>(() => {}),
    };
    return chain;
  }
  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => makeChain()),
    })),
  };
  return { supabase };
});

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({ tenantId: "00000000-0000-0000-0000-000000000001" }),
}));

// usePlantillaProtegida — return a synchronous canonical plantilla so the
// canonical capa3 is visible immediately and the only thing pending is the
// overrides query.
vi.mock("../usePlantillasProtegidas", () => ({
  usePlantillaProtegida: () => ({
    data: {
      id: "plantilla-1",
      version: "1.0.0",
      capa3_editables: [
        { campo: "campo_obligatorio", obligatoriedad: "OBLIGATORIO" },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

// Import after mocks.
import { usePlantillaWithOverrides } from "../usePlantillaWithOverrides";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("usePlantillaWithOverrides — loading vs loaded contract (Codex P2)", () => {
  it("exposes isLoading=true and hasLoadedOverrides=false while overrides query is in-flight", () => {
    const { result } = renderHook(
      () => usePlantillaWithOverrides("plantilla-1", "entity-1"),
      { wrapper },
    );

    // Core contract under test (Codex P2): consumers must be able to tell
    // "overrides still loading" apart from "overrides loaded (possibly empty)".
    //  - isLoading=true while the Supabase query is unresolved.
    //  - hasLoadedOverrides=false until the query reports isSuccess.
    // This pair is what GenerarDocumentoStepper uses to preserve canonical
    // capa3_editables instead of falling through to EMPTY_CAPA3.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasLoadedOverrides).toBe(false);
    expect(Array.isArray(result.current.capa3_editables)).toBe(true);
  });
});
