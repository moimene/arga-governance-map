import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface CapitalProfileRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  currency: string;
  capital_escriturado: number;
  capital_desembolsado: number | null;
  numero_titulos: number | null;
  valor_nominal: number | null;
  estado: "VIGENTE" | "HISTORICO";
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

export interface ShareClassRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  class_code: string;
  name: string;
  votes_per_title: number;
  economic_rights_coeff: number;
  voting_rights: boolean;
  veto_rights: boolean;
  created_at: string;
}

/** Perfil de capital VIGENTE para una sociedad. */
export function useCapitalProfile(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["entity_capital_profile", tenantId, "vigente", entityId],
    queryFn: async (): Promise<CapitalProfileRow | null> => {
      const { data, error } = await supabase
        .from("entity_capital_profile")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .eq("estado", "VIGENTE")
        .maybeSingle();
      if (error) throw error;
      return (data as CapitalProfileRow) ?? null;
    },
  });
}

/** Historial de capital (VIGENTE + HISTORICO) ordenado cronológicamente. */
export function useCapitalProfileHistory(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["entity_capital_profile", tenantId, "history", entityId],
    queryFn: async (): Promise<CapitalProfileRow[]> => {
      const { data, error } = await supabase
        .from("entity_capital_profile")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CapitalProfileRow[];
    },
  });
}

/** Clases de acciones/participaciones de una sociedad. */
export function useShareClasses(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["share_classes", tenantId, "byEntity", entityId],
    queryFn: async (): Promise<ShareClassRow[]> => {
      const { data, error } = await supabase
        .from("share_classes")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("class_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShareClassRow[];
    },
  });
}
