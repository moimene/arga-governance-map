import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  buildSocietaryBookPortfolio,
  normalizeMandatoryBookKind,
  type BookBodyLike,
  type BookPortfolioEntityLike,
  type PersistedMandatoryBookLike,
  type SocietaryBookView,
} from "@/lib/secretaria/libros-societarios";
import { isOperationalSecretariaBody } from "@/lib/secretaria/operational-bodies";

export interface MandatoryBookRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  book_kind: string;
  volume_number: number;
  period: number;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  legalization_deadline: string | null;
  legalization_status: string;
  legalization_evidence_url: string | null;
  entity_name: string | null;
  entity_legal_name?: string | null;
  jurisdiction: string | null;
  legal_form?: string | null;
  tipo_social?: string | null;
  es_cotizada?: boolean | null;
  regulated_sector?: string | null;
}

type ActivityRow = {
  id: string;
  entity_id: string | null;
  body_id?: string | null;
  created_at?: string | null;
  signed_at?: string | null;
  registered_at?: string | null;
  effective_date?: string | null;
};

function latestDate(current: string | null, candidate: string | null | undefined) {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

function applyBookActivityMetrics(
  rows: SocietaryBookView[],
  params: {
    minutes: ActivityRow[];
    capitalMovements: ActivityRow[];
    unipersonalDecisions: ActivityRow[];
    cargos: ActivityRow[];
  },
) {
  const minutesByBody = new Map<string, ActivityRow[]>();
  const minutesByEntity = new Map<string, ActivityRow[]>();
  const capitalByEntity = new Map<string, ActivityRow[]>();
  const decisionsByEntity = new Map<string, ActivityRow[]>();
  const cargosByEntity = new Map<string, ActivityRow[]>();

  for (const minute of params.minutes) {
    if (minute.entity_id) {
      const current = minutesByEntity.get(minute.entity_id) ?? [];
      current.push(minute);
      minutesByEntity.set(minute.entity_id, current);
    }
    if (minute.body_id) {
      const current = minutesByBody.get(minute.body_id) ?? [];
      current.push(minute);
      minutesByBody.set(minute.body_id, current);
    }
  }
  for (const movement of params.capitalMovements) {
    if (!movement.entity_id) continue;
    const current = capitalByEntity.get(movement.entity_id) ?? [];
    current.push(movement);
    capitalByEntity.set(movement.entity_id, current);
  }
  for (const decision of params.unipersonalDecisions) {
    if (!decision.entity_id) continue;
    const current = decisionsByEntity.get(decision.entity_id) ?? [];
    current.push(decision);
    decisionsByEntity.set(decision.entity_id, current);
  }
  for (const cargo of params.cargos) {
    if (!cargo.entity_id) continue;
    const current = cargosByEntity.get(cargo.entity_id) ?? [];
    current.push(cargo);
    cargosByEntity.set(cargo.entity_id, current);
  }

  return rows.map((row) => {
    let activity: ActivityRow[] = [];
    const code = normalizeMandatoryBookKind(row.book_code);
    if (code.startsWith("LIBRO_ACTAS")) {
      activity = row.body_id
        ? minutesByBody.get(row.body_id) ?? []
        : row.entity_id
          ? minutesByEntity.get(row.entity_id) ?? []
          : [];
    } else if (code === "LIBRO_REGISTRO_SOCIOS" || code === "LIBRO_ACCIONES_NOMINATIVAS") {
      activity = row.entity_id ? capitalByEntity.get(row.entity_id) ?? [] : [];
    } else if (code === "LIBRO_CONTRATOS_SOCIO_UNICO") {
      activity = row.entity_id ? decisionsByEntity.get(row.entity_id) ?? [] : [];
    } else if (code === "REGISTRO_PERSONAS_CARGOS") {
      activity = row.entity_id ? cargosByEntity.get(row.entity_id) ?? [] : [];
    }

    if (activity.length === 0) return row;
    const last = activity.reduce<string | null>((acc, item) => {
      const candidate = item.registered_at ?? item.signed_at ?? item.effective_date ?? item.created_at ?? null;
      return latestDate(acc, candidate);
    }, null);
    return {
      ...row,
      entries_count: activity.length,
      last_entry_at: last,
    };
  });
}

export function useLibrosList(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["mandatory_books", tenantId, "list", entityId ?? "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<SocietaryBookView[]> => {
      let query = supabase
        .from("mandatory_books")
        .select("*, entities(id, common_name, legal_name, jurisdiction, legal_form, tipo_social, es_cotizada, regulated_sector)")
        .eq("tenant_id", tenantId!)
        .order("legalization_deadline", { ascending: true });

      if (entityId) {
        query = query.eq("entity_id", entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      type Raw = Omit<MandatoryBookRow, "entity_name" | "jurisdiction"> & {
        entities?: {
          id?: string | null;
          common_name?: string | null;
          legal_name?: string | null;
          jurisdiction?: string | null;
          legal_form?: string | null;
          tipo_social?: string | null;
          es_cotizada?: boolean | null;
          regulated_sector?: string | null;
        } | null;
      };
      const books = ((data ?? []) as Raw[]).map((b): PersistedMandatoryBookLike => ({
        ...b,
        entity_name: b.entities?.common_name ?? null,
        entity_legal_name: b.entities?.legal_name ?? null,
        jurisdiction: b.entities?.jurisdiction ?? null,
        legal_form: b.entities?.legal_form ?? null,
        tipo_social: b.entities?.tipo_social ?? null,
        es_cotizada: b.entities?.es_cotizada ?? null,
        regulated_sector: b.entities?.regulated_sector ?? null,
      }));

      let bodiesQuery = supabase
        .from("governing_bodies")
        .select("id, slug, name, body_type, config, entity_id, entities(id, tenant_id, common_name, legal_name, jurisdiction, legal_form, tipo_social, es_cotizada, regulated_sector)")
        .eq("tenant_id", tenantId!);

      if (entityId) {
        bodiesQuery = bodiesQuery.eq("entity_id", entityId);
      }

      const { data: bodiesData, error: bodiesError } = await bodiesQuery;
      if (bodiesError) throw bodiesError;

      type BodyRaw = BookBodyLike & {
        entities?: BookPortfolioEntityLike | BookPortfolioEntityLike[] | null;
      };
      const bodyRows = ((bodiesData ?? []) as unknown as BodyRaw[]).filter(isOperationalSecretariaBody);
      const bodies: BookBodyLike[] = bodyRows.map((body) => ({
        id: body.id ?? null,
        name: body.name ?? null,
        body_type: body.body_type ?? null,
        config: body.config ?? null,
        entity_id: body.entity_id ?? null,
      }));

      const entityMap = new Map<string, BookPortfolioEntityLike>();
      for (const book of books) {
        if (!book.entity_id) continue;
        entityMap.set(book.entity_id, {
          id: book.entity_id,
          tenant_id: book.tenant_id,
          common_name: book.entity_name,
          legal_name: book.entity_legal_name,
          jurisdiction: book.jurisdiction,
          legal_form: book.legal_form,
          tipo_social: book.tipo_social,
          es_cotizada: book.es_cotizada,
          regulated_sector: book.regulated_sector,
        });
      }
      for (const body of bodyRows) {
        const entity = Array.isArray(body.entities) ? body.entities[0] : body.entities;
        if (!body.entity_id || !entity) continue;
        entityMap.set(body.entity_id, { ...entity, id: body.entity_id });
      }

      if (entityId && !entityMap.has(entityId)) {
        const { data: entityData, error: entityError } = await supabase
          .from("entities")
          .select("id, tenant_id, common_name, legal_name, jurisdiction, legal_form, tipo_social, es_cotizada, regulated_sector")
          .eq("tenant_id", tenantId!)
          .eq("id", entityId)
          .maybeSingle();
        if (entityError) throw entityError;
        if (entityData) entityMap.set(entityId, entityData as BookPortfolioEntityLike);
      }

      const portfolio = buildSocietaryBookPortfolio({
        books,
        bodies,
        entities: Array.from(entityMap.values()),
      });

      const entityIds = Array.from(new Set(portfolio.map((book) => book.entity_id).filter((id): id is string => Boolean(id))));
      if (entityIds.length === 0) return portfolio;

      const [minutesRes, capitalRes, decisionsRes, cargosRes] = await Promise.all([
        supabase
          .from("minutes")
          .select("id, entity_id, body_id, created_at, signed_at, registered_at")
          .eq("tenant_id", tenantId!)
          .in("entity_id", entityIds),
        supabase
          .from("capital_movements")
          .select("id, entity_id, created_at, effective_date")
          .eq("tenant_id", tenantId!)
          .in("entity_id", entityIds),
        supabase
          .from("unipersonal_decisions")
          .select("id, entity_id, created_at")
          .eq("tenant_id", tenantId!)
          .in("entity_id", entityIds),
        supabase
          .from("condiciones_persona")
          .select("id, entity_id, effective_date:fecha_inicio")
          .eq("tenant_id", tenantId!)
          .in("entity_id", entityIds),
      ]);
      if (minutesRes.error) throw minutesRes.error;
      if (capitalRes.error) throw capitalRes.error;
      if (decisionsRes.error) throw decisionsRes.error;
      if (cargosRes.error) throw cargosRes.error;

      return applyBookActivityMetrics(portfolio, {
        minutes: (minutesRes.data ?? []) as ActivityRow[],
        capitalMovements: (capitalRes.data ?? []) as ActivityRow[],
        unipersonalDecisions: (decisionsRes.data ?? []) as ActivityRow[],
        cargos: (cargosRes.data ?? []) as ActivityRow[],
      });
    },
  });
}
