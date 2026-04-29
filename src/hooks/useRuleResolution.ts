import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  resolveRulePackForMatter,
  type RawRulePackVersionRow,
  type RuleResolution,
} from "@/lib/rules-engine";
import type { RuleParamOverride } from "@/lib/rules-engine";

interface RawRulePackQueryRow {
  id?: string;
  tenant_id?: string;
  materia?: string | null;
  materia_clase?: string | null;
  clase?: string | null;
  organo_tipo?: string | null;
  descripcion?: string | null;
  nombre?: string | null;
  rule_pack_versions?: RawRulePackVersionRow[] | null;
}

interface RawOverrideRow {
  id: string;
  entity_id: string;
  materia: string;
  clave: string;
  valor: unknown;
  fuente: RuleParamOverride["fuente"];
  referencia?: string | null;
}

export interface UseRuleResolutionParams {
  materia?: string | null;
  entityId?: string | null;
  organoTipo?: string | null;
  clase?: string | null;
  allowApprovedInUat?: boolean;
}

export interface RuleResolutionSpec {
  materia: string;
  clase?: string | null;
}

export interface UseRuleResolutionsParams {
  materias: RuleResolutionSpec[];
  entityId?: string | null;
  organoTipo?: string | null;
  allowApprovedInUat?: boolean;
}

function flattenRulePackVersions(packRows: RawRulePackQueryRow[]): RawRulePackVersionRow[] {
  return packRows.flatMap((pack) => {
    const packVersions = pack.rule_pack_versions ?? [];
    return packVersions.map((version) => ({
      ...version,
      rule_packs: {
        id: pack.id,
        materia: pack.materia,
        materia_clase: pack.materia_clase,
        clase: pack.clase,
        organo_tipo: pack.organo_tipo,
        descripcion: pack.descripcion,
        nombre: pack.nombre,
      },
    }));
  });
}

function mapOverrides(rows: RawOverrideRow[]): RuleParamOverride[] {
  return rows.map((override) => ({
    id: override.id,
    entity_id: override.entity_id,
    materia: override.materia,
    clave: override.clave,
    valor: override.valor,
    fuente: override.fuente,
    referencia: override.referencia ?? undefined,
  }));
}

function uniqueSpecs(specs: RuleResolutionSpec[]): RuleResolutionSpec[] {
  const seen = new Set<string>();
  const out: RuleResolutionSpec[] = [];
  for (const spec of specs) {
    const materia = spec.materia?.trim();
    if (!materia) continue;
    const key = `${materia}::${spec.clase ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ materia, clase: spec.clase ?? null });
  }
  return out;
}

/**
 * Canonical rule resolution hook.
 *
 * It reads whatever rule_pack schema is available, normalizes lifecycle/version
 * differences in the pure rules-engine layer, and returns one RuleResolution
 * contract for UI steppers and campaign flows.
 */
export function useRuleResolution(params: UseRuleResolutionParams) {
  const { tenantId } = useTenantContext();

  return useQuery<RuleResolution | null, Error>({
    enabled: !!tenantId && !!params.materia,
    queryKey: [
      "ruleResolution",
      tenantId,
      params.materia ?? "none",
      params.entityId ?? "none",
      params.organoTipo ?? "any",
      params.clase ?? "any",
      params.allowApprovedInUat ?? false,
    ],
    staleTime: 60_000,
    queryFn: async () => {
      if (!params.materia) return null;

      const { data: packRows, error: packError } = await supabase
        .from("rule_packs")
        .select("*, rule_pack_versions(*)")
        .eq("tenant_id", tenantId!);

      if (packError) throw packError;

      const versions = flattenRulePackVersions((packRows ?? []) as RawRulePackQueryRow[]);

      let overrides: RuleParamOverride[] = [];
      if (params.entityId) {
        const { data: overridesData, error: overridesError } = await supabase
          .from("rule_param_overrides")
          .select("*")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", params.entityId);

        if (overridesError) throw overridesError;
        overrides = mapOverrides((overridesData ?? []) as RawOverrideRow[]);
      }

      return resolveRulePackForMatter({
        materia: params.materia,
        versions,
        overrides,
        organoTipo: params.organoTipo,
        clase: params.clase,
        allowApprovedInUat: params.allowApprovedInUat,
      });
    },
  });
}

/**
 * Resolves all matters in an agenda with one DB read.
 *
 * This is the preferred hook for convocatoria/reunion steppers: the legal
 * result must be composed from the full agenda, not from the first item only.
 */
export function useRuleResolutions(params: UseRuleResolutionsParams) {
  const { tenantId } = useTenantContext();
  const specs = uniqueSpecs(params.materias);

  return useQuery<RuleResolution[], Error>({
    enabled: !!tenantId && specs.length > 0,
    queryKey: [
      "ruleResolutions",
      tenantId,
      specs.map((spec) => `${spec.materia}:${spec.clase ?? "any"}`).join("|"),
      params.entityId ?? "none",
      params.organoTipo ?? "any",
      params.allowApprovedInUat ?? false,
    ],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: packRows, error: packError } = await supabase
        .from("rule_packs")
        .select("*, rule_pack_versions(*)")
        .eq("tenant_id", tenantId!);

      if (packError) throw packError;
      const versions = flattenRulePackVersions((packRows ?? []) as RawRulePackQueryRow[]);

      let overrides: RuleParamOverride[] = [];
      if (params.entityId) {
        const { data: overridesData, error: overridesError } = await supabase
          .from("rule_param_overrides")
          .select("*")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", params.entityId);

        if (overridesError) throw overridesError;
        overrides = mapOverrides((overridesData ?? []) as RawOverrideRow[]);
      }

      return specs.map((spec) =>
        resolveRulePackForMatter({
          materia: spec.materia,
          versions,
          overrides,
          organoTipo: params.organoTipo,
          clase: spec.clase,
          allowApprovedInUat: params.allowApprovedInUat,
        }),
      );
    },
  });
}
