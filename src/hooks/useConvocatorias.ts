import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface ConvocatoriaRow {
  id: string;
  tenant_id: string;
  body_id: string | null;
  estado: string;
  fecha_emision: string | null;
  fecha_1: string | null;
  fecha_2: string | null;
  is_second_call: boolean;
  modalidad: string | null;
  junta_universal: boolean;
  urgente: boolean;
  publication_channels: string[] | null;
  publication_evidence_url: string | null;
  statutory_basis: string | null;
  immutable_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConvocatoriaWithBody extends ConvocatoriaRow {
  body_name: string | null;
  entity_name: string | null;
  jurisdiction: string | null;
  legal_form: string | null;
}

export interface AttachmentRow {
  id: string;
  tenant_id: string;
  convocatoria_id: string;
  agenda_item_index: number | null;
  file_name: string;
  file_url: string;
  file_hash: string | null;
  uploaded_at: string;
}

export function useConvocatoriasList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["convocatorias", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async (): Promise<ConvocatoriaWithBody[]> => {
      const { data, error } = await supabase
        .from("convocatorias")
        .select(
          "*, governing_bodies(name, body_type, entities(common_name, jurisdiction, legal_form))",
        )
        .eq("tenant_id", tenantId!)
        .order("fecha_1", { ascending: false });
      if (error) throw error;
      type Raw = Omit<ConvocatoriaWithBody, "body_name" | "entity_name" | "jurisdiction" | "legal_form"> & {
        governing_bodies?: {
          name?: string | null;
          body_type?: string | null;
          entities?: { common_name?: string | null; jurisdiction?: string | null; legal_form?: string | null } | null;
        } | null;
      };
      return ((data ?? []) as Raw[]).map((c) => ({
        ...c,
        body_name: c.governing_bodies?.name ?? null,
        entity_name: c.governing_bodies?.entities?.common_name ?? null,
        jurisdiction: c.governing_bodies?.entities?.jurisdiction ?? null,
        legal_form: c.governing_bodies?.entities?.legal_form ?? null,
      }));
    },
  });
}

export function useConvocatoriaById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["convocatorias", tenantId, "byId", id],
    queryFn: async (): Promise<ConvocatoriaWithBody | null> => {
      const { data, error } = await supabase
        .from("convocatorias")
        .select(
          "*, governing_bodies(name, body_type, entities(common_name, jurisdiction, legal_form))",
        )
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      type Raw = Omit<ConvocatoriaWithBody, "body_name" | "entity_name" | "jurisdiction" | "legal_form"> & {
        governing_bodies?: {
          name?: string | null;
          body_type?: string | null;
          entities?: { common_name?: string | null; jurisdiction?: string | null; legal_form?: string | null } | null;
        } | null;
      };
      const c = data as Raw;
      return {
        ...c,
        body_name: c.governing_bodies?.name ?? null,
        entity_name: c.governing_bodies?.entities?.common_name ?? null,
        jurisdiction: c.governing_bodies?.entities?.jurisdiction ?? null,
        legal_form: c.governing_bodies?.entities?.legal_form ?? null,
      };
    },
  });
}

export function useConvocatoriaAttachments(convocatoriaId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!convocatoriaId && !!tenantId,
    queryKey: ["attachments", tenantId, "convocatoria", convocatoriaId],
    queryFn: async (): Promise<AttachmentRow[]> => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("convocatoria_id", convocatoriaId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttachmentRow[];
    },
  });
}

export interface AgendaItem {
  id: string;
  titulo: string;
  tipo: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  inscribible: boolean;
}

export interface CreateConvocatoriaInput {
  body_id: string;
  tipo_convocatoria: string;
  fecha_1: string;
  fecha_2?: string | null;
  modalidad: string;
  lugar?: string | null;
  junta_universal: boolean;
  is_second_call: boolean;
  publication_channels: string[];
  agenda_items: Omit<AgendaItem, "id">[];
  statutory_basis?: string | null;
  convocatoria_text?: string | null;
}

export function useCreateConvocatoria() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateConvocatoriaInput): Promise<ConvocatoriaRow> => {
      const { data, error } = await supabase
        .from("convocatorias")
        .insert({
          tenant_id: tenantId!,
          body_id: input.body_id,
          tipo_convocatoria: input.tipo_convocatoria,
          estado: "EMITIDA",
          fecha_emision: new Date().toISOString().split("T")[0],
          fecha_1: input.fecha_1,
          fecha_2: input.fecha_2 ?? null,
          modalidad: input.modalidad,
          lugar: input.lugar ?? null,
          junta_universal: input.junta_universal,
          is_second_call: input.is_second_call,
          publication_channels: input.publication_channels,
          agenda_items: input.agenda_items,
          statutory_basis: input.statutory_basis ?? null,
          convocatoria_text: input.convocatoria_text ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as ConvocatoriaRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocatorias", tenantId] });
    },
  });
}
