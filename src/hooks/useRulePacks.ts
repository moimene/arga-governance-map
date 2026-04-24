import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/context/TenantContext';

/**
 * Rule pack version row with joined rule pack fields
 */
export interface RulePackVersionRow {
  id: string;
  rule_pack_id: string;
  version_tag: string;
  status: string;
  params: unknown; // JSONB — the full RulePack params
  created_at: string;
  tenant_id: string;
  // joined fields
  materia?: string;
  clase?: string;
  organo_tipo?: string;
}

/**
 * Rule parameter override row
 */
type RulePackJoinRow = {
  id: string; rule_pack_id: string; version_tag: string; status: string;
  params: unknown; created_at: string; tenant_id: string;
  rule_packs: { materia: string; clase: string; organo_tipo: string } | null;
};

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
        .select("*, rule_packs(materia, clase, organo_tipo)")
        .eq("tenant_id", tenantId!)
        .eq("status", "ACTIVE")
        .order("version_tag", { ascending: false });

      if (error) throw error;

      // Transform PostgREST response to flatten joined fields
      const rows = (data ?? []) as RulePackJoinRow[];
      return rows.map((row) => {
        const packed = row.rule_packs;
        return {
          id: row.id,
          rule_pack_id: row.rule_pack_id,
          version_tag: row.version_tag,
          status: row.status,
          params: row.params,
          created_at: row.created_at,
          tenant_id: row.tenant_id,
          materia: packed?.materia,
          clase: packed?.clase,
          organo_tipo: packed?.organo_tipo,
        } as RulePackVersionRow;
      });
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
        .select("*, rule_packs(materia, clase, organo_tipo)")
        .eq("tenant_id", tenantId!)
        .eq("status", "ACTIVE")
        .order("version_tag", { ascending: false });

      if (packsError) throw packsError;

      const packs = (packsData as RulePackJoinRow[] ?? []).map((row) => {
        const packed = row.rule_packs;
        return {
          id: row.id,
          rule_pack_id: row.rule_pack_id,
          version_tag: row.version_tag,
          status: row.status,
          params: row.params,
          created_at: row.created_at,
          tenant_id: row.tenant_id,
          materia: packed?.materia,
          clase: packed?.clase,
          organo_tipo: packed?.organo_tipo,
        } as RulePackVersionRow;
      });

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
 * Load a single active rule pack version by materia code
 * Joins with rule_packs to get clase, organo_tipo
 * Enabled only when materia is truthy
 * staleTime: 60 seconds
 */
export function useRulePackForMateria(materia?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["rulePacks", tenantId, "materia", materia ?? "none"],
    staleTime: 60_000,
    enabled: !!materia && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rule_pack_versions")
        .select("*, rule_packs(materia, clase, organo_tipo)")
        .eq("tenant_id", tenantId!)
        .eq("status", "ACTIVE")
        .eq("rule_packs.materia", materia)
        .order("version_tag", { ascending: false })
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const packed = (data as RulePackJoinRow).rule_packs;
      return {
        id: data.id,
        rule_pack_id: data.rule_pack_id,
        version_tag: data.version_tag,
        status: data.status,
        params: data.params,
        created_at: data.created_at,
        tenant_id: data.tenant_id,
        materia: packed?.materia,
        clase: packed?.clase,
        organo_tipo: packed?.organo_tipo,
      } as RulePackVersionRow;
    },
  });
}
