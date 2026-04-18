import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export interface MandatoryBookRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  book_kind: string;
  volume_number: number;
  period: number;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  legalization_deadline: string | null;
  legalization_status: string;
  legalization_evidence_url: string | null;
  entity_name: string | null;
  jurisdiction: string | null;
}

export function useLibrosList() {
  return useQuery({
    queryKey: ["mandatory_books", "list"],
    queryFn: async (): Promise<MandatoryBookRow[]> => {
      const { data, error } = await supabase
        .from("mandatory_books")
        .select("*, entities(common_name, jurisdiction)")
        .eq("tenant_id", DEMO_TENANT)
        .order("legalization_deadline", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((b: any) => ({
        ...b,
        entity_name: b.entities?.common_name ?? null,
        jurisdiction: b.entities?.jurisdiction ?? null,
      }));
    },
  });
}
