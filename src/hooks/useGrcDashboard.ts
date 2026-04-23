import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export function useGrcKpis() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "kpis", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [risks, incidents, exceptions, regNots] = await Promise.all([
        supabase
          .from("risks")
          .select("id, residual_score, status")
          .eq("tenant_id", tenantId!),
        supabase
          .from("incidents")
          .select("id, status, is_major_incident")
          .eq("tenant_id", tenantId!),
        supabase
          .from("exceptions")
          .select("id, status, expires_at")
          .eq("tenant_id", tenantId!),
        supabase
          .from("regulatory_notifications")
          .select("id, status, notification_deadline")
          .eq("tenant_id", tenantId!),
      ]);

      const criticalRisks = (risks.data ?? []).filter(
        (r) => (r.residual_score ?? 0) >= 15
      ).length;
      const openIncidents = (incidents.data ?? []).filter(
        (i) => i.status !== "Cerrado"
      ).length;
      const majorOpen = (incidents.data ?? []).filter(
        (i) => i.is_major_incident && i.status !== "Cerrado"
      ).length;
      const pendingExceptions = (exceptions.data ?? []).filter(
        (e) => e.status === "Pendiente"
      ).length;
      const pendingRegNots = (regNots.data ?? []).filter(
        (n) => n.status === "Pendiente"
      ).length;

      return {
        criticalRisks,
        openIncidents,
        majorOpen,
        pendingExceptions,
        pendingRegNots,
      };
    },
  });
}
