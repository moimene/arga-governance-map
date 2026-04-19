import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  computePlantillasMetrics,
  PlantillaProtegidaRow,
  LeadingMetrics,
  LaggingMetrics,
} from "@/lib/plantillas-metrics";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

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
  return useQuery({
    queryKey: ["plantillas", "metrics"],
    queryFn: async (): Promise<UsePlantillasMetricsResult> => {
      // Fetch all plantillas for the demo tenant
      const { data: plantillas, error } = await supabase
        .from("plantillas_protegidas")
        .select("id, tipo, adoption_mode, estado, created_at, fecha_aprobacion")
        .eq("tenant_id", DEMO_TENANT)
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
