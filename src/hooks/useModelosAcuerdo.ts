import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  isOperationalTemplate,
  OPERATIONAL_TEMPLATE_QUERY_STATES,
} from "@/lib/doc-gen/template-operability";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";

export interface ModeloAcuerdo {
  id: string;
  materia_acuerdo: string;
  materia: string | null;
  jurisdiccion: string;
  contenido_template: string | null;
  capa1_inmutable: string | null;
  capa2_variables: Array<{ variable: string; fuente: string; condicion: string }> | null;
  capa3_editables: Array<Record<string, unknown>> | null;
  referencia_legal: string | null;
  estado: string;
  version: string;
  aprobada_por: string | null;
  fecha_aprobacion: string | null;
  adoption_mode: string | null;
  organo_tipo: string | null;
  contrato_variables_version: string | null;
}

export function useModelosAcuerdo(materia: string, organoTipo?: string, adoptionMode?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["modelos_acuerdo", tenantId, materia, organoTipo ?? "all", adoptionMode ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("plantillas_protegidas")
        .select(
          "id, materia, materia_acuerdo, jurisdiccion, contenido_template, capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, estado, version, aprobada_por, fecha_aprobacion, adoption_mode, organo_tipo, contrato_variables_version"
        )
        .eq("tenant_id", tenantId!)
        .eq("tipo", "MODELO_ACUERDO")
        .eq("materia_acuerdo", materia)
        .in("estado", [...OPERATIONAL_TEMPLATE_QUERY_STATES])
        .order("version", { ascending: false });

      if (organoTipo) {
        q = q.eq("organo_tipo", organoTipo);
      }

      if (adoptionMode) {
        q = q.or(`adoption_mode.is.null,adoption_mode.eq.${adoptionMode}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as Array<ModeloAcuerdo & Partial<PlantillaProtegidaRow>>)
        .filter((modelo) => isOperationalTemplate({
          tenant_id: tenantId!,
          tipo: "MODELO_ACUERDO",
          notas_legal: null,
          variables: [],
          protecciones: {},
          snapshot_rule_pack_required: true,
          created_at: "",
          approval_checklist: null,
          version_history: null,
          ...modelo,
        } as PlantillaProtegidaRow)) as ModeloAcuerdo[];
    },
    enabled: !!materia && !!tenantId,
  });
}
