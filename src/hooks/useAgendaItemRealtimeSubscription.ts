import { useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Task 6 — Realtime subscription a `agenda_items` filtrada por `meeting_id`.
 *
 * Contrato G4 (spec 2026-05-12 §7): cuando el SECRETARIO reclasifica el
 * `kind` de un punto durante una reunión OPEN, otros tabs/usuarios
 * abiertos sobre la misma reunión deben:
 *   1) Recibir un toast informativo con el cambio.
 *   2) Invalidar la query `['agenda_items', meetingId]` para refetch.
 *
 * Diseño:
 *   - Subscribe solo cuando `meetingId` es truthy.
 *   - Filtro Postgres-side por `meeting_id=eq.${meetingId}` para no
 *     consumir ancho de banda en reuniones ajenas.
 *   - Cleanup en `useEffect` return (removeChannel) para evitar fugas de
 *     conexiones cuando el componente se desmonta o el `meetingId` cambia.
 *   - Toast solo si `kind` cambió (otros UPDATEs sobre la misma fila
 *     —order_number, title, etc.— no deben generar ruido).
 */
export function useAgendaItemRealtimeSubscription(meetingId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!meetingId) return;

    const channel = supabase
      .channel(`agenda_items_${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agenda_items",
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload: { old: Record<string, unknown> | null; new: Record<string, unknown> | null }) => {
          const oldKind = (payload.old as { kind?: string } | null)?.kind;
          const newKind = (payload.new as { kind?: string } | null)?.kind;
          const orderNumber = (payload.new as { order_number?: number } | null)?.order_number;

          if (oldKind !== newKind) {
            toast.info(
              `Punto ${orderNumber ?? "?"} reclasificado de ${oldKind ?? "?"} a ${newKind ?? "?"}`,
              { description: "El Secretario ha modificado la naturaleza de este punto." },
            );
            queryClient.invalidateQueries({ queryKey: ["agenda_items", meetingId] });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meetingId, queryClient]);
}
