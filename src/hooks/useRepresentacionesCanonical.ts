import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export type RepresentationScope =
  | "PJ_PERMANENTE"
  | "JUNTA_PROXY"
  | "CONSEJO_DELEGACION";

export interface RepresentacionRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  represented_person_id: string;
  representative_person_id: string;
  scope: RepresentationScope;
  meeting_id: string | null;
  porcentaje_delegado: number | null;
  effective_from: string;
  effective_to: string | null;
  evidence: Record<string, unknown>;
  created_at: string;
}

export interface RepresentacionDetailRow extends RepresentacionRow {
  represented?: {
    id: string;
    full_name: string;
    tax_id: string | null;
    person_type: string | null;
  } | null;
  representative?: {
    id: string;
    full_name: string;
    tax_id: string | null;
    person_type: string | null;
  } | null;
}

/** Representaciones vigentes (effective_to NULL) para una sociedad. */
export function useRepresentaciones(
  entityId: string | undefined,
  scope?: RepresentationScope,
) {
  return useQuery({
    enabled: !!entityId,
    queryKey: ["representaciones", "vigente", entityId, scope ?? "all"],
    queryFn: async (): Promise<RepresentacionDetailRow[]> => {
      let q = supabase
        .from("representaciones")
        .select(`
          *,
          represented:represented_person_id(id, full_name, tax_id, person_type),
          representative:representative_person_id(id, full_name, tax_id, person_type)
        `)
        .eq("tenant_id", DEMO_TENANT)
        .eq("entity_id", entityId!)
        .is("effective_to", null);
      if (scope) q = q.eq("scope", scope);
      const { data, error } = await q.order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RepresentacionDetailRow[];
    },
  });
}

export const SCOPE_LABELS: Record<RepresentationScope, string> = {
  PJ_PERMANENTE: "Representante PJ permanente",
  JUNTA_PROXY: "Delegación de voto en Junta",
  CONSEJO_DELEGACION: "Delegación en Consejo",
};
