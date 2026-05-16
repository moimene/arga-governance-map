import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  recordNormativeMaintenanceEvent,
  runNormativeFrameworkBackfill,
  type NormativeFrameworkStatusRow,
  type NormativeMaintenanceCloudEvent,
} from "@/lib/secretaria/normative-maintenance-cloud";

export function useNormativeFrameworkCloudStatus(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["secretaria_normative_framework_status", tenantId, entityId ?? "none"],
    enabled: !!tenantId && !!entityId,
    staleTime: 60_000,
    queryFn: async (): Promise<NormativeFrameworkStatusRow | null> => {
      const { data, error } = await supabase
        .from("secretaria_normative_framework_status")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .maybeSingle();
      if (error) throw error;
      return (data as NormativeFrameworkStatusRow | null) ?? null;
    },
  });
}

export function useRecordNormativeMaintenanceEvent() {
  const { tenantId } = useTenantContext();

  return useMutation({
    mutationFn: async (event: Omit<NormativeMaintenanceCloudEvent, "tenantId">) => {
      if (!tenantId) throw new Error("tenantId requerido");
      return recordNormativeMaintenanceEvent(supabase, {
        ...event,
        tenantId,
      });
    },
  });
}

export function useRunNormativeFrameworkBackfill() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { apply: boolean }) => {
      if (!tenantId) throw new Error("tenantId requerido");
      return runNormativeFrameworkBackfill(supabase, {
        tenantId,
        apply: input.apply,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretaria_normative_framework_status"] });
      queryClient.invalidateQueries({ queryKey: ["secretaria_normative_backfill_runs"] });
    },
  });
}
