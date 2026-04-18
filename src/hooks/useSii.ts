import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Las vistas sii_*_view no están en los tipos generados de Supabase.
// Helper para atacarlas por PostgREST con tipado mínimo del encadenamiento
// usado en este archivo (select → eq → order/maybeSingle).
type Rest<Row> = {
  select: (cols: string) => RestQuery<Row>;
};
type RestQuery<Row> = {
  eq: (col: string, v: unknown) => RestQuery<Row>;
  order: (col: string, opts?: { ascending?: boolean }) => RestQuery<Row>;
  maybeSingle: () => Promise<{ data: Row | null; error: { message: string } | null }>;
  then<T>(fn: (r: { data: Row[] | null; error: { message: string } | null }) => T): Promise<T>;
};
const siiFrom = <Row>(table: string): Rest<Row> =>
  (supabase as unknown as { from: (t: string) => Rest<Row> }).from(table);

export interface SiiActionRow {
  id: string;
  case_id: string;
  action_date: string | null;
  action: string;
  actor: string | null;
  created_at?: string;
}

export interface SiiEvidenceRow {
  id: string;
  case_id: string;
  title: string;
  type: string | null;
  status: string | null;
}

export interface SiiCaseRow {
  id: string;
  reference: string | null;
  received_date: string | null;
  channel: string | null;
  category: string | null;
  classification?: string | null;
  country?: string | null;
  status: string | null;
  investigator_id: string | null;
  investigator_name: string | null;
  summary: string | null;
  related_finding: string | null;
  confidentiality: string | null;
  closed_date: string | null;
  closing_reason: string | null;
}

export interface SiiCaseFull extends SiiCaseRow {
  display_id: string;
}

export interface SiiCaseDetail extends SiiCaseFull {
  actions: SiiActionRow[];
  evidences: SiiEvidenceRow[];
}

const formatDate = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export function useSiiCasesList() {
  return useQuery({
    queryKey: ["sii", "cases", "list"],
    queryFn: async () => {
      const { data, error } = await siiFrom<SiiCaseRow>("sii_cases_view")
        .select("*")
        .order("received_date", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      return rows.map<SiiCaseFull>((r) => ({
        ...r,
        display_id: r.reference ?? r.id,
        received_date: formatDate(r.received_date),
        closed_date: formatDate(r.closed_date),
      }));
    },
  });
}

export function useSiiCaseById(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["sii", "case", id],
    queryFn: async () => {
      // Try lookup by reference first, fallback to id
      const { data: byRef } = await siiFrom<SiiCaseRow>("sii_cases_view")
        .select("*")
        .eq("reference", id)
        .maybeSingle();
      let row: SiiCaseRow | null = byRef;
      if (!row) {
        const { data: byId, error } = await siiFrom<SiiCaseRow>("sii_cases_view")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        row = byId;
      }
      if (!row) return null;

      const [actionsRes, evidencesRes] = await Promise.all([
        siiFrom<SiiActionRow>("sii_actions_view")
          .select("*")
          .eq("case_id", row.id)
          .order("action_date", { ascending: true }),
        siiFrom<SiiEvidenceRow>("sii_evidences_view")
          .select("*")
          .eq("case_id", row.id),
      ]);

      const actions = (actionsRes.data ?? []).map((a) => ({
        ...a,
        action_date: formatDate(a.action_date),
      }));

      return {
        ...row,
        display_id: row.reference ?? row.id,
        received_date: formatDate(row.received_date),
        closed_date: formatDate(row.closed_date),
        actions,
        evidences: evidencesRes.data ?? [],
      } as SiiCaseDetail;
    },
  });
}
