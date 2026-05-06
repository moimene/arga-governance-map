import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type TipoCondicion =
  | "SOCIO"
  | "ADMIN_UNICO"
  | "ADMIN_SOLIDARIO"
  | "ADMIN_MANCOMUNADO"
  | "ADMIN_PJ"
  | "CONSEJERO"
  | "PRESIDENTE"
  | "SECRETARIO"
  | "VICEPRESIDENTE"
  | "CONSEJERO_COORDINADOR";

export type FuenteDesignacion =
  | "ACTA_NOMBRAMIENTO"
  | "ESCRITURA"
  | "DECISION_UNIPERSONAL"
  | "BOOTSTRAP";

export interface CargoRow {
  id: string;
  tenant_id: string;
  person_id: string;
  entity_id: string;
  body_id: string | null;
  tipo_condicion: TipoCondicion;
  estado: "VIGENTE" | "CESADO";
  fecha_inicio: string;
  fecha_fin: string | null;
  representative_person_id: string | null;
  fuente_designacion: FuenteDesignacion | null;
  inscripcion_rm_referencia: string | null;
  inscripcion_rm_fecha: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CargoDetailRow extends CargoRow {
  person?: {
    id: string;
    full_name: string;
    tax_id: string | null;
    person_type: string | null;
    denomination: string | null;
  } | null;
  body?: {
    id: string;
    name: string;
    body_type: string;
  } | null;
  // G3: entity join para que el detalle de persona pueda mostrar
  // la sociedad a la que pertenece cada cargo, también cuando body_id es NULL
  // (p. ej. ADMIN_UNICO, ADMIN_SOLIDARIO, SOCIO).
  entity?: {
    id: string;
    common_name: string | null;
    legal_name: string;
  } | null;
  representative?: {
    id: string;
    full_name: string;
    tax_id: string | null;
  } | null;
}

const CARGOS_ADMIN_NO_COLEGIADO: TipoCondicion[] = [
  "ADMIN_UNICO",
  "ADMIN_SOLIDARIO",
  "ADMIN_MANCOMUNADO",
  "ADMIN_PJ",
];

const CARGOS_ORGANO_COLEGIADO: TipoCondicion[] = [
  "CONSEJERO",
  "PRESIDENTE",
  "VICEPRESIDENTE",
  "SECRETARIO",
  "CONSEJERO_COORDINADOR",
];

/**
 * Administradores no colegiados de una sociedad (body_id NULL).
 * ADMIN_UNICO, ADMIN_SOLIDARIO, ADMIN_MANCOMUNADO, ADMIN_PJ.
 */
export function useAdministradores(entityId: string | undefined, soloVigentes = true) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["cargos", tenantId, "administradores", entityId, soloVigentes],
    queryFn: async (): Promise<CargoDetailRow[]> => {
      let q = supabase
        .from("condiciones_persona")
        .select(`
          *,
          person:person_id(id, full_name, tax_id, person_type, denomination),
          representative:representative_person_id(id, full_name, tax_id)
        `)
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .is("body_id", null)
        .in("tipo_condicion", CARGOS_ADMIN_NO_COLEGIADO);
      if (soloVigentes) q = q.eq("estado", "VIGENTE");
      const { data, error } = await q.order("fecha_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CargoDetailRow[];
    },
  });
}

/**
 * Administradores societarios de una entidad.
 *
 * Para una SA administrada por Consejo, los administradores son los miembros
 * del Consejo de Administracion. Para formas no colegiadas, son los cargos
 * ADMIN_UNICO / ADMIN_SOLIDARIO / ADMIN_MANCOMUNADO / ADMIN_PJ sin body_id.
 * No incluye miembros de comisiones ni cargos de Junta General.
 */
export function useAdministradoresSocietarios(entityId: string | undefined, soloVigentes = true) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["cargos", tenantId, "administradoresSocietarios", entityId, soloVigentes],
    queryFn: async (): Promise<CargoDetailRow[]> => {
      let q = supabase
        .from("condiciones_persona")
        .select(`
          *,
          person:person_id(id, full_name, tax_id, person_type, denomination),
          body:body_id(id, name, body_type),
          representative:representative_person_id(id, full_name, tax_id)
        `)
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .in("tipo_condicion", [...CARGOS_ADMIN_NO_COLEGIADO, ...CARGOS_ORGANO_COLEGIADO]);
      if (soloVigentes) q = q.eq("estado", "VIGENTE");
      const { data, error } = await q.order("fecha_inicio", { ascending: false });
      if (error) throw error;

      return ((data ?? []) as CargoDetailRow[]).filter((cargo) => {
        if (!cargo.body_id) return CARGOS_ADMIN_NO_COLEGIADO.includes(cargo.tipo_condicion);
        const bodyType = cargo.body?.body_type?.toUpperCase() ?? "";
        return bodyType === "CDA" || bodyType === "CONSEJO" || bodyType === "CONSEJO_ADMIN";
      });
    },
  });
}

/**
 * Composición de un órgano colegiado (body_id NOT NULL).
 * CONSEJERO, PRESIDENTE, VICEPRESIDENTE, SECRETARIO, CONSEJERO_COORDINADOR.
 */
export function useComposicionOrgano(bodyId: string | undefined, soloVigentes = true) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!bodyId && !!tenantId,
    queryKey: ["cargos", tenantId, "composicionOrgano", bodyId, soloVigentes],
    queryFn: async (): Promise<CargoDetailRow[]> => {
      let q = supabase
        .from("condiciones_persona")
        .select(`
          *,
          person:person_id(id, full_name, tax_id, person_type, denomination),
          body:body_id(id, name, body_type),
          representative:representative_person_id(id, full_name, tax_id)
        `)
        .eq("tenant_id", tenantId!)
        .eq("body_id", bodyId!)
        .in("tipo_condicion", CARGOS_ORGANO_COLEGIADO);
      if (soloVigentes) q = q.eq("estado", "VIGENTE");
      const { data, error } = await q.order("tipo_condicion", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CargoDetailRow[];
    },
  });
}

/**
 * Historial completo de cargos de una persona (cualquier entidad/body).
 * Útil para perfil de persona.
 */
export function useCargosPersona(personId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!personId && !!tenantId,
    queryKey: ["cargos", tenantId, "byPerson", personId],
    queryFn: async (): Promise<CargoDetailRow[]> => {
      // G3: incluye join a entity para resolver la sociedad incluso cuando
      // el cargo no pertenece a un órgano colegiado (body_id NULL).
      const { data, error } = await supabase
        .from("condiciones_persona")
        .select(`
          *,
          body:body_id(id, name, body_type),
          entity:entity_id(id, common_name, legal_name)
        `)
        .eq("tenant_id", tenantId!)
        .eq("person_id", personId!)
        .order("fecha_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CargoDetailRow[];
    },
  });
}

export const CARGO_LABELS: Record<TipoCondicion, string> = {
  SOCIO: "Socio",
  ADMIN_UNICO: "Administrador único",
  ADMIN_SOLIDARIO: "Administrador solidario",
  ADMIN_MANCOMUNADO: "Administrador mancomunado",
  ADMIN_PJ: "Administrador persona jurídica",
  CONSEJERO: "Consejero",
  PRESIDENTE: "Presidente",
  VICEPRESIDENTE: "Vicepresidente",
  SECRETARIO: "Secretario",
  CONSEJERO_COORDINADOR: "Consejero coordinador",
};
