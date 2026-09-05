import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

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

// `RegulatoryClock` describía `aims_regulatory_clocks`, tabla que NINGUNA
// superficie de `src/` lee ni escribe: los relojes se calculan en cliente en
// `incident-clocks.ts` y no se persisten. El tipo se ha retirado para que no
// sugiera una persistencia que no existe; la tabla sigue en Cloud.

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
  // Igual que en la FRIA: `aims_incident_reports` no tiene `qseal_token` ni
  // `tsq_token`. Con ellas en el tipo, `useCreateIncidentReport` —que hace
  // spread del objeto entero— rompía con PGRST204 en cuanto alguien respetara
  // el contrato. No se reintroducen: serían un claim de sello.
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
