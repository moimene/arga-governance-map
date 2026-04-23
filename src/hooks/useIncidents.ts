import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type RegulatoryNotificationLite = {
  id: string;
  authority: string;
  status: string;
  notification_deadline: string | null;
  notification_type: string;
  submitted_at: string | null;
  reference_number: string | null;
};

export type IncidentWithJoins = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  severity: string | null;
  incident_type: string;
  is_major_incident: boolean | null;
  status: string;
  country_code: string | null;
  detection_date: string | null;
  containment_date: string | null;
  resolution_date: string | null;
  obligation_id: string | null;
  root_cause: string | null;
  lessons_learned: string | null;
  regulatory_notification_required: boolean | null;
  obligations?: { code?: string | null; title?: string | null } | null;
  regulatory_notifications?: RegulatoryNotificationLite[] | null;
};

export function useIncidents(incidentType?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "incidents", tenantId, incidentType ?? "all"],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("incidents")
        .select(
          "id, code, title, description, severity, incident_type, is_major_incident, status, country_code, detection_date, containment_date, resolution_date, obligation_id, root_cause, lessons_learned, regulatory_notification_required, obligations:obligation_id(code, title), regulatory_notifications(id, authority, status, notification_deadline, notification_type, submitted_at, reference_number)"
        )
        .eq("tenant_id", tenantId!)
        .order("detection_date", { ascending: false });

      if (incidentType) {
        q = q.eq("incident_type", incidentType);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as IncidentWithJoins[];
    },
  });
}

export function useIncident(id?: string) {
  return useQuery({
    queryKey: ["grc", "incident", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select(
          "id, code, title, description, severity, incident_type, is_major_incident, status, country_code, detection_date, containment_date, resolution_date, obligation_id, root_cause, lessons_learned, regulatory_notification_required, obligations:obligation_id(code, title), regulatory_notifications(id, authority, status, notification_deadline, notification_type, submitted_at, reference_number)"
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as IncidentWithJoins | null;
    },
  });
}

export function useCreateIncident() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      severity: string;
      incident_type: string;
      is_major_incident: boolean;
      status: string;
      country_code: string;
      detection_date: string;
      regulatory_notification_required: boolean;
    }) => {
      const { data, error } = await supabase
        .from("incidents")
        .insert({ ...input, tenant_id: tenantId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grc", "incidents"] });
      qc.invalidateQueries({ queryKey: ["grc", "kpis"] });
      qc.invalidateQueries({ queryKey: ["grc", "alertas"] });
    },
  });
}
