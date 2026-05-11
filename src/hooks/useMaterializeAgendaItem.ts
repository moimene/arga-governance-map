/**
 * Hook `useMaterializeAgendaItem` (Codex P2 round 6).
 *
 * Materializa un row en `agenda_items` on-demand desde un punto que viene
 * de la convocatoria (source_table='convocatorias') o de la agenda libre
 * de sesión. Es prerrequisito para `reclassify_agenda_item_kind` que
 * requiere un agenda_item_id real.
 *
 * Flujo:
 *  1. INSERT en agenda_items con (meeting_id, tenant_id, order_number,
 *     title, kind, decision_subtype).
 *  2. Invalida queries derivadas (`meeting_agenda_sources`, `agenda_items`,
 *     `agenda_item_kind_changelog`) para que la UI refleje el nuevo row.
 *  3. Devuelve el nuevo `id` para que el caller pueda pasarlo al dialog
 *     de reclasificación.
 *
 * Codex P2 (round 6) reportó que el chip "Reclasificar" estaba
 * permanentemente disabled para puntos de convocatoria porque
 * `useCreateMeetingFromConvocatoria` solo inserta `meetings`, no
 * `agenda_items`. Este hook cierra ese gap on-demand.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AgendaItemKind } from "@/lib/secretaria/agenda-kind";

interface MaterializeAgendaItemParams {
  meetingId: string;
  tenantId: string;
  orderNumber: number;
  title: string;
  kind?: AgendaItemKind | null;
  decisionSubtype?: string | null;
}

export function useMaterializeAgendaItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MaterializeAgendaItemParams): Promise<string> => {
      if (!params.meetingId || !params.tenantId) {
        throw new Error("meetingId y tenantId son obligatorios para materializar");
      }
      const safeTitle = (params.title ?? "").trim().slice(0, 240) || "Punto sin título";
      // Codex P2 round 15: idempotencia. Si dos clientes con cache stale
      // intentan materializar el mismo (meeting_id, order_number) concurrente,
      // el UNIQUE ix_agenda_items_meeting_order (000066) rechaza duplicados.
      // En lugar de fallar, primero intentamos INSERT y si choca con UNIQUE
      // (23505), hacemos SELECT del row existente y devolvemos su id.
      const insertResult = await supabase
        .from("agenda_items")
        .insert({
          meeting_id: params.meetingId,
          tenant_id: params.tenantId,
          order_number: params.orderNumber,
          title: safeTitle,
          // Default conservador a DELIBERATIVO si no viene kind explícito
          // (espejo de normalizeAgendaItemKind del cliente).
          kind: (params.kind ?? "DELIBERATIVO") as string,
          decision_subtype: params.decisionSubtype ?? null,
        })
        .select("id")
        .single();

      if (insertResult.error) {
        // UNIQUE violation → otro cliente ya materializó. SELECT y devolver id.
        const isUniqueViolation =
          (insertResult.error as { code?: string }).code === "23505" ||
          /duplicate key|unique/i.test(insertResult.error.message ?? "");
        if (isUniqueViolation) {
          const { data: existing, error: selErr } = await supabase
            .from("agenda_items")
            .select("id")
            .eq("meeting_id", params.meetingId)
            .eq("order_number", params.orderNumber)
            .maybeSingle();
          if (selErr) throw selErr;
          if (!existing?.id) {
            throw new Error("INSERT colisionó por UNIQUE pero SELECT no encontró el row");
          }
          return existing.id as string;
        }
        throw insertResult.error;
      }
      if (!insertResult.data?.id) throw new Error("INSERT agenda_items no devolvió id");
      return insertResult.data.id as string;
    },
    onSuccess: (_id, vars) => {
      // Codex P2 round 7: queryKey real es
      //   ['secretaria', tenantId, 'meetings', meetingId, 'agenda-sources']
      // (definido en useMeetingAgendaSources). El key plano que usábamos antes
      // era no-op silencioso. Invalidamos el subtree completo de meetings del
      // tenant para refrescar agenda-sources + byId + cualquier query derivada.
      queryClient.invalidateQueries({
        queryKey: ["secretaria", vars.tenantId, "meetings"],
      });
      // También el changelog WORM por si la UI muestra historial de cambios.
      queryClient.invalidateQueries({
        queryKey: ["agenda_item_kind_changelog"],
      });
    },
  });
}
