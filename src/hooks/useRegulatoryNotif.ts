import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { buildRegulatoryNotificationInsert } from "@/lib/grc/regulatory-notification-insert";

export function useRegulatoryNotifications() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", tenantId, "regulatory-notifications"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regulatory_notifications")
        .select(
          "id, authority, notification_type, notification_deadline, submitted_at, status, reference_number, incident_id, incidents:incident_id(code, title, incident_type, severity)"
        )
        .eq("tenant_id", tenantId!)
        .order("notification_deadline", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * MOI-149 (D-23, alta por pantalla): único camino de escritura sobre
 * `regulatory_notifications` en toda la aplicación. `tenantId` sale de la
 * sesión (`useTenantContext`), nunca del formulario, para que el alta no
 * pueda aterrizar en un tenant distinto del que la creó.
 */
export function useCreateRegulatoryNotification() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      authority: string;
      notificationType?: string | null;
      notificationDeadline?: string | null;
      incidentId?: string | null;
      referenceNumber?: string | null;
    }) => {
      if (!tenantId) throw new Error("Sin tenant de sesión: no se puede dar de alta la notificación.");
      const row = buildRegulatoryNotificationInsert({ ...input, tenantId });
      const { data, error } = await supabase
        .from("regulatory_notifications")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["grc", tenantId, "regulatory-notifications"] });
      qc.invalidateQueries({ queryKey: ["grc", "alertas"] });
      qc.invalidateQueries({ queryKey: ["grc", "incidents"] });
      if (variables.incidentId) {
        qc.invalidateQueries({ queryKey: ["grc", "incident", variables.incidentId] });
      }
    },
  });
}

/** Returns hours until deadline. 0 if overdue. null if no deadline. */
export function hoursUntilDeadline(isoDeadline?: string | null): number | null {
  if (!isoDeadline) return null;
  const ms = new Date(isoDeadline).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 3_600_000));
}

/** Returns countdown string for display */
export function deadlineLabel(isoDeadline?: string | null): string {
  const h = hoursUntilDeadline(isoDeadline);
  if (h === null) return "—";
  if (h === 0) return "VENCIDA";
  if (h < 24) return `${h}h restantes`;
  const days = Math.floor(h / 24);
  const rem = h % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}
