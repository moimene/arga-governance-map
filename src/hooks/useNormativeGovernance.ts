import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  assignTemplateBinding,
  materializeEffectiveRuleMatrix,
  publishNormativeOverride,
  publishStatuteVersion,
  upsertOrganProfile,
  upsertOrganRule,
  type AssignTemplateBindingInput,
  type EffectiveRuleMatrixRow,
  type NormativeOverrideRow,
  type OrganRuleRow,
  type PublishNormativeOverrideInput,
  type PublishStatuteVersionInput,
  type StatuteClauseMappingRow,
  type StatuteVersionRow,
  type TemplateBindingRow,
  type UpsertOrganProfileInput,
  type UpsertOrganRuleInput,
} from "@/lib/secretaria/normative-governance";

export function useOrganRules(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["secretaria_organ_rules", tenantId, entityId ?? "none"],
    enabled: !!tenantId && !!entityId,
    staleTime: 60_000,
    queryFn: async (): Promise<OrganRuleRow[]> => {
      const { data, error } = await supabase
        .from("secretaria_organ_rules")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("matter_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrganRuleRow[];
    },
  });
}

export function useStatuteVersions(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["secretaria_statute_versions", tenantId, entityId ?? "none"],
    enabled: !!tenantId && !!entityId,
    staleTime: 60_000,
    queryFn: async (): Promise<StatuteVersionRow[]> => {
      const { data, error } = await supabase
        .from("secretaria_statute_versions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StatuteVersionRow[];
    },
  });
}

export function useStatuteClauseMappings(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["secretaria_statute_clause_mappings", tenantId, entityId ?? "none"],
    enabled: !!tenantId && !!entityId,
    staleTime: 60_000,
    queryFn: async (): Promise<StatuteClauseMappingRow[]> => {
      const { data, error } = await supabase
        .from("secretaria_statute_clause_mappings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("matter_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StatuteClauseMappingRow[];
    },
  });
}

export function useNormativeOverrides(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["secretaria_normative_overrides", tenantId, entityId ?? "none"],
    enabled: !!tenantId && !!entityId,
    staleTime: 60_000,
    queryFn: async (): Promise<NormativeOverrideRow[]> => {
      const { data, error } = await supabase
        .from("secretaria_normative_overrides")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NormativeOverrideRow[];
    },
  });
}

export function useTemplateBindings(criteria?: {
  materia?: string | null;
  jurisdiction?: string | null;
  tipoSocial?: string | null;
}) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: [
      "materia_template_binding",
      tenantId,
      criteria?.materia ?? "all",
      criteria?.jurisdiction ?? "any",
      criteria?.tipoSocial ?? "any",
    ],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<TemplateBindingRow[]> => {
      let query = supabase
        .from("materia_template_binding")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("priority", { ascending: true });
      if (criteria?.materia) query = query.eq("materia", criteria.materia);
      if (criteria?.jurisdiction) query = query.in("jurisdiccion", [criteria.jurisdiction, "ANY", "GLOBAL"]);
      if (criteria?.tipoSocial) query = query.in("tipo_social", [criteria.tipoSocial, "ANY"]);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TemplateBindingRow[];
    },
  });
}

export function useEffectiveRuleMatrix(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["secretaria_effective_rule_matrix", tenantId, entityId ?? "none"],
    enabled: !!tenantId && !!entityId,
    staleTime: 60_000,
    queryFn: async (): Promise<EffectiveRuleMatrixRow[]> => {
      const { data, error } = await supabase
        .from("secretaria_effective_rule_matrix")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("matter_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EffectiveRuleMatrixRow[];
    },
  });
}

function invalidateNormativeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["secretaria_organ_rules"] });
  queryClient.invalidateQueries({ queryKey: ["secretaria_statute_versions"] });
  queryClient.invalidateQueries({ queryKey: ["secretaria_statute_clause_mappings"] });
  queryClient.invalidateQueries({ queryKey: ["secretaria_normative_overrides"] });
  queryClient.invalidateQueries({ queryKey: ["materia_template_binding"] });
  queryClient.invalidateQueries({ queryKey: ["secretaria_effective_rule_matrix"] });
  queryClient.invalidateQueries({ queryKey: ["secretaria_normative_framework_status"] });
  queryClient.invalidateQueries({ queryKey: ["governing_bodies"] });
}

export function useUpsertOrganProfile() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<UpsertOrganProfileInput, "tenantId">) => {
      if (!tenantId) throw new Error("tenantId requerido");
      return upsertOrganProfile(supabase, { ...input, tenantId });
    },
    onSuccess: () => invalidateNormativeQueries(queryClient),
  });
}

export function useUpsertOrganRule() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<UpsertOrganRuleInput, "tenantId">) => {
      if (!tenantId) throw new Error("tenantId requerido");
      return upsertOrganRule(supabase, { ...input, tenantId });
    },
    onSuccess: () => invalidateNormativeQueries(queryClient),
  });
}

export function usePublishStatuteVersion() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<PublishStatuteVersionInput, "tenantId">) => {
      if (!tenantId) throw new Error("tenantId requerido");
      return publishStatuteVersion(supabase, { ...input, tenantId });
    },
    onSuccess: () => invalidateNormativeQueries(queryClient),
  });
}

export function usePublishNormativeOverride() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<PublishNormativeOverrideInput, "tenantId">) => {
      if (!tenantId) throw new Error("tenantId requerido");
      return publishNormativeOverride(supabase, { ...input, tenantId });
    },
    onSuccess: () => invalidateNormativeQueries(queryClient),
  });
}

export function useAssignTemplateBinding() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<AssignTemplateBindingInput, "tenantId">) => {
      if (!tenantId) throw new Error("tenantId requerido");
      return assignTemplateBinding(supabase, { ...input, tenantId });
    },
    onSuccess: () => invalidateNormativeQueries(queryClient),
  });
}

export function useMaterializeEffectiveRuleMatrix() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { entityId?: string | null }) => {
      if (!tenantId) throw new Error("tenantId requerido");
      return materializeEffectiveRuleMatrix(supabase, { tenantId, entityId: input.entityId });
    },
    onSuccess: () => invalidateNormativeQueries(queryClient),
  });
}
