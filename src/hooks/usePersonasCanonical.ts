import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export type PersonType = "PF" | "PJ";

export interface PersonaRow {
  id: string;
  tenant_id: string;
  full_name: string;
  tax_id: string | null;
  email: string | null;
  person_type: PersonType | null;
  denomination: string | null;
  representative_person_id: string | null;
  created_at: string | null;
}

export interface PersonaDetailRow extends PersonaRow {
  representative?: {
    id: string;
    full_name: string;
    tax_id: string | null;
  } | null;
}

export function usePersonasCanonical(filter?: {
  person_type?: PersonType;
  search?: string;
}) {
  return useQuery({
    queryKey: ["personas_canonical", "list", filter?.person_type ?? "all", filter?.search ?? ""],
    queryFn: async (): Promise<PersonaRow[]> => {
      let q = supabase.from("persons").select("*").eq("tenant_id", DEMO_TENANT);
      if (filter?.person_type) q = q.eq("person_type", filter.person_type);
      if (filter?.search && filter.search.trim().length > 0) {
        const s = filter.search.trim();
        q = q.or(`full_name.ilike.%${s}%,tax_id.ilike.%${s}%,denomination.ilike.%${s}%,email.ilike.%${s}%`);
      }
      const { data, error } = await q.order("full_name", { ascending: true }).limit(200);
      if (error) throw error;
      return (data ?? []) as PersonaRow[];
    },
  });
}

export function usePersonaCanonical(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["personas_canonical", "byId", id],
    queryFn: async (): Promise<PersonaDetailRow | null> => {
      const { data, error } = await supabase
        .from("persons")
        .select(`
          *,
          representative:representative_person_id(id, full_name, tax_id)
        `)
        .eq("tenant_id", DEMO_TENANT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as PersonaDetailRow) ?? null;
    },
  });
}
