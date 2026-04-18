import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export function useIncidents(incidentType?: string) {
  return useQuery({
    queryKey: ["grc", "incidents", incidentType ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("incidents")
        .select(
          "id, code, title, description, severity, incident_type, is_major_incident, status, country_code, detection_date, containment_date, resolution_date, obligation_id, root_cause, lessons_learned, regulatory_notification_required, obligations:obligation_id(code, title), regulatory_notifications(id, authority, status, notification_deadline, notification_type, submitted_at, reference_number)"
        )
        .eq("tenant_id", DEMO_TENANT)
        .order("detection_date", { ascending: false });

      if (incidentType) {
        q = q.eq("incident_type", incidentType);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
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
      return data;
    },
  });
}

export function useCreateIncident() {
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
        .insert({ ...input, tenant_id: DEMO_TENANT })
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
