import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { filterAgreementCompatibleMaterias } from "@/lib/secretaria/matter-class";

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

/**
 * Devuelve el catálogo de materias filtrado a las matter_class compatibles
 * con `agreements` (ORDINARIA / ESTATUTARIA / ESTRUCTURAL).
 *
 * El catálogo de DB contiene también materias con matter_class='ESPECIAL'
 * (PACTO_PARASOCIAL, EXCLUSION_SOCIO, SEPARACION_SOCIO) que tienen
 * pathways distintos (tabla `pactos_parasociales` o flujos judiciales)
 * y NO deben persistirse como agreement — el CHECK
 * `agreements_matter_class_check` las rechaza con HTTP 400 silencioso.
 *
 * Si en el futuro un consumer necesita el catálogo COMPLETO (ej: para
 * navegar materias judiciales), añadir una variante explícita
 * `useMateriaCatalogIncludingSpecial()` en lugar de relajar este filtro.
 *
 * Detalle del fix + decisión: docs/superpowers/plans/2026-05-09-matter-class-especial-filter.md
 */
export function useMateriaCatalog() {
  return useQuery<MateriaCatalogRow[], Error>({
    queryKey: ["materia_catalog", "agreement_compatible"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materia_catalog")
        .select("*")
        .order("matter_class", { ascending: true })
        .order("materia_label_es", { ascending: true });
      if (error) throw error;
      return filterAgreementCompatibleMaterias((data ?? []) as MateriaCatalogRow[]);
    },
  });
}
