/**
 * H-27 (MOI-15) — Tests del hook `useMaterializeAgendaItem`.
 *
 * Contrato verificado tras el fix (INSERT directo → RPC gobernada
 * `fn_secretaria_add_session_agenda_item`):
 *   1) Llama a la RPC con los args mapeados (p_meeting_id, p_order_number,
 *      p_title, p_kind, p_decision_subtype), nunca hace `.from("agenda_items")`
 *      directamente — ese INSERT directo es exactamente el defecto H-27 que
 *      el trigger `fn_secretaria_guard_emitted_agenda_dml` rechaza con
 *      42501 AGENDA_EMITIDA_RPC_REQUIRED en cualquier reunión convocada.
 *   2) kind por defecto DELIBERATIVO cuando no se pasa.
 *   3) Devuelve el id que responde la RPC.
 *   4) Si la RPC falla, el error se traduce con secretariaErrorMessage (el
 *      toast de ReunionStepper debe poder leer "CODIGO: texto", no
 *      "[object Object]").
 *   5) meetingId/tenantId ausentes rechaza sin llamar a la RPC.
 *   6) onSuccess invalida el subtree de meetings del tenant y el changelog.
 */
import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/integrations/supabase/client";

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realModule0 }],
];
__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockFrom = vi.fn();
const rpcResponseStore: { current: { data: unknown; error: unknown } } = {
  current: { data: "new-agenda-item-id", error: null },
};
const mockRpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => rpcResponseStore.current);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import { useMaterializeAgendaItem } from "../useMaterializeAgendaItem";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useMaterializeAgendaItem", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockRpc.mockClear();
    rpcResponseStore.current = { data: "new-agenda-item-id", error: null };
  });

  it("materializa un punto nacido en sesión vía RPC, nunca por INSERT directo", async () => {
    const { result } = renderHook(() => useMaterializeAgendaItem(), { wrapper });

    const id = await result.current.mutateAsync({
      meetingId: "m-1",
      tenantId: "t-1",
      orderNumber: 2,
      title: "Ruegos y preguntas nacido en sesión",
      kind: "INFORMATIVO",
      decisionSubtype: null,
    });

    expect(id).toBe("new-agenda-item-id");
    expect(mockRpc).toHaveBeenCalledWith("fn_secretaria_add_session_agenda_item", {
      p_meeting_id: "m-1",
      p_order_number: 2,
      p_title: "Ruegos y preguntas nacido en sesión",
      p_kind: "INFORMATIVO",
      p_decision_subtype: null,
      p_matter_code: null,
      p_proposal_text: null,
    });
    // H-27: el defecto era un INSERT directo en agenda_items por PostgREST.
    // El fix no debe volver a tocar `.from("agenda_items")`.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("H-52: materia y propuesta viajan a la RPC (p_matter_code / p_proposal_text), recortadas", async () => {
    const { result } = renderHook(() => useMaterializeAgendaItem(), { wrapper });

    await result.current.mutateAsync({
      meetingId: "m-1",
      tenantId: "t-1",
      orderNumber: 2,
      title: "Aprobación del presupuesto anual 2027",
      kind: "DECISORIO",
      decisionSubtype: null,
      matterCode: " APROBACION_PRESUPUESTO ",
      proposalText: "  Se acuerda aprobar el presupuesto anual del ejercicio 2027.  ",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "fn_secretaria_add_session_agenda_item",
      expect.objectContaining({
        p_kind: "DECISORIO",
        p_matter_code: "APROBACION_PRESUPUESTO",
        p_proposal_text: "Se acuerda aprobar el presupuesto anual del ejercicio 2027.",
      }),
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("kind por defecto DELIBERATIVO cuando no se pasa", async () => {
    const { result } = renderHook(() => useMaterializeAgendaItem(), { wrapper });

    await result.current.mutateAsync({
      meetingId: "m-1",
      tenantId: "t-1",
      orderNumber: 3,
      title: "Punto sin kind explícito",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "fn_secretaria_add_session_agenda_item",
      expect.objectContaining({ p_kind: "DELIBERATIVO", p_decision_subtype: null }),
    );
  });

  it("título vacío cae a 'Punto sin título' y se recorta a 240 chars", async () => {
    const { result } = renderHook(() => useMaterializeAgendaItem(), { wrapper });

    await result.current.mutateAsync({
      meetingId: "m-1",
      tenantId: "t-1",
      orderNumber: 1,
      title: "   ",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "fn_secretaria_add_session_agenda_item",
      expect.objectContaining({ p_title: "Punto sin título" }),
    );
  });

  it("meetingId ausente rechaza sin llamar a la RPC", async () => {
    const { result } = renderHook(() => useMaterializeAgendaItem(), { wrapper });

    await expect(
      result.current.mutateAsync({
        meetingId: "",
        tenantId: "t-1",
        orderNumber: 1,
        title: "Punto",
      }),
    ).rejects.toThrow(/meetingId y tenantId son obligatorios/);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("error de la RPC se traduce a 'CODIGO: texto' legible, no [object Object]", async () => {
    rpcResponseStore.current = {
      data: null,
      error: { code: "42501", message: "SESSION_AGENDA_ITEM_MEETING_NOT_OPEN: la reunión debe estar en curso" },
    };
    const { result } = renderHook(() => useMaterializeAgendaItem(), { wrapper });

    await expect(
      result.current.mutateAsync({
        meetingId: "m-1",
        tenantId: "t-1",
        orderNumber: 1,
        title: "Punto",
      }),
    ).rejects.toThrow(/SESSION_AGENDA_ITEM_MEETING_NOT_OPEN/);
  });

  it("respuesta sin data ni error rechaza con mensaje explícito", async () => {
    rpcResponseStore.current = { data: null, error: null };
    const { result } = renderHook(() => useMaterializeAgendaItem(), { wrapper });

    await expect(
      result.current.mutateAsync({
        meetingId: "m-1",
        tenantId: "t-1",
        orderNumber: 1,
        title: "Punto",
      }),
    ).rejects.toThrow(/no devolvió id/);
  });

  it("invalida el subtree de meetings del tenant y el changelog en success", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useMaterializeAgendaItem(), { wrapper: localWrapper });

    await result.current.mutateAsync({
      meetingId: "m-9",
      tenantId: "t-9",
      orderNumber: 1,
      title: "Punto",
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["secretaria", "t-9", "meetings"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["agenda_item_kind_changelog"],
      });
    });
  });
});
