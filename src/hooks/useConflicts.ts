import { useQuery } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { supabase } from "@/integrations/supabase/client";

export interface ConflictRow {
  id: string;
  code: string;
  person_id: string;
  conflict_type: string;
  description: string;
  status: string;
  related_finding_id: string | null;
  related_agenda_item_id: string | null;
  related_meeting_id: string | null;
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

type ConflictRaw = {
  id: string;
  code: string | null;
  person_id: string | null;
  conflict_type: string | null;
  description: string | null;
  status: string | null;
  related_finding_id: string | null;
  related_agenda_item_id: string | null;
  related_meeting_id: string | null;
  declared_at: string | null;
  created_at: string | null;
  person?: { full_name?: string | null } | null;
  finding?: { code?: string | null; entity_id?: string | null } | null;
  meeting?: { governing_bodies?: { entity_id?: string | null } | null } | null;
};

const ACTIVE_CONFLICT_STATUS = "ABIERTO";

const formatDateTime = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export const conflictTypeLabel = (t: string) => t.toUpperCase();

// Fetch a map: person_id → primary active role (first mandate role)
async function fetchRolesByPersonIds(ids: string[], tenantId: string | null) {
  if (ids.length === 0) return new Map<string, string>();
  let query = supabase
    .from("mandates")
    .select("person_id, role, status")
    .in("person_id", ids)
    .eq("status", "Activo");
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  const { data } = await query;
  const map = new Map<string, string>();
  type MandateRoleRow = { person_id: string; role: string; status: string };
  ((data ?? []) as MandateRoleRow[]).forEach((m) => {
    if (!map.has(m.person_id)) map.set(m.person_id, m.role);
  });
  return map;
}

function mapConflictRow(row: ConflictRaw, roles: Map<string, string>): ConflictFull {
  const personId = row.person_id ?? "";
  return {
    id: row.id,
    code: row.code ?? "",
    person_id: personId,
    conflict_type: row.conflict_type ?? "",
    description: row.description ?? "",
    status: row.status ?? "",
    related_finding_id: row.related_finding_id,
    related_agenda_item_id: row.related_agenda_item_id,
    related_meeting_id: row.related_meeting_id,
    declared_at: formatDateTime(row.declared_at),
    created_at: row.created_at ?? "",
    person_name: row.person?.full_name ?? null,
    person_role: personId ? roles.get(personId) ?? null : null,
    finding_code: row.finding?.code ?? null,
  };
}

function matchesConflictEntity(row: ConflictRaw, entityId?: string | null) {
  if (!entityId) return true;
  const relatedEntityId = row.meeting?.governing_bodies?.entity_id ?? row.finding?.entity_id ?? null;
  return relatedEntityId === null || relatedEntityId === entityId;
}

export function useConflictsList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["conflicts", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conflicts_of_interest")
        .select("*, person:person_id(full_name), finding:related_finding_id(code)")
        .eq("tenant_id", tenantId!)
        .order("status", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as ConflictRaw[];
      const roles = await fetchRolesByPersonIds(
        rows.map((r) => r.person_id).filter((personId): personId is string => Boolean(personId)),
        tenantId,
      );
      return rows.map((row) => mapConflictRow(row, roles));
    },
  });
}

export function useActiveConflicts(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["conflicts", tenantId, "active", entityId ?? "all"],
    enabled: !!tenantId && entityId !== null,
    queryFn: async (): Promise<ConflictFull[]> => {
      const { data, error } = await supabase
        .from("conflicts_of_interest")
        .select(
          "*, person:person_id(full_name), finding:related_finding_id(code, entity_id), meeting:related_meeting_id(governing_bodies(entity_id))",
        )
        .eq("tenant_id", tenantId!)
        .eq("status", ACTIVE_CONFLICT_STATUS)
        .order("declared_at", { ascending: false });
      if (error) throw error;

      const rows = ((data ?? []) as ConflictRaw[]).filter((row) => matchesConflictEntity(row, entityId));
      const roles = await fetchRolesByPersonIds(
        rows.map((r) => r.person_id).filter((personId): personId is string => Boolean(personId)),
        tenantId,
      );
      return rows.map((row) => mapConflictRow(row, roles));
    },
  });
}

export function useAttestationsList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["attestations", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attestations")
        .select("*, person:person_id(full_name, email)")
        .eq("tenant_id", tenantId!)
        .order("status", { ascending: true }); // Pendiente < Completada alfabéticamente — invertimos abajo
      if (error) throw error;
      type AttestationRaw = AttestationRow & { person?: { full_name?: string | null; email?: string | null } | null };
      const rows = (data ?? []) as AttestationRaw[];
      const roles = await fetchRolesByPersonIds(
        rows.map((r) => r.person_id).filter((personId): personId is string => Boolean(personId)),
        tenantId,
      );
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
