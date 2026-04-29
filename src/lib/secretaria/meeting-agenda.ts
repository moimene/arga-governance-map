import type { MateriaClase } from "@/lib/rules-engine";

export type AgendaPointOrigin =
  | "PREPARED_AGREEMENT"
  | "MEETING_AGENDA"
  | "CONVOCATORIA"
  | "MEETING_FLOOR";

export interface MeetingAgendaPoint {
  punto: string;
  notas: string;
  materia: string;
  tipo: MateriaClase;
  origin: AgendaPointOrigin;
  source_table?: string | null;
  source_id?: string | null;
  source_index?: number | null;
  agreement_id?: string | null;
  group_campaign_id?: string | null;
  group_campaign_step?: string | null;
}

export interface MeetingAgendaItemSource {
  id?: string | null;
  order_number?: number | null;
  title?: string | null;
  description?: string | null;
  type?: string | null;
}

export interface ConvocatoriaAgendaItemSource {
  titulo?: string | null;
  title?: string | null;
  descripcion?: string | null;
  description?: string | null;
  materia?: string | null;
  tipo?: string | null;
  inscribible?: boolean | null;
}

export interface PreparedAgreementSource {
  id: string;
  agreement_kind?: string | null;
  matter_class?: string | null;
  proposal_text?: string | null;
  compliance_snapshot?: Record<string, unknown> | null;
  compliance_explain?: Record<string, unknown> | null;
}

export interface MergeMeetingAgendaSourcesInput {
  savedDebates?: unknown[] | null;
  agendaItems?: MeetingAgendaItemSource[] | null;
  convocatoriaId?: string | null;
  convocatoriaItems?: ConvocatoriaAgendaItemSource[] | null;
  preparedAgreements?: PreparedAgreementSource[] | null;
}

export const AGENDA_ORIGIN_LABELS: Record<AgendaPointOrigin, string> = {
  PREPARED_AGREEMENT: "Propuesta preparada",
  MEETING_AGENDA: "Agenda de reunión",
  CONVOCATORIA: "Convocatoria",
  MEETING_FLOOR: "Nacido en sesión",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMateriaClase(value: unknown): MateriaClase {
  const raw = String(value ?? "").toUpperCase();
  if (raw === "ESTATUTARIA") return "ESTATUTARIA";
  if (raw === "ESTRUCTURAL") return "ESTRUCTURAL";
  if (raw === "ESPECIAL") return "ESPECIAL";
  return "ORDINARIA";
}

function defaultMateriaForTitle(title: string) {
  const raw = title.toUpperCase();
  if (raw.includes("ESTATUT")) return "MODIFICACION_ESTATUTOS";
  if (raw.includes("CAPITAL")) return "AUMENTO_CAPITAL";
  if (raw.includes("AUDITOR")) return "NOMBRAMIENTO_AUDITOR";
  if (raw.includes("DIVIDENDO") || raw.includes("RESULTADO")) return "DISTRIBUCION_DIVIDENDOS";
  if (raw.includes("CONSEJ") || raw.includes("CARGO")) return "NOMBRAMIENTO_CONSEJERO";
  return "APROBACION_CUENTAS";
}

function materiaClaseFromMateria(materia: string): MateriaClase {
  if (["MODIFICACION_ESTATUTOS", "AUMENTO_CAPITAL"].includes(materia)) return "ESTATUTARIA";
  if (["FUSION", "ESCISION", "DISOLUCION", "AUTORIZACION_GARANTIA"].includes(materia)) {
    return "ESTRUCTURAL";
  }
  return "ORDINARIA";
}

function firstLine(value?: string | null) {
  return value?.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

function titleKey(title: string) {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sourceKey(point: Pick<MeetingAgendaPoint, "source_table" | "source_id" | "source_index" | "agreement_id" | "punto">) {
  if (point.agreement_id) return `agreement:${point.agreement_id}`;
  if (point.source_table && point.source_id) {
    return `${point.source_table}:${point.source_id}:${point.source_index ?? ""}`;
  }
  return `title:${titleKey(point.punto)}`;
}

function normalizePoint(point: Partial<MeetingAgendaPoint>): MeetingAgendaPoint {
  const title = point.punto?.trim() || "Acuerdo de la sesión";
  const materia = point.materia ?? defaultMateriaForTitle(title);
  return {
    punto: title,
    notas: point.notas ?? "",
    materia,
    tipo: point.tipo ?? materiaClaseFromMateria(materia),
    origin: point.origin ?? "MEETING_FLOOR",
    source_table: point.source_table ?? null,
    source_id: point.source_id ?? null,
    source_index: point.source_index ?? null,
    agreement_id: point.agreement_id ?? null,
    group_campaign_id: point.group_campaign_id ?? null,
    group_campaign_step: point.group_campaign_step ?? null,
  };
}

function normalizeSavedDebate(value: unknown): MeetingAgendaPoint | null {
  if (!isRecord(value)) return null;
  const title = String(value.punto ?? value.title ?? "").trim();
  if (!title) return null;
    return normalizePoint({
      punto: title,
      notas: String(value.notas ?? value.notes ?? ""),
      materia: typeof value.materia === "string" ? value.materia : undefined,
      tipo: typeof value.tipo === "string" ? normalizeMateriaClase(value.tipo) : undefined,
    origin: typeof value.origin === "string" ? (value.origin as AgendaPointOrigin) : "MEETING_FLOOR",
    source_table: typeof value.source_table === "string" ? value.source_table : null,
    source_id: typeof value.source_id === "string" ? value.source_id : null,
    source_index: typeof value.source_index === "number" ? value.source_index : null,
    agreement_id: typeof value.agreement_id === "string" ? value.agreement_id : null,
    group_campaign_id: typeof value.group_campaign_id === "string" ? value.group_campaign_id : null,
    group_campaign_step: typeof value.group_campaign_step === "string" ? value.group_campaign_step : null,
  });
}

function sourcePoints(input: MergeMeetingAgendaSourcesInput): MeetingAgendaPoint[] {
  const points: MeetingAgendaPoint[] = [];

  (input.agendaItems ?? [])
    .slice()
    .sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0))
    .forEach((item, index) => {
      const title = item.title?.trim();
      if (!title) return;
      const materia = defaultMateriaForTitle(title);
      points.push(
        normalizePoint({
          punto: title,
          notas: item.description ?? "",
          materia,
          tipo: item.type ? normalizeMateriaClase(item.type) : materiaClaseFromMateria(materia),
          origin: "MEETING_AGENDA",
          source_table: "agenda_items",
          source_id: item.id ?? null,
          source_index: item.order_number ?? index + 1,
        })
      );
    });

  (input.convocatoriaItems ?? []).forEach((item, index) => {
    const title = (item.titulo ?? item.title ?? "").trim();
    if (!title) return;
    const materia = item.materia ?? defaultMateriaForTitle(title);
    points.push(
      normalizePoint({
        punto: title,
        notas: item.descripcion ?? item.description ?? "",
        materia,
        tipo: item.tipo ? normalizeMateriaClase(item.tipo) : materiaClaseFromMateria(materia),
        origin: "CONVOCATORIA",
        source_table: "convocatorias",
        source_id: input.convocatoriaId ?? null,
        source_index: index + 1,
      })
    );
  });

  (input.preparedAgreements ?? []).forEach((agreement, index) => {
    const title = firstLine(agreement.proposal_text) || agreement.agreement_kind || "Propuesta preparada";
    const materia = agreement.agreement_kind ?? defaultMateriaForTitle(title);
    points.push(
      normalizePoint({
        punto: title,
        notas: agreement.proposal_text ?? "",
      materia,
      tipo: normalizeMateriaClase(agreement.matter_class ?? materiaClaseFromMateria(materia)),
      origin: "PREPARED_AGREEMENT",
      source_table: "agreements",
      source_id: agreement.id,
      source_index: index + 1,
      agreement_id: agreement.id,
      group_campaign_id:
        typeof agreement.compliance_snapshot?.campaign_id === "string"
          ? agreement.compliance_snapshot.campaign_id
          : null,
      group_campaign_step:
        typeof agreement.compliance_explain?.campaign_step === "string"
          ? agreement.compliance_explain.campaign_step
          : null,
      })
    );
  });

  return dedupeAgendaPoints(points);
}

function dedupeAgendaPoints(points: MeetingAgendaPoint[]) {
  const bySource = new Map<string, MeetingAgendaPoint>();
  const byTitle = new Map<string, MeetingAgendaPoint>();
  const out: MeetingAgendaPoint[] = [];

  for (const point of points) {
    const normalized = normalizePoint(point);
    const exactKey = sourceKey(normalized);
    const looseKey = titleKey(normalized.punto);
    const existing = bySource.get(exactKey) ?? byTitle.get(looseKey);
    if (existing) {
      if (!existing.agreement_id && normalized.agreement_id) existing.agreement_id = normalized.agreement_id;
      if (!existing.notas && normalized.notas) existing.notas = normalized.notas;
      if (!existing.group_campaign_id && normalized.group_campaign_id) existing.group_campaign_id = normalized.group_campaign_id;
      if (!existing.group_campaign_step && normalized.group_campaign_step) existing.group_campaign_step = normalized.group_campaign_step;
      if (existing.origin !== "PREPARED_AGREEMENT" && normalized.origin === "PREPARED_AGREEMENT") {
        existing.origin = normalized.origin;
        existing.source_table = normalized.source_table;
        existing.source_id = normalized.source_id;
      }
      continue;
    }
    out.push(normalized);
    bySource.set(exactKey, normalized);
    byTitle.set(looseKey, normalized);
  }

  return out;
}

export function mergeMeetingAgendaSources(input: MergeMeetingAgendaSourcesInput): MeetingAgendaPoint[] {
  const saved = (input.savedDebates ?? []).map(normalizeSavedDebate).filter(Boolean) as MeetingAgendaPoint[];
  const sourced = sourcePoints(input);
  if (saved.length === 0) return sourced;

  const bySource = new Map(sourced.map((point) => [sourceKey(point), point]));
  const byTitle = new Map(sourced.map((point) => [titleKey(point.punto), point]));
  const merged = saved.map((point) => {
    const source = bySource.get(sourceKey(point)) ?? byTitle.get(titleKey(point.punto));
    if (!source) return normalizePoint(point);
    return normalizePoint({
      ...source,
      ...point,
      agreement_id: point.agreement_id ?? source.agreement_id ?? null,
      source_table: point.source_table ?? source.source_table ?? null,
      source_id: point.source_id ?? source.source_id ?? null,
      source_index: point.source_index ?? source.source_index ?? null,
      origin: point.origin ?? source.origin,
      notas: point.notas || source.notas,
      group_campaign_id: point.group_campaign_id ?? source.group_campaign_id ?? null,
      group_campaign_step: point.group_campaign_step ?? source.group_campaign_step ?? null,
    });
  });

  const represented = new Set(merged.flatMap((point) => [sourceKey(point), titleKey(point.punto)]));
  const additions = sourced.filter((point) => !represented.has(sourceKey(point)) && !represented.has(titleKey(point.punto)));
  return [...merged, ...additions];
}

export function newSessionAgendaPoint(): MeetingAgendaPoint {
  return {
    punto: "",
    notas: "",
    materia: "APROBACION_CUENTAS",
    tipo: "ORDINARIA",
    origin: "MEETING_FLOOR",
    source_table: null,
    source_id: null,
    source_index: null,
    agreement_id: null,
    group_campaign_id: null,
    group_campaign_step: null,
  };
}
