import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { isMissingSupabaseRpcError } from "@/lib/secretaria/supabase-rpc-fallback";
import {
  secretariaErrorMessage,
  secretariaOperationError,
} from "@/lib/secretaria/supabase-error-message";

export interface SocietaryBookEntryRow {
  id: string;
  tenant_id: string;
  book_id: string;
  section_id: string;
  ordinal_number: number;
  entry_type: "MINUTE";
  source_domain: "MINUTE";
  source_id: string;
  source_hash: string;
  occurred_at: string;
  recorded_at: string;
}

export interface BookRoutingIncidentRow {
  id: string;
  tenant_id: string;
  minute_id: string;
  incident_type: "NO_CANDIDATE" | "AMBIGUOUS";
  candidate_section_ids: string[];
  occurred_at: string;
  context: Record<string, unknown>;
}

export interface ResolveMinuteBookDestinationResult extends Record<string, unknown> {
  minute_id: string;
  resolved: boolean;
  reason?: "NO_CANDIDATE" | "AMBIGUOUS";
  incident_id?: string;
  book_id?: string;
  section_id?: string;
  already_resolved?: boolean;
}

function asObject<T extends Record<string, unknown> = Record<string, unknown>>(data: unknown): T {
  if (!data || typeof data !== "object") {
    throw new Error("La operación de libro no devolvió confirmación estructurada.");
  }
  return data as T;
}

function bookRpcError(error: unknown, action: string) {
  const detail = secretariaErrorMessage(error, `No se pudo ${action}.`);
  if (isMissingSupabaseRpcError(error)) {
    return new Error(
      `La operación para ${action} todavía no está disponible en el entorno conectado. ` +
        `Falta aplicar la migración de asientos de libros. Detalle: ${detail}`,
    );
  }
  return new Error(detail);
}

export function useSocietaryBookEntries(bookId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!bookId,
    queryKey: ["societary_book_entries", tenantId, bookId],
    queryFn: async (): Promise<SocietaryBookEntryRow[]> => {
      const { data, error } = await supabase
        .from("societary_book_entries")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("book_id", bookId!)
        .order("ordinal_number", { ascending: true });
      if (error) throw secretariaOperationError(error, "No se pudieron cargar los asientos del libro.");
      return (data ?? []) as SocietaryBookEntryRow[];
    },
  });
}

export function useMinuteBookEntry(minuteId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!minuteId,
    queryKey: ["societary_book_entries", tenantId, "minute", minuteId],
    queryFn: async (): Promise<SocietaryBookEntryRow | null> => {
      const { data, error } = await supabase
        .from("societary_book_entries")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("source_domain", "MINUTE")
        .eq("source_id", minuteId!)
        .maybeSingle();
      if (error) throw secretariaOperationError(error, "No se pudo cargar el asiento del acta.");
      return data as SocietaryBookEntryRow | null;
    },
  });
}

export function useMinuteBookRoutingIncidents(minuteId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!minuteId,
    queryKey: ["societary_book_routing_incidents", tenantId, minuteId],
    queryFn: async (): Promise<BookRoutingIncidentRow[]> => {
      const { data, error } = await supabase
        .from("societary_book_routing_incidents")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("minute_id", minuteId!)
        .order("occurred_at", { ascending: false });
      if (error) throw secretariaOperationError(error, "No se pudieron cargar las incidencias de destino.");
      return (data ?? []) as BookRoutingIncidentRow[];
    },
  });
}

export function useConfigureMinuteBookSection() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { bookId: string; bodyId: string; sectionCode: string; sectionLabel: string }) => {
      const { data, error } = await supabase.rpc("fn_secretaria_configure_minute_book_section", {
        p_book_id: params.bookId,
        p_body_id: params.bodyId,
        p_section_code: params.sectionCode,
        p_section_label: params.sectionLabel,
      });
      if (error) throw bookRpcError(error, "configurar la sección del libro");
      return asObject(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["societary_book_sections", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["mandatory_books", tenantId] });
    },
  });
}

export function useResolveMinuteBookDestination() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (minuteId: string) => {
      const { data, error } = await supabase.rpc("fn_secretaria_resolve_minute_book_destination", {
        p_minute_id: minuteId,
      });
      if (error) throw bookRpcError(error, "resolver el libro y la sección del acta");
      const result = asObject<ResolveMinuteBookDestinationResult>(data);
      if (typeof result.resolved !== "boolean") {
        throw new Error("La resolución del libro no devolvió un estado verificable.");
      }
      return result;
    },
    onSuccess: async (_result, minuteId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["actas", tenantId, "byId", minuteId] }),
        queryClient.invalidateQueries({ queryKey: ["actas", tenantId] }),
        queryClient.invalidateQueries({
          queryKey: ["societary_book_routing_incidents", tenantId, minuteId],
        }),
      ]);
    },
  });
}

export function useRegisterMinuteBookEntry() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { minuteId: string; operationId: string }) => {
      const { data, error } = await supabase.rpc("fn_secretaria_register_minute_book_entry", {
        p_minute_id: params.minuteId,
        p_operation_id: params.operationId,
      });
      if (error) throw bookRpcError(error, "asentar el acta aprobada con evidencia EAD");
      const result = asObject(data);
      if (typeof result.entry_id !== "string") {
        throw new Error("El asiento no devolvió un identificador persistido.");
      }
      return result;
    },
    onSuccess: async (result, params) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["actas", tenantId, "byId", params.minuteId] }),
        queryClient.invalidateQueries({ queryKey: ["actas", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["mandatory_books", tenantId] }),
        queryClient.invalidateQueries({
          queryKey: ["societary_book_entries", tenantId, result.book_id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["societary_book_entries", tenantId, "minute", params.minuteId],
        }),
      ]);
    },
  });
}

export function useCloseSocietaryBookVolume() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { bookId: string; operationId: string }) => {
      const { data, error } = await supabase.rpc("fn_secretaria_close_book_volume", {
        p_book_id: params.bookId,
        p_operation_id: params.operationId,
      });
      if (error) throw bookRpcError(error, "cerrar el volumen del libro");
      const result = asObject(data);
      if (typeof result.closure_id !== "string" || typeof result.manifest_hash !== "string") {
        throw new Error("El cierre no devolvió manifiesto e identificador persistidos.");
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["mandatory_books", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["societary_book_entries", tenantId, result.book_id] });
      queryClient.invalidateQueries({ queryKey: ["societary_book_closures", tenantId, result.book_id] });
    },
  });
}
