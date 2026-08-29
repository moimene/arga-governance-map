import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { AgendaItemKind, AgendaDecisionSubtype } from "@/lib/secretaria/agenda-kind";
import {
  ensureLiveSupabaseSession,
  registerSupportingConvocationArtifact,
} from "@/lib/secretaria/convocation-supporting-artifact-registration";
import { secretariaOperationError } from "@/lib/secretaria/supabase-error-message";

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
    requires_attachments?: boolean | null;
    target_entity_id?: string | null;
    representative_person_id?: string | null;
    representation_authority_route?: string | null;
    representation_delegation_id?: string | null;
    representation_evidence_status?: string | null;
  }> | null;
  convocatoria_text?: string | null;
  rule_trace: Record<string, unknown> | null;
  reminders_trace: Record<string, unknown> | null;
  accepted_warnings: Record<string, unknown>[] | null;
  convocante_person_id?: string | null;
  convocante_authority_evidence_id?: string | null;
  convocation_authority_route?: "PRESIDENTE_ART_246_1" | string | null;
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
  es_cotizada: boolean | null;
}

export interface AttachmentRow {
  id: string;
  tenant_id: string;
  convocatoria_id: string;
  agenda_item_index: number | null;
  file_name: string;
  file_url: string;
  file_hash: string | null;
  file_hash_sha512?: string | null;
  artifact_kind?: "SUPPORTING_DOCUMENT" | "CONVOCATORIA_FINAL" | null;
  artifact_verified_at?: string | null;
  artifact_verified_by_service?: boolean | null;
  artifact_verified_size_bytes?: number | null;
  artifact_verified_mime_type?: string | null;
  artifact_candidate_id?: string | null;
  convocation_manifest_hash_sha512?: string | null;
  supporting_attachment_intent_id?: string | null;
  uploaded_at: string;
}

export interface ConvocationManifestRow {
  id: string;
  tenant_id: string;
  convocatoria_id: string;
  act_id: string;
  act_hash_sha512: string;
  manifest_json: {
    schema_version?: string;
    data_class?: string;
    legal_effect?: string;
    /** Numeración real del punto en el orden del día (p. ej. "1.1", "2", "acta").
     *  Ausente en las convocatorias que no la traen: la UI cae a la posición. */
    numero?: string;
    /** Nota visible del punto. La usan los puntos cuya clasificación de materia
     *  no está acreditada, para que la ficha no les invente una clase. */
    nota?: string;
    record_status?: "DEMO_OPERATIONAL_DRAFT_RECORDED" | string;
    not_a_legal_convocation?: boolean;
    president_action_not_asserted?: boolean;
    reviewed_demo_draft_text_hash_sha256?: string;
    authority?: Record<string, unknown>;
    publication?: Record<string, unknown>;
    agenda?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  manifest_hash_sha512: string;
  data_class: "DEMO";
  legal_effect: "DEMO_SIMULATION_NO_LEGAL_EFFECT";
  created_by: string | null;
  created_at: string;
  immutable_at: string;
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
          "*, governing_bodies(name, body_type, entity_id, entities(common_name, jurisdiction, legal_form, es_cotizada))",
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
          entities?: { common_name?: string | null; jurisdiction?: string | null; legal_form?: string | null; es_cotizada?: boolean | null } | null;
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
        es_cotizada: c.governing_bodies?.entities?.es_cotizada ?? null,
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
          "*, governing_bodies(name, body_type, entity_id, entities(common_name, jurisdiction, legal_form, es_cotizada))",
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
          entities?: { common_name?: string | null; jurisdiction?: string | null; legal_form?: string | null; es_cotizada?: boolean | null } | null;
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
        es_cotizada: c.governing_bodies?.entities?.es_cotizada ?? null,
      };
    },
  });
}

export function useConvocationManifest(convocatoriaId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!convocatoriaId && !!tenantId,
    queryKey: ["convocation-manifest", tenantId, convocatoriaId],
    queryFn: async (): Promise<ConvocationManifestRow | null> => {
      const { data, error } = await supabase
        .from("convocation_manifests")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("convocatoria_id", convocatoriaId!)
        .maybeSingle();
      if (error) throw error;
      return data as ConvocationManifestRow | null;
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
  /**
   * Exigencia expresa de documentación soporte. La materialización a reunión
   * también la fuerza para FORMULACION_CUENTAS, aunque el JSON legacy la omita.
   */
  requires_attachments?: boolean | null;
  /** Filial concreta en la que la sociedad actuará como socia única. */
  target_entity_id?: string | null;
  /** Persona física propuesta para asistir y votar en nombre de la socia única. */
  representative_person_id?: string | null;
  /** Valores derivados por el gate del servidor; el cliente nunca los decide. */
  representation_authority_route?: string | null;
  representation_delegation_id?: string | null;
  representation_evidence_status?: string | null;
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
        .rpc("fn_emit_convocatoria", {
          p_payload: {
            body_id: input.body_id,
            tipo_convocatoria: input.tipo_convocatoria,
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
            rule_trace: input.rule_trace ?? null,
            reminders_trace: input.reminders_trace ?? null,
            accepted_warnings: input.accepted_warnings ?? [],
          },
        });
      if (error) throw error;
      const result = data as {
        convocatoria?: ConvocatoriaRow;
        manifest?: ConvocationManifestRow;
      } | null;
      if (!result?.convocatoria || !result.manifest) {
        throw new Error("El registro DEMO no devolvió el borrador y su manifiesto canónico.");
      }
      return result.convocatoria;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convocatorias", tenantId] });
    },
  });
}

export type ConvocatoriaLifecycleTarget = "CANCELADA" | "RECTIFICADA";

export function useTransitionConvocatoriaLifecycle() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      convocatoriaId: string;
      targetState: ConvocatoriaLifecycleTarget;
      reason: string;
    }): Promise<ConvocatoriaRow> => {
      const reason = input.reason.trim();
      if (reason.length < 10) {
        throw new Error("Explica el motivo con al menos 10 caracteres.");
      }
      const { data, error } = await supabase.rpc("fn_transition_convocatoria_lifecycle", {
        p_convocatoria_id: input.convocatoriaId,
        p_target_state: input.targetState,
        p_reason: reason,
      });
      if (error) {
        throw secretariaOperationError(
          error,
          "No se pudo registrar la transición de la convocatoria.",
        );
      }
      const result = data as { convocatoria?: ConvocatoriaRow } | null;
      if (!result?.convocatoria) {
        throw new Error("La transición no devolvió la convocatoria preservada.");
      }
      return result.convocatoria;
    },
    onSuccess: (convocatoria) => {
      queryClient.invalidateQueries({
        queryKey: ["convocatorias", tenantId, "byId", convocatoria.id],
      });
      queryClient.invalidateQueries({ queryKey: ["convocatorias", tenantId] });
      queryClient.invalidateQueries({
        queryKey: ["communications", tenantId, "convocatoria", convocatoria.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["secretaria", tenantId, "meetings"],
      });
    },
  });
}

// ── Adjuntos ──────────────────────────────────────────────────────────────
//
// MIME types soportados (lista cerrada para evitar ejecutables / scripts).
const ATTACHMENT_ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Sniff MIME desde la extensión cuando `file.type` viene vacío
// (típico en Mac Finder + Safari, drag-and-drop antiguos). Mantiene la
// lista cerrada — extensiones no mapeadas → rechazo explícito en lugar
// de bypass como octet-stream (riesgo de subir ejecutables).
const ATTACHMENT_EXTENSION_TO_MIME: Record<string, string> = {
  pdf:  "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export interface UploadAttachmentInput {
  convocatoriaId: string;
  file: File;
  intentId?: string | null;
  agendaItemIndex?: number | null;
}

export interface UploadAttachmentResult {
  id: string;
  file_name: string;
  file_url: string;
  file_hash: string;
  file_hash_sha512: string;
  artifact_kind: "SUPPORTING_DOCUMENT";
  agenda_item_index: number | null;
  artifact_verified_at: string;
  artifact_verified_by_service: true;
  artifact_verified_size_bytes: number;
  artifact_verified_mime_type: string;
}

export interface AttachmentBinaryHashes {
  sha256: string;
  sha512: string;
}

export interface SupportingAttachmentIntentInput {
  id: string;
  file: File;
  alias: string;
  descripcion: string;
  agendaItemIndex?: number | null;
}

export interface SupportingAttachmentIntent {
  id: string;
  nombre: string;
  descripcion: string;
  file_name: string;
  size_bytes: number;
  mime: string;
  hash_sha256: string;
  hash_sha512: string;
  agenda_item_index: number | null;
  upload_status: "intended";
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeFileHashes(file: File | Blob): Promise<AttachmentBinaryHashes> {
  const buffer = await file.arrayBuffer();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto API no disponible");
  const [sha256, sha512] = await Promise.all([
    subtle.digest("SHA-256", buffer.slice(0)),
    subtle.digest("SHA-512", buffer),
  ]);
  return { sha256: bytesToHex(sha256), sha512: bytesToHex(sha512) };
}

export async function computeFileHashSha512(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto API no disponible");
  const digest = await subtle.digest("SHA-512", buffer);
  return bytesToHex(digest);
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
 * Precompromete la identidad binaria de cada anexo antes de emitir la
 * convocatoria. El servidor materializa estas entradas en un set WORM dentro
 * de la misma transacción de emisión; por eso un fichero vacío, demasiado
 * grande o con MIME no permitido debe fallar antes de crear el expediente.
 */
export async function buildSupportingAttachmentIntents(
  inputs: SupportingAttachmentIntentInput[],
): Promise<SupportingAttachmentIntent[]> {
  const seenIds = new Set<string>();
  const seenIdentities = new Set<string>();
  const intents = await Promise.all(inputs.map(async (input) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)) {
      throw new Error(`Identificador de intención de anexo no válido: ${input.id}`);
    }
    if (seenIds.has(input.id)) {
      throw new Error(`Identificador de intención de anexo duplicado: ${input.id}`);
    }
    seenIds.add(input.id);
    if (input.file.size <= 0) {
      throw new Error(`El anexo ${input.file.name} está vacío.`);
    }
    if (input.file.size > ATTACHMENT_MAX_BYTES) {
      throw new Error(
        `Archivo demasiado grande (${Math.round(input.file.size / (1024 * 1024))} MB > 25 MB)`,
      );
    }
    const mime = resolveAttachmentMime({ name: input.file.name, type: input.file.type });
    const hashes = await computeFileHashes(input.file);
    const identity = [
      input.file.name,
      input.file.size,
      mime,
      hashes.sha256,
      hashes.sha512,
      input.agendaItemIndex ?? "",
    ].join("\u0000");
    if (seenIdentities.has(identity)) {
      throw new Error(
        `El anexo ${input.file.name} está duplicado con la misma identidad binaria. Añádelo una sola vez.`,
      );
    }
    seenIdentities.add(identity);
    return {
      id: input.id,
      nombre: input.alias.trim() || input.file.name,
      descripcion: input.descripcion.trim(),
      file_name: input.file.name,
      size_bytes: input.file.size,
      mime,
      hash_sha256: hashes.sha256,
      hash_sha512: hashes.sha512,
      agenda_item_index: input.agendaItemIndex ?? null,
      upload_status: "intended" as const,
    };
  }));
  return intents;
}

/**
 * Sube un candidato al bucket privado. La fila autoritativa `attachments` no
 * la crea el navegador: una Edge Function vuelve a descargar el objeto,
 * comprueba magic/MIME/tamaño/SHA-256/SHA-512 y llama a la RPC service-only.
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
      // La firma del JWT basta para PostgREST, pero una sesión revocada debe
      // fallar antes de crear candidatos en Storage. La validación compartida
      // evita nueve renovaciones paralelas cuando se sube un board pack.
      await ensureLiveSupabaseSession();
      // resolveAttachmentMime valida o sniffa por extensión y lanza si no
      // hay match contra la lista cerrada (no acepta octet-stream).
      const effectiveMime = resolveAttachmentMime({ name: file.name, type: file.type });

      const hashes = await computeFileHashes(file);
      let intentId = input.intentId?.trim() || null;
      if (!intentId) {
        const { data: convocatoria, error: convocatoriaError } = await supabase
          .from("convocatorias")
          .select("reminders_trace")
          .eq("tenant_id", tenantId)
          .eq("id", convocatoriaId)
          .maybeSingle();
        if (convocatoriaError) throw convocatoriaError;
        const trace = convocatoria?.reminders_trace as Record<string, unknown> | null;
        const documents = trace?.documents as Record<string, unknown> | undefined;
        const references = Array.isArray(documents?.uploaded_references)
          ? documents.uploaded_references as Array<Record<string, unknown>>
          : [];
        const matches = references.filter((reference) =>
          reference.file_name === file.name
          && reference.size_bytes === file.size
          && reference.mime === effectiveMime
          && reference.hash_sha256 === hashes.sha256
          && reference.hash_sha512 === hashes.sha512
          && (reference.agenda_item_index ?? null) === (input.agendaItemIndex ?? null)
        );
        if (matches.length !== 1 || typeof matches[0]?.id !== "string") {
          throw new Error(
            `El fichero ${file.name} no coincide de forma unívoca con una intención inmutable de esta convocatoria.`,
          );
        }
        intentId = matches[0].id;
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(intentId)) {
        throw new Error("La intención inmutable del anexo no tiene un UUID válido.");
      }
      const safeName = sanitizeFileName(file.name);
      const storagePath = `convocatorias/${convocatoriaId}/supporting/${intentId}-${hashes.sha256.slice(0, 16)}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("matter-documents")
        .upload(storagePath, file, {
          contentType: effectiveMime,
          upsert: false,
        });
      // Ruta determinista por intención + hash: si una respuesta previa se
      // perdió, el objeto puede existir. La Edge Function lo volverá a leer y
      // verificar; si no existe o difiere, fallará cerrado. Nunca sobrescribir.
      if (uploadError) {
        console.info("[convocatorias] revalidating deterministic supporting object", {
          convocatoriaId,
          intentId,
          message: uploadError.message,
        });
      }

      const sentinelUrl = `evidence-bundle://${storagePath}`;
      // No borrar el objeto ante una respuesta ambigua: la Edge Function pudo
      // haber registrado ya la fila antes de que se perdiera la respuesta.
      return await registerSupportingConvocationArtifact({
        tenantId,
        convocatoriaId,
        agendaItemIndex: input.agendaItemIndex ?? null,
        fileName: file.name,
        storageUri: sentinelUrl,
        expectedHashSha256: hashes.sha256,
        expectedHashSha512: hashes.sha512,
        expectedMimeType: effectiveMime,
      }) as UploadAttachmentResult;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["attachments", tenantId, "convocatoria", variables.convocatoriaId],
      });
    },
  });
}
