import type { AgendaItemKind } from "./agenda-kind";

export type UniversalMeetingModality = "PRESENCIAL" | "TELEMATICA" | "MIXTA";

export const UNIVERSAL_MEETING_INITIAL_STATUS = "DRAFT";

export interface UniversalMeetingBasicInput {
  tenantId: string;
  entityId: string;
  entityName?: string | null;
  bodyId: string;
  bodyName?: string | null;
  fecha: string;
  horaInicio: string;
  lugar: string;
  modalidad: UniversalMeetingModality;
  normativeSnapshot?: Record<string, unknown> | null;
}

export interface UniversalAgendaPointInput {
  numero: number;
  titulo: string;
  materia?: string | null;
  texto_acuerdo?: string | null;
  kind?: AgendaItemKind | null;
  agreement_id?: string | null;
}

export interface UniversalVotePointInput extends UniversalAgendaPointInput {
  votos_favor?: number | null;
  votos_contra?: number | null;
  abstenciones?: number | null;
  votos_nulos?: number | null;
  mayoria_descripcion?: string | null;
  rule_pack_ref?: string | null;
  proclamacion?: "APROBADO" | "RECHAZADO" | string | null;
}

export interface UniversalCapitalSummaryInput {
  capitalConcurrentePorcentaje: number;
  capitalConcurrenteImporte?: number | null;
  calculoCapitalRef?: string | null;
}

const UNIVERSAL_ACCEPTANCE_TEXT =
  "Todos los asistentes aceptan por unanimidad la celebración de la Junta y el orden del día propuesto, conforme al artículo 178 de la Ley de Sociedades de Capital.";

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function shortHash(value: unknown) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ju_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function universalMeetingStartIso(fecha: string, horaInicio: string) {
  return new Date(`${fecha}T${horaInicio || "00:00"}:00`).toISOString();
}

export function addUniversalMeetingHoursIso(value: string, hours: number) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function buildUniversalMeetingDedupHash(input: UniversalMeetingBasicInput) {
  return shortHash({
    tenant_id: input.tenantId,
    entity_id: input.entityId,
    body_id: input.bodyId,
    fecha: input.fecha,
    hora_inicio: input.horaInicio,
    lugar: input.lugar.trim(),
    modalidad: input.modalidad,
    es_universal: "SÍ",
  });
}

export function buildUniversalMeetingSlug(input: UniversalMeetingBasicInput, dedupHash: string) {
  const base = [
    "junta-universal",
    input.entityName ?? input.bodyName ?? "sociedad",
    input.fecha,
    dedupHash.replace(/^ju_/, ""),
  ]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `junta-universal-${dedupHash}`;
}

export function universalOrdenDiaResumen(points: UniversalAgendaPointInput[]) {
  return points
    .filter((point) => point.titulo.trim())
    .map((point) => `${point.numero}. ${point.titulo.trim()}`)
    .join(". ");
}

export function buildUniversalAgendaPoint(point: UniversalVotePointInput) {
  return {
    numero: point.numero,
    titulo: point.titulo,
    materia: point.materia ?? null,
    texto_acuerdo: point.texto_acuerdo ?? null,
    votos_favor: point.votos_favor ?? null,
    votos_contra: point.votos_contra ?? null,
    abstenciones: point.abstenciones ?? null,
    votos_nulos: point.votos_nulos ?? null,
    mayoria_descripcion: point.mayoria_descripcion ?? null,
    rule_pack_ref: point.rule_pack_ref ?? null,
    agreement_id: point.agreement_id ?? null,
    proclamacion: point.proclamacion ?? null,
    kind: point.kind ?? null,
  };
}

export function isUniversalMeetingQuorumData(quorumData?: Record<string, unknown> | null) {
  if (!quorumData) return false;
  const meetings = quorumData.meetings as Record<string, unknown> | undefined;
  const junta = meetings?.junta as Record<string, unknown> | undefined;
  return (
    quorumData.is_universal === true ||
    quorumData.junta_universal === true ||
    junta?.es_universal === "SÍ" ||
    junta?.es_universal === true
  );
}

export function buildUniversalMeetingQuorumData(input: UniversalMeetingBasicInput) {
  const dedupHash = buildUniversalMeetingDedupHash(input);
  return {
    is_universal: true,
    junta_universal: true,
    universal_intake: {
      schema_version: "junta-universal-intake.v1",
      dedup_hash: dedupHash,
      created_without_convocatoria: true,
      legal_basis: "art. 178 LSC",
    },
    meetings: {
      junta: {
        fecha: input.fecha,
        hora_inicio: input.horaInicio,
        hora_cierre: null,
        lugar: input.lugar,
        modalidad: input.modalidad,
        es_universal: "SÍ",
        canal_convocatoria: null,
        fecha_convocatoria: null,
        publicacion_ref: null,
        convocatoria_ordinal: null,
        fecha_segunda_convocatoria: null,
        hora_segunda_convocatoria: null,
        orden_del_dia_resumen: null,
        salvedades: null,
        modo_aprobacion_acta: null,
        puntos: [],
      },
    },
    rule_pack: {
      junta: {
        capital_concurrente_porcentaje: null,
        capital_concurrente_importe: null,
        calculo_capital_ref: null,
      },
      conflictos: {
        estado_resumen: "Pendiente de evaluación por punto",
      },
      pactos: {
        estado_resumen: "Pendiente de evaluación por punto",
      },
    },
    agreements: {
      convocatoria: null,
    },
    normative_snapshot: input.normativeSnapshot ?? null,
    normative_snapshot_id:
      typeof input.normativeSnapshot?.snapshot_id === "string"
        ? input.normativeSnapshot.snapshot_id
        : null,
    scheduled_from: {
      source: "junta_universal",
      convocatoria_id: null,
      statutory_basis: "art. 178 LSC",
      junta_universal: true,
    },
  };
}

export function patchUniversalCapitalSummary(
  quorumData: Record<string, unknown>,
  input: UniversalCapitalSummaryInput,
) {
  const currentRulePack = (quorumData.rule_pack ?? {}) as Record<string, unknown>;
  const currentJunta = (currentRulePack.junta ?? {}) as Record<string, unknown>;
  return {
    ...quorumData,
    rule_pack: {
      ...currentRulePack,
      junta: {
        ...currentJunta,
        capital_concurrente_porcentaje: input.capitalConcurrentePorcentaje,
        capital_concurrente_importe: input.capitalConcurrenteImporte ?? null,
        calculo_capital_ref: input.calculoCapitalRef ?? null,
      },
    },
  };
}

export function patchUniversalAgendaAcceptance(
  quorumData: Record<string, unknown>,
  points: UniversalAgendaPointInput[],
  capitalPresentePorcentaje: number,
  now = new Date().toISOString(),
) {
  const meetings = (quorumData.meetings ?? {}) as Record<string, unknown>;
  const junta = (meetings.junta ?? {}) as Record<string, unknown>;
  return {
    ...quorumData,
    meetings: {
      ...meetings,
      junta: {
        ...junta,
        orden_del_dia_resumen: universalOrdenDiaResumen(points),
        puntos: points.map(buildUniversalAgendaPoint),
      },
    },
    aceptacion_unanime_orden_dia: {
      confirmada: true,
      timestamp: now,
      capital_presente_porcentaje: capitalPresentePorcentaje,
      texto_legal: UNIVERSAL_ACCEPTANCE_TEXT,
    },
  };
}

export function universalAcceptanceText() {
  return UNIVERSAL_ACCEPTANCE_TEXT;
}
