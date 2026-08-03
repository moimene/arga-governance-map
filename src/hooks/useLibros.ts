import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  buildSocietaryBookPortfolio,
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

      // Los contadores son proyecciones persistidas de asientos reales. Las
      // actas o movimientos de dominio no se cuentan como si ya estuvieran
      // asentados y los libros virtuales no fabrican actividad operativa.
      return portfolio.map((book) => book.is_virtual
        ? { ...book, entries_count: null, last_entry_at: null }
        : book);
    },
  });
}
