// src/hooks/usePlantillaWithOverrides.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { usePlantillaProtegida } from "./usePlantillasProtegidas";

export interface Capa3OverrideRow {
  campo: string;
  default_value_override: unknown;
  opciones_override: unknown[] | null;
  obligatoriedad_override: "OBLIGATORIO" | "RECOMENDADO" | "OPCIONAL" | null;
  compatible_with_canonical_version: string;
}

export interface Capa3Field {
  campo: string;
  obligatoriedad?: string;
  default?: unknown;
  opciones?: unknown[];
  [key: string]: unknown;
}

/**
 * Pure function: merges canonical capa3 with overrides per (entity, plantilla).
 * Used in usePlantillaWithOverrides hook + tested standalone.
 */
export function applyCapa3Overrides(
  canonical: Capa3Field[],
  overrides: Capa3OverrideRow[],
): Capa3Field[] {
  const overridesByCampo = new Map<string, Capa3OverrideRow>();
  for (const o of overrides) {
    overridesByCampo.set(o.campo, o);
  }
  return canonical.map((field) => {
    const override = overridesByCampo.get(field.campo);
    if (!override) return field;
    return {
      ...field,
      ...(override.default_value_override !== null && override.default_value_override !== undefined
        ? { default: override.default_value_override }
        : {}),
      ...(override.opciones_override !== null
        ? { opciones: override.opciones_override }
        : {}),
      ...(override.obligatoriedad_override !== null
        ? { obligatoriedad: override.obligatoriedad_override }
        : {}),
    };
  });
}

/**
 * Loads a plantilla and merges capa3 overrides for the given entity.
 * Returns warnCompatibility=true when override.compatible_with_canonical_version
 * differs from the current plantilla.version (R3 dashboard signal).
 */
export function usePlantillaWithOverrides(plantillaId?: string, entityId?: string) {
  const { tenantId } = useTenantContext();
  const plantillaQuery = usePlantillaProtegida(plantillaId);

  const overridesQuery = useQuery({
    queryKey: ["capa3_overrides", tenantId, entityId, plantillaId],
    enabled: !!tenantId && !!entityId && !!plantillaId,
    queryFn: async (): Promise<Capa3OverrideRow[]> => {
      const { data, error } = await supabase
        .from("plantilla_capa3_overrides_por_entidad")
        .select("campo, default_value_override, opciones_override, obligatoriedad_override, compatible_with_canonical_version")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .eq("plantilla_id", plantillaId!);
      if (error) throw error;
      return (data ?? []) as Capa3OverrideRow[];
    },
  });

  const plantilla = plantillaQuery.data;
  const overrides = overridesQuery.data ?? [];
  const canonicalCapa3 = (plantilla?.capa3_editables ?? []) as Capa3Field[];
  const mergedCapa3 = applyCapa3Overrides(canonicalCapa3, overrides);

  const warnCompatibility = overrides.some(
    (o) => plantilla && o.compatible_with_canonical_version !== plantilla.version,
  );

  return {
    plantilla,
    capa3_editables: mergedCapa3,
    overrides,
    warnCompatibility,
    isLoading: plantillaQuery.isLoading || overridesQuery.isLoading,
    error: plantillaQuery.error || overridesQuery.error,
  };
}
