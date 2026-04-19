import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PolicyRow {
  id: string;
  policy_code: string;
  title: string;
  policy_type: string | null;
  normative_tier: string | null;
  scope_level: string | null;
  owner_function: string | null;
  approval_body_id: string | null;
  status: string;
  effective_date: string | null;
  next_review_date: string | null;
  current_version: number | null;
}

export interface PolicyWithBody extends PolicyRow {
  approval_body_name: string | null;
}

export interface ObligationRow {
  id: string;
  code: string;
  title: string;
  source: string | null;
  criticality: string | null;
  policy_id: string | null;
  country_scope: string[] | null;
}

export interface ObligationWithPolicy extends ObligationRow {
  policy_code: string | null;
  policy_title: string | null;
}

export interface ControlRow {
  id: string;
  code: string;
  name: string;
  status: string | null;
  owner_id: string | null;
  obligation_id: string | null;
  last_test_date: string | null;
  next_test_date: string | null;
}

export interface ControlWithOwner extends ControlRow {
  owner_name: string | null;
}

export interface EvidenceRow {
  id: string;
  control_id: string;
  title: string;
  ev_type: string | null;
  status: string | null;
  owner_id: string | null;
  rejection_reason: string | null;
  file_url: string | null;
  legal_hold: boolean | null;
  created_at: string;
}

// ───────── Status mapping helpers ─────────

export const policyStatusLabel = (s: string | null | undefined) => {
  switch (s) {
    case "Draft": return "BORRADOR";
    case "In Review": return "EN REVISIÓN";
    case "Legal Review": return "REVISIÓN JURÍDICA";
    case "Approval Pending": return "PENDIENTE APROBACIÓN";
    case "Approved": return "APROBADA";
    case "Published": return "VIGENTE";
    case "Superseded": return "SUSTITUIDA";
    case "Archived": return "ARCHIVADA";
    default: return (s ?? "—").toUpperCase();
  }
};

export const policyStatusToStep = (s: string | null | undefined): number => {
  switch (s) {
    case "Draft": return 1;
    case "In Review": return 2;
    case "Legal Review": return 3;
    case "Approval Pending": return 4;
    case "Approved": return 5;
    case "Published": return 6;
    case "Superseded":
    case "Archived": return 7;
    default: return 1;
  }
};

export const obligationCriticalityTone = (c: string | null | undefined) => {
  switch (c) {
    case "Crítico": return "critical" as const;
    case "Alto": return "warning" as const;
    case "Medio": return "warning" as const;
    case "Bajo": return "neutral" as const;
    default: return "neutral" as const;
  }
};

export const controlStatusLabel = (s: string | null | undefined) => {
  switch (s) {
    case "Efectivo": return "EFECTIVO";
    case "Parcial": return "EN REMEDIACIÓN";
    case "Deficiente": return "DEFICIENTE";
    case "No probado": return "NO PROBADO";
    default: return (s ?? "—").toUpperCase();
  }
};

export const controlStatusTone = (s: string | null | undefined) => {
  switch (s) {
    case "Efectivo": return "active" as const;
    case "Parcial": return "warning" as const;
    case "Deficiente": return "critical" as const;
    case "No probado": return "neutral" as const;
    default: return "neutral" as const;
  }
};

export const evidenceStatusLabel = (s: string | null | undefined) => {
  switch (s) {
    case "Validada": return "VALIDADA";
    case "Rechazada": return "RECHAZADA";
    case "Pendiente": return "PENDIENTE VALIDACIÓN";
    case "Vencida": return "VENCIDA";
    default: return (s ?? "—").toUpperCase();
  }
};

export const evidenceStatusTone = (s: string | null | undefined) => {
  switch (s) {
    case "Validada": return "active" as const;
    case "Rechazada":
    case "Vencida": return "critical" as const;
    case "Pendiente": return "warning" as const;
    default: return "neutral" as const;
  }
};

// ───────── Queries ─────────

export function usePoliciesList() {
  return useQuery({
    queryKey: ["policies", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*, approval_body:approval_body_id(name)")
        .order("policy_code");
      if (error) throw error;
      type Raw = PolicyRow & { approval_body?: { name?: string | null } | null };
      return ((data ?? []) as Raw[]).map((row) => ({
        ...row,
        approval_body_name: row.approval_body?.name ?? null,
      })) as PolicyWithBody[];
    },
  });
}

export function usePolicyByCode(code: string | undefined) {
  return useQuery({
    queryKey: ["policies", "byCode", code],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*, approval_body:approval_body_id(name)")
        .eq("policy_code", code!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      type Raw = PolicyRow & { approval_body?: { name?: string | null } | null };
      const row = data as Raw;
      return { ...row, approval_body_name: row.approval_body?.name ?? null } as PolicyWithBody;
    },
  });
}

export function usePolicyObligations(policyId: string | undefined) {
  return useQuery({
    queryKey: ["obligations", "byPolicy", policyId],
    enabled: !!policyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obligations")
        .select("*")
        .eq("policy_id", policyId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as ObligationRow[];
    },
  });
}

export function useObligationsList() {
  return useQuery({
    queryKey: ["obligations", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obligations")
        .select("*, policy:policy_id(policy_code, title)")
        .order("code");
      if (error) throw error;
      type Raw = ObligationRow & { policy?: { policy_code?: string | null; title?: string | null } | null };
      return ((data ?? []) as Raw[]).map((row) => ({
        ...row,
        policy_code: row.policy?.policy_code ?? null,
        policy_title: row.policy?.title ?? null,
      })) as ObligationWithPolicy[];
    },
  });
}

export function useObligationByCode(code: string | undefined) {
  return useQuery({
    queryKey: ["obligations", "byCode", code],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obligations")
        .select("*, policy:policy_id(policy_code, title)")
        .eq("code", code!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      type Raw = ObligationRow & { policy?: { policy_code?: string | null; title?: string | null } | null };
      const row = data as Raw;
      return {
        ...row,
        policy_code: row.policy?.policy_code ?? null,
        policy_title: row.policy?.title ?? null,
      } as ObligationWithPolicy;
    },
  });
}

export function useObligationControls(obligationId: string | undefined) {
  return useQuery({
    queryKey: ["controls", "byObligation", obligationId],
    enabled: !!obligationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controls")
        .select("*, owner:owner_id(full_name)")
        .eq("obligation_id", obligationId!)
        .order("code");
      if (error) throw error;
      type Raw = ControlRow & { owner?: { full_name?: string | null } | null };
      return ((data ?? []) as Raw[]).map((row) => ({
        ...row,
        owner_name: row.owner?.full_name ?? null,
      })) as ControlWithOwner[];
    },
  });
}

export function useAllControlsByObligationIds(obligationIds: string[]) {
  return useQuery({
    queryKey: ["controls", "byObligationIds", obligationIds.sort().join(",")],
    enabled: obligationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controls")
        .select("*, owner:owner_id(full_name)")
        .in("obligation_id", obligationIds);
      if (error) throw error;
      type Raw = ControlRow & { owner?: { full_name?: string | null } | null };
      return ((data ?? []) as Raw[]).map((row) => ({
        ...row,
        owner_name: row.owner?.full_name ?? null,
      })) as ControlWithOwner[];
    },
  });
}

export function useEvidencesByControlIds(controlIds: string[]) {
  return useQuery({
    queryKey: ["evidences", "byControlIds", controlIds.sort().join(",")],
    enabled: controlIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidences")
        .select("*")
        .in("control_id", controlIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EvidenceRow[];
    },
  });
}
