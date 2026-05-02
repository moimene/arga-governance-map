import { patchQuorumDataSourceLinks } from "./meeting-links";

export interface ConvocatoriaForMeetingSchedule {
  id: string;
  tenant_id: string;
  body_id: string | null;
  body_name?: string | null;
  body_type?: string | null;
  entity_id?: string | null;
  entity_name?: string | null;
  estado: string;
  tipo_convocatoria?: string | null;
  fecha_1: string | null;
  fecha_2?: string | null;
  lugar?: string | null;
  modalidad?: string | null;
  statutory_basis?: string | null;
  agenda_items?: Array<{ titulo?: string; materia?: string; tipo?: string; inscribible?: boolean }> | null;
  rule_trace?: Record<string, unknown> | null;
  reminders_trace?: Record<string, unknown> | null;
}

export interface MeetingScheduleValidation {
  ok: boolean;
  reasons: string[];
}

export interface MeetingScheduleInsertPayload {
  tenant_id: string;
  body_id: string;
  slug: string;
  meeting_type: string;
  scheduled_start: string;
  scheduled_end: string;
  status: "CONVOCADA";
  location: string | null;
  confidentiality_level: "NORMAL";
  quorum_data: Record<string, unknown>;
}

function safeSlugPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeStart(value: string) {
  if (value.includes("T")) return value;
  return `${value}T10:00:00.000Z`;
}

function addHoursIso(value: string, hours: number) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function validateMeetingScheduleFromConvocatoria(
  convocatoria: ConvocatoriaForMeetingSchedule | null | undefined,
): MeetingScheduleValidation {
  const reasons: string[] = [];
  if (!convocatoria) reasons.push("convocatoria_missing");
  if (convocatoria && !convocatoria.body_id) reasons.push("body_id_missing");
  if (convocatoria && !convocatoria.fecha_1) reasons.push("fecha_1_missing");
  return { ok: reasons.length === 0, reasons };
}

export function meetingTypeFromConvocatoria(convocatoria: ConvocatoriaForMeetingSchedule) {
  const body = `${convocatoria.body_type ?? ""} ${convocatoria.body_name ?? ""}`.toUpperCase();
  if (body.includes("JUNTA") || body.includes("SOCIO")) return "JUNTA_GENERAL";
  if (body.includes("CONSEJO")) return "CONSEJO_ADMINISTRACION";
  return convocatoria.tipo_convocatoria ?? "REUNION_ORGANO";
}

export function buildMeetingScheduleFromConvocatoria(
  convocatoria: ConvocatoriaForMeetingSchedule,
): MeetingScheduleInsertPayload {
  const validation = validateMeetingScheduleFromConvocatoria(convocatoria);
  if (!validation.ok) {
    throw new Error(`No se puede programar la reunion: ${validation.reasons.join(", ")}`);
  }

  const scheduledStart = normalizeStart(convocatoria.fecha_1!);
  const agenda = Array.isArray(convocatoria.agenda_items) ? convocatoria.agenda_items : [];
  const slug = safeSlugPart([
    "convocatoria",
    convocatoria.entity_name ?? convocatoria.body_name ?? "organo",
    scheduledStart.slice(0, 10),
    convocatoria.id.slice(0, 8),
  ].join(" "));

  return {
    tenant_id: convocatoria.tenant_id,
    body_id: convocatoria.body_id!,
    slug,
    meeting_type: meetingTypeFromConvocatoria(convocatoria),
    scheduled_start: scheduledStart,
    scheduled_end: addHoursIso(scheduledStart, 2),
    status: "CONVOCADA",
    location: convocatoria.lugar ?? convocatoria.modalidad ?? null,
    confidentiality_level: "NORMAL",
    quorum_data: patchQuorumDataSourceLinks(
      {
        scheduled_from: {
          source: "convocatoria",
          convocatoria_id: convocatoria.id,
          estado_convocatoria: convocatoria.estado,
          statutory_basis: convocatoria.statutory_basis ?? null,
        },
        agenda_preview: agenda.map((item, index) => ({
          index: index + 1,
          titulo: item.titulo ?? "Punto del orden del dia",
          materia: item.materia ?? null,
          tipo: item.tipo ?? null,
          inscribible: Boolean(item.inscribible),
        })),
        trace: {
          rule_trace_present: Boolean(convocatoria.rule_trace),
          reminders_trace_present: Boolean(convocatoria.reminders_trace),
        },
      },
      {
        convocatoria_id: convocatoria.id,
        convocatoria_ids: [convocatoria.id],
        source: "explicit",
      },
    ),
  };
}
