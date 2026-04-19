import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export interface PlantillaProtegidaRow {
  id: string;
  tenant_id: string;
  tipo: string;
  materia: string | null;
  jurisdiccion: string;
  version: string;
  estado: string;
  aprobada_por: string | null;
  fecha_aprobacion: string | null;
  contenido_template: string | null;
  capa1_inmutable: string | null;
  capa2_variables: Array<{ variable: string; fuente: string; condicion: string }> | null;
  capa3_editables: Array<{ campo: string; obligatoriedad: string; descripcion: string }> | null;
  referencia_legal: string | null;
  notas_legal: string | null;
  variables: unknown[];
  protecciones: Record<string, unknown>;
  snapshot_rule_pack_required: boolean;
  adoption_mode: string | null;
  organo_tipo: string | null;
  contrato_variables_version: string | null;
  created_at: string;
}

export function usePlantillasProtegidas() {
  return useQuery({
    queryKey: ["plantillas_protegidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantillas_protegidas")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .order("tipo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlantillaProtegidaRow[];
    },
  });
}

export function usePlantillaProtegida(id?: string) {
  return useQuery({
    queryKey: ["plantillas_protegidas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantillas_protegidas")
        .select("*")
        .eq("id", id!)
        .eq("tenant_id", DEMO_TENANT)
        .maybeSingle();
      if (error) throw error;
      return data as PlantillaProtegidaRow | null;
    },
    enabled: !!id,
  });
}

export function useUpdateEstadoPlantilla() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      nuevo_estado: string;
      aprobada_por?: string;
    }) => {
      const updates: Record<string, unknown> = {
        estado: params.nuevo_estado,
      };

      if (
        params.nuevo_estado === "APROBADA" ||
        params.nuevo_estado === "ACTIVA"
      ) {
        updates.fecha_aprobacion = new Date().toISOString();
        if (params.aprobada_por) {
          updates.aprobada_por = params.aprobada_por;
        }
      }

      const { error } = await supabase
        .from("plantillas_protegidas")
        .update(updates)
        .eq("id", params.id)
        .eq("tenant_id", DEMO_TENANT);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plantillas_protegidas"] });
      queryClient.invalidateQueries({ queryKey: ["plantillas", "metrics"] });
    },
  });
}

export function useUpdateContenidoPlantilla() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      capa1_inmutable?: string;
      capa3_editables?: Array<{
        campo: string;
        obligatoriedad: string;
        descripcion: string;
      }>;
      notas_legal?: string;
    }) => {
      const updates: Record<string, unknown> = {};

      if (params.capa1_inmutable !== undefined) {
        updates.capa1_inmutable = params.capa1_inmutable;
      }

      if (params.capa3_editables !== undefined) {
        updates.capa3_editables = params.capa3_editables;
      }

      if (params.notas_legal !== undefined) {
        updates.notas_legal = params.notas_legal;
      }

      const { error } = await supabase
        .from("plantillas_protegidas")
        .update(updates)
        .eq("id", params.id)
        .eq("tenant_id", DEMO_TENANT);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plantillas_protegidas"] });
      queryClient.invalidateQueries({ queryKey: ["plantillas", "metrics"] });
    },
  });
}
