import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  evaluateMultiregimeIncident,
  calculateRiaDeadline,
  calculateGdprDeadline,
  calculateDoraDeadlines,
  formatRemainingTime,
  MultiregimeClocks,
} from "@/lib/aims/incident-clocks";

export interface IncidentRegimeCase {
  id: string;
  tenant_id: string;
  incident_id: string;
  entity_id: string | null;
  regime_code: "RIA" | "GDPR" | "DORA";
  status: "OPEN" | "IN_INVESTIGATION" | "NOTIFIED" | "NOT_APPLICABLE_JUSTIFIED" | "CLOSED";
  applicability_rationale: string | null;
  target_authority: string;
  lead_role: "AI_OFFICER" | "DPO" | "CISO" | "LEGAL";
  closed_at: string | null;
  closure_reason: string | null;
  evidence_bundle_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RegulatoryClock {
  id: string;
  tenant_id: string;
  incident_regime_id: string;
  clock_type: string;
  trigger_at: string;
  deadline_at: string;
  status: "RUNNING" | "SATISFIED" | "EXPIRED" | "PAUSED_JUSTIFIED";
  delay_justification: string | null;
  stopped_at: string | null;
}

export interface IncidentReport {
  id: string;
  tenant_id: string;
  incident_regime_id: string;
  report_type: "INITIAL" | "INTERMEDIATE" | "FINAL" | "DELAY_JUSTIFICATION" | "NON_APPLICABILITY";
  authority: string;
  sent_at: string | null;
  submission_channel: string | null;
  acknowledgment_ref: string | null;
  is_complete: boolean;
  content_summary: string | null;
  manifest_hash: string | null;
  qseal_token: string | null;
  tsq_token: string | null;
}

/**
 * Consulta los subexpedientes por régimen asociados a un incidente.
 */
export function useIncidentRegimes(incidentId: string | undefined) {
  const { tenantId } = useTenantContext();

  return useQuery<IncidentRegimeCase[]>({
    queryKey: ["aims_incident_regimes", tenantId, incidentId],
    queryFn: tenantId && incidentId ? async () => {
      const { data, error } = await supabase
        .from("aims_incident_regimes" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as IncidentRegimeCase[];
    } : skipToken,
  });
}

/**
 * Actualiza un subexpediente de régimen de forma aislada (Aislamiento de Cierres).
 */
export function useUpdateIncidentRegime() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<IncidentRegimeCase>;
    }) => {
      const { data, error } = await supabase
        .from("aims_incident_regimes" as never)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as IncidentRegimeCase;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["aims_incident_regimes", tenantId, data.incident_id] });
    },
  });
}

/**
 * Registra un informe formal de notificación con acuse para un subexpediente.
 */
export function useCreateIncidentReport() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();

  return useMutation({
    mutationFn: async (report: Omit<IncidentReport, "id" | "tenant_id">) => {
      const { data, error } = await supabase
        .from("aims_incident_reports" as never)
        .insert({
          ...report,
          tenant_id: tenantId!,
          sent_at: report.sent_at || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as IncidentReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aims_incident_reports", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["aims_incident_regimes", tenantId] });
    },
  });
}
