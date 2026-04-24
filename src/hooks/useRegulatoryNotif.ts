import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

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
