/**
 * Hook `useMaterializeAgendaItem` (Codex P2 round 6; H-27/MOI-15).
 *
 * Materializa un row en `agenda_items` on-demand para un punto nacido en
 * sesión (origin MEETING_FLOOR, sin convocatoria). Es prerrequisito para
 * `reclassify_agenda_item_kind`, que requiere un agenda_item_id real.
 *
 * Flujo:
 *  1. RPC `fn_secretaria_add_session_agenda_item(meeting_id, order_number,
 *     title, kind, decision_subtype, matter_code, proposal_text)`. Llamarla
 *     otra vez sobre el mismo punto nacido en sesión completa su materia y
 *     su propuesta (H-52) mientras no se haya votado.
 *  2. Invalida queries derivadas (`meeting_agenda_sources`, `agenda_items`,
 *     `agenda_item_kind_changelog`) para que la UI refleje el nuevo row.
 *  3. Devuelve el nuevo `id` para que el caller pueda pasarlo al dialog
 *     de reclasificación.
 *
 * H-27 (MOI-15, 2026-09-27): este hook hacía un INSERT directo por
 * PostgREST. Para cualquier reunión nacida de una convocatoria EMITIDA, el
 * trigger `fn_secretaria_guard_emitted_agenda_dml` rechaza CUALQUIER
 * escritura directa en `agenda_items` con 42501
 * `AGENDA_EMITIDA_RPC_REQUIRED` — exige una RPC gobernada, y no existía
 * ninguna para un punto nacido en sesión. El paso "Añadir punto nacido en
 * sesión" (DebatesStep en ReunionStepper) quedaba inutilizable en cualquier
 * reunión convocada. La migración `20260928151000` crea la RPC gobernada;
 * este hook la llama en vez de insertar directamente. El contrato del
 * hook (params/retorno) no cambia, así que ningún caller necesita tocarse.
 *
 * Codex P2 (round 6) reportó que el chip "Reclasificar" estaba
 * permanentemente disabled para puntos de convocatoria porque
 * `useCreateMeetingFromConvocatoria` solo inserta `meetings`, no
 * `agenda_items`. Este hook cierra ese gap on-demand.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { secretariaErrorMessage } from "@/lib/secretaria/supabase-error-message";
import type { AgendaItemKind } from "@/lib/secretaria/agenda-kind";

interface MaterializeAgendaItemParams {
  meetingId: string;
  tenantId: string;
  orderNumber: number;
  title: string;
  kind?: AgendaItemKind | null;
  decisionSubtype?: string | null;
  /** H-52: materia catalogada del punto (se valida contra materia_catalog en servidor). */
  matterCode?: string | null;
  /** H-52: propuesta exacta del punto DECISORIO; el acta la exige. */
  proposalText?: string | null;
}

export function useMaterializeAgendaItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MaterializeAgendaItemParams): Promise<string> => {
      if (!params.meetingId || !params.tenantId) {
        throw new Error("meetingId y tenantId son obligatorios para materializar");
      }
      const safeTitle = (params.title ?? "").trim().slice(0, 240) || "Punto sin título";
      const rpcArgs = {
        p_meeting_id: params.meetingId,
        p_order_number: params.orderNumber,
        p_title: safeTitle,
        // Default conservador a DELIBERATIVO si no viene kind explícito
        // (espejo de normalizeAgendaItemKind del cliente).
        p_kind: (params.kind ?? "DELIBERATIVO") as string,
        p_decision_subtype: params.decisionSubtype ?? null,
        // H-52 (MOI-15): sin estos dos argumentos el punto nacido en sesión
        // quedaba sin materia ni propuesta y el acta no se podía generar.
        // Se envían siempre (aunque sean null) para que PostgREST resuelva
        // la firma de 7 argumentos.
        p_matter_code: params.matterCode?.trim() || null,
        p_proposal_text: params.proposalText?.trim() || null,
      };
      // La RPC ya es idempotente en servidor (Codex P2 round 15 vivía aquí
      // client-side contra un INSERT directo; ahora vive dentro de
      // fn_secretaria_add_session_agenda_item con FOR UPDATE sobre el
      // (meeting_id, order_number) existente): dos clientes con cache stale
      // que materialicen el mismo punto reciben el mismo id, no un 23505.
      const { data, error } = await supabase.rpc("fn_secretaria_add_session_agenda_item", rpcArgs);
      if (error) {
        throw new Error(secretariaErrorMessage(error, "No se pudo materializar el punto de agenda."));
      }
      if (!data) throw new Error("fn_secretaria_add_session_agenda_item no devolvió id");
      return data as string;
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
