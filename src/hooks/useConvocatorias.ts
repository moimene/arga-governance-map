import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { AgendaItemKind, AgendaDecisionSubtype } from "@/lib/secretaria/agenda-kind";

export interface ConvocatoriaRow {
  id: string;
  tenant_id: string;
  body_id: string | null;
  tipo_convocatoria?: string | null;
  estado: string;
  fecha_emision: string | null;
  fecha_1: string | null;
  fecha_2: string | null;
  lugar?: string | null;
  is_second_call: boolean;
  modalidad: string | null;
  junta_universal: boolean;
  urgente: boolean;
  publication_channels: string[] | null;
  publication_evidence_url: string | null;
  statutory_basis: string | null;
  agenda_items?: Array<{
    titulo?: string;
    materia?: string;
    tipo?: string;
    inscribible?: boolean;
    kind?: AgendaItemKind;
    decision_subtype?: AgendaDecisionSubtype | null;
    propuesta_acuerdo?: string | null;
  }> | null;
  convocatoria_text?: string | null;
  rule_trace: Record<string, unknown> | null;
  reminders_trace: Record<string, unknown> | null;
  accepted_warnings: Record<string, unknown>[] | null;
  immutable_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConvocatoriaWithBody extends ConvocatoriaRow {
  body_name: string | null;
  body_type: string | null;
  entity_id: string | null;
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

export function useConvocatoriasList(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["convocatorias", tenantId, "list", entityId ?? "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<ConvocatoriaWithBody[]> => {
      let bodyIds: string[] | null = null;

      if (entityId) {
        const { data: bodies, error: bodiesError } = await supabase
          .from("governing_bodies")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId);

        if (bodiesError) throw bodiesError;
        bodyIds = (bodies ?? []).map((body) => body.id);
        if (bodyIds.length === 0) return [];
      }

      let query = supabase
        .from("convocatorias")
        .select(
          "*, governing_bodies(name, body_type, entity_id, entities(common_name, jurisdiction, legal_form))",
        )
        .eq("tenant_id", tenantId!)
        .order("fecha_1", { ascending: false });

      if (bodyIds) {
        query = query.in("body_id", bodyIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      type Raw = Omit<ConvocatoriaWithBody, "body_name" | "body_type" | "entity_id" | "entity_name" | "jurisdiction" | "legal_form"> & {
        governing_bodies?: {
          name?: string | null;
          body_type?: string | null;
          entity_id?: string | null;
          entities?: { common_name?: string | null; jurisdiction?: string | null; legal_form?: string | null } | null;
        } | null;
      };
      return ((data ?? []) as Raw[]).map((c) => ({
        ...c,
        body_name: c.governing_bodies?.name ?? null,
        body_type: c.governing_bodies?.body_type ?? null,
        entity_id: c.governing_bodies?.entity_id ?? null,
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
          "*, governing_bodies(name, body_type, entity_id, entities(common_name, jurisdiction, legal_form))",
        )
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      type Raw = Omit<ConvocatoriaWithBody, "body_name" | "body_type" | "entity_id" | "entity_name" | "jurisdiction" | "legal_form"> & {
        governing_bodies?: {
          name?: string | null;
          body_type?: string | null;
          entity_id?: string | null;
          entities?: { common_name?: string | null; jurisdiction?: string | null; legal_form?: string | null } | null;
        } | null;
      };
      const c = data as Raw;
      return {
        ...c,
        body_name: c.governing_bodies?.name ?? null,
        body_type: c.governing_bodies?.body_type ?? null,
        entity_id: c.governing_bodies?.entity_id ?? null,
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
  materia: string;
  tipo: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  inscribible: boolean;
  /**
   * Naturaleza del punto del orden del día (agenda_item.kind v3.1):
   * - INFORMATIVO: solo informe, sin decisión.
   * - TOMA_DE_RAZON: constancia de hecho o acto ya producido.
   * - DELIBERATIVO: debate y conclusiones, sin votación formal (default).
   * - ACEPTACION_INFORME: recepción de informe con conformidad u observaciones.
   * - RUEGOS_PREGUNTAS: intervenciones y compromisos de respuesta.
   * - DECISORIO: sometible a votación y materializable como acuerdo.
   *
   * Se persiste en `convocatorias.agenda_items` JSONB y se replica como
   * fuente autoritative en `meeting_resolutions.kind` cuando el punto pasa
   * a reunión. Default `DELIBERATIVO` para coincidir con el default de BD.
   */
  kind?: AgendaItemKind;
  /**
   * Subtipo de decisión (solo aplica si kind === "DECISORIO").
   * NULL por defecto. Permite distinguir actos constitutivos, ratificatorios,
   * elevación a público y mero acknowledgement de hechos.
   */
  decision_subtype?: AgendaDecisionSubtype | null;
  /**
   * Texto concreto de la propuesta de acuerdo que se someterá a votación
   * para este punto del orden del día.
   *
   * Razón legal: art. 197.1 LSC + 287 LSC + 144 RRM exigen que en
   * convocatorias que afecten estatutos / capital / operaciones
   * estructurales el socio reciba el texto íntegro propuesto antes de la
   * sesión. Sin este campo, la convocatoria queda con descripción
   * genérica del punto pero los consejeros no tienen el texto exacto.
   *
   * Se persiste en `convocatorias.agenda_items` JSONB (no requiere
   * migration). Backward-compatible: convocatorias antiguas leen `null`.
   *
   * Futuro (no en este lote): `template_id` opcional para vincular
   * MODELO_ACUERDO de plantillas_protegidas y autorrellenar la propuesta
   * desde plantilla.
   */
  propuesta_acuerdo?: string | null;
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
  rule_trace?: Record<string, unknown> | null;
  reminders_trace?: Record<string, unknown> | null;
  accepted_warnings?: Record<string, unknown>[] | null;
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

      const created = data as ConvocatoriaRow;
      const tracePatch = {
        rule_trace: input.rule_trace ?? null,
        reminders_trace: input.reminders_trace ?? null,
        accepted_warnings: input.accepted_warnings ?? [],
      };

      if (input.rule_trace || input.reminders_trace || input.accepted_warnings) {
        const { error: traceError } = await supabase
          .from("convocatorias")
          .update(tracePatch as never)
          .eq("id", created.id)
          .eq("tenant_id", tenantId!);

        if (traceError) {
          console.warn("[convocatorias] Trace persistence skipped", {
            convocatoriaId: created.id,
            message: traceError.message,
          });
        } else {
          return { ...created, ...tracePatch };
        }
      }

      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocatorias", tenantId] });
    },
  });
}

// ── Adjuntos ──────────────────────────────────────────────────────────────
//
// MIME types soportados (lista cerrada para evitar ejecutables / scripts).
const ATTACHMENT_ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
]);

// Sniff MIME desde la extensión cuando `file.type` viene vacío
// (típico en Mac Finder + Safari, drag-and-drop antiguos). Mantiene la
// lista cerrada — extensiones no mapeadas → rechazo explícito en lugar
// de bypass como octet-stream (riesgo de subir ejecutables).
const ATTACHMENT_EXTENSION_TO_MIME: Record<string, string> = {
  pdf:  "application/pdf",
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:  "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt:  "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv:  "text/csv",
  txt:  "text/plain",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
};

export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export interface UploadAttachmentInput {
  convocatoriaId: string;
  file: File;
  agendaItemIndex?: number | null;
}

export interface UploadAttachmentResult {
  id: string;
  file_name: string;
  file_url: string;
  file_hash: string;
}

export async function computeFileHashSha512(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto API no disponible");
  const digest = await subtle.digest("SHA-512", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

/**
 * Resuelve el MIME efectivo del fichero. Si `file.type` está presente
 * y permitido, se usa tal cual. Si está vacío, se sniffa por extensión
 * contra la lista cerrada. Si tras el sniff sigue sin coincidir con un
 * MIME permitido → throw (NO se admite `application/octet-stream`).
 */
export function resolveAttachmentMime(file: { name: string; type: string }): string {
  const declared = file.type?.trim().toLowerCase();
  if (declared) {
    if (!ATTACHMENT_ALLOWED_MIME.has(declared)) {
      throw new Error(`Tipo de archivo no permitido: ${declared}`);
    }
    return declared;
  }
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  const sniffed = ATTACHMENT_EXTENSION_TO_MIME[ext];
  if (!sniffed || !ATTACHMENT_ALLOWED_MIME.has(sniffed)) {
    throw new Error(
      `Tipo de archivo no permitido: MIME vacío y extensión "${ext || "(sin extensión)"}" no admitida`,
    );
  }
  return sniffed;
}

/**
 * Sube un fichero a Storage (bucket `matter-documents`) e inserta la fila
 * correspondiente en `attachments`. Lanza si el MIME no está permitido o el
 * tamaño supera el límite. Idempotencia: cada llamada genera un id distinto
 * y un path único; reintentos crean filas extra (responsabilidad del caller
 * deduplicar).
 */
export function useUploadConvocatoriaAttachment() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadAttachmentInput): Promise<UploadAttachmentResult> => {
      if (!tenantId) throw new Error("tenant_id no disponible");
      const { file, convocatoriaId } = input;

      if (file.size > ATTACHMENT_MAX_BYTES) {
        throw new Error(`Archivo demasiado grande (${Math.round(file.size / (1024 * 1024))} MB > 25 MB)`);
      }
      // resolveAttachmentMime valida o sniffa por extensión y lanza si no
      // hay match contra la lista cerrada (no acepta octet-stream).
      const effectiveMime = resolveAttachmentMime({ name: file.name, type: file.type });

      const hash = await computeFileHashSha512(file);
      const safeName = sanitizeFileName(file.name);
      const storagePath = `convocatorias/${convocatoriaId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("matter-documents")
        .upload(storagePath, file, {
          contentType: effectiveMime,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      // F3.G3: getPublicUrl removed — el bucket matter-documents es privado.
      // `file_url` se persiste como sentinel `evidence-bundle://<path>` para
      // mantener la condición legacy `if (file_url)` en componentes que aún
      // no consumen la Edge Function sign-evidence-url. El acceso real al
      // archivo pasa por la Edge Function cuando se materialice un
      // evidence_bundle (post-archival). Attachments-only refactor (futuro
      // sprint): adaptar a hook firmado para attachment_id.
      const sentinelUrl = `evidence-bundle://${storagePath}`;

      const { data: inserted, error: insertError } = await supabase
        .from("attachments")
        .insert({
          tenant_id: tenantId,
          convocatoria_id: convocatoriaId,
          agenda_item_index: input.agendaItemIndex ?? null,
          file_name: file.name,
          file_url: sentinelUrl,
          file_hash: hash,
        })
        .select("id, file_name, file_url, file_hash")
        .single();
      if (insertError) {
        // Limpieza best-effort para no dejar huérfanos en Storage.
        await supabase.storage.from("matter-documents").remove([storagePath]).catch(() => undefined);
        throw insertError;
      }

      return inserted as UploadAttachmentResult;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["attachments", tenantId, "convocatoria", variables.convocatoriaId],
      });
    },
  });
}
