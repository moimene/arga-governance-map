import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ControlDetailRow {
  id: string;
  code: string;
  name: string;
  status: string | null;
  owner_id: string | null;
  obligation_id: string | null;
  last_test_date: string | null;
  next_test_date: string | null;
}

export interface ControlDetailFull extends ControlDetailRow {
  owner_name: string | null;
  obligation_code: string | null;
  obligation_title: string | null;
  obligation_source: string | null;
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

export interface EvidenceFull extends EvidenceRow {
  owner_name: string | null;
}

export function useControlByCode(code: string | undefined) {
  return useQuery({
    queryKey: ["controls", "byCode", code],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controls")
        .select("*, owner:owner_id(full_name), obligation:obligation_id(code, title, source)")
        .eq("code", code!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      type Raw = ControlDetailRow & {
        owner?: { full_name?: string | null } | null;
        obligation?: { code?: string | null; title?: string | null; source?: string | null } | null;
      };
      const row = data as Raw;
      return {
        ...row,
        owner_name: row.owner?.full_name ?? null,
        obligation_code: row.obligation?.code ?? null,
        obligation_title: row.obligation?.title ?? null,
        obligation_source: row.obligation?.source ?? null,
      } as ControlDetailFull;
    },
  });
}

export function useControlEvidences(controlId: string | undefined) {
  return useQuery({
    queryKey: ["evidences", "byControl", controlId],
    enabled: !!controlId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidences")
        .select("*, owner:owner_id(full_name)")
        .eq("control_id", controlId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Raw = EvidenceRow & { owner?: { full_name?: string | null } | null };
      return ((data ?? []) as Raw[]).map((row) => ({
        ...row,
        owner_name: row.owner?.full_name ?? null,
      })) as EvidenceFull[];
    },
  });
}

// Findings that reference the same obligation as this control
export function useControlRelatedFindings(obligationId: string | null | undefined) {
  return useQuery({
    queryKey: ["findings", "byObligation", obligationId],
    enabled: !!obligationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("findings")
        .select("id, code, title, severity, status")
        .eq("obligation_id", obligationId!)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });
}
