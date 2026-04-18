import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  defect_details: any;
  resolution_document_url: string | null;
  created_at: string;
  updated_at: string;
  agreement_id: string | null;
}

export function useTramitacionesList() {
  return useQuery({
    queryKey: ["registry_filings", "list"],
    queryFn: async (): Promise<FilingRow[]> => {
      const { data, error } = await supabase
        .from("registry_filings")
        .select("*")
        .order("presentation_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FilingRow[];
    },
  });
}

export function useTramitacionById(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["registry_filings", "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registry_filings")
        .select("*, deeds(notary, deed_date, status, content)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
