import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MapPin, FileText, Paperclip, Shield, CalendarPlus } from "lucide-react";
import { useConvocatoriaById, useConvocatoriaAttachments } from "@/hooks/useConvocatorias";
import { useCreateMeetingFromConvocatoria, useMeetingForConvocatoria } from "@/hooks/useReunionSecretaria";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { ProcessDocxButton } from "@/components/secretaria/ProcessDocxButton";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { validateMeetingScheduleFromConvocatoria } from "@/lib/secretaria/meeting-scheduler";

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("es-ES") : "—";
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

type ConvocatoriaDocContext = {
  id: string;
  body_id?: string | null;
  entity_id?: string | null;
  tipo_convocatoria?: string | null;
  body_name?: string | null;
  body_type?: string | null;
  entity_name?: string | null;
  legal_form?: string | null;
  jurisdiction?: string | null;
  fecha_emision?: string | null;
  fecha_1?: string | null;
  fecha_2?: string | null;
  is_second_call?: boolean | null;
  lugar?: string | null;
  modalidad?: string | null;
  statutory_basis?: string | null;
  publication_channels?: string[] | null;
  agenda_items?: Array<{ titulo?: string; materia?: string; tipo?: string; inscribible?: boolean }> | null;
  reminders_trace?: Record<string, unknown> | null;
  rule_trace?: Record<string, unknown> | null;
  accepted_warnings?: Record<string, unknown>[] | null;
};

function agendaItems(conv: ConvocatoriaDocContext) {
  return Array.isArray(conv.agenda_items) ? conv.agenda_items : [];
}

function buildConvocatoriaVariables(conv: ConvocatoriaDocContext) {
  const agenda = Array.isArray(conv.agenda_items) ? conv.agenda_items : [];
  const fecha1 = conv.fecha_1 ? new Date(conv.fecha_1) : null;
  const emittedAt = conv.fecha_emision ?? new Date().toISOString();
  const horaJunta = fecha1
    ? fecha1.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const ruleContext = conv.rule_trace?.context as Record<string, unknown> | undefined;
  const ruleEvaluation = conv.rule_trace?.evaluation as Record<string, unknown> | undefined;
  const reminderTrace = conv.reminders_trace ?? {};
  const documents = (reminderTrace.documents as { missing_required?: Array<{ nombre?: string; document_name?: string }> } | undefined)?.missing_required ?? [];
  const channels = (reminderTrace.channels as { pending?: Array<{ label?: string; value?: string }> } | undefined)?.pending ?? [];
  const comprobaciones = [
    `Órgano convocante: ${conv.body_name ?? "órgano no informado"}`,
    `Canales seleccionados: ${(conv.publication_channels ?? []).join(", ") || "sin canales registrados"}`,
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
    denominacion_social: conv.entity_name ?? "Sociedad",
    cif: "No informado en demo",
    jurisdiccion: conv.jurisdiction ?? "",
    organo_convocante: conv.body_name ?? "Órgano",
    organo_tipo: conv.body_type ?? "",
    fecha: emittedAt,
    fecha_emision: emittedAt,
    fecha_junta: conv.fecha_1 ?? "—",
    hora: horaJunta,
    hora_junta: horaJunta,
    lugar: conv.lugar ?? "domicilio social",
    lugar_junta: conv.lugar ?? "domicilio social",
    ciudad: conv.lugar ?? "Madrid",
    modalidad: conv.modalidad ?? "—",
    destinatarios: "Personas legitimadas conforme a la ley, estatutos y, en su caso, pactos aplicables.",
    orden_dia: agenda.map((item, index) => ({
      ordinal: String(index + 1),
      descripcion_punto: item.titulo ?? "Punto del orden del día",
      tipo: item.tipo ?? "ORDINARIA",
      inscribible: !!item.inscribible,
    })),
    numero_convocatoria: conv.is_second_call ? "Segunda convocatoria" : "Primera convocatoria",
    requiere_segunda_convocatoria: conv.is_second_call ? "Sí" : "No",
    articulo_segunda_convocatoria: conv.is_second_call ? "Régimen estatutario y legal aplicable" : "No aplica",
    derecho_informacion: "Derecho de información disponible conforme a la normativa y estatutos aplicables.",
    plazo_informacion_dias: "Desde la publicación o notificación de la convocatoria.",
    documentacion_disponible: getTraceArray(conv.reminders_trace, "documents").length > 0,
    documentos_disponibles: [],
    documentos_adjuntos: [],
    canales_publicacion: conv.publication_channels ?? [],
    canal_notificacion: conv.publication_channels?.join(", ") ?? "—",
    statutory_basis: conv.statutory_basis ?? "—",
    advertencias_aceptadas: conv.accepted_warnings ?? [],
    comprobaciones,
    comprobaciones_texto: comprobaciones.join("\n"),
    resultado_gate: String(ruleEvaluation?.ok ?? ruleContext?.ok ?? "recordatorio"),
    resultado_evaluacion: "Convocatoria generada con alertas no bloqueantes y trazabilidad operativa.",
    snapshot_rule_pack_id: String(ruleContext?.rule_pack_id ?? ruleContext?.pack_id ?? "rule-pack-operativo-demo"),
    snapshot_rule_pack_version: String(ruleContext?.rule_pack_version ?? ruleContext?.version ?? "demo"),
    snapshot_hash: String(conv.rule_trace?.snapshot_hash ?? conv.rule_trace?.hash ?? "snapshot-operativo-demo"),
    tsq_token: "Pendiente de timestamp cualificado EAD Trust en entorno productivo",
    cargo_firmante: "Secretaría del órgano",
    firma: "Secretaría Societaria",
    firma_qes_ref: "Pendiente de QES productiva EAD Trust",
  };
}

function buildConvocatoriaFallback(conv: ConvocatoriaDocContext) {
  const variables = buildConvocatoriaVariables(conv);
  const agenda = variables.orden_dia;
  return [
    `CONVOCATORIA DE ${variables.tipo_junta_texto} DE ${variables.denominacion_social}`,
    "",
    `Órgano convocante: ${variables.organo_convocante}`,
    `Fecha de emisión: ${formatDateTime(conv.fecha_emision)}`,
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
  const selectedTemplate = (context as { selected_template?: unknown }).selected_template;
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
  const { data: attachments } = useConvocatoriaAttachments(id);
  const { data: scheduledMeeting, isLoading: isMeetingLoading } = useMeetingForConvocatoria(id, conv);
  const createMeetingFromConvocatoria = useCreateMeetingFromConvocatoria();

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

  const docVariables = buildConvocatoriaVariables(conv);
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

  const openOrScheduleMeeting = async () => {
    try {
      if (scheduledMeeting?.id) {
        navigate(scope.createScopedTo(`/secretaria/reuniones/${scheduledMeeting.id}`));
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
            Convocatoria · {statusLabel(conv.estado)}
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
            label={preferredConvocatoriaTemplateId ? "Convocatoria con plantilla" : "Convocatoria DOCX"}
            variant="primary"
            input={{
              kind: "CONVOCATORIA",
              recordId: conv.id,
              title: `Convocatoria de ${conv.body_name ?? "órgano"}`,
              subtitle: conv.entity_name ?? undefined,
              entityName: conv.entity_name,
              templateTypes: conv.legal_form?.toUpperCase().includes("SL")
                ? ["CONVOCATORIA_SL_NOTIFICACION", "CONVOCATORIA"]
                : ["CONVOCATORIA", "CONVOCATORIA_SL_NOTIFICACION"],
              variables: docVariables,
              templateCriteria: {
                jurisdiction: conv.jurisdiction,
                organoTipo: conv.body_type,
              },
              preferredTemplateId: preferredConvocatoriaTemplateId,
              fallbackText: convocatoriaFallback,
              filenamePrefix: "convocatoria",
            }}
          />
          <ProcessDocxButton
            label={preferredInformeTemplateId ? "Informe PRE con plantilla" : "Informe PRE"}
            input={{
              kind: "INFORME_PRECEPTIVO",
              recordId: conv.id,
              title: "Informe preceptivo documental",
              subtitle: conv.entity_name ?? undefined,
              entityName: conv.entity_name,
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
            disabled={!meetingValidation.ok || createMeetingFromConvocatoria.isPending || isMeetingLoading}
            aria-busy={createMeetingFromConvocatoria.isPending || isMeetingLoading}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <CalendarPlus className="h-4 w-4" />
            {scheduledMeeting ? "Abrir reunión" : "Programar reunión"}
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Datos de la convocatoria" icon={Calendar}>
            <KV label="Fecha de emisión" value={conv.fecha_emision ? new Date(conv.fecha_emision).toLocaleDateString("es-ES") : "—"} />
            <KV label="Fecha 1ª convocatoria" value={conv.fecha_1 ? new Date(conv.fecha_1).toLocaleString("es-ES") : "—"} />
            <KV label="Fecha 2ª convocatoria" value={conv.fecha_2 ? new Date(conv.fecha_2).toLocaleString("es-ES") : "—"} />
            <KV label="Modalidad" value={conv.modalidad ?? "—"} />
            <KV label="Junta universal" value={conv.junta_universal ? "Sí" : "No"} />
            <KV label="2ª convocatoria reforzada" value={conv.is_second_call ? "Sí" : "No"} />
            <KV label="Urgente" value={conv.urgente ? "Sí" : "No"} />
            <KV label="Fundamento estatutario" value={conv.statutory_basis ?? "—"} />
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
                      <span>{item.materia ?? "Materia sin clasificar"}</span>
                      <span>{item.tipo ?? "ORDINARIA"}</span>
                      {item.inscribible ? <span>Inscribible</span> : null}
                    </div>
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

          <Card title="Canales de publicación" icon={MapPin}>
            {conv.publication_channels && conv.publication_channels.length > 0 ? (
              <ul className="space-y-1 text-sm text-[var(--g-text-secondary)]">
                {conv.publication_channels.map((ch) => (
                  <li key={ch}>· {ch}</li>
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
            {attachments && attachments.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                    >
                      {a.file_name}
                    </a>
                    {a.file_hash ? (
                      <span className="ml-2 font-mono text-[11px] text-[var(--g-text-secondary)]">
                        {a.file_hash.slice(0, 12)}…
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-[var(--g-text-secondary)]">Sin adjuntos.</div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Reunión operativa" icon={CalendarPlus}>
            {scheduledMeeting ? (
              <>
                <KV label="Estado" value={statusLabel(scheduledMeeting.status)} />
                <KV label="Inicio" value={formatDateTime(scheduledMeeting.scheduled_start)} />
                <KV label="Tipo" value={scheduledMeeting.meeting_type} />
                <button
                  type="button"
                  onClick={() => navigate(scope.createScopedTo(`/secretaria/reuniones/${scheduledMeeting.id}`))}
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
