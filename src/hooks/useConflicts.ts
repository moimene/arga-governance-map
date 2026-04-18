import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConflictRow {
  id: string;
  code: string;
  person_id: string;
  conflict_type: string;
  description: string;
  status: string;
  related_finding_id: string | null;
  declared_at: string | null;
  created_at: string;
}

export interface ConflictFull extends ConflictRow {
  person_name: string | null;
  person_role: string | null;
  finding_code: string | null;
}

export interface AttestationRow {
  id: string;
  person_id: string;
  campaign: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export interface AttestationFull extends AttestationRow {
  person_name: string | null;
  person_email: string | null;
  person_role: string | null;
}

const formatDateTime = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export const conflictTypeLabel = (t: string) => t.toUpperCase();

// Fetch a map: person_id → primary active role (first mandate role)
async function fetchRolesByPersonIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const { data } = await supabase
    .from("mandates")
    .select("person_id, role, status")
    .in("person_id", ids)
    .eq("status", "Activo");
  const map = new Map<string, string>();
  type MandateRoleRow = { person_id: string; role: string; status: string };
  ((data ?? []) as MandateRoleRow[]).forEach((m) => {
    if (!map.has(m.person_id)) map.set(m.person_id, m.role);
  });
  return map;
}

export function useConflictsList() {
  return useQuery({
    queryKey: ["conflicts", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conflicts_of_interest")
        .select("*, person:person_id(full_name), finding:related_finding_id(code)")
        .order("status", { ascending: false });
      if (error) throw error;
      type ConflictRaw = ConflictRow & {
        person?: { full_name?: string | null } | null;
        finding?: { code?: string | null } | null;
      };
      const rows = (data ?? []) as ConflictRaw[];
      const roles = await fetchRolesByPersonIds(rows.map((r) => r.person_id).filter(Boolean));
      return rows.map((r): ConflictFull => ({
        ...r,
        person_name: r.person?.full_name ?? null,
        person_role: roles.get(r.person_id) ?? null,
        finding_code: r.finding?.code ?? null,
        declared_at: formatDateTime(r.declared_at),
      }));
    },
  });
}

export function useAttestationsList() {
  return useQuery({
    queryKey: ["attestations", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attestations")
        .select("*, person:person_id(full_name, email)")
        .order("status", { ascending: true }); // Pendiente < Completada alfabéticamente — invertimos abajo
      if (error) throw error;
      type AttestationRaw = AttestationRow & { person?: { full_name?: string | null; email?: string | null } | null };
      const rows = (data ?? []) as AttestationRaw[];
      const roles = await fetchRolesByPersonIds(rows.map((r) => r.person_id).filter(Boolean));
      // Pendientes primero
      rows.sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === "Pendiente" ? -1 : 1;
      });
      return rows.map((r): AttestationFull => ({
        ...r,
        person_name: r.person?.full_name ?? null,
        person_email: r.person?.email ?? null,
        person_role: roles.get(r.person_id) ?? null,
        completed_at: formatDateTime(r.completed_at),
      }));
    },
  });
}
