import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

// CONSEJERO_COORDINADOR removed 2026-05-12: alineación con W1 fix commit 63a8639.
// El trigger fn_sync_authority_evidence ya no crea AE para este cargo (RRM art. 109
// reserva certificación a Secretario con VºBº del Presidente). Decisión legal L15-L16.
export type CargoCertificante =
  | "ADMIN_UNICO"
  | "ADMIN_SOLIDARIO"
  | "ADMIN_MANCOMUNADO"
  | "PRESIDENTE"
  | "VICEPRESIDENTE"
  | "SECRETARIO"
  | "VICESECRETARIO";

export type FuenteDesignacion =
  | "ACTA_NOMBRAMIENTO"
  | "ESCRITURA"
  | "DECISION_UNIPERSONAL"
  | "BOOTSTRAP";

export interface AuthorityEvidenceRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  body_id: string | null;
  person_id: string;
  cargo: CargoCertificante;
  fecha_inicio: string;
  fecha_fin: string | null;
  fuente_designacion: FuenteDesignacion;
  inscripcion_rm_referencia: string | null;
  inscripcion_rm_fecha: string | null;
  estado: "VIGENTE" | "CESADO";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuthorityEvidenceDetailRow extends AuthorityEvidenceRow {
  person?: {
    id: string;
    full_name: string;
    tax_id: string | null;
    person_type: string | null;
  } | null;
  body?: {
    id: string;
    name: string;
    body_type: string;
  } | null;
}

/** Authority evidence vigentes para una sociedad. */
export function useAuthorityEvidence(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["authority_evidence", tenantId, "vigente", entityId],
    queryFn: async (): Promise<AuthorityEvidenceDetailRow[]> => {
      const { data, error } = await supabase
        .from("authority_evidence")
        .select(`
          *,
          person:person_id(id, full_name, tax_id, person_type),
          body:body_id(id, name, body_type)
        `)
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .eq("estado", "VIGENTE")
        .order("cargo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AuthorityEvidenceDetailRow[];
    },
  });
}

/**
 * Busca authority_evidence concreto por (entity, body, person, cargo).
 * Usado al emitir certificación para validar la capacidad del firmante.
 */
export function useAuthorityEvidenceFor(params: {
  entityId: string | undefined;
  bodyId?: string | null;
  personId: string | undefined;
  cargos: CargoCertificante[];
}) {
  const { entityId, bodyId, personId, cargos } = params;
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!personId && cargos.length > 0 && !!tenantId,
    queryKey: [
      "authority_evidence",
      tenantId,
      "lookup",
      entityId,
      bodyId ?? "null",
      personId,
      cargos.join(","),
    ],
    queryFn: async (): Promise<AuthorityEvidenceRow | null> => {
      let q = supabase
        .from("authority_evidence")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .eq("person_id", personId!)
        .eq("estado", "VIGENTE")
        .in("cargo", cargos);
      q = bodyId ? q.eq("body_id", bodyId) : q.is("body_id", null);
      const { data, error } = await q
        .order("fecha_inicio", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as AuthorityEvidenceRow) ?? null;
    },
  });
}

/**
 * Busca al PRESIDENTE vigente de una sociedad (opcionalmente filtrado por
 * órgano). Usado por el botón "Emitir certificación" para precargar el
 * Vº Bº en SA. Devuelve null si no hay ningún presidente vigente.
 */
export function usePresidenteVigente(
  entityId: string | undefined,
  bodyId?: string | null,
) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["authority_evidence", tenantId, "presidente", entityId, bodyId ?? "null"],
    queryFn: async (): Promise<AuthorityEvidenceDetailRow | null> => {
      let q = supabase
        .from("authority_evidence")
        .select(`
          *,
          person:person_id(id, full_name, tax_id, person_type)
        `)
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .eq("cargo", "PRESIDENTE")
        .eq("estado", "VIGENTE");
      if (bodyId) q = q.eq("body_id", bodyId);
      // Orden determinista (ITEM-029): tras la purga de cargos fantasma y el
      // índice único parcial, por órgano solo hay un PRESIDENTE VIGENTE; el
      // orden cubre el caso sin bodyId (varios órganos de la entidad).
      const { data, error } = await q
        .order("fecha_inicio", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as AuthorityEvidenceDetailRow) ?? null;
    },
  });
}

export const CARGO_CERT_LABELS: Record<CargoCertificante, string> = {
  ADMIN_UNICO: "Administrador único",
  ADMIN_SOLIDARIO: "Administrador solidario",
  ADMIN_MANCOMUNADO: "Administrador mancomunado",
  PRESIDENTE: "Presidente",
  VICEPRESIDENTE: "Vicepresidente",
  SECRETARIO: "Secretario",
  VICESECRETARIO: "Vicesecretario",
};
