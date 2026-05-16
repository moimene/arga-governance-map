import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MateriaCatalogRow } from "@/hooks/useMateriaConfig";

export function useMateriaCatalogoSocietario() {
  return useQuery<MateriaCatalogRow[], Error>({
    queryKey: ["materia_catalog", "mesa_control", "all"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materia_catalog")
        .select("*")
        .order("materia_label_es", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MateriaCatalogRow[];
    },
  });
}
