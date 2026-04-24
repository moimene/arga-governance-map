import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { useEntityRules } from "@/hooks/useJurisdiccionRules";

export interface FilialEntity {
  id: string;
  slug: string;
  legal_name: string;
  common_name: string | null;
  jurisdiction: string;
  legal_form: string | null;
  tipo_social: string | null;
  es_unipersonal: boolean | null;
  ownership_percentage: number | null;
  entity_status: string | null;
  materiality: string | null;
  parent_entity_id: string | null;
}

/** Returns all entities with jurisdiction outside Spain (i.e. BR, MX, PT filiales). */
export function useFilialEntities() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["filial_entities", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FilialEntity[]> => {
      const { data, error } = await supabase
        .from("entities")
        .select(
          "id, slug, legal_name, common_name, jurisdiction, legal_form, tipo_social, " +
          "es_unipersonal, ownership_percentage, entity_status, materiality, parent_entity_id"
        )
        .eq("tenant_id", tenantId!)
        .not("jurisdiction", "eq", "ES")
        .not("jurisdiction", "is", null)
        .order("jurisdiction", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FilialEntity[];
    },
  });
}

/** Returns entities grouped by jurisdiction code. */
export function useFilialEntitiesByJurisdiction() {
  const { data: filiales = [], ...rest } = useFilialEntities();
  const grouped = filiales.reduce<Record<string, FilialEntity[]>>((acc, e) => {
    const j = e.jurisdiction ?? "XX";
    if (!acc[j]) acc[j] = [];
    acc[j].push(e);
    return acc;
  }, {});
  return { data: grouped, filiales, ...rest };
}

/** Returns active agreement counts per entity (DRAFT + PROPOSED + ADOPTED + CERTIFIED). */
export function useFilialAgreementCounts(entityIds: string[]) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["filial_agreement_counts", tenantId, entityIds.join(",")],
    enabled: !!tenantId && entityIds.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("agreements")
        .select("entity_id, status")
        .eq("tenant_id", tenantId!)
        .in("entity_id", entityIds)
        .in("status", ["DRAFT", "PROPOSED", "ADOPTED", "CERTIFIED"]);
      if (error) throw error;
      return (data ?? []).reduce<Record<string, number>>((acc, row) => {
        if (row.entity_id) acc[row.entity_id] = (acc[row.entity_id] ?? 0) + 1;
        return acc;
      }, {});
    },
  });
}

/** Convenience: rule set for a filial entity (uses jurisdiction + tipo_social). */
export { useEntityRules };
