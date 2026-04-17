import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  summary: string | null;
  related_finding: string | null;
  confidentiality: string | null;
  closed_date: string | null;
  closing_reason: string | null;
}

export interface SiiCaseFull extends SiiCaseRow {
  investigator_name: string | null;
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

// Access the `sii` schema explicitly (must be exposed via Supabase API settings)
const sii = (supabase as any).schema ? (supabase as any).schema("sii") : supabase;

async function attachInvestigators<T extends { investigator_id: string | null }>(rows: T[]) {
  const ids = Array.from(new Set(rows.map((r) => r.investigator_id).filter(Boolean))) as string[];
  if (ids.length === 0) return new Map<string, string>();
  const { data } = await supabase.from("persons").select("id, full_name").in("id", ids);
  const map = new Map<string, string>();
  (data ?? []).forEach((p: any) => map.set(p.id, p.full_name));
  return map;
}

export function useSiiCasesList() {
  return useQuery({
    queryKey: ["sii", "cases", "list"],
    queryFn: async () => {
      const { data, error } = await sii
        .from("cases")
        .select("*")
        .order("received_date", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as SiiCaseRow[];
      const investigators = await attachInvestigators(rows);
      return rows.map<SiiCaseFull>((r) => ({
        ...r,
        investigator_name: r.investigator_id ? investigators.get(r.investigator_id) ?? null : null,
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
      const { data: byRef } = await sii
        .from("cases")
        .select("*")
        .eq("reference", id)
        .maybeSingle();
      let row = byRef as SiiCaseRow | null;
      if (!row) {
        const { data: byId, error } = await sii
          .from("cases")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        row = byId as SiiCaseRow | null;
      }
      if (!row) return null;

      const [actionsRes, evidencesRes, investigators] = await Promise.all([
        sii.from("actions").select("*").eq("case_id", row.id).order("action_date", { ascending: true }),
        sii.from("evidences").select("*").eq("case_id", row.id),
        attachInvestigators([row]),
      ]);

      const actions = ((actionsRes.data ?? []) as SiiActionRow[]).map((a) => ({
        ...a,
        action_date: formatDate(a.action_date),
      }));

      return {
        ...row,
        investigator_name: row.investigator_id ? investigators.get(row.investigator_id) ?? null : null,
        display_id: row.reference ?? row.id,
        received_date: formatDate(row.received_date),
        closed_date: formatDate(row.closed_date),
        actions,
        evidences: (evidencesRes.data ?? []) as SiiEvidenceRow[],
      } as SiiCaseDetail;
    },
  });
}
