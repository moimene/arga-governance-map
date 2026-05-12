// src/hooks/useEntitySettingsCatalog.ts
import { useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EntitySettingsCatalogRow {
  key: string;
  value_type: "boolean" | "text" | "enum" | "number";
  allowed_values: unknown[] | null;
  default_value: unknown;
  descripcion: string;
  categoria: "CARGO" | "CONFIG_CONDICIONAL" | "PERFIL_SOCIETARIO" | "PERFIL_SECTORIAL";
  usado_por_plantillas: string[] | null;
  estado_catalog: "ACTIVA" | "ARCHIVADA";
  created_at: string;
}

const QUERY_KEY = ["entity-settings-catalog"] as const;

/**
 * Catálogo global de claves para entity_settings. Cargado una sola vez con
 * staleTime: Infinity. Invalidación via mutation hooks de admin + Realtime
 * subscription a cambios externos. R4 + §5.1 del spec.
 */
export function useEntitySettingsCatalog() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000, // 24h
    queryFn: async (): Promise<EntitySettingsCatalogRow[]> => {
      const { data, error } = await supabase
        .from("entity_settings_catalog")
        .select("*")
        .eq("estado_catalog", "ACTIVA")
        .order("categoria", { ascending: true })
        .order("key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EntitySettingsCatalogRow[];
    },
  });

  // Realtime subscription: invalida cache si cambia algo en el catalog
  useEffect(() => {
    const channel = supabase
      .channel("entity_settings_catalog_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entity_settings_catalog" },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const byKey = useMemo(() => {
    const map = new Map<string, EntitySettingsCatalogRow>();
    for (const row of query.data ?? []) {
      map.set(row.key, row);
    }
    return map;
  }, [query.data]);

  return { ...query, byKey };
}
