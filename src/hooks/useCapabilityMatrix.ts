import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Capability =
  | "SNAPSHOT_CREATION"
  | "VOTE_EMISSION"
  | "CERTIFICATION";

export interface CapabilityRow {
  id: string;
  role: string;
  action: Capability;
  enabled: boolean;
  reason: string | null;
  created_at: string;
}

export function useCapabilityMatrix() {
  return useQuery({
    queryKey: ["capability_matrix", "all"],
    staleTime: 5 * 60 * 1000, // 5 min — estable en runtime
    queryFn: async (): Promise<CapabilityRow[]> => {
      const { data, error } = await supabase
        .from("capability_matrix")
        .select("*")
        .order("role", { ascending: true })
        .order("action", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CapabilityRow[];
    },
  });
}

/**
 * Devuelve true si el rol tiene la capacidad pedida según la matriz.
 * Usa resultado cacheado — no hace fetch adicional.
 */
export function useHasCapability(role: string | undefined, action: Capability) {
  const { data } = useCapabilityMatrix();
  if (!role || !data) return false;
  const row = data.find((r) => r.role === role && r.action === action);
  return row?.enabled ?? false;
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  SNAPSHOT_CREATION: "Creación de censo",
  VOTE_EMISSION: "Emisión de voto",
  CERTIFICATION: "Certificación",
};
