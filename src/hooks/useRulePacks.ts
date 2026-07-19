import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/context/TenantContext';
import { rulePackOrganoFamily } from "@/lib/secretaria/rule-pack-organo";
import { normalizeMateriaForRulePack } from '@/lib/rules-engine/rule-resolution';
import {
  mapRulePackJoinRowToVersionRow,
  pickFreshestRulePackVersion,
  type RulePackJoinRow,
  type RulePackVersionRow,
} from '@/lib/secretaria/rule-pack-params';

export type { RulePackVersionRow };

/**
 * Rule parameter override row
 */
export interface RuleParamOverrideRow {
  id: string;
  entity_id: string;
  rule_pack_id: string;
  materia: string;
  clave: string;
  valor: unknown;
  fuente: string;
  referencia: string | null;
}

/**
 * Load all active rule pack versions for the demo tenant
 * Joins with rule_packs to get materia, clase, organo_tipo
 * staleTime: 60 seconds
 */
export function useRulePacks() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["rulePacks", tenantId, "active"],
    staleTime: 60_000,
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rule_pack_versions")
        .select("*, rule_packs!inner(tenant_id, materia, organo_tipo)")
        .eq("rule_packs.tenant_id", tenantId!)
        .eq("is_active", true)
        .order("version", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as RulePackJoinRow[];
      return rows.map((row) => mapRulePackJoinRowToVersionRow(row, tenantId!));
    },
  });
}

/**
 * Load only the rule parameter overrides for one tenant entity.
 * Enabled only when both tenantId and entityId are available.
 * staleTime: 60 seconds
 */
export function useRuleParamOverrides(entityId?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ruleParamOverrides", tenantId ?? "none", entityId ?? "none"],
    staleTime: 60_000,
    enabled: !!tenantId && !!entityId,
    queryFn: async (): Promise<RuleParamOverrideRow[]> => {
      const { data, error } = await supabase
        .from("rule_param_overrides")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!);

      if (error) throw error;
      return (data ?? []) as RuleParamOverrideRow[];
    },
  });
}

/**
 * Load active rule pack versions for tenant + parameter overrides for a given entity
 * Returns { packs, overrides }
 * Enabled only when entityId is truthy
 * staleTime: 60 seconds
 */
export function useRulePacksForEntity(entityId?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["rulePacks", tenantId, "entity", entityId ?? "none"],
    staleTime: 60_000,
    enabled: !!entityId && !!tenantId,
    queryFn: async () => {
      // Load active pack versions
      const { data: packsData, error: packsError } = await supabase
        .from("rule_pack_versions")
        .select("*, rule_packs!inner(tenant_id, materia, organo_tipo)")
        .eq("rule_packs.tenant_id", tenantId!)
        .eq("is_active", true)
        .order("version", { ascending: false });

      if (packsError) throw packsError;

      const packs = ((packsData ?? []) as RulePackJoinRow[]).map((row) =>
        mapRulePackJoinRowToVersionRow(row, tenantId!),
      );

      // Load overrides for this entity
      const { data: overridesData, error: overridesError } = await supabase
        .from("rule_param_overrides")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId);

      if (overridesError) throw overridesError;

      const overrides = (overridesData ?? []) as RuleParamOverrideRow[];

      return {
        packs,
        overrides,
      };
    },
  });
}

/**
 * Load a single active rule pack version by materia code.
 * Joins with rule_packs to get clase, organo_tipo.
 * Enabled only when materia is truthy.
 * staleTime: 60 seconds.
 *
 * Why no `.maybeSingle()` and no `.limit(1)`:
 *
 *   Cloud legacy data can contain more than one `is_active = true` row for
 *   the same materia (the canonical INC-14 case for `AUMENTO_CAPITAL`). The
 *   previous implementation used `.maybeSingle()` and crashed with PGRST116.
 *
 *   We now bring all active rows back and let `pickFreshestRulePackVersion`
 *   decide which one wins, applying the documented policy:
 *
 *     "última activación/creación operativa gana, aunque la versión
 *      semántica sea menor"
 *
 *   SQL still provides a defensive primary ordering by `created_at` DESC
 *   (with `id` DESC as a deterministic tie-breaker so PostgREST never falls
 *   back to undefined ordering on equal timestamps), but the JS picker is
 *   the source of truth — if the SQL ordering ever changes the picker
 *   still returns the correct row, and tests cover the decision directly.
 *   See `src/lib/secretaria/rule-pack-params.ts` and its tests.
 */
export function useRulePackForMateria(materia?: string, organoTipo?: string | null) {
  const { tenantId } = useTenantContext();
  const organo = rulePackOrganoFamily(organoTipo);
  return useQuery({
    queryKey: ["rulePacks", tenantId, "materia", materia ?? "none", organo ?? "sin-organo"],
    staleTime: 60_000,
    enabled: !!materia && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rule_pack_versions")
        .select("*, rule_packs!inner(tenant_id, materia, organo_tipo)")
        .eq("rule_packs.tenant_id", tenantId!)
        .eq("is_active", true)
        // alias-aware (remediación W5): resuelve grafías legacy al pack canónico.
        .eq("rule_packs.materia", normalizeMateriaForRulePack(materia))
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as RulePackJoinRow[];

      // Cuando se conoce el órgano se prefieren sus packs, con el mismo
      // desempate de siempre ("la activación más reciente gana").
      //
      // Si ninguno es de ese órgano NO se devuelve null: eso sería fail-closed
      // por discrepancia de órgano, que es la opción C — post-demo y pendiente
      // del Comité Legal. Aquí solo se prefiere, nunca se deja de servir.
      const delOrgano = organo
        ? rows.filter((r) => rulePackOrganoFamily(r.rule_packs?.organo_tipo) === organo)
        : [];
      const candidatos = delOrgano.length > 0 ? delOrgano : rows;

      // Sin órgano conocido y con varios packs de la misma materia, cualquier
      // elección es arbitraria. El único consumidor de este hook deriva de aquí
      // la MAYORÍA LEGAL que se muestra como "regla efectiva", y la de la Junta
      // no es la del Consejo: servir una al azar es afirmar ante el abogado algo
      // que nadie ha determinado. Se devuelve null y el contrato degrada a una
      // inferencia explícitamente etiquetada como tal.
      const distintosOrganos = new Set(
        rows.map((r) => rulePackOrganoFamily(r.rule_packs?.organo_tipo) ?? "SIN_ORGANO"),
      );
      if (!organo && distintosOrganos.size > 1) return null;

      const row = pickFreshestRulePackVersion(candidatos);
      if (!row) return null;

      return mapRulePackJoinRowToVersionRow(row, tenantId!);
    },
  });
}
