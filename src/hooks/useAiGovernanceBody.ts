import { skipToken, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { useBodyById, type BodyRow } from "@/hooks/useBodies";
import { resolveAiGovernanceBodyId } from "@/lib/aims/governing-body";

/**
 * Órgano de gobierno de la IA del tenant, resuelto por dato (F2.T9, MOI-170;
 * MOI-150), no por una lista fija de tenants escrita en el programa.
 *
 * Dos pasos: 1) trae de Cloud lo mínimo para decidir (`resolveAiGovernanceBodyId`,
 * hoja pura en `@/lib/aims/governing-body`); 2) si resuelve un id, trae la
 * ficha completa del órgano. `data` es `null` sin órgano acreditado — el
 * Dashboard no pinta el panel en ese caso (fallo cerrado, no un órgano
 * inventado).
 */
export function useAiGovernanceBody() {
  const { tenantId } = useTenantContext();
  const bodyIdQuery = useQuery({
    queryKey: ["ai_governance_body_id", tenantId],
    queryFn: tenantId ? async (): Promise<string | null> => {
      const { data: subjects, error: errSub } = await supabase
        .from("aims_ria_subjects")
        .select("governing_body_id")
        .eq("tenant_id", tenantId!)
        .not("governing_body_id", "is", null)
        .order("created_at", { ascending: true });
      if (errSub) throw errSub;

      const { data: systems, error: errSys } = await supabase
        .from("ai_systems")
        .select("ai_policy_id")
        .eq("tenant_id", tenantId!)
        .not("ai_policy_id", "is", null)
        // Orden fijo: con varias políticas de IA con órganos distintos, el
        // resultado no puede depender del orden en que Postgres devuelva filas.
        .order("id", { ascending: true });
      if (errSys) throw errSys;

      const policyIds = [...new Set((systems ?? []).map((s) => s.ai_policy_id as string))];
      let policies: Array<{ id: string; owner_body_id: string | null }> = [];
      if (policyIds.length > 0) {
        const { data: pol, error: errPol } = await supabase
          .from("policies")
          .select("id, owner_body_id")
          .eq("tenant_id", tenantId!)
          .in("id", policyIds);
        if (errPol) throw errPol;
        policies = pol ?? [];
      }

      return resolveAiGovernanceBodyId({
        subjects: (subjects ?? []) as { governing_body_id: string | null }[],
        systems: (systems ?? []) as { ai_policy_id: string | null }[],
        policies,
      });
    } : skipToken,
  });

  const bodyQuery = useBodyById(bodyIdQuery.data ?? undefined);

  return {
    data: (bodyQuery.data ?? null) as BodyRow | null,
    isLoading: bodyIdQuery.isLoading || bodyQuery.isLoading,
    error: bodyIdQuery.error ?? bodyQuery.error ?? null,
  };
}

export interface AiSystemBySubjectRow {
  subject_id: string;
  system_id: string;
  tenant_id: string;
  system_name: string;
  role: string;
  status: string;
}

/**
 * Sistemas de IA de los que esta ENTIDAD es sujeto (`v_aims_sistemas_por_entidad`,
 * F2.T12). Con 0 sujetos declarados (hoy, en los dos tenants) devuelve `[]`:
 * la pantalla que la usa debe pintar un vacío honesto, no el inventario entero
 * del tenant como si estuviera atribuido a esta sociedad.
 */
export function useAiSystemsByEntitySubject(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["v_aims_sistemas_por_entidad", tenantId, entityId],
    queryFn: tenantId && entityId ? async (): Promise<AiSystemBySubjectRow[]> => {
      const { data, error } = await supabase
        .from("v_aims_sistemas_por_entidad")
        .select("subject_id, system_id, tenant_id, system_name, role, status")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!);
      if (error) throw error;
      return (data ?? []) as AiSystemBySubjectRow[];
    } : skipToken,
  });
}

export interface AiSystemByBodyRow {
  subject_id: string;
  system_id: string;
  tenant_id: string;
  system_name: string;
  entity_id: string;
  role: string;
  status: string;
}

/**
 * Sistemas de IA que este ÓRGANO gobierna (`v_aims_sistemas_por_organo`,
 * F2.T9). Con 0 sujetos declarados devuelve `[]`.
 */
export function useAiSystemsByGoverningBody(bodyId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["v_aims_sistemas_por_organo", tenantId, bodyId],
    queryFn: tenantId && bodyId ? async (): Promise<AiSystemByBodyRow[]> => {
      const { data, error } = await supabase
        .from("v_aims_sistemas_por_organo")
        .select("subject_id, system_id, tenant_id, system_name, entity_id, role, status")
        .eq("tenant_id", tenantId!)
        .eq("governing_body_id", bodyId!);
      if (error) throw error;
      return (data ?? []) as AiSystemByBodyRow[];
    } : skipToken,
  });
}
