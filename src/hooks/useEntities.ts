import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { isOperationalSecretariaBody } from "@/lib/secretaria/operational-bodies";

export interface EntityRow {
  id: string;
  slug: string;
  legal_name: string;
  common_name: string;
  jurisdiction: string;
  legal_form: string | null;
  tipo_social?: string | null;
  registration_number: string | null;
  parent_entity_id: string | null;
  ownership_percentage: number | null;
  entity_status: string;
  materiality: string;
  secretary_owner_id: string | null;
  person_id?: string | null;
}

export interface EntityWithParent extends EntityRow {
  parent_name: string | null;
}

export interface GoverningBodyRow {
  id: string;
  slug: string;
  entity_id: string;
  name: string;
  body_type: string;
  config?: Record<string, unknown> | null;
}

export interface PolicyRow {
  id: string;
  policy_code: string;
  title: string;
  owner_function: string | null;
  status: string;
  next_review_date: string | null;
}

export interface DelegationRow {
  id: string;
  code: string;
  slug: string;
  delegation_type: string;
  entity_id: string;
  scope: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

export interface FindingRow {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  entity_id: string | null;
  due_date: string | null;
}

const labelJurisdiction = (code: string) => {
  const m: Record<string, string> = {
    ES: "España", BR: "Brasil", MX: "México", CO: "Colombia", PE: "Perú",
    AR: "Argentina", CL: "Chile", US: "EE.UU.", TR: "Turquía", IT: "Italia",
    PT: "Portugal", DE: "Alemania", LU: "Luxemburgo", MT: "Malta",
    ID: "Indonesia", PH: "Filipinas",
  };
  return m[code] ?? code;
};

const labelMateriality = (m: string) => {
  const map: Record<string, string> = {
    Critical: "Crítica", High: "Alta", Medium: "Media", Low: "Baja",
  };
  return map[m] ?? m;
};

const labelStatus = (s: string) => (s === "Active" ? "Activa" : s === "Inactive" ? "Inactiva" : s);

export const formatJurisdiction = labelJurisdiction;
export const formatMateriality = labelMateriality;
export const formatEntityStatus = labelStatus;

export function useEntitiesList(options?: { sociedadesOnly?: boolean }) {
  const { tenantId } = useTenantContext();
  const sociedadesOnly = options?.sociedadesOnly ?? false;

  return useQuery({
    queryKey: ["entities", tenantId, "list", sociedadesOnly ? "sociedades" : "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<EntityWithParent[]> => {
      let query = supabase
        .from("entities")
        .select("*, parent:parent_entity_id(common_name)")
        .eq("tenant_id", tenantId!);

      if (sociedadesOnly) {
        query = query.not("person_id", "is", null);
      }

      const { data, error } = await query.order("common_name", { ascending: true });
      if (error) throw error;
      type Raw = EntityRow & { parent?: { common_name?: string | null } | null };
      return ((data ?? []) as Raw[]).map((e) => ({
        ...e,
        parent_name: e.parent?.common_name ?? null,
      }));
    },
  });
}

export function useEntityBySlug(slug: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!slug && !!tenantId,
    queryKey: ["entities", tenantId, "bySlug", slug],
    queryFn: async (): Promise<EntityRow | null> => {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as EntityRow) ?? null;
    },
  });
}

export function useEntityChildren(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["entities", tenantId, "children", entityId],
    queryFn: async (): Promise<EntityRow[]> => {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("parent_entity_id", entityId!)
        .order("common_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EntityRow[];
    },
  });
}

export function useEntityParent(parentId: string | null | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!parentId && !!tenantId,
    queryKey: ["entities", tenantId, "byId", parentId],
    queryFn: async (): Promise<EntityRow | null> => {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("id", parentId!)
        .maybeSingle();
      if (error) throw error;
      return (data as EntityRow) ?? null;
    },
  });
}

export function useEntityBodies(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["governing_bodies", tenantId, "byEntity", entityId],
    queryFn: async (): Promise<GoverningBodyRow[]> => {
      const { data, error } = await supabase
        .from("governing_bodies")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as GoverningBodyRow[]).filter(isOperationalSecretariaBody);
    },
  });
}

export function useAllPolicies() {
  return useQuery({
    queryKey: ["policies", "all"],
    queryFn: async (): Promise<PolicyRow[]> => {
      const { data, error } = await supabase
        .from("policies")
        .select("id, policy_code, title, owner_function, status, next_review_date")
        .order("policy_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PolicyRow[];
    },
  });
}

export function useEntityDelegations(entityId: string | undefined) {
  return useQuery({
    enabled: !!entityId,
    queryKey: ["delegations", "byEntity", entityId],
    queryFn: async (): Promise<DelegationRow[]> => {
      const { data, error } = await supabase
        .from("delegations")
        .select("*")
        .eq("entity_id", entityId!)
        .order("code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DelegationRow[];
    },
  });
}

export function useEntityFindings(entityId: string | undefined) {
  return useQuery({
    enabled: !!entityId,
    queryKey: ["findings", "byEntity", entityId],
    queryFn: async (): Promise<FindingRow[]> => {
      const { data, error } = await supabase
        .from("findings")
        .select("id, code, title, severity, status, entity_id, due_date")
        .eq("entity_id", entityId!)
        .order("code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FindingRow[];
    },
  });
}
