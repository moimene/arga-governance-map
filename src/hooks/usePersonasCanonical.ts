import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export interface PersonaProfileRow {
  id: string;
  tenant_id: string;
  person_id: string;
  document_type: string;
  document_country: string;
  nationality: string | null;
  birth_date: string | null;
  birth_place: string | null;
  legal_form: string | null;
  jurisdiction: string | null;
  registry_name: string | null;
  registry_number: string | null;
  lei_code: string | null;
  phone: string | null;
  secondary_email: string | null;
  preferred_language: string;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string;
  notification_address_same: boolean;
  notification_address_line1: string | null;
  notification_address_line2: string | null;
  notification_postal_code: string | null;
  notification_city: string | null;
  notification_province: string | null;
  notification_country: string | null;
  governance_role: string;
  kyc_status: string;
  onboarding_status: string;
  evidence_summary: Record<string, unknown>;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PersonaCompletaProfileInput {
  document_type: string;
  document_country: string;
  nationality?: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  legal_form?: string | null;
  jurisdiction?: string | null;
  registry_name?: string | null;
  registry_number?: string | null;
  lei_code?: string | null;
  phone?: string | null;
  secondary_email?: string | null;
  preferred_language: string;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  country: string;
  notification_address_same: boolean;
  notification_address_line1?: string | null;
  notification_address_line2?: string | null;
  notification_postal_code?: string | null;
  notification_city?: string | null;
  notification_province?: string | null;
  notification_country?: string | null;
  governance_role: string;
  kyc_status: string;
  onboarding_status: string;
  notes?: string | null;
}

export interface PersonaCompletaInput {
  person_type: PersonType;
  full_name: string;
  tax_id: string;
  email?: string | null;
  denomination?: string | null;
  profile: PersonaCompletaProfileInput;
  evidence_summary: Record<string, unknown>;
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

export interface PersonaEnriquecidaPage {
  rows: PersonaEnriquecida[];
  total: number;
}

export function usePersonasCanonical(filter?: {
  person_type?: PersonType;
  search?: string;
  limit?: number;
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
      filter?.limit ?? 2000,
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
      const { data, error } = await q
        .order("full_name", { ascending: true })
        .limit(filter?.limit ?? 2000);
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

/**
 * Variante paginada en servidor para la lista operativa de personas.
 * Mantiene los agregados acotados a las personas de la pagina actual.
 */
export function usePersonasEnriquecidasPage(filter?: {
  person_type?: PersonType;
  search?: string;
  tipo_condicion?: string;
  entity_id?: string;
  page?: number;
  pageSize?: number;
  excludeTestData?: boolean;
}) {
  const { tenantId } = useTenantContext();
  const exclude = filter?.excludeTestData ?? true;
  const page = Math.max(1, filter?.page ?? 1);
  const pageSize = Math.max(1, Math.min(filter?.pageSize ?? 25, 100));

  return useQuery({
    queryKey: [
      "personas_canonical",
      tenantId,
      "enriquecidas_page",
      filter?.person_type ?? "all",
      filter?.search ?? "",
      filter?.tipo_condicion ?? "all",
      filter?.entity_id ?? "all",
      page,
      pageSize,
      exclude,
    ],
    enabled: !!tenantId,
    queryFn: async (): Promise<PersonaEnriquecidaPage> => {
      let targetPersonIds: Set<string> | null = null;

      if (filter?.entity_id || filter?.tipo_condicion) {
        targetPersonIds = new Set<string>();

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

        if (targetPersonIds.size === 0) return { rows: [], total: 0 };
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let personsQ = supabase
        .from("persons")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId!);
      if (filter?.person_type) personsQ = personsQ.eq("person_type", filter.person_type);
      if (filter?.search && filter.search.trim().length > 0) {
        const s = filter.search.trim();
        personsQ = personsQ.or(
          `full_name.ilike.%${s}%,tax_id.ilike.%${s}%,denomination.ilike.%${s}%,email.ilike.%${s}%`,
        );
      }
      if (targetPersonIds) {
        personsQ = personsQ.in("id", Array.from(targetPersonIds));
      }

      const personsR = await personsQ
        .order("full_name", { ascending: true })
        .range(from, to);
      if (personsR.error) throw personsR.error;

      const personsRows = (personsR.data ?? []) as PersonaRow[];
      const personsFiltered = exclude ? personsRows.filter(isProductionPerson) : personsRows;
      const pagePersonIds = personsFiltered.map((p) => p.id);
      if (pagePersonIds.length === 0) {
        return { rows: [], total: personsR.count ?? 0 };
      }

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
        .eq("estado", "VIGENTE")
        .in("person_id", pagePersonIds);

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
        .is("effective_to", null)
        .in("holder_person_id", pagePersonIds);

      const [cargosR, holdingsR] = await Promise.all([cargosQ, holdingsQ]);
      if (cargosR.error) throw cargosR.error;
      if (holdingsR.error) throw holdingsR.error;

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

      return {
        rows: personsFiltered.map((p) => ({
          ...p,
          cargos_vigentes: cargosByPerson.get(p.id) ?? [],
          holdings_vigentes: holdingsByPerson.get(p.id) ?? [],
        })),
        total: personsR.count ?? personsFiltered.length,
      };
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
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as PersonaDetailRow) ?? null;
    },
  });
}

export function usePersonaProfile(personId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!personId && !!tenantId,
    queryKey: ["personas_canonical", tenantId, "profile", personId],
    queryFn: async (): Promise<PersonaProfileRow | null> => {
      const { data, error } = await supabase
        .from("persona_profiles")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("person_id", personId!)
        .maybeSingle();
      if (error) throw error;
      return (data as PersonaProfileRow) ?? null;
    },
  });
}

export interface UpdatePersonaInput {
  id: string;
  full_name: string;
  tax_id?: string | null;
  email?: string | null;
  denomination?: string | null;
}

export interface ImportPersonaRowInput {
  full_name: string;
  person_type: PersonType;
  tax_id?: string | null;
  email?: string | null;
  denomination?: string | null;
  row_key: string;
}

export function useImportPersonaRow() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportPersonaRowInput): Promise<{ id: string }> => {
      if (!tenantId) throw new Error("Tenant no inicializado");
      const { data, error } = await supabase.rpc("fn_import_persona_row", {
        p_tenant_id: tenantId,
        p_full_name: input.full_name.trim(),
        p_person_type: input.person_type,
        p_tax_id: input.tax_id?.trim() || null,
        p_email: input.email?.trim() || null,
        p_denomination: input.denomination?.trim() || null,
        p_idempotency_key: [
          "import-persona-row",
          tenantId,
          input.row_key,
          input.tax_id?.trim() ?? "",
          input.full_name.trim(),
        ].join(":"),
      });
      if (error) throw error;
      return { id: String(data) };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId] });
    },
  });
}

export function useCreatePersonaCompleta() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: PersonaCompletaInput): Promise<{ person_id: string; profile_id: string }> => {
      if (!tenantId) throw new Error("Tenant no inicializado");
      const fullName = input.full_name.trim();
      const taxId = input.tax_id.trim();
      if (!fullName) throw new Error("El nombre es obligatorio");
      if (!taxId) throw new Error("El NIF/CIF es obligatorio");

      const payload = {
        person_type: input.person_type,
        full_name: fullName,
        tax_id: taxId,
        email: input.email?.trim() || null,
        denomination: input.person_type === "PJ" ? input.denomination?.trim() || fullName : null,
        profile: input.profile,
        evidence_summary: input.evidence_summary,
      };

      const { data, error } = await supabase.rpc("fn_create_persona_completa", {
        p_tenant_id: tenantId,
        p_payload: payload,
        p_idempotency_key: [
          "create-persona-completa",
          tenantId,
          input.person_type,
          taxId,
          fullName,
          input.profile.document_type,
          input.profile.document_country,
        ].join(":"),
      });
      if (error) throw error;

      const result = data as { person_id?: unknown; profile_id?: unknown } | null;
      const personId = typeof result?.person_id === "string" ? result.person_id : "";
      const profileId = typeof result?.profile_id === "string" ? result.profile_id : "";
      if (!personId || !profileId) {
        throw new Error("La RPC no devolvió identificadores de persona y perfil");
      }
      return { person_id: personId, profile_id: profileId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId] });
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId, "byId", data.person_id] });
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId, "profile", data.person_id] });
    },
  });
}

export function useUpdatePersona() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePersonaInput): Promise<PersonaRow> => {
      if (!tenantId) throw new Error("Tenant no inicializado");
      if (!input.id) throw new Error("Persona no informada");
      const fullName = input.full_name.trim();
      if (!fullName) throw new Error("El nombre es obligatorio");

      const { error } = await supabase.rpc("fn_update_persona", {
        p_tenant_id: tenantId,
        p_person_id: input.id,
        p_full_name: fullName,
        p_tax_id: input.tax_id?.trim() || null,
        p_email: input.email?.trim() || null,
        p_denomination: input.denomination?.trim() || null,
        p_idempotency_key: [
          "update-persona",
          tenantId,
          input.id,
          fullName,
          input.tax_id?.trim() ?? "",
          input.email?.trim() ?? "",
          input.denomination?.trim() ?? "",
        ].join(":"),
      });
      if (error) throw error;

      const { data, error: fetchError } = await supabase
        .from("persons")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", input.id)
        .single();
      if (fetchError) throw fetchError;
      return data as PersonaRow;
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId] });
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId, "byId", input.id] });
      qc.invalidateQueries({ queryKey: ["cargos", tenantId, "byPerson", input.id] });
    },
  });
}
