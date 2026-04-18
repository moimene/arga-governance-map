import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DelegationRow {
  id: string;
  code: string;
  slug: string;
  delegation_type: string | null;
  entity_id: string | null;
  grantor_id: string | null;
  delegate_id: string | null;
  scope: string | null;
  limits: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  alert_t90: boolean | null;
  alert_t60: boolean | null;
  alert_t30: boolean | null;
}

export interface DelegationFull extends DelegationRow {
  entity_name: string | null;
  entity_slug: string | null;
  entity_legal_name: string | null;
  grantor_name: string | null;
  delegate_name: string | null;
}

// Map DB status → UI label/tone
export const delegationStatusLabel = (s: string | null | undefined) => {
  switch (s) {
    case "Vigente": return "VIGENTE";
    case "Próxima a vencer":
    case "Próximo a vencer": return "PRÓXIMA VENCIMIENTO";
    case "Caducada": return "CADUCADA";
    case "Revocada": return "REVOCADA";
    default: return (s ?? "—").toUpperCase();
  }
};

export const delegationStatusTone = (s: string | null | undefined) => {
  switch (s) {
    case "Caducada": return "critical" as const;
    case "Próxima a vencer":
    case "Próximo a vencer": return "warning" as const;
    case "Revocada": return "archived" as const;
    case "Vigente": return "active" as const;
    default: return "neutral" as const;
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
  entity:entity_id(common_name, slug, legal_name),
  grantor:grantor_id(full_name),
  delegate:delegate_id(full_name)
`;

type DelegationRaw = DelegationRow & {
  entity?: { common_name?: string | null; slug?: string | null; legal_name?: string | null } | null;
  grantor?: { full_name?: string | null } | null;
  delegate?: { full_name?: string | null } | null;
};

const mapRow = (row: DelegationRaw): DelegationFull => ({
  ...row,
  entity_name: row.entity?.common_name ?? null,
  entity_slug: row.entity?.slug ?? null,
  entity_legal_name: row.entity?.legal_name ?? null,
  grantor_name: row.grantor?.full_name ?? null,
  delegate_name: row.delegate?.full_name ?? null,
});

export function useDelegationsList() {
  return useQuery({
    queryKey: ["delegations", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select(SELECT)
        .order("code");
      if (error) throw error;
      return ((data ?? []) as DelegationRaw[]).map(mapRow);
    },
  });
}

export function useDelegationBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["delegations", "bySlug", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select(SELECT)
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data as DelegationRaw) : null;
    },
  });
}
