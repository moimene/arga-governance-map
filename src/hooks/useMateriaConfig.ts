import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MateriaCatalogRow {
  materia: string;
  materia_label_es: string;
  requires_notary: boolean;
  requires_registry: boolean;
  inscribable: boolean;
  matter_class: string;
  min_majority_code: string | null;
  publication_required: boolean;
  plazo_inscripcion_dias: number | null;
  referencia_legal: string | null;
}

export function useMateriaConfig(materia?: string) {
  return useQuery<MateriaCatalogRow | null, Error>({
    queryKey: ["materia_catalog", materia ?? "none"],
    enabled: !!materia,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!materia) return null;
      const { data, error } = await supabase
        .from("materia_catalog")
        .select("*")
        .eq("materia", materia)
        .maybeSingle();
      if (error) throw error;
      return data as MateriaCatalogRow | null;
    },
  });
}

export function useMateriaCatalog() {
  return useQuery<MateriaCatalogRow[], Error>({
    queryKey: ["materia_catalog", "all"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materia_catalog")
        .select("*")
        .order("matter_class", { ascending: true })
        .order("materia_label_es", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MateriaCatalogRow[];
    },
  });
}
