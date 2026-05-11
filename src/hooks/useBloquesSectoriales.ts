// src/hooks/useBloquesSectoriales.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface BloqueSectorialRow {
  id: string;
  clave_bloque: string;
  version: string;
  sector: string;
  materia_aplicable: string[];
  texto_aprobado: string;
  referencia_legal: string | null;
  descripcion: string | null;
  estado: "ACTIVA" | "ARCHIVADA";
}

/**
 * Carga bloques sectoriales sugeridos según sector + materia.
 * Si sector === 'GENERICO' o sector === undefined, devuelve [] por defecto (R10).
 * El consumidor puede pasar `showAll: true` para relajar el filtro de sector.
 */
export function useBloquesSectoriales(params: {
  sector?: string;
  materia?: string;
  showAll?: boolean;
}) {
  const { sector, materia, showAll } = params;
  return useQuery({
    queryKey: ["bloques_sectoriales", sector, materia, showAll],
    enabled: !!materia,
    queryFn: async (): Promise<BloqueSectorialRow[]> => {
      let query = supabase
        .from("bloques_sectoriales")
        .select("*")
        .eq("estado", "ACTIVA");
      if (!showAll && sector && sector !== "GENERICO") {
        query = query.eq("sector", sector);
      }
      const { data, error } = await query;
      if (error) throw error;
      const filtered = (data ?? []).filter((b) =>
        materia ? (b.materia_aplicable as string[]).includes(materia) : true,
      );
      return filtered as BloqueSectorialRow[];
    },
  });
}

export interface InsertBloqueParams {
  agreementId: string;
  bloque: BloqueSectorialRow;
  insertedBy?: string;
}

/**
 * Inserta un bloque en bloque_insertions (auditoría WORM).
 * El append literal al campo capa3 lo hace el componente UI; este hook solo
 * persiste la auditoría.
 */
export function useInsertBloque() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (params: InsertBloqueParams) => {
      const { error } = await supabase.from("bloque_insertions").insert({
        tenant_id: tenantId!,
        agreement_id: params.agreementId,
        bloque_id: params.bloque.id,
        bloque_clave: params.bloque.clave_bloque,
        bloque_version: params.bloque.version,
        texto_insertado: params.bloque.texto_aprobado,
        inserted_by: params.insertedBy ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["bloque_insertions", vars.agreementId] });
    },
  });
}
