import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  computePlantillasMetrics,
  PlantillaProtegidaRow,
  LeadingMetrics,
  LaggingMetrics,
} from "@/lib/plantillas-metrics";

export interface UsePlantillasMetricsResult {
  leading: LeadingMetrics;
  lagging: LaggingMetrics;
  plantillas: PlantillaProtegidaRow[];
  alertas: Array<{
    tipo: 'WARNING' | 'ERROR';
    mensaje: string;
    plantilla_id?: string;
  }>;
}

/**
 * Hook to fetch plantillas_protegidas and compute leading/lagging metrics
 */
export function usePlantillasMetrics() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["plantillas", tenantId, "metrics"],
    enabled: !!tenantId,
    queryFn: async (): Promise<UsePlantillasMetricsResult> => {
      // Fetch all plantillas for the tenant
      const { data: plantillas, error } = await supabase
        .from("plantillas_protegidas")
        .select("id, tipo, adoption_mode, estado, created_at, fecha_aprobacion")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const plantillasData = (plantillas ?? []) as PlantillaProtegidaRow[];

      // Compute metrics using pure function
      const metricsResult = computePlantillasMetrics(plantillasData);

      return {
        leading: metricsResult.leading,
        lagging: metricsResult.lagging,
        plantillas: plantillasData,
        alertas: metricsResult.alertas,
      };
    },
  });
}
