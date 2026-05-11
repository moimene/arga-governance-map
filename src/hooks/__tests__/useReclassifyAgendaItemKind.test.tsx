/**
 * Task 5 — Tests del hook `useReclassifyAgendaItemKind`.
 *
 * Contrato verificado:
 *   1) RBAC: rechaza si `roles` no incluye SECRETARIO.
 *   2) Sanity: rechaza `motivo` < 3 chars antes de tocar BD.
 *   3) Matriz P7: usa `checkReclassificationAllowed` y rechaza si denegada.
 *   4) Orden de operaciones: RPC `set_kind_change_context` ANTES del UPDATE
 *      (para que trigger T3 capture autor + motivo).
 *   5) Invalida queries en success.
 *
 * Mocks:
 *   - `@/integrations/supabase/client` — from()/rpc() encadenables.
 *   - `@/hooks/useCurrentUser` — controlar identidad.
 *   - `@/hooks/useUserRole` — controlar roles.
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// -- Supabase mock con orden de llamadas trackeado --------------------------
const callLog: string[] = [];
const mockFromSelect = vi.fn();
const mockFromUpdate = vi.fn();
const mockRpc = vi.fn();

function makeMaybeSingleChain(rowProvider: () => { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => {
      callLog.push("maybeSingle");
      return rowProvider();
    }),
  };
  return chain;
}

function makeUpdateChain() {
  const chain = {
    update: vi.fn((patch: Record<string, unknown>) => {
      mockFromUpdate(patch);
      return chain;
    }),
    eq: vi.fn(async () => {
      callLog.push("update");
      return { data: null, error: null };
    }),
  };
  return chain;
}

// Stores controlables por test
const meetingMetaStore: { current: { data: unknown; error: unknown } } = {
  current: {
    data: {
      status: "DRAFT",
      quorum_data: null,
      governing_bodies: { body_type: "CDA" },
    },
    error: null,
  },
};
const agendaItemStore: { current: { data: unknown; error: unknown } } = {
  current: {
    data: { kind: "DELIBERATIVO" },
    error: null,
  },
};

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        callLog.push(`from:${table}`);
        if (table === "meetings") {
          return makeMaybeSingleChain(() => meetingMetaStore.current);
        }
        if (table === "agenda_items") {
          // El test decide si va a select (maybeSingle) o update.
          // El hook llama PRIMERO a select (currentKind), luego update.
          // Distinguimos por la siguiente call esperada en callLog.
          // Estrategia: detectar si el último consumer ya hizo maybeSingle.
          if (!callLog.includes("agenda_items_select_done")) {
            const chain = makeMaybeSingleChain(() => {
              callLog.push("agenda_items_select_done");
              return agendaItemStore.current;
            });
            mockFromSelect(table);
            return chain;
          }
          // Segunda invocación → es el UPDATE
          return makeUpdateChain();
        }
        return makeMaybeSingleChain(() => ({ data: null, error: null }));
      }),
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        callLog.push(`rpc:${name}`);
        mockRpc(name, args);
        return { data: null, error: null };
      }),
    },
  };
});

// -- Mocks de hooks dependientes --------------------------------------------
const currentUserStore: { current: { id: string; email: string | null } | null } = {
  current: { id: "user-secretario-001", email: "secre@arga.test" },
};
const rolesStore: { current: string[] } = { current: ["SECRETARIO"] };

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ user: currentUserStore.current, loading: false }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    roles: rolesStore.current,
    permissions: [],
    hasPermission: () => true,
    isLoading: false,
  }),
}));

// Import después de los mocks
import { useReclassifyAgendaItemKind } from "../useReclassifyAgendaItemKind";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useReclassifyAgendaItemKind", () => {
  beforeEach(() => {
    callLog.length = 0;
    mockFromSelect.mockClear();
    mockFromUpdate.mockClear();
    mockRpc.mockClear();
    currentUserStore.current = { id: "user-secretario-001", email: "secre@arga.test" };
    rolesStore.current = ["SECRETARIO"];
    meetingMetaStore.current = {
      data: {
        status: "DRAFT",
        quorum_data: null,
        governing_bodies: { body_type: "CDA" },
      },
      error: null,
    };
    agendaItemStore.current = {
      data: { kind: "DELIBERATIVO" },
      error: null,
    };
  });

  it("happy path: SECRETARIO + DRAFT + CONSEJO → RPC antes de UPDATE, success", async () => {
    const { result } = renderHook(() => useReclassifyAgendaItemKind(), { wrapper });

    await result.current.mutateAsync({
      agendaItemId: "ai-1",
      meetingId: "m-1",
      newKind: "DECISORIO",
      motivo: "Elevación tras consulta legal",
    });

    // Codex P1 #1 fix: orden esperado tras consolidación a RPC transaccional
    //   from:meetings → maybeSingle (meeting meta)
    //   from:agenda_items → maybeSingle (current kind)
    //   rpc:reclassify_agenda_item_kind (set_config + UPDATE atomicamente)
    const rpcIdx = callLog.indexOf("rpc:reclassify_agenda_item_kind");
    expect(rpcIdx).toBeGreaterThan(-1);

    // v1.3.1 Codex P1 #1 security: p_user_id NO se pasa — auth.uid() derivado server-side
    expect(mockRpc).toHaveBeenCalledWith("reclassify_agenda_item_kind", {
      p_agenda_item_id: "ai-1",
      p_meeting_id: "m-1",
      p_new_kind: "DECISORIO",
      p_motivo: "Elevación tras consulta legal",
    });
    // mockFromUpdate NO debe ser llamado en v1.3.1+ — UPDATE ahora va dentro del RPC
    expect(mockFromUpdate).not.toHaveBeenCalled();
  });

  it("RBAC: rechaza si user no tiene rol SECRETARIO", async () => {
    rolesStore.current = ["CONSEJERO", "AUDITOR"];
    const { result } = renderHook(() => useReclassifyAgendaItemKind(), { wrapper });

    await expect(
      result.current.mutateAsync({
        agendaItemId: "ai-1",
        meetingId: "m-1",
        newKind: "DECISORIO",
        motivo: "Motivo válido",
      }),
    ).rejects.toThrow(/403/);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFromUpdate).not.toHaveBeenCalled();
  });

  it("motivo < 3 chars: rechaza antes de tocar Supabase", async () => {
    const { result } = renderHook(() => useReclassifyAgendaItemKind(), { wrapper });

    await expect(
      result.current.mutateAsync({
        agendaItemId: "ai-1",
        meetingId: "m-1",
        newKind: "DECISORIO",
        motivo: "ab",
      }),
    ).rejects.toThrow(/motivo.*3 caracteres/i);

    expect(callLog).not.toContain("rpc:reclassify_agenda_item_kind");
    expect(mockFromUpdate).not.toHaveBeenCalled();
  });

  it("usuario no autenticado: rechaza 401", async () => {
    currentUserStore.current = null;
    const { result } = renderHook(() => useReclassifyAgendaItemKind(), { wrapper });

    await expect(
      result.current.mutateAsync({
        agendaItemId: "ai-1",
        meetingId: "m-1",
        newKind: "DECISORIO",
        motivo: "Motivo válido",
      }),
    ).rejects.toThrow(/401/);
  });

  it("Matriz P7 deniega: JUNTA formal + OPEN + DELIB→DECIS → vicio procedimiento", async () => {
    meetingMetaStore.current = {
      data: {
        status: "OPEN",
        quorum_data: { is_universal: false },
        governing_bodies: { body_type: "JUNTA_GENERAL" },
      },
      error: null,
    };

    const { result } = renderHook(() => useReclassifyAgendaItemKind(), { wrapper });

    await expect(
      result.current.mutateAsync({
        agendaItemId: "ai-1",
        meetingId: "m-1",
        newKind: "DECISORIO",
        motivo: "Intento de elevación en junta formal",
      }),
    ).rejects.toThrow(/Matriz P7.*Junta convocada formalmente/i);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFromUpdate).not.toHaveBeenCalled();
  });

  it("Matriz P7 permite: JUNTA universal + OPEN → continúa hasta UPDATE", async () => {
    meetingMetaStore.current = {
      data: {
        status: "OPEN",
        quorum_data: { is_universal: true },
        governing_bodies: { body_type: "JUNTA_GENERAL" },
      },
      error: null,
    };

    const { result } = renderHook(() => useReclassifyAgendaItemKind(), { wrapper });

    await result.current.mutateAsync({
      agendaItemId: "ai-1",
      meetingId: "m-1",
      newKind: "DECISORIO",
      motivo: "Junta universal con unanimidad acreditada",
    });

    expect(mockRpc).toHaveBeenCalled();
    // v1.3.1 Codex P1 #1: UPDATE va dentro del RPC, no via supabase.from().update()
    expect(mockFromUpdate).not.toHaveBeenCalled();
  });

  it("meeting no encontrada: rechaza con mensaje claro", async () => {
    meetingMetaStore.current = { data: null, error: null };
    const { result } = renderHook(() => useReclassifyAgendaItemKind(), { wrapper });

    await expect(
      result.current.mutateAsync({
        agendaItemId: "ai-1",
        meetingId: "m-NOT-FOUND",
        newKind: "DECISORIO",
        motivo: "Motivo válido",
      }),
    ).rejects.toThrow(/Meeting m-NOT-FOUND no encontrada/);
  });

  it("agenda_item no encontrado: rechaza con mensaje claro", async () => {
    agendaItemStore.current = { data: null, error: null };
    const { result } = renderHook(() => useReclassifyAgendaItemKind(), { wrapper });

    await expect(
      result.current.mutateAsync({
        agendaItemId: "ai-NOT-FOUND",
        meetingId: "m-1",
        newKind: "DECISORIO",
        motivo: "Motivo válido",
      }),
    ).rejects.toThrow(/agenda_item ai-NOT-FOUND no encontrado/);
  });

  it("RPC reclassify_agenda_item_kind falla: aborta sin commitear cambio", async () => {
    const { result } = renderHook(() => useReclassifyAgendaItemKind(), { wrapper });

    // Capturar la implementación actual y sustituirla puntualmente
    const { supabase } = await import("@/integrations/supabase/client");
    const rpcSpy = vi
      .spyOn(supabase, "rpc")
      .mockImplementationOnce(
        // @ts-expect-error mock with simplified shape — runtime contract is { data, error }
        async () => ({ data: null, error: { message: "reclassify_agenda_item_kind falló" } }),
      );

    await expect(
      result.current.mutateAsync({
        agendaItemId: "ai-1",
        meetingId: "m-1",
        newKind: "DECISORIO",
        motivo: "Motivo válido",
      }),
    ).rejects.toThrow(/reclassify_agenda_item_kind falló/);

    expect(mockFromUpdate).not.toHaveBeenCalled();
    rpcSpy.mockRestore();
  });

  it("invalida queries en success: agenda_items[meetingId] + agenda_item_kind_changelog[id]", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useReclassifyAgendaItemKind(), {
      wrapper: localWrapper,
    });

    await result.current.mutateAsync({
      agendaItemId: "ai-9",
      meetingId: "m-9",
      newKind: "DECISORIO",
      motivo: "Motivo válido",
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["agenda_items", "m-9"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["agenda_item_kind_changelog", "ai-9"],
      });
    });
  });
});
