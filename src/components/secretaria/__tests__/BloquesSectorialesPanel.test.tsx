// src/components/secretaria/__tests__/BloquesSectorialesPanel.test.tsx
/**
 * WORM contract regression: when bloque_insertions INSERT fails (RLS,
 * constraint, network), the textarea must NOT be updated. Otherwise the
 * generated document contains untracked sector text without a matching
 * audit row in bloque_insertions, violating R5/F4.
 *
 * The fix: persist audit FIRST, only call onCampoLibreChange after success.
 * On failure, error toast and textarea unchanged.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BloquesSectorialesPanel } from "../BloquesSectorialesPanel";
import type { ReactNode } from "react";

// Mock toast to capture success/error calls
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock hooks — we control what they return
const mockMutateAsync = vi.fn();
const mockBloque = {
  id: "test-bloque-id",
  clave_bloque: "TEST_BLOQUE_WORM",
  version: "1.0.0",
  sector: "BANCA",
  materia_aplicable: ["TEST_MATERIA"],
  texto_aprobado: "Texto aprobado WORM test.",
  referencia_legal: null,
  descripcion: null,
  estado: "ACTIVA" as const,
};

vi.mock("@/hooks/useBloquesSectoriales", () => ({
  useBloquesSectoriales: () => ({
    data: [mockBloque],
    isLoading: false,
  }),
  useInsertBloque: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

vi.mock("@/hooks/useEntitySettingsCatalog", () => ({
  useEntitySettingsCatalog: () => ({
    byKey: new Map([["sector_regulado", { default_value: "BANCA" }]]),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { value: "BANCA" } }),
          }),
        }),
      }),
    }),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const baseProps = {
  entityId: "test-entity",
  agreementId: "test-agreement",
  materia: "TEST_MATERIA",
  capa3Editables: [{ campo: "campo_libre_sectorial" }],
};

describe("BloquesSectorialesPanel — WORM contract", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    vi.clearAllMocks();
  });

  it("calls onCampoLibreChange ONLY after audit insert succeeds", async () => {
    const onCampoLibreChange = vi.fn();
    mockMutateAsync.mockResolvedValueOnce(undefined);

    render(
      <BloquesSectorialesPanel
        {...baseProps}
        campoLibreValue=""
        onCampoLibreChange={onCampoLibreChange}
      />,
      { wrapper },
    );

    const insertBtn = await screen.findByRole("button", { name: /insertar bloque test_bloque_worm/i });
    fireEvent.click(insertBtn);

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());
    await waitFor(() => expect(onCampoLibreChange).toHaveBeenCalledWith("Texto aprobado WORM test."));
  });

  it("does NOT update textarea when audit insert fails", async () => {
    const onCampoLibreChange = vi.fn();
    mockMutateAsync.mockRejectedValueOnce(new Error("RLS violation"));
    // Silence the explicit console.error from the catch path so test output stays clean
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <BloquesSectorialesPanel
        {...baseProps}
        campoLibreValue="texto previo"
        onCampoLibreChange={onCampoLibreChange}
      />,
      { wrapper },
    );

    const insertBtn = await screen.findByRole("button", { name: /insertar bloque test_bloque_worm/i });
    fireEvent.click(insertBtn);

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());
    // Critical assertion: textarea NOT modified when audit failed (WORM contract)
    expect(onCampoLibreChange).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
