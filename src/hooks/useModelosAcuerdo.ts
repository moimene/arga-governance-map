import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export interface ModeloAcuerdo {
  id: string;
  materia_acuerdo: string;
  contenido_template: string | null;
  capa1_inmutable: string | null;
  capa2_variables: Array<{ variable: string; fuente: string; condicion: string }> | null;
  capa3_editables: Array<{ campo: string; tipo: string; label: string }> | null;
  referencia_legal: string | null;
  estado: string;
  version: string;
}

export function useModelosAcuerdo(materia: string, organoTipo?: string) {
  return useQuery({
    queryKey: ["modelos_acuerdo", materia, organoTipo ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("plantillas_protegidas")
        .select(
          "id, materia_acuerdo, contenido_template, capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, estado, version"
        )
        .eq("tenant_id", DEMO_TENANT)
        .eq("tipo", "MODELO_ACUERDO")
        .eq("materia_acuerdo", materia)
        .in("estado", ["ACTIVA", "APROBADA", "REVISADA"])
        .order("version", { ascending: false });

      if (organoTipo) {
        q = q.eq("organo_tipo", organoTipo);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ModeloAcuerdo[];
    },
    enabled: !!materia,
  });
}
