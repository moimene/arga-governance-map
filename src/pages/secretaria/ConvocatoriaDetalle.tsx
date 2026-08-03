import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MapPin, FileText, Paperclip, Shield, CalendarPlus, Copy, Send, RefreshCcw, XCircle } from "lucide-react";
import {
  useConvocatoriaById,
  useConvocatoriaAttachments,
  useConvocationManifest,
  useTransitionConvocatoriaLifecycle,
  useUploadConvocatoriaAttachment,
  type ConvocatoriaLifecycleTarget,
} from "@/hooks/useConvocatorias";
import {
  useCreateMeetingFromConvocatoria,
  useMeetingForConvocatoria,
  useReunionById,
} from "@/hooks/useReunionSecretaria";
import { useCommunicationForConvocatoria } from "@/hooks/useCommunication";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { ProcessDocxButton } from "@/components/secretaria/ProcessDocxButton";
import { PasoEnvioMiembros } from "@/components/secretaria/comunicaciones/PasoEnvioMiembros";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { validateMeetingScheduleFromConvocatoria } from "@/lib/secretaria/meeting-scheduler";
import { bodyTypeLabel } from "@/lib/secretaria/body-labels";
import { labelMateria } from "@/lib/secretaria/agenda-materias";
import { useAuthorityEvidenceById } from "@/hooks/useAuthorityEvidence";
import type { OrganoTipo } from "@/lib/comms/types";
import { safeEadChannelLabel } from "@/lib/secretaria/ead-channel-semantics";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("es-ES") : "—";
}

function publicationChannelDisplayLabel(channel: string) {
  const eadLabel = safeEadChannelLabel(channel);
  if (eadLabel) return eadLabel;
  return channel.startsWith("SANDBOX_")
    ? `Sandbox · ${channel.slice("SANDBOX_".length)}`
    : channel;
}

function convocatoriaEntityDisplayName(conv: ConvocatoriaDocContext) {
  const name = conv.entity_name?.trim() || "Sociedad";
  const legalForm = conv.legal_form?.trim();
  if (!legalForm) return name;
  const normalizedName = name.replace(/[.,\s]/g, "").toUpperCase();
  const normalizedForm = legalForm.replace(/[.,\s]/g, "").toUpperCase();
  return normalizedName.endsWith(normalizedForm) ? name : `${name}, ${legalForm}`;
}

function getTraceArray(trace: Record<string, unknown> | null, key: string): unknown[] {
  const value = trace?.[key];
  return Array.isArray(value) ? value : [];
}

function getTraceRecord(trace: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const value = trace?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

type TraceDocument = {
  id?: string;
  nombre?: string;
  document_name?: string;
  descripcion?: string;
};

function getTraceDocuments(trace: Record<string, unknown> | null) {
  const documents = getTraceRecord(trace, "documents");
  const included = documents?.included_required;
  const missing = documents?.missing_required;
  const uploaded = documents?.uploaded_references;

  return {
    included: Array.isArray(included) ? included as TraceDocument[] : [],
    missing: Array.isArray(missing) ? missing as TraceDocument[] : [],
    uploaded: Array.isArray(uploaded) ? uploaded as TraceDocument[] : [],
  };
}

function documentLabel(doc: TraceDocument) {
  return doc.nombre ?? doc.document_name ?? doc.descripcion ?? doc.id ?? "Documento";
}

function scheduleReasonLabel(reason: string) {
  if (reason === "body_id_missing") return "Falta órgano social asociado a la convocatoria.";
  if (reason === "fecha_1_missing") return "Falta fecha de primera convocatoria.";
  if (reason === "convocatoria_missing") return "No se ha cargado la convocatoria.";
  return reason;
}

function communicationOrganoTipo(bodyType?: string | null): OrganoTipo {
  const normalized = (bodyType ?? "").trim().toUpperCase();
  if (normalized === "JGA" || normalized.includes("JUNTA")) return "JUNTA_GENERAL";
  if (normalized.includes("COMISION") || normalized.includes("COMISIÓN")) return "COMISION_DELEGADA";
  if (normalized.includes("SOCIO_UNICO") || normalized.includes("SOCIO ÚNICO")) return "SOCIO_UNICO";
  if (normalized.includes("ADMIN_UNICO") || normalized.includes("ADMINISTRADOR ÚNICO")) return "ADMIN_UNICO";
  if (normalized.includes("CONJUNT")) return "ADMIN_CONJUNTA";
  if (normalized.includes("SOLIDARI")) return "ADMIN_SOLIDARIOS";
  // El Consejo canónico ARGA usa body_type=CDA.
  return "CONSEJO_ADMIN";
}

type ConvocatoriaDocContext = {
  id: string;
  body_id?: string | null;
  entity_id?: string | null;
  tipo_convocatoria?: string | null;
  body_name?: string | null;
  body_type?: string | null;
  entity_name?: string | null;
  legal_form?: string | null;
  es_cotizada?: boolean | null;
  jurisdiction?: string | null;
  fecha_emision?: string | null;
  fecha_1?: string | null;
  fecha_2?: string | null;
  is_second_call?: boolean | null;
  lugar?: string | null;
  modalidad?: string | null;
  statutory_basis?: string | null;
  publication_channels?: string[] | null;
  agenda_items?: Array<{
    titulo?: string;
    materia?: string;
    tipo?: string;
    inscribible?: boolean;
    kind?: string | null;
    propuesta_acuerdo?: string | null;
    target_entity_id?: string | null;
    target_entity_name?: string | null;
    representative_person_id?: string | null;
    representative_name?: string | null;
    representation_delegation_id?: string | null;
    representation_authority_route?: string | null;
    representation_evidence_status?: string | null;
    representation_source_reference?: string | null;
    representation_legal_effect?: string | null;
    capital_evidence_status?: string | null;
    data_class?: string | null;
    legal_effect?: string | null;
  }> | null;
  convocatoria_text?: string | null;
  reminders_trace?: Record<string, unknown> | null;
  rule_trace?: Record<string, unknown> | null;
  accepted_warnings?: Record<string, unknown>[] | null;
};

function agendaItems(conv: ConvocatoriaDocContext) {
  return Array.isArray(conv.agenda_items) ? conv.agenda_items : [];
}

function buildConvocatoriaVariables(conv: ConvocatoriaDocContext) {
  const agenda = Array.isArray(conv.agenda_items) ? conv.agenda_items : [];
  const publicationChannelLabels = (conv.publication_channels ?? []).map(publicationChannelDisplayLabel);
  const ordenDiaTexto =
    agenda.length > 0
      ? agenda.map((item, index) => `${index + 1}. ${item.titulo ?? "Punto del orden del día"}`).join("\n")
      : "";
  const fecha1 = conv.fecha_1 ? new Date(conv.fecha_1) : null;
  const fecha2 = conv.fecha_2 ? new Date(conv.fecha_2) : null;
  const emittedAt = conv.fecha_emision ?? new Date().toISOString();
  const horaJunta = fecha1
    ? fecha1.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const horaSegunda = fecha2
    ? fecha2.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "";
  const haySegundaConvocatoria = Boolean(conv.fecha_2);
  const ruleContext = conv.rule_trace?.context as Record<string, unknown> | undefined;
  const ruleEvaluation = conv.rule_trace?.evaluation as Record<string, unknown> | undefined;
  const reminderTrace = conv.reminders_trace ?? {};
  const documents = (reminderTrace.documents as { missing_required?: Array<{ nombre?: string; document_name?: string }> } | undefined)?.missing_required ?? [];
  const channels = (reminderTrace.channels as { pending?: Array<{ label?: string; value?: string }> } | undefined)?.pending ?? [];
  const comprobaciones = [
    `Órgano convocante: ${conv.body_name ?? "órgano no informado"}`,
    `Canales seleccionados: ${publicationChannelLabels.join(", ") || "sin canales registrados"}`,
    `Documentación PRE pendiente: ${documents.length}`,
    `Canales pendientes de evidencia: ${channels.length}`,
    `Advertencias aceptadas: ${(conv.accepted_warnings ?? []).length}`,
  ];
  return {
    convocatoria_id: conv.id,
    body_id: conv.body_id ?? "",
    entity_id: conv.entity_id ?? "",
    convocatoria: conv,
    tipo_junta: conv.tipo_convocatoria ?? "ORDINARIA",
    tipo_junta_texto: conv.tipo_convocatoria ?? "Ordinaria",
    forma_social: conv.legal_form ?? "",
    denominacion_social: conv.entity_name ?? "Sociedad",
    cif: "No informado en demo",
    jurisdiccion: conv.jurisdiction ?? "",
    organo_convocante: conv.body_name ?? "Órgano",
    organo_tipo: conv.body_type ?? "",
    fecha: emittedAt,
    fecha_emision: emittedAt,
    fecha_junta: conv.fecha_1 ?? "—",
    fecha_sesion: conv.fecha_1?.slice(0, 10) ?? "",
    fecha_primera_convocatoria: conv.fecha_1 ?? "",
    fecha_segunda_convocatoria: conv.fecha_2 ?? "",
    hora: horaJunta,
    hora_junta: horaJunta,
    hora_sesion: horaJunta,
    hora_primera_convocatoria: horaJunta,
    hora_segunda_convocatoria: horaSegunda,
    lugar: conv.lugar ?? "domicilio social",
    lugar_junta: conv.lugar ?? "domicilio social",
    lugar_sesion: conv.lugar ?? "domicilio social",
    ciudad: conv.lugar ?? "Madrid",
    modalidad: conv.modalidad ?? "—",
    // Semilla Capa 3: la plantilla CONVOCATORIA pide `modalidad_sesion` como
    // lista cerrada (PRESENCIAL/TELEMATICA/MIXTA). El dato ya existe en la
    // convocatoria; sin esta clave el diálogo lo pediría vacío pese a mostrarlo
    // en "Datos de la convocatoria". Valores fuera de la lista se descartan en
    // normalizeCapa3Value, no ensucian el select.
    modalidad_sesion: conv.modalidad ?? "",
    destinatarios: "Personas legitimadas conforme a la ley, estatutos y, en su caso, pactos aplicables.",
    orden_dia: agenda.map((item, index) => ({
      ordinal: String(index + 1),
      descripcion_punto: item.titulo ?? "Punto del orden del día",
      tipo: item.kind === "INFORMATIVO"
        ? "Punto informativo"
        : labelMateria(item.materia ?? item.tipo ?? "ORDINARIA"),
      inscribible: !!item.inscribible,
    })),
    orden_dia_texto: ordenDiaTexto,
    orden_del_dia_resumen: ordenDiaTexto,
    numero_convocatoria: conv.is_second_call ? "Segunda convocatoria" : "Primera convocatoria",
    hay_segunda_convocatoria: haySegundaConvocatoria,
    requiere_segunda_convocatoria: haySegundaConvocatoria ? "Sí" : "No",
    articulo_segunda_convocatoria: haySegundaConvocatoria ? "Régimen estatutario y legal aplicable" : "No aplica",
    canal_documentacion: "Expediente electrónico de Secretaría Societaria",
    publicacion_ref: publicationChannelLabels.join(", "),
    cotizada_procedimiento_voto_distancia_ref: "Procedimiento de asistencia, representación y voto a distancia publicado con la convocatoria",
    derecho_informacion: "Derecho de información disponible conforme a la normativa y estatutos aplicables.",
    plazo_informacion_dias: "Desde la publicación o notificación de la convocatoria.",
    documentacion_disponible: getTraceArray(conv.reminders_trace, "documents").length > 0,
    documentos_disponibles: [],
    documentos_adjuntos: [],
    canales_publicacion: publicationChannelLabels,
    canal_notificacion: publicationChannelLabels.join(", ") || "—",
    canal_convocatoria: publicationChannelLabels.join(", "),
    entidad_cotizada: conv.es_cotizada === true,
    statutory_basis: conv.statutory_basis ?? "—",
    advertencias_aceptadas: conv.accepted_warnings ?? [],
    comprobaciones,
    comprobaciones_texto: comprobaciones.join("\n"),
    resultado_gate: String(ruleEvaluation?.ok ?? ruleContext?.ok ?? "recordatorio"),
    resultado_evaluacion: "Convocatoria generada con alertas no bloqueantes y trazabilidad operativa.",
    snapshot_rule_pack_id: String(ruleContext?.rule_pack_id ?? ruleContext?.pack_id ?? "rule-pack-operativo-demo"),
    snapshot_rule_pack_version: String(ruleContext?.rule_pack_version ?? ruleContext?.version ?? "demo"),
    snapshot_hash: String(conv.rule_trace?.snapshot_hash ?? conv.rule_trace?.hash ?? "snapshot-operativo-demo"),
    cargo_firmante: "Secretaría del órgano",
    firma_organo_administracion: "Secretaría del órgano convocante",
    firma: "Secretaría Societaria",
    entities: {
      id: conv.entity_id ?? "",
      name: conv.entity_name ?? "Sociedad",
      common_name: conv.entity_name ?? "Sociedad",
      legal_form: conv.legal_form ?? "",
      jurisdiction: conv.jurisdiction ?? "",
    },
    meetings: {
      junta: {
        tipo_junta: conv.tipo_convocatoria ?? "ORDINARIA",
        forma_social: conv.legal_form ?? "",
        fecha_primera_convocatoria: conv.fecha_1 ?? "",
        hora_primera_convocatoria: horaJunta,
        fecha_segunda_convocatoria: conv.fecha_2 ?? "",
        hora_segunda_convocatoria: horaSegunda,
        lugar: conv.lugar ?? "domicilio social",
        modalidad: conv.modalidad ?? "PRESENCIAL",
        hay_segunda_convocatoria: haySegundaConvocatoria,
        orden_dia: ordenDiaTexto,
        canales_publicacion: publicationChannelLabels,
        publicacion_ref: publicationChannelLabels.join(", "),
        cotizada_procedimiento_voto_distancia_ref: "Procedimiento de asistencia, representación y voto a distancia publicado con la convocatoria",
      },
    },
    agreements: {
      convocatoria: {
        expediente_id: conv.id,
      },
    },
  };
}

function buildConvocatoriaFallback(conv: ConvocatoriaDocContext) {
  const variables = buildConvocatoriaVariables(conv);
  const agenda = variables.orden_dia;
  return [
    `CONVOCATORIA DE ${variables.tipo_junta_texto} DE ${variables.denominacion_social}`,
    "",
    `Órgano convocante: ${variables.organo_convocante}`,
    `Fecha de registro DEMO: ${formatDateTime(conv.fecha_emision)}`,
    `Primera convocatoria: ${formatDateTime(conv.fecha_1)}`,
    conv.fecha_2 ? `Segunda convocatoria: ${formatDateTime(conv.fecha_2)}` : null,
    `Modalidad: ${variables.modalidad}`,
    `Lugar: ${variables.lugar_junta}`,
    "",
    "ORDEN DEL DÍA",
    ...(agenda.length > 0
      ? agenda.map((item) => `${item.ordinal}. ${item.descripcion_punto}`)
      : ["1. Orden del día pendiente de detalle."]),
    "",
    "CANALES DE PUBLICACIÓN Y NOTIFICACIÓN",
    variables.canales_publicacion.length > 0 ? variables.canales_publicacion.join(", ") : "Sin canales registrados.",
    "",
    "FUNDAMENTO",
    variables.statutory_basis,
  ].filter(Boolean).join("\n");
}

function buildInformePreceptivoFallback(conv: ConvocatoriaDocContext) {
  const warnings = conv.accepted_warnings ?? [];
  const reminderTrace = conv.reminders_trace ?? {};
  const documents = (reminderTrace.documents as { missing_required?: Array<{ nombre?: string; document_name?: string }> } | undefined)?.missing_required ?? [];
  const channels = (reminderTrace.channels as { pending?: Array<{ label?: string; value?: string }> } | undefined)?.pending ?? [];

  return [
    `INFORME PRECEPTIVO DOCUMENTAL DE CONVOCATORIA`,
    "",
    `Sociedad: ${conv.entity_name ?? "—"}`,
    `Órgano: ${conv.body_name ?? "—"}`,
    `Convocatoria: ${conv.id}`,
    `Fecha de reunión: ${formatDateTime(conv.fecha_1)}`,
    "",
    "ALCANCE",
    "Este informe resume las comprobaciones PRE asociadas a la convocatoria: plazos, canales de publicación o notificación, documentación puesta a disposición y advertencias aceptadas en modo recordatorio.",
    "",
    "DOCUMENTACIÓN PRE",
    documents.length > 0
      ? documents.map((doc, index) => `${index + 1}. ${doc.nombre ?? doc.document_name ?? "Documento pendiente"}`).join("\n")
      : "Sin documentos obligatorios pendientes registrados en la traza.",
    "",
    "CANALES PENDIENTES DE EVIDENCIA",
    channels.length > 0
      ? channels.map((channel, index) => `${index + 1}. ${channel.label ?? channel.value ?? "Canal pendiente"}`).join("\n")
      : "Sin canales pendientes registrados en la traza.",
    "",
    "ADVERTENCIAS ACEPTADAS",
    warnings.length > 0
      ? warnings.map((warning, index) => `${index + 1}. ${String(warning.message ?? warning.type ?? "Advertencia")}`).join("\n")
      : "Sin advertencias aceptadas.",
  ].join("\n");
}

function selectedTemplateFromTrace(trace?: Record<string, unknown> | null) {
  const context = trace?.context;
  if (!context || typeof context !== "object") return null;
  const traceContext = context as { borrador_template?: unknown; selected_template?: unknown };
  const selectedTemplate =
    traceContext.borrador_template && typeof traceContext.borrador_template === "object"
      ? traceContext.borrador_template
      : traceContext.selected_template;
  if (!selectedTemplate || typeof selectedTemplate !== "object") return null;
  const id = (selectedTemplate as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id : null;
}

function generateIcs(convocatoria: {
  title: string;
  meeting_date: string;
  start_time?: string | null;
  location?: string | null;
  body_name?: string | null;
}): string {
  const dt = new Date(convocatoria.meeting_date);
  const dateStr = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `convocatoria-${Date.now()}@arga-seguros.com`;
  const summary = convocatoria.title ?? "Reunión " + (convocatoria.body_name ?? "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TGMS//Secretaría Societaria//ES",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dateStr}`,
    `DTSTART:${dateStr}`,
    `SUMMARY:${summary}`,
    convocatoria.location ? `LOCATION:${convocatoria.location}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function downloadIcs(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ConvocatoriaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const { data: conv, isLoading } = useConvocatoriaById(id);
  const { data: manifest } = useConvocationManifest(id);
  const manifestRecipientsRaw = Array.isArray(manifest?.manifest_json.recipients)
    ? manifest.manifest_json.recipients
    : [];
  const canonicalRecipients = manifestRecipientsRaw.map((raw) => ({
    personId: String(raw.person_id ?? ""),
    conditionId: String(raw.condition_id ?? ""),
    name: String(raw.name ?? ""),
    office: String(raw.office ?? ""),
    email: String(raw.email ?? ""),
    channel: String(raw.channel ?? "") as "EAD_INTERPOSITION" | "EMAIL_SIMPLE",
  })).filter((recipient) => (
    recipient.personId
    && recipient.conditionId
    && recipient.name
    && recipient.office
    && recipient.email
    && ["EAD_INTERPOSITION", "EMAIL_SIMPLE"].includes(recipient.channel)
  ));
  const { data: attachments, refetch: refetchAttachments } = useConvocatoriaAttachments(id);
  const uploadAttachment = useUploadConvocatoriaAttachment();
  const [attachmentsInFlight, setAttachmentsInFlight] = useState(0);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [lifecycleDialogTarget, setLifecycleDialogTarget] =
    useState<ConvocatoriaLifecycleTarget | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleReasonError, setLifecycleReasonError] = useState<string | null>(null);
  const {
    data: existingCommunication,
    isLoading: communicationLoading,
    refetch: refetchCommunication,
  } = useCommunicationForConvocatoria(id);
  const { data: scheduledMeeting, isLoading: isMeetingLoading } = useMeetingForConvocatoria(id, conv);
  const { data: lifecycleMeeting, isLoading: isLifecycleMeetingLoading } = useReunionById(
    existingCommunication?.meeting_id ?? undefined,
  );
  const effectiveMeeting = scheduledMeeting ?? lifecycleMeeting ?? null;
  const createMeetingFromConvocatoria = useCreateMeetingFromConvocatoria();
  const transitionLifecycle = useTransitionConvocatoriaLifecycle();
  const { data: storedConvocationAuthority } = useAuthorityEvidenceById(
    conv?.convocante_authority_evidence_id,
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Cargando…
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="mx-auto max-w-[1200px] p-6">
        <div className="text-sm text-[var(--g-text-secondary)]">Convocatoria no encontrada.</div>
      </div>
    );
  }

  // El DOCX final nunca puede aparecer como anexo de sí mismo. El texto del
  // documento se compone únicamente con el manifiesto de soportes verificados.
  const attachmentNames = (attachments ?? [])
    .filter((attachment) =>
      attachment.artifact_kind === "SUPPORTING_DOCUMENT" &&
      attachment.artifact_verified_by_service === true &&
      Boolean(attachment.artifact_verified_at),
    )
    .map((attachment) => attachment.file_name);
  const entityDisplayName = convocatoriaEntityDisplayName(conv);
  const docVariables = {
    ...buildConvocatoriaVariables(conv),
    convocation_manifest_hash_sha512: manifest?.manifest_hash_sha512 ?? null,
    nombre_convocante: storedConvocationAuthority?.person?.full_name ?? "",
    cargo_convocante: storedConvocationAuthority?.cargo ?? "",
    canal_documentacion: attachmentNames.length > 0
      ? `Expediente electrónico de Secretaría Societaria · ${attachmentNames.length} anexos verificados`
      : "Expediente electrónico de Secretaría Societaria",
    documentos_adjuntos: attachmentNames,
    documentos_disponibles: attachmentNames,
  };
  const reviewedConvocatoriaText = conv.convocatoria_text?.trim() ? conv.convocatoria_text : null;
  const convocatoriaFallback = buildConvocatoriaFallback(conv);
  const informeFallback = buildInformePreceptivoFallback(conv);
  const backToList = scope.createScopedTo("/secretaria/convocatorias");
  const requestedPlantillaId = searchParams.get("plantilla");
  const requestedTemplateType = searchParams.get("tipo");
  const tracedTemplateId = selectedTemplateFromTrace(conv.rule_trace);
  const preferredConvocatoriaTemplateId =
    requestedTemplateType && requestedTemplateType.startsWith("INFORME")
      ? tracedTemplateId
      : requestedPlantillaId ?? tracedTemplateId;
  const preferredInformeTemplateId =
    requestedTemplateType && requestedTemplateType.startsWith("INFORME")
      ? requestedPlantillaId
      : null;
  const meetingValidation = validateMeetingScheduleFromConvocatoria(conv);
  const agenda = agendaItems(conv);
  const documentTrace = getTraceDocuments(conv.reminders_trace);
  const manifestAuthority = manifest?.manifest_json.authority as Record<string, unknown> | undefined;
  const manifestPublication = manifest?.manifest_json.publication as Record<string, unknown> | undefined;
  const demoSandboxOnly =
    manifest?.data_class === "DEMO" &&
    manifest.legal_effect === "DEMO_SIMULATION_NO_LEGAL_EFFECT";
  const displayStatus = conv.estado === "EMITIDA" && demoSandboxOnly
    ? "Registrada · simulación DEMO sin efecto jurídico"
    : statusLabel(conv.estado);
  const canonicalConvocatoriaAttachment = [...(attachments ?? [])]
    .filter((attachment) =>
      attachment.artifact_kind === "CONVOCATORIA_FINAL" &&
      attachment.artifact_verified_by_service === true &&
      Boolean(attachment.artifact_verified_at) &&
      Boolean(attachment.convocation_manifest_hash_sha512) &&
      attachment.convocation_manifest_hash_sha512 === manifest?.manifest_hash_sha512 &&
      attachment.agenda_item_index === null &&
      /^[0-9a-f]{64}$/.test(attachment.file_hash ?? "") &&
      /^[0-9a-f]{128}$/.test(attachment.file_hash_sha512 ?? "") &&
      attachment.file_url.startsWith(`evidence-bundle://convocatorias/${conv.id}/`),
    )
    .sort((left, right) => right.uploaded_at.localeCompare(left.uploaded_at))[0] ?? null;
  const supportingConvocatoriaAttachments = (attachments ?? [])
    .filter((attachment) =>
      attachment.artifact_kind === "SUPPORTING_DOCUMENT" &&
      attachment.artifact_verified_by_service === true &&
      Boolean(attachment.artifact_verified_at),
    )
    .map((attachment) => ({
      id: attachment.id,
      fileName: attachment.file_name,
      fileUrl: attachment.file_url,
      hashSha256: attachment.file_hash,
      hashSha512: attachment.file_hash_sha512 ?? null,
      agendaItemIndex: attachment.agenda_item_index,
    }));
  const supportingDocumentContract = manifest?.manifest_json.supporting_documents;
  const supportingDocumentIntents = supportingDocumentContract
    && typeof supportingDocumentContract === "object"
    && !Array.isArray(supportingDocumentContract)
    && Array.isArray((supportingDocumentContract as { intents?: unknown }).intents)
      ? (supportingDocumentContract as { intents: Array<Record<string, unknown>> }).intents
      : [];
  const registeredSupportingIntentIds = new Set(
    (attachments ?? [])
      .filter((attachment) => attachment.artifact_kind === "SUPPORTING_DOCUMENT")
      .map((attachment) => attachment.supporting_attachment_intent_id)
      .filter((intentId): intentId is string => Boolean(intentId)),
  );
  const pendingSupportingIntents = supportingDocumentIntents.filter((intent) => (
    typeof intent.intent_id === "string"
    && !registeredSupportingIntentIds.has(intent.intent_id)
  ));
  const supportingUploadOpen = conv.estado === "EMITIDA"
    && !canonicalConvocatoriaAttachment
    && !existingCommunication
    && pendingSupportingIntents.length > 0;

  const openOrScheduleMeeting = async () => {
    try {
      if (effectiveMeeting?.id) {
        navigate(scope.createScopedTo(`/secretaria/reuniones/${effectiveMeeting.id}`));
        return;
      }

      const result = await createMeetingFromConvocatoria.mutateAsync(conv);
      toast.success(result.reused ? "Reunión existente localizada" : "Reunión programada", {
        description: "La sesión conserva la convocatoria como origen y cargará su orden del día.",
      });
      navigate(scope.createScopedTo(`/secretaria/reuniones/${result.id}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("No se pudo programar la reunión", { description: message });
    }
  };

  const openLifecycleDialog = (targetState: ConvocatoriaLifecycleTarget) => {
    setLifecycleDialogTarget(targetState);
    setLifecycleReason("");
    setLifecycleReasonError(null);
  };

  const closeLifecycleDialog = () => {
    if (transitionLifecycle.isPending) return;
    setLifecycleDialogTarget(null);
    setLifecycleReason("");
    setLifecycleReasonError(null);
  };

  const transitionDemoLifecycle = async () => {
    if (!lifecycleDialogTarget) return;
    const reason = lifecycleReason.trim();
    if (reason.length < 10) {
      setLifecycleReasonError("Escribe un motivo de al menos 10 caracteres.");
      return;
    }
    try {
      await transitionLifecycle.mutateAsync({
        convocatoriaId: conv.id,
        targetState: lifecycleDialogTarget,
        reason,
      });
      toast.success(
        lifecycleDialogTarget === "CANCELADA"
          ? "Registro DEMO cancelado; el original y su historial permanecen íntegros."
          : "Registro DEMO marcado como rectificado; el original permanece íntegro.",
      );
      setLifecycleDialogTarget(null);
      setLifecycleReason("");
      setLifecycleReasonError(null);
    } catch (error) {
      toast.error("No se pudo registrar la transición", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const uploadConvocatoriaFiles = async (files: FileList | null) => {
    if (
      !id ||
      !files ||
      files.length === 0 ||
      attachmentsInFlight > 0 ||
      !supportingUploadOpen
    ) return;
    const selected = Array.from(files);
    setAttachmentsInFlight(selected.length);
    const results = await Promise.allSettled(
      selected.map((file) => uploadAttachment.mutateAsync({ convocatoriaId: id, file })),
    );
    const uploaded = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - uploaded;
    setAttachmentsInFlight(0);
    if (failed === 0) {
      toast.success(`${uploaded} adjunto(s) archivado(s) con SHA-256 y SHA-512`);
      return;
    }
    const firstFailure = results.find((result) => result.status === "rejected");
    const detail = firstFailure?.status === "rejected"
      ? firstFailure.reason instanceof Error ? firstFailure.reason.message : String(firstFailure.reason)
      : undefined;
    toast.warning(`${uploaded} adjunto(s) subido(s); ${failed} fallido(s)`, { description: detail });
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate(backToList)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            Borrador operativo · {displayStatus}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {conv.body_name ?? "Órgano"}
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {conv.entity_name ?? "—"}
            {conv.jurisdiction ? ` · ${conv.jurisdiction}` : ""}
            {conv.legal_form ? ` · ${conv.legal_form}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <ProcessDocxButton
            label={reviewedConvocatoriaText ? "Borrador DEMO revisado DOCX" : preferredConvocatoriaTemplateId ? "Borrador DEMO con plantilla" : "Borrador DEMO DOCX"}
            variant="primary"
            input={{
              kind: "CONVOCATORIA",
              recordId: conv.id,
              title: `Convocatoria de ${conv.body_name ?? "órgano"}`,
              subtitle: entityDisplayName,
              entityName: entityDisplayName,
              generatedAt: conv.fecha_emision?.slice(0, 10) ?? undefined,
              templateTypes: conv.legal_form?.toUpperCase().includes("SL")
                ? ["CONVOCATORIA_SL_NOTIFICACION", "CONVOCATORIA"]
                : ["CONVOCATORIA", "CONVOCATORIA_SL_NOTIFICACION"],
              variables: docVariables,
              templateCriteria: {
                jurisdiction: conv.jurisdiction,
                organoTipo: conv.body_type,
              },
              preferredTemplateId: preferredConvocatoriaTemplateId,
              reviewedBodyText: reviewedConvocatoriaText,
              preserveReviewedBodyExact: Boolean(reviewedConvocatoriaText),
              fallbackText: reviewedConvocatoriaText ?? convocatoriaFallback,
              filenamePrefix: "convocatoria",
            }}
            onGenerated={async (result) => {
              if (result.archive.archived) await refetchAttachments();
            }}
          />
          <ProcessDocxButton
            label={preferredInformeTemplateId ? "Informe PRE con plantilla" : "Informe PRE"}
            input={{
              kind: "INFORME_PRECEPTIVO",
              recordId: conv.id,
              title: "Informe preceptivo documental",
              subtitle: entityDisplayName,
              entityName: entityDisplayName,
              generatedAt: conv.fecha_emision?.slice(0, 10) ?? undefined,
              templateTypes: ["INFORME_PRECEPTIVO", "INFORME_DOCUMENTAL_PRE"],
              variables: docVariables,
              templateCriteria: {
                jurisdiction: conv.jurisdiction,
                organoTipo: conv.body_type,
              },
              preferredTemplateId: preferredInformeTemplateId,
              fallbackText: informeFallback,
              filenamePrefix: "informe_pre_convocatoria",
            }}
          />
          <button
            type="button"
            onClick={openOrScheduleMeeting}
            disabled={!meetingValidation.ok || createMeetingFromConvocatoria.isPending || isMeetingLoading || isLifecycleMeetingLoading}
            aria-busy={createMeetingFromConvocatoria.isPending || isMeetingLoading || isLifecycleMeetingLoading}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <CalendarPlus className="h-4 w-4" />
            {effectiveMeeting ? "Abrir reunión" : "Programar reunión"}
          </button>
          {/* ITEM-097: el wizard de convocatoria no permite editar in situ un
              BORRADOR existente. Opción ligera: clonar esta convocatoria como
              base de una nueva, reutilizando el prefill `?clonarDe=<id>` del
              stepper (órgano, entidad, tipo de sesión, fechas, canales, agenda…)
              sin copiar identificadores ni estado. */}
          <button
            type="button"
            onClick={() =>
              navigate(scope.createScopedTo(`/secretaria/convocatorias/nueva?clonarDe=${conv.id}`))
            }
            className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Copy className="h-4 w-4" />
            Clonar como nueva
          </button>
          {conv.fecha_1 ? (
            <button
              type="button"
              onClick={() => {
                const ics = generateIcs({
                  title: `${conv.body_name ?? "Reunión"} — ${conv.entity_name ?? ""}`,
                  meeting_date: conv.fecha_1!,
                  location: null,
                  body_name: conv.body_name,
                });
                downloadIcs(ics, `convocatoria-${conv.id}.ics`);
              }}
              className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <CalendarPlus className="h-4 w-4" />
              Calendario
            </button>
          ) : null}
          {conv.estado === "EMITIDA" && manifest ? (
            <>
              <button
                type="button"
                onClick={() => openLifecycleDialog("RECTIFICADA")}
                disabled={transitionLifecycle.isPending}
                aria-busy={transitionLifecycle.isPending}
                className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <RefreshCcw className="h-4 w-4" />
                Marcar rectificación
              </button>
              <button
                type="button"
                onClick={() => openLifecycleDialog("CANCELADA")}
                disabled={transitionLifecycle.isPending}
                aria-busy={transitionLifecycle.isPending}
                className="inline-flex items-center gap-2 border border-[var(--status-error)] px-3 py-2 text-sm text-[var(--status-error)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <XCircle className="h-4 w-4" />
                Cancelar registro DEMO
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Datos de la convocatoria" icon={Calendar}>
            <KV label="Fecha de registro DEMO" value={conv.fecha_emision ? new Date(conv.fecha_emision).toLocaleDateString("es-ES") : "—"} />
            <KV label="Fecha 1ª convocatoria" value={conv.fecha_1 ? new Date(conv.fecha_1).toLocaleString("es-ES") : "—"} />
            <KV label="Fecha 2ª convocatoria" value={conv.fecha_2 ? new Date(conv.fecha_2).toLocaleString("es-ES") : "—"} />
            <KV label="Modalidad" value={conv.modalidad ? statusLabel(conv.modalidad) : "—"} />
            <KV label="Junta universal" value={conv.junta_universal ? "Sí" : "No"} />
            <KV label="2ª convocatoria reforzada" value={conv.is_second_call ? "Sí" : "No"} />
            <KV label="Urgente" value={conv.urgente ? "Sí" : "No"} />
            <KV label="Fundamento estatutario" value={conv.statutory_basis ?? "—"} />
          </Card>

          <Card title="Manifiesto canónico del registro DEMO" icon={Shield}>
            {manifest ? (
              <div className="space-y-2">
                <KV label="Clase de datos" value={manifest.data_class} />
                <KV label="Efecto" value="Simulación DEMO sin efecto jurídico" />
                <KV
                  label="Cargo acreditado"
                  value={String(manifestAuthority?.person_name ?? "Presidencia")}
                />
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Registro WORM lógico de una operación DEMO. La persona figura solo como titular del cargo derivado: no se afirma que el Presidente haya actuado, consentido, emitido o firmado una convocatoria.
                </p>
                <KV label="Tipo de registro" value={String(manifestAuthority?.act_type ?? "DEMO_CONVOCATION_RECORD")} />
                <KV
                  label="SHA-512 del acto DEMO"
                  value={<span className="font-mono text-[11px]">{String(manifestAuthority?.act_hash_sha512 ?? manifest.act_hash_sha512)}</span>}
                />
                <KV label="Entrega" value="Sandbox; entrega real bloqueada" />
                <KV
                  label="Rol de EAD Trust"
                  value={manifestAuthority?.ead_signature_service_required === false
                    ? "Interposición/mensajería/custodia separada; sin firma ni ERDS"
                    : "No informado"}
                />
                <p className="text-xs text-[var(--g-text-secondary)]">
                  La necesidad jurídica de firma no se afirma en este artefacto DEMO; la interposición, mensajería y custodia se registran separadamente.
                </p>
                <KV
                  label="SHA-512 manifiesto"
                  value={<span className="font-mono text-[11px]">{manifest.manifest_hash_sha512}</span>}
                />
                {manifestPublication?.delivery_mode === "SANDBOX_ONLY" ? (
                  <p className="border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-subtle)] p-2 text-xs text-[var(--g-text-primary)]">
                    Este caso permite recorrer el ciclo y generar el documento, pero no enviar comunicaciones reales.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--g-text-secondary)]">
                Registro legacy sin manifiesto canónico DEMO; no se atribuye actuación personal ni efecto jurídico.
              </p>
            )}
          </Card>

          <Card title="Orden del día" icon={FileText}>
            {agenda.length > 0 ? (
              <ol className="space-y-3">
                {agenda.map((item, index) => (
                  <li key={`${item.materia ?? "punto"}-${index}`} className="text-sm">
                    <div className="font-medium text-[var(--g-text-primary)]">
                      {index + 1}. {item.titulo ?? "Punto del orden del día"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--g-text-secondary)]">
                      {item.kind === "DECISORIO" ? (
                        <>
                          <span>{labelMateria(item.materia ?? "OTROS_LIBRE")}</span>
                          <span>{item.tipo ? statusLabel(item.tipo) : "Ordinaria"}</span>
                          {item.inscribible ? <span>Inscribible</span> : null}
                        </>
                      ) : (
                        <span>Punto informativo · sin acuerdo ni votación</span>
                      )}
                    </div>
                    {item.propuesta_acuerdo ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--g-text-secondary)]">
                        Propuesta canónica: {item.propuesta_acuerdo}
                      </p>
                    ) : null}
                    {item.materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL" ? (
                      <div className="mt-2 border-l-4 border-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] p-2 text-xs text-[var(--g-text-primary)]">
                        <div>Filial: {item.target_entity_name ?? item.target_entity_id ?? "—"}</div>
                        <div>Representante: {item.representative_name ?? item.representative_person_id ?? "—"}</div>
                        <div>Título: {item.representation_source_reference ?? item.representation_delegation_id ?? "—"}</div>
                        <div>Ruta: {item.representation_authority_route ?? "—"}</div>
                        <div>Evidencia: {item.representation_evidence_status ?? "—"}</div>
                        <div>Efecto: {item.representation_legal_effect ?? item.legal_effect ?? "—"}</div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-[var(--g-text-secondary)]">Orden del día pendiente de detalle.</div>
            )}
          </Card>

          <Card title="Índice documental PRE" icon={FileText}>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <KV label="Incluidos" value={documentTrace.included.length} />
              <KV label="Pendientes" value={documentTrace.missing.length} />
              <KV label="Referencias" value={documentTrace.uploaded.length + (attachments?.length ?? 0)} />
            </div>
            {documentTrace.missing.length > 0 ? (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--status-warning)]">
                  Pendientes de trazabilidad
                </div>
                <ul className="space-y-1 text-sm text-[var(--g-text-secondary)]">
                  {documentTrace.missing.map((doc, index) => (
                    <li key={`${doc.id ?? documentLabel(doc)}-${index}`}>· {documentLabel(doc)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--g-text-secondary)]">
                Sin documentos PRE pendientes en la traza de recordatorios.
              </p>
            )}
            {documentTrace.included.length > 0 || documentTrace.uploaded.length > 0 ? (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
                  Documentos incorporados o referenciados
                </div>
                <ul className="space-y-1 text-sm text-[var(--g-text-secondary)]">
                  {[...documentTrace.included, ...documentTrace.uploaded].map((doc, index) => (
                    <li key={`${doc.id ?? documentLabel(doc)}-${index}`}>· {documentLabel(doc)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card title="Publicación y comunicación" icon={MapPin}>
            {conv.publication_channels && conv.publication_channels.length > 0 ? (
              <ul className="space-y-1 text-sm text-[var(--g-text-secondary)]">
                {conv.publication_channels.map((ch) => (
                  <li key={ch}>· {publicationChannelDisplayLabel(ch)}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-[var(--g-text-secondary)]">Sin canales registrados.</div>
            )}
            {conv.publication_evidence_url ? (
              <a
                href={conv.publication_evidence_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
              >
                <FileText className="h-3.5 w-3.5" />
                Evidencia de publicación
              </a>
            ) : null}
          </Card>

          <Card title="Adjuntos" icon={Paperclip}>
            <label
              className={`mb-4 inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors ${
                supportingUploadOpen
                  ? "cursor-pointer hover:bg-[var(--g-surface-subtle)]"
                  : "cursor-not-allowed opacity-60"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Paperclip className="h-4 w-4" />
              {attachmentsInFlight > 0
                ? `Archivando ${attachmentsInFlight} adjunto(s)…`
                : supportingUploadOpen
                ? `Añadir anexos pendientes PDF/DOCX (${pendingSupportingIntents.length})`
                : "Set de anexos cerrado"}
              <input
                type="file"
                multiple
                disabled={attachmentsInFlight > 0 || !supportingUploadOpen}
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  void uploadConvocatoriaFiles(event.target.files);
                  event.target.value = "";
                }}
                className="sr-only"
              />
            </label>
            {supportingDocumentIntents.length > 0 ? (
              <p className="mb-3 text-xs text-[var(--g-text-secondary)]">
                Set WORM: {registeredSupportingIntentIds.size}/{supportingDocumentIntents.length} anexo(s) verificado(s).
                {pendingSupportingIntents.length > 0
                  ? " Solo se admiten los binarios precomprometidos en el manifiesto."
                  : " El set está completo y no admite incorporaciones adicionales."}
              </p>
            ) : null}
            {attachments && attachments.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {attachments.map((a) => {
                  // ITEM-094: file_url puede ser el sentinel evidence-bundle://<path>
                  // (bucket privado tras F3.G3) o una URL https legacy de un bucket
                  // ahora privado — ambos abren un anchor roto. Solo se renderiza un
                  // enlace si el esquema es navegable; el resto se muestra como
                  // referencia privada verificada (nombre + hash + badge).
                  const isNavigable = /^https?:\/\//i.test(a.file_url ?? "");
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      {isNavigable ? (
                        <a
                          href={a.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                        >
                          {a.file_name}
                        </a>
                      ) : (
                        <span className="text-[var(--g-text-primary)]">{a.file_name}</span>
                      )}
                      {!isNavigable && (
                        <span
                          className="bg-[var(--g-surface-muted)] px-2 py-0.5 text-[10px] text-[var(--g-text-secondary)]"
                          style={{ borderRadius: "var(--g-radius-full)" }}
                        >
                          Verificado en Storage
                        </span>
                      )}
                      {a.file_hash ? (
                        <span className="font-mono text-[11px] text-[var(--g-text-secondary)]">
                          {a.file_hash.slice(0, 12)}…
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-sm text-[var(--g-text-secondary)]">Sin adjuntos.</div>
            )}
          </Card>

          <Card title="Comunicación de convocatoria" icon={Send}>
            {communicationLoading ? (
              <p className="text-sm text-[var(--g-text-secondary)]">
                Comprobando el vínculo de comunicación…
              </p>
            ) : existingCommunication ? (
              <div className="space-y-2 text-sm">
                <KV label="Estado" value={statusLabel(existingCommunication.estado)} />
                {!demoSandboxOnly ? (
                  <KV
                    label="Programada"
                    value={formatDateTime(existingCommunication.fecha_programada)}
                  />
                ) : null}
                {demoSandboxOnly ? (
                  <p className="border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-primary)]">
                    {existingCommunication.estado === "CANCELADA"
                      ? "Comunicación sandbox cancelada por la rectificación. Se conserva el histórico sin envío, programación, claim de dispatcher ni petición a proveedor."
                      : "Comunicación sandbox preparada en Borrador y sin envío. No existe programación, claim de dispatcher ni petición a proveedor."}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    La programación no acredita envío ni entrega. Esos estados solo cambian con respuesta real del proveedor.
                  </p>
                )}
              </div>
            ) : !canonicalConvocatoriaAttachment ? (
              <p className="text-sm text-[var(--g-text-secondary)]">
                Genera primero el DOCX final con el botón superior. La comunicación permanece bloqueada hasta que Storage conserve el binario y sus hashes SHA-256/SHA-512.
              </p>
            ) : !effectiveMeeting ? (
              <p className="text-sm text-[var(--g-text-secondary)]">
                Programa primero la reunión operativa. La comunicación no puede salir hasta que la agenda materialice el vínculo autoritativo entre convocatoria y sesión.
              </p>
            ) : communicationOpen ? (
              <PasoEnvioMiembros
                bodyId={conv.body_id!}
                entityId={conv.entity_id!}
                organoTipo={communicationOrganoTipo(conv.body_type)}
                convocatoriaId={conv.id}
                meetingId={effectiveMeeting?.id ?? null}
                meetingDate={conv.fecha_1 ? new Date(conv.fecha_1) : null}
                tipoComunicacion="CONVOCATORIA"
                demoSandboxOnly={demoSandboxOnly}
                sourceAttachmentId={canonicalConvocatoriaAttachment.id}
                documentUri={canonicalConvocatoriaAttachment.file_url}
                documentHashSha256={canonicalConvocatoriaAttachment.file_hash}
                documentHash={canonicalConvocatoriaAttachment.file_hash_sha512 ?? undefined}
                documentLabel={canonicalConvocatoriaAttachment.file_name}
                documentMimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                documentTipo="DOCUMENTO_GENERADO"
                supportingAttachments={supportingConvocatoriaAttachments}
                canonicalRecipients={canonicalRecipients}
                asunto={`Convocatoria · ${conv.body_name ?? "órgano"}${conv.fecha_1 ? ` · ${conv.fecha_1.slice(0, 10)}` : ""}`}
                cuerpoHtml={reviewedConvocatoriaText ?? convocatoriaFallback}
                onProgramado={async (_communicationId, result) => {
                  setCommunicationOpen(false);
                  await refetchCommunication();
                  if (result.estado === "BORRADOR") {
                    toast.success("Comunicación sandbox preparada en borrador", {
                      description: "Sin programación, sin envío y sin interacción con proveedor.",
                    });
                  } else {
                    toast.success("Comunicación vinculada y programada", {
                      description: "Pendiente de confirmación real del proveedor.",
                    });
                  }
                }}
                onCancel={() => setCommunicationOpen(false)}
              />
            ) : (
              <div className="space-y-3">
                {demoSandboxOnly ? (
                  <p className="border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-subtle)] p-3 text-sm text-[var(--g-text-primary)]">
                    DOCX final verificado en servidor y reunión materializada. Puedes preparar el paquete sandbox como Borrador; la entrega real, el dispatcher y cualquier proveedor permanecen bloqueados.
                  </p>
                ) : (
                  <p className="text-sm text-[var(--g-text-secondary)]">
                    DOCX final verificado en servidor. La comunicación incorporará también {supportingConvocatoriaAttachments.length} documento(s) de soporte y fijará las FKs de convocatoria, reunión y cada adjunto.
                  </p>
                )}
                <button
                  type="button"
                  disabled={!conv.body_id || !conv.entity_id || isMeetingLoading || isLifecycleMeetingLoading || communicationLoading}
                  onClick={() => setCommunicationOpen(true)}
                  className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Send className="h-4 w-4" />
                  {demoSandboxOnly ? "Preparar comunicación sandbox" : "Programar comunicación"}
                </button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Reunión operativa" icon={CalendarPlus}>
            {effectiveMeeting ? (
              <>
                <KV label="Estado" value={statusLabel(effectiveMeeting.status)} />
                <KV label="Inicio" value={formatDateTime(effectiveMeeting.scheduled_start)} />
                <KV label="Tipo" value={bodyTypeLabel(effectiveMeeting.meeting_type)} />
                <button
                  type="button"
                  onClick={() => navigate(scope.createScopedTo(`/secretaria/reuniones/${effectiveMeeting.id}`))}
                  className="mt-3 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Abrir reunión
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--g-text-secondary)]">
                  Programa una reunión operativa desde esta convocatoria para cargar su orden del día, conservar el vínculo de origen y continuar con votación, acta, certificación y Acuerdo 360.
                </p>
                {!meetingValidation.ok ? (
                  <ul className="mt-3 space-y-1 text-xs text-[var(--status-warning)]">
                    {meetingValidation.reasons.map((reason) => (
                      <li key={reason}>· {scheduleReasonLabel(reason)}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </Card>

          <Card title="Trazabilidad" icon={Shield}>
            <KV label="Creada" value={new Date(conv.created_at).toLocaleString("es-ES")} />
            <KV label="Actualizada" value={new Date(conv.updated_at).toLocaleString("es-ES")} />
            <KV
              label="Inmutable desde"
              value={conv.immutable_at ? new Date(conv.immutable_at).toLocaleString("es-ES") : "—"}
            />
          </Card>
        </div>
      </div>

      <AlertDialog
        open={lifecycleDialogTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeLifecycleDialog();
        }}
      >
        <AlertDialogContent className="border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lifecycleDialogTarget === "CANCELADA"
                ? "Cancelar registro DEMO"
                : "Marcar rectificación"}
            </AlertDialogTitle>
            <AlertDialogDescription
              id="lifecycle-transition-description"
              className="text-[var(--g-text-secondary)]"
            >
              Indica el motivo de la transición. El texto, la fecha, la autoridad de
              referencia, el acto DEMO y el manifiesto se conservarán íntegros.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-2">
            <label
              htmlFor="lifecycle-transition-reason"
              className="text-sm font-medium text-[var(--g-text-primary)]"
            >
              Motivo
            </label>
            <textarea
              id="lifecycle-transition-reason"
              value={lifecycleReason}
              onChange={(event) => {
                const value = event.target.value;
                setLifecycleReason(value);
                if (lifecycleReasonError && value.trim().length >= 10) {
                  setLifecycleReasonError(null);
                }
              }}
              minLength={10}
              required
              autoFocus
              rows={4}
              aria-invalid={Boolean(lifecycleReasonError)}
              aria-describedby="lifecycle-transition-description lifecycle-transition-help lifecycle-transition-error"
              className="w-full resize-y border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
            <div className="flex items-start justify-between gap-3 text-xs">
              <p id="lifecycle-transition-help" className="text-[var(--g-text-secondary)]">
                Mínimo 10 caracteres.
              </p>
              <p
                id="lifecycle-transition-error"
                role={lifecycleReasonError ? "alert" : undefined}
                className="text-right text-[var(--status-error)]"
              >
                {lifecycleReasonError ?? ""}
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={transitionLifecycle.isPending}
              className="border-[var(--g-border-subtle)] bg-transparent text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] hover:text-[var(--g-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </AlertDialogCancel>
            <button
              type="button"
              disabled={transitionLifecycle.isPending}
              aria-busy={transitionLifecycle.isPending}
              onClick={() => {
                void transitionDemoLifecycle();
              }}
              className={lifecycleDialogTarget === "CANCELADA"
                ? "bg-[var(--status-error)] text-[var(--g-text-inverse)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                : "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"}
            >
              {transitionLifecycle.isPending
                ? "Registrando…"
                : lifecycleDialogTarget === "CANCELADA"
                  ? "Confirmar cancelación"
                  : "Confirmar rectificación"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-5 py-3">
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-4 text-sm last:mb-0">
      <span className="text-[var(--g-text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--g-text-primary)]">{value}</span>
    </div>
  );
}
