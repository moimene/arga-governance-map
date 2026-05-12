import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { isProductionPerson } from "@/lib/secretaria/persona-filters";

type MaybeJoin<T> = T | T[] | null | undefined;

function firstJoin<T>(value: MaybeJoin<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

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
  /**
   * Si `true` (default), filtra fixtures E2E, personas archivadas y
   * placeholders PENDIENTE-* del resultado vía `isProductionPerson`.
   * Los tests E2E que necesiten ver sus fixtures pueden pasar `false`
   * explícitamente.
   */
  excludeTestData?: boolean;
}) {
  const { tenantId } = useTenantContext();
  const exclude = filter?.excludeTestData ?? true;
  return useQuery({
    queryKey: [
      "personas_canonical",
      tenantId,
      "list",
      filter?.person_type ?? "all",
      filter?.search ?? "",
      exclude,
    ],
    enabled: !!tenantId,
    queryFn: async (): Promise<PersonaRow[]> => {
      let q = supabase.from("persons").select("*").eq("tenant_id", tenantId!);
      if (filter?.person_type) q = q.eq("person_type", filter.person_type);
      if (filter?.search && filter.search.trim().length > 0) {
        const s = filter.search.trim();
        q = q.or(`full_name.ilike.%${s}%,tax_id.ilike.%${s}%,denomination.ilike.%${s}%,email.ilike.%${s}%`);
      }
      // P2 Codex iter-6: cap subido a 2000 (mirror del fix iter-5 sobre usePersonasEnriquecidas).
      // Necesario para selectores que dependen del list completo (RepresentanteAdminPJStepper
      // selector PF para LSC 212 bis). Tenants futuros >2000 personas requieren searchable
      // selector — Plan A' diferido.
      const { data, error } = await q.order("full_name", { ascending: true }).limit(2000);
      if (error) throw error;
      const rows = (data ?? []) as PersonaRow[];
      return exclude ? rows.filter(isProductionPerson) : rows;
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
  /**
   * Si `true` (default), filtra fixtures E2E, personas archivadas y
   * placeholders PENDIENTE-* del resultado vía `isProductionPerson`.
   * Tests E2E pueden pasar `false` para ver sus fixtures.
   */
  excludeTestData?: boolean;
}) {
  const { tenantId } = useTenantContext();
  const exclude = filter?.excludeTestData ?? true;
  return useQuery({
    queryKey: [
      "personas_canonical",
      tenantId,
      "enriquecidas",
      filter?.person_type ?? "all",
      filter?.search ?? "",
      filter?.tipo_condicion ?? "all",
      filter?.entity_id ?? "all",
      exclude,
    ],
    enabled: !!tenantId,
    queryFn: async (): Promise<PersonaEnriquecida[]> => {
      // P2 Codex iter-5: pre-filter person_ids cuando hay entity_id o tipo_condicion filter
      // para evitar que el cap (subido a 2000) corte personas alfabéticamente tardías
      // que estén linked a la sociedad/cargo target.
      // Bug original: con limit(200), tenants con >200 personas perdían silenciosamente
      // matches en sociedad-mode o cargo-filter views porque el cap se aplicaba ANTES del
      // client-side cross-join contra condiciones_persona y capital_holdings.
      let targetPersonIds: Set<string> | null = null;

      if (filter?.entity_id || filter?.tipo_condicion) {
        targetPersonIds = new Set<string>();

        // Pre-query a condiciones_persona para resolver person_ids con cargo vigente
        // que cumpla el filtro (entity_id y/o tipo_condicion).
        let cpQ = supabase
          .from("condiciones_persona")
          .select("person_id")
          .eq("tenant_id", tenantId!)
          .eq("estado", "VIGENTE");
        if (filter.entity_id) cpQ = cpQ.eq("entity_id", filter.entity_id);
        if (filter.tipo_condicion) cpQ = cpQ.eq("tipo_condicion", filter.tipo_condicion);
        const { data: cpData, error: cpErr } = await cpQ;
        if (cpErr) throw cpErr;
        for (const row of (cpData ?? []) as Array<{ person_id: string }>) {
          targetPersonIds.add(row.person_id);
        }

        // Si el filter es solo entity_id (sin tipo_condicion específico), también
        // hacemos union con capital_holdings — el filtro post-join también acepta
        // matching por holding, así que el pre-query debe incluir ese set.
        if (filter.entity_id && !filter.tipo_condicion) {
          const { data: chData, error: chErr } = await supabase
            .from("capital_holdings")
            .select("holder_person_id")
            .eq("tenant_id", tenantId!)
            .eq("entity_id", filter.entity_id)
            .is("effective_to", null);
          if (chErr) throw chErr;
          for (const row of (chData ?? []) as Array<{ holder_person_id: string }>) {
            targetPersonIds.add(row.holder_person_id);
          }
        }

        // Si el set está vacío tras pre-filter, no hay matches posibles → return temprano.
        if (targetPersonIds.size === 0) return [];
      }

      // 1. Personas (con filtros propios de la tabla persons)
      let personsQ = supabase.from("persons").select("*").eq("tenant_id", tenantId!);
      if (filter?.person_type) personsQ = personsQ.eq("person_type", filter.person_type);
      if (filter?.search && filter.search.trim().length > 0) {
        const s = filter.search.trim();
        personsQ = personsQ.or(
          `full_name.ilike.%${s}%,tax_id.ilike.%${s}%,denomination.ilike.%${s}%,email.ilike.%${s}%`,
        );
      }
      if (targetPersonIds) {
        // P2 Codex iter-5: restringir a person_ids que cumplen el pre-filter entity/cargo.
        personsQ = personsQ.in("id", Array.from(targetPersonIds));
      }
      // Cap 2000 (10× del anterior 200) — sigue siendo bounded pero ya no corta
      // resultados relevantes cuando el pre-filter por entity/cargo está activo.
      personsQ = personsQ.order("full_name", { ascending: true }).limit(2000);

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

      // Filtro test data sobre el listado base ANTES de cruzar con cargos /
      // holdings — mantiene los agregados limpios sin que se filtren después.
      const personsRows = (personsR.data ?? []) as PersonaRow[];
      const personsFiltered = exclude ? personsRows.filter(isProductionPerson) : personsRows;

      type CargoRaw = {
        person_id: string;
        tipo_condicion: string;
        entity_id: string;
        body_id: string | null;
        entity?: MaybeJoin<{ id: string; common_name: string | null; legal_name: string }>;
        body?: MaybeJoin<{ id: string; name: string }>;
      };
      type HoldingRaw = {
        holder_person_id: string;
        entity_id: string;
        porcentaje_capital: number | null;
        entity?: MaybeJoin<{ id: string; common_name: string | null; legal_name: string }>;
      };

      const cargosByPerson = new Map<string, PersonaCargoAgregado[]>();
      for (const c of (cargosR.data ?? []) as unknown as CargoRaw[]) {
        const entity = firstJoin(c.entity);
        const body = firstJoin(c.body);
        const entry: PersonaCargoAgregado = {
          tipo_condicion: c.tipo_condicion,
          entity_id: c.entity_id,
          entity_name: entity?.common_name ?? entity?.legal_name ?? "—",
          body_id: c.body_id,
          body_name: body?.name ?? null,
        };
        const arr = cargosByPerson.get(c.person_id) ?? [];
        arr.push(entry);
        cargosByPerson.set(c.person_id, arr);
      }

      const holdingsByPerson = new Map<string, PersonaHoldingAgregado[]>();
      for (const h of (holdingsR.data ?? []) as unknown as HoldingRaw[]) {
        const entity = firstJoin(h.entity);
        const entry: PersonaHoldingAgregado = {
          entity_id: h.entity_id,
          entity_name: entity?.common_name ?? entity?.legal_name ?? "—",
          porcentaje_capital: h.porcentaje_capital,
        };
        const arr = holdingsByPerson.get(h.holder_person_id) ?? [];
        arr.push(entry);
        holdingsByPerson.set(h.holder_person_id, arr);
      }

      // Cruzar + aplicar filtros cargo/entity (post-join).
      const enriched: PersonaEnriquecida[] = personsFiltered.map((p) => ({
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
