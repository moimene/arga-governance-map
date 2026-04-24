import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type PersonType = "PF" | "PJ";

export interface PersonaRow {
  id: string;
  tenant_id: string;
  full_name: string;
  tax_id: string | null;
  email: string | null;
  person_type: PersonType | null;
  denomination: string | null;
  representative_person_id: string | null;
  created_at: string | null;
}

export interface PersonaDetailRow extends PersonaRow {
  representative?: {
    id: string;
    full_name: string;
    tax_id: string | null;
  } | null;
}

// G2: agregados que enriquecen la lista de personas con contexto societario.
export interface PersonaCargoAgregado {
  tipo_condicion: string;
  entity_id: string;
  entity_name: string;
  body_id: string | null;
  body_name: string | null;
}

export interface PersonaHoldingAgregado {
  entity_id: string;
  entity_name: string;
  porcentaje_capital: number | null;
}

export interface PersonaEnriquecida extends PersonaRow {
  cargos_vigentes: PersonaCargoAgregado[];
  holdings_vigentes: PersonaHoldingAgregado[];
}

export function usePersonasCanonical(filter?: {
  person_type?: PersonType;
  search?: string;
}) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["personas_canonical", tenantId, "list", filter?.person_type ?? "all", filter?.search ?? ""],
    enabled: !!tenantId,
    queryFn: async (): Promise<PersonaRow[]> => {
      let q = supabase.from("persons").select("*").eq("tenant_id", tenantId!);
      if (filter?.person_type) q = q.eq("person_type", filter.person_type);
      if (filter?.search && filter.search.trim().length > 0) {
        const s = filter.search.trim();
        q = q.or(`full_name.ilike.%${s}%,tax_id.ilike.%${s}%,denomination.ilike.%${s}%,email.ilike.%${s}%`);
      }
      const { data, error } = await q.order("full_name", { ascending: true }).limit(200);
      if (error) throw error;
      return (data ?? []) as PersonaRow[];
    },
  });
}

/**
 * G2: lista de personas enriquecida con sus cargos y holdings vigentes,
 * filtrable por tipo, cargo y sociedad. Estrategia: 3 queries paralelas
 * (persons, condiciones_persona VIGENTES, capital_holdings VIGENTES) +
 * join en cliente. El filtro por cargo/sociedad se aplica SOBRE el
 * resultado cruzado para que "muestra consejeros de ARGA Seguros"
 * funcione de forma intuitiva.
 */
export function usePersonasEnriquecidas(filter?: {
  person_type?: PersonType;
  search?: string;
  tipo_condicion?: string; // opcional: filtra personas que tengan ese cargo vigente
  entity_id?: string;      // opcional: filtra personas con cargo O holding en esa entity
}) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: [
      "personas_canonical",
      tenantId,
      "enriquecidas",
      filter?.person_type ?? "all",
      filter?.search ?? "",
      filter?.tipo_condicion ?? "all",
      filter?.entity_id ?? "all",
    ],
    enabled: !!tenantId,
    queryFn: async (): Promise<PersonaEnriquecida[]> => {
      // 1. Personas (con filtros propios de la tabla persons)
      let personsQ = supabase.from("persons").select("*").eq("tenant_id", tenantId!);
      if (filter?.person_type) personsQ = personsQ.eq("person_type", filter.person_type);
      if (filter?.search && filter.search.trim().length > 0) {
        const s = filter.search.trim();
        personsQ = personsQ.or(
          `full_name.ilike.%${s}%,tax_id.ilike.%${s}%,denomination.ilike.%${s}%,email.ilike.%${s}%`,
        );
      }
      personsQ = personsQ.order("full_name", { ascending: true }).limit(200);

      // 2. Cargos VIGENTES + joins a entity y body (todo el tenant).
      const cargosQ = supabase
        .from("condiciones_persona")
        .select(`
          person_id,
          tipo_condicion,
          entity_id,
          body_id,
          entity:entity_id(id, common_name, legal_name),
          body:body_id(id, name)
        `)
        .eq("tenant_id", tenantId!)
        .eq("estado", "VIGENTE");

      // 3. Holdings VIGENTES (effective_to IS NULL) + join a entity.
      const holdingsQ = supabase
        .from("capital_holdings")
        .select(`
          holder_person_id,
          entity_id,
          porcentaje_capital,
          effective_to,
          entity:entity_id(id, common_name, legal_name)
        `)
        .eq("tenant_id", tenantId!)
        .is("effective_to", null);

      const [personsR, cargosR, holdingsR] = await Promise.all([personsQ, cargosQ, holdingsQ]);
      if (personsR.error) throw personsR.error;
      if (cargosR.error) throw cargosR.error;
      if (holdingsR.error) throw holdingsR.error;

      type CargoRaw = {
        person_id: string;
        tipo_condicion: string;
        entity_id: string;
        body_id: string | null;
        entity?: { id: string; common_name: string | null; legal_name: string } | null;
        body?: { id: string; name: string } | null;
      };
      type HoldingRaw = {
        holder_person_id: string;
        entity_id: string;
        porcentaje_capital: number | null;
        entity?: { id: string; common_name: string | null; legal_name: string } | null;
      };

      const cargosByPerson = new Map<string, PersonaCargoAgregado[]>();
      for (const c of (cargosR.data ?? []) as CargoRaw[]) {
        const entry: PersonaCargoAgregado = {
          tipo_condicion: c.tipo_condicion,
          entity_id: c.entity_id,
          entity_name: c.entity?.common_name ?? c.entity?.legal_name ?? "—",
          body_id: c.body_id,
          body_name: c.body?.name ?? null,
        };
        const arr = cargosByPerson.get(c.person_id) ?? [];
        arr.push(entry);
        cargosByPerson.set(c.person_id, arr);
      }

      const holdingsByPerson = new Map<string, PersonaHoldingAgregado[]>();
      for (const h of (holdingsR.data ?? []) as HoldingRaw[]) {
        const entry: PersonaHoldingAgregado = {
          entity_id: h.entity_id,
          entity_name: h.entity?.common_name ?? h.entity?.legal_name ?? "—",
          porcentaje_capital: h.porcentaje_capital,
        };
        const arr = holdingsByPerson.get(h.holder_person_id) ?? [];
        arr.push(entry);
        holdingsByPerson.set(h.holder_person_id, arr);
      }

      // Cruzar + aplicar filtros cargo/entity (post-join).
      const enriched: PersonaEnriquecida[] = ((personsR.data ?? []) as PersonaRow[]).map((p) => ({
        ...p,
        cargos_vigentes: cargosByPerson.get(p.id) ?? [],
        holdings_vigentes: holdingsByPerson.get(p.id) ?? [],
      }));

      return enriched.filter((p) => {
        if (filter?.tipo_condicion) {
          const hasCargo = p.cargos_vigentes.some((c) => c.tipo_condicion === filter.tipo_condicion);
          if (!hasCargo) return false;
        }
        if (filter?.entity_id) {
          const inEntity =
            p.cargos_vigentes.some((c) => c.entity_id === filter.entity_id) ||
            p.holdings_vigentes.some((h) => h.entity_id === filter.entity_id);
          if (!inEntity) return false;
        }
        return true;
      });
    },
  });
}

export function usePersonaCanonical(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["personas_canonical", tenantId, "byId", id],
    queryFn: async (): Promise<PersonaDetailRow | null> => {
      const { data, error } = await supabase
        .from("persons")
        .select(`
          *,
          representative:representative_person_id(id, full_name, tax_id)
        `)
        .eq("tenant_id", tenantId!)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as PersonaDetailRow) ?? null;
    },
  });
}
