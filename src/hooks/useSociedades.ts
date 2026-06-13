import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

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
  constitution_date: string | null;
  registration_date: string | null;
  registry_location: string | null;
  registry_volume: string | null;
  registry_folio: string | null;
  registry_sheet: string | null;
  registry_inscription: string | null;
  lei_code: string | null;
  cnae_primary: string | null;
  cnae_secondary: string[] | null;
  corporate_purpose: string | null;
  duration: string | null;
  fiscal_year_close: string | null;
  address: string | null;
  address_street: string | null;
  address_number: string | null;
  address_floor: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  website: string | null;
  corporate_email: string | null;
  regulated_sector: string | null;
  group_role: string | null;
  onboarding_status: "OPERATIVA" | "INCOMPLETA_CARGOS" | "INCOMPLETA_DATOS" | "BORRADOR" | null;
  support_docs_metadata: Record<string, unknown> | null;
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
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["sociedades", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async (): Promise<SociedadRow[]> => {
      // G1.2: filtrar entities con `person_id NOT NULL` — sólo las que
      // tienen su PJ canónica asociada son "sociedades" bien formadas.
      // Evita mostrar entities legacy pre-modelo-canónico como sociedades.
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("tenant_id", tenantId!)
        .not("person_id", "is", null)
        // W3: oculta artefactos de E2E/pruebas del listado operativo. El detalle
        // por id/slug NO filtra (un enlace directo a una TEST sigue abriendo).
        .neq("data_class", "TEST")
        .order("common_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SociedadRow[];
    },
  });
}

export function useSociedad(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["sociedades", tenantId, "byId", id],
    queryFn: async (): Promise<SociedadDetailRow | null> => {
      const { data, error } = await supabase
        .from("entities")
        .select(`
          *,
          person:person_id(id, full_name, tax_id, denomination, person_type),
          parent:parent_entity_id(id, common_name, legal_name)
        `)
        .eq("tenant_id", tenantId!)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as SociedadDetailRow) ?? null;
    },
  });
}

export function useSociedadBySlug(slug: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!slug && !!tenantId,
    queryKey: ["sociedades", tenantId, "bySlug", slug],
    queryFn: async (): Promise<SociedadDetailRow | null> => {
      const { data, error } = await supabase
        .from("entities")
        .select(`
          *,
          person:person_id(id, full_name, tax_id, denomination, person_type),
          parent:parent_entity_id(id, common_name, legal_name)
        `)
        .eq("tenant_id", tenantId!)
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as SociedadDetailRow) ?? null;
    },
  });
}
