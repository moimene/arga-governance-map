import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export interface SociedadRow {
  id: string;
  tenant_id: string;
  slug: string;
  legal_name: string;
  common_name: string | null;
  jurisdiction: string | null;
  legal_form: string | null;
  tipo_social: string | null; // 'SA' | 'SL' | 'SLU' | 'SAU'
  registration_number: string | null;
  entity_status: string | null;
  materiality: string | null;
  forma_administracion: string | null;
  tipo_organo_admin: string | null;
  es_unipersonal: boolean | null;
  es_cotizada: boolean | null;
  person_id: string; // FK persons (PJ)
  parent_entity_id: string | null;
  ownership_percentage: number | null;
  created_at: string | null;
}

export interface SociedadDetailRow extends SociedadRow {
  person?: {
    id: string;
    full_name: string;
    tax_id: string | null;
    denomination: string | null;
    person_type: string | null;
  } | null;
  parent?: {
    id: string;
    common_name: string | null;
    legal_name: string;
  } | null;
}

export function useSociedades() {
  return useQuery({
    queryKey: ["sociedades", "list"],
    queryFn: async (): Promise<SociedadRow[]> => {
      // G1.2: filtrar entities con `person_id NOT NULL` — sólo las que
      // tienen su PJ canónica asociada son "sociedades" bien formadas.
      // Evita mostrar entities legacy pre-modelo-canónico como sociedades.
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .not("person_id", "is", null)
        .order("common_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SociedadRow[];
    },
  });
}

export function useSociedad(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["sociedades", "byId", id],
    queryFn: async (): Promise<SociedadDetailRow | null> => {
      const { data, error } = await supabase
        .from("entities")
        .select(`
          *,
          person:person_id(id, full_name, tax_id, denomination, person_type),
          parent:parent_entity_id(id, common_name, legal_name)
        `)
        .eq("tenant_id", DEMO_TENANT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as SociedadDetailRow) ?? null;
    },
  });
}

export function useSociedadBySlug(slug: string | undefined) {
  return useQuery({
    enabled: !!slug,
    queryKey: ["sociedades", "bySlug", slug],
    queryFn: async (): Promise<SociedadDetailRow | null> => {
      const { data, error } = await supabase
        .from("entities")
        .select(`
          *,
          person:person_id(id, full_name, tax_id, denomination, person_type),
          parent:parent_entity_id(id, common_name, legal_name)
        `)
        .eq("tenant_id", DEMO_TENANT)
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as SociedadDetailRow) ?? null;
    },
  });
}
