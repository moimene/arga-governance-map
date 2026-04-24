import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

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
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["mandatory_books", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async (): Promise<MandatoryBookRow[]> => {
      const { data, error } = await supabase
        .from("mandatory_books")
        .select("*, entities(common_name, jurisdiction)")
        .eq("tenant_id", tenantId!)
        .order("legalization_deadline", { ascending: true });
      if (error) throw error;
      type Raw = Omit<MandatoryBookRow, "entity_name" | "jurisdiction"> & {
        entities?: { common_name?: string | null; jurisdiction?: string | null } | null;
      };
      return ((data ?? []) as Raw[]).map((b) => ({
        ...b,
        entity_name: b.entities?.common_name ?? null,
        jurisdiction: b.entities?.jurisdiction ?? null,
      }));
    },
  });
}
