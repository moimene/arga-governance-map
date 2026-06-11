import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/integrations/supabase/client";
import * as __realModule1 from "sonner";
/**
 * Task 6 — Tests del hook `useAgendaItemRealtimeSubscription`.
 *
 * Contrato G4 verificado:
 *   1) Subscribe SOLO si `meetingId` es truthy.
 *   2) Filtro Postgres-side: `meeting_id=eq.${meetingId}` (no bandwidth ajeno).
 *   3) Toast SOLO en cambio de `kind` (otros UPDATEs no deben generar ruido).
 *   4) Cleanup en unmount (removeChannel) — evita fugas de conexiones.
 *
 * Mocks:
 *   - `@/integrations/supabase/client` — channel/on/subscribe encadenables.
 *   - `sonner` — capturar `toast.info`.
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAgendaItemRealtimeSubscription } from "../useAgendaItemRealtimeSubscription";

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockRemoveChannel = vi.fn();
const mockToastInfo = vi.fn();

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realModule0 }],
  ["sonner", { ...__realModule1 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: () => mockRemoveChannel(),
  },
}));

vi.mock("sonner", () => ({
  toast: { info: (...args: unknown[]) => mockToastInfo(...args) },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useAgendaItemRealtimeSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to channel when meetingId provided", () => {
    renderHook(() => useAgendaItemRealtimeSubscription("meeting-123"), { wrapper });

    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "UPDATE",
        table: "agenda_items",
        filter: "meeting_id=eq.meeting-123",
      }),
      expect.any(Function),
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("does NOT subscribe when meetingId undefined", () => {
    renderHook(() => useAgendaItemRealtimeSubscription(undefined), { wrapper });

    expect(mockChannel.on).not.toHaveBeenCalled();
    expect(mockChannel.subscribe).not.toHaveBeenCalled();
  });

  it("toasts when kind changes in payload", () => {
    renderHook(() => useAgendaItemRealtimeSubscription("meeting-123"), { wrapper });

    // Extract the callback passed to .on()
    const callback = mockChannel.on.mock.calls[0][2] as (payload: {
      old: Record<string, unknown> | null;
      new: Record<string, unknown> | null;
    }) => void;

    callback({
      old: { kind: "DELIBERATIVO" },
      new: { kind: "DECISORIO", order_number: 3 },
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      expect.stringContaining("Punto 3 reclasificado"),
      expect.any(Object),
    );
  });

  it("does NOT toast when kind is unchanged", () => {
    renderHook(() => useAgendaItemRealtimeSubscription("meeting-123"), { wrapper });

    const callback = mockChannel.on.mock.calls[0][2] as (payload: {
      old: Record<string, unknown> | null;
      new: Record<string, unknown> | null;
    }) => void;

    callback({
      old: { kind: "DECISORIO" },
      new: { kind: "DECISORIO", order_number: 1 },
    });

    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it("cleans up channel on unmount", () => {
    const { unmount } = renderHook(() => useAgendaItemRealtimeSubscription("meeting-123"), {
      wrapper,
    });

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
