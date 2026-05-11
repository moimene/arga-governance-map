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
      const { data, error } = await supabase
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
      if (error) throw error;
      if (!data?.id) throw new Error("INSERT agenda_items no devolvió id");
      return data.id as string;
    },
    onSuccess: (_id, vars) => {
      // Invalidar para que la UI refresque inmediatamente
      queryClient.invalidateQueries({ queryKey: ["meeting_agenda_sources", vars.meetingId] });
      queryClient.invalidateQueries({ queryKey: ["agenda_items", vars.meetingId] });
      queryClient.invalidateQueries({
        queryKey: ["meeting", vars.meetingId],
      });
    },
  });
}
