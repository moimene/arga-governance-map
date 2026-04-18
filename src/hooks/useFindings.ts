import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FindingRow {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  origin: string | null;
  entity_id: string | null;
  obligation_id: string | null;
  owner_id: string | null;
  due_date: string | null;
  opened_at: string | null;
  closed_at: string | null;
}

export interface FindingFull extends FindingRow {
  entity_name: string | null;
  entity_slug: string | null;
  owner_name: string | null;
  obligation_code: string | null;
  obligation_title: string | null;
}

export const severityLabel = (s: string | null | undefined) => {
  switch (s) {
    case "Crítico": return "CRÍTICA";
    case "Alto": return "ALTA";
    case "Medio": return "MEDIA";
    case "Bajo": return "BAJA";
    default: return (s ?? "—").toUpperCase();
  }
};

export const severityTone = (s: string | null | undefined) => {
  switch (s) {
    case "Crítico":
    case "Alto": return "critical" as const;
    case "Medio": return "warning" as const;
    case "Bajo": return "neutral" as const;
    default: return "neutral" as const;
  }
};

export const findingStatusLabel = (s: string | null | undefined) => {
  switch (s) {
    case "Abierto": return "ABIERTO";
    case "Asignado": return "ASIGNADO";
    case "EnRemediacion":
    case "En Remediación": return "EN REMEDIACIÓN";
    case "EnInvestigacion":
    case "En Investigación": return "EN INVESTIGACIÓN";
    case "PendienteValidacion":
    case "Pendiente Validación": return "PENDIENTE VALIDACIÓN";
    case "Cerrado": return "CERRADO";
    default: return (s ?? "—").toUpperCase();
  }
};

export const findingStatusToStep = (s: string | null | undefined): number => {
  switch (s) {
    case "Abierto": return 1;
    case "Asignado": return 2;
    case "EnInvestigacion":
    case "En Investigación": return 3;
    case "EnRemediacion":
    case "En Remediación": return 4;
    case "PendienteValidacion":
    case "Pendiente Validación": return 5;
    case "Cerrado": return 6;
    default: return 1;
  }
};

export const originLabel = (s: string | null | undefined) => {
  switch (s) {
    case "AuditInterna": return "Auditoría Interna";
    case "Cumplimiento": return "Cumplimiento";
    case "SecretariaGeneral":
    case "Secretaría General": return "Secretaría General";
    case "Externa":
    case "AuditExterna": return "Auditoría Externa";
    default: return s ?? "—";
  }
};

export const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};

const SELECT = `
  *,
  entity:entity_id(common_name, slug),
  owner:owner_id(full_name),
  obligation:obligation_id(code, title)
`;

type FindingRaw = FindingRow & {
  entity?: { common_name?: string | null; slug?: string | null } | null;
  owner?: { full_name?: string | null } | null;
  obligation?: { code?: string | null; title?: string | null } | null;
};

const mapRow = (row: FindingRaw): FindingFull => ({
  ...row,
  entity_name: row.entity?.common_name ?? null,
  entity_slug: row.entity?.slug ?? null,
  owner_name: row.owner?.full_name ?? null,
  obligation_code: row.obligation?.code ?? null,
  obligation_title: row.obligation?.title ?? null,
});

export function useFindingsList() {
  return useQuery({
    queryKey: ["findings", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("findings")
        .select(SELECT)
        .order("code");
      if (error) throw error;
      return ((data ?? []) as FindingRaw[]).map(mapRow);
    },
  });
}

export function useFindingByCode(code: string | undefined) {
  return useQuery({
    queryKey: ["findings", "byCode", code],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("findings")
        .select(SELECT)
        .eq("code", code!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data as FindingRaw) : null;
    },
  });
}

// Find controls associated with the same obligation as this finding
export function useFindingRelatedControls(obligationId: string | null | undefined) {
  return useQuery({
    queryKey: ["findings", "relatedControls", obligationId],
    enabled: !!obligationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controls")
        .select("id, code, name, status, owner:owner_id(full_name)")
        .eq("obligation_id", obligationId!)
        .order("code");
      if (error) throw error;
      type ControlRaw = {
        id: string;
        code: string;
        name: string;
        status: string | null;
        owner?: { full_name?: string | null } | null;
      };
      return ((data ?? []) as ControlRaw[]).map((c) => ({
        ...c,
        owner_name: c.owner?.full_name ?? null,
      }));
    },
  });
}

export interface ActionPlanRow {
  id: string;
  finding_id: string;
  title: string;
  responsible_id: string | null;
  due_date: string | null;
  status: string;
  progress_pct: number | null;
}

export interface ActionPlanFull extends ActionPlanRow {
  responsible_name: string | null;
}

export function useActionPlansByFinding(findingId: string | null | undefined) {
  return useQuery({
    queryKey: ["actionPlans", "byFinding", findingId],
    enabled: !!findingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plans")
        .select("*, responsible:responsible_id(full_name)")
        .eq("finding_id", findingId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      type ApRaw = ActionPlanRow & { responsible?: { full_name?: string | null } | null };
      return ((data ?? []) as ApRaw[]).map((r): ActionPlanFull => ({
        ...r,
        responsible_name: r.responsible?.full_name ?? null,
      }));
    },
  });
}

