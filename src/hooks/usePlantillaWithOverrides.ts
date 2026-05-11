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

// Referencias estables compartidas — evitan `?? []` inline que crearía un
// array nuevo en cada render y rompería los useMemo descendientes en
// GenerarDocumentoStepper (reviewer adversarial CRÍTICO #1).
const EMPTY_OVERRIDES: Capa3OverrideRow[] = Object.freeze([]) as Capa3OverrideRow[];
const EMPTY_CAPA3: Capa3Field[] = Object.freeze([]) as Capa3Field[];

/**
 * Pure function: merges canonical capa3 with overrides per (entity, plantilla).
 * Used in usePlantillaWithOverrides hook + tested standalone.
 *
 * If `canonicalVersion` is provided, overrides whose
 * `compatible_with_canonical_version` differs from it are ignored (with a
 * console.warn) — this prevents stale overrides from a previous template
 * version from contaminating the current canonical fields. When
 * `canonicalVersion` is omitted, no version filtering is applied (backwards
 * compatible behavior).
 */
export function applyCapa3Overrides(
  canonical: Capa3Field[],
  overrides: Capa3OverrideRow[],
  canonicalVersion?: string,
): Capa3Field[] {
  const overridesByCampo = new Map<string, Capa3OverrideRow>();
  for (const o of overrides) {
    if (canonicalVersion !== undefined && o.compatible_with_canonical_version !== canonicalVersion) {
      // eslint-disable-next-line no-console
      console.warn(
        `[plantilla-overrides] Override ignorado para campo "${o.campo}": compatible_with_canonical_version=${o.compatible_with_canonical_version} no coincide con plantilla.version=${canonicalVersion}`,
      );
      continue;
    }
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
  // Reviewer adversarial CRÍTICO #1: `overridesQuery.data ?? []` produce un
  // array NUEVO en cada render → `mergedCapa3` identity cambia → cascada de
  // memos invalidados en GenerarDocumentoStepper. Estabilizamos con la
  // constante de módulo (referencia estable).
  const overrides = overridesQuery.data ?? EMPTY_OVERRIDES;
  const canonicalCapa3 = (plantilla?.capa3_editables ?? EMPTY_CAPA3) as Capa3Field[];
  // Pass canonical version so applyCapa3Overrides filters out stale overrides
  // (those whose compatible_with_canonical_version no longer matches).
  const mergedCapa3 = applyCapa3Overrides(canonicalCapa3, overrides, plantilla?.version);

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
