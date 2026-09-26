import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface AgreementListRow {
  id: string;
  tenant_id: string;
  entity_id: string | null;
  body_id: string | null;
  agreement_kind: string;
  matter_class: string;
  inscribable: boolean;
  adoption_mode: string;
  proposal_text: string | null;
  decision_text: string | null;
  decision_date: string | null;
  status: string;
  created_at: string;
  /** MOI-197: nombre del órgano (join a governing_bodies), null si no hay body_id. */
  body_name?: string | null;
}

/**
 * useAgreementsList — Fetches all agreements for the demo tenant,
 * optionally filtered by status (e.g., "CERTIFIED", "ADOPTED")
 *
 * Usage:
 *   const { data: agreements } = useAgreementsList(["CERTIFIED", "ADOPTED"]);
 */
export function useAgreementsList(statusFilter?: string[]) {
  const { tenantId } = useTenantContext();
  return useQuery<AgreementListRow[], Error>({
    queryKey: ["agreements", tenantId, "list", statusFilter ? statusFilter.join(",") : "all"],
    enabled: !!tenantId,
    queryFn: async () => {
      // MOI-197: join a governing_bodies(name) para el filtro por órgano del
      // índice, y count:"exact" para que la respuesta lleve content-range
      // (lo que el e2e de solo lectura contrasta contra las filas pintadas).
      let query = supabase
        .from("agreements")
        .select("*, governing_bodies(name)", { count: "exact" })
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      type Raw = Omit<AgreementListRow, "body_name"> & {
        governing_bodies?: { name?: string | null } | null;
      };
      return ((data ?? []) as Raw[]).map((row) => ({
        ...row,
        body_name: row.governing_bodies?.name ?? null,
      })) as AgreementListRow[];
    },
  });
}

/**
 * useAgreementById — Fetches a single agreement with its related entities
 */
export function useAgreementById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery<AgreementListRow | null, Error>({
    enabled: !!id && !!tenantId,
    queryKey: ["agreements", tenantId, "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("*")
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AgreementListRow | null;
    },
  });
}
