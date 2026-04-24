import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface FilingRow {
  id: string;
  tenant_id: string;
  deed_id: string | null;
  filing_via: string | null;
  filing_number: string | null;
  presentation_date: string | null;
  status: string;
  estimated_resolution: string | null;
  inscription_number: string | null;
  borme_ref: string | null;
  psm_ref: string | null;
  siger_ref: string | null;
  conservatoria_ref: string | null;
  jucerja_ref: string | null;
  diario_oficial_ref: string | null;
  defect_details: Record<string, unknown> | null;
  resolution_document_url: string | null;
  created_at: string;
  updated_at: string;
  agreement_id: string | null;
}

export function useTramitacionesList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["registry_filings", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async (): Promise<FilingRow[]> => {
      const { data, error } = await supabase
        .from("registry_filings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("presentation_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FilingRow[];
    },
  });
}

export function useTramitacionById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["registry_filings", tenantId, "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registry_filings")
        .select("*, deeds(notary, deed_date, status, content)")
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
