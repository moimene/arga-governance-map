import type { MeetingAgendaPoint } from "./meeting-agenda";

export interface MeetingSourceLinks {
  convocatoria_id?: string | null;
  convocatoria_ids?: string[];
  group_campaign_id?: string | null;
  group_campaign_ids?: string[];
  agreement_ids?: string[];
  source?: "explicit" | "derived";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function extractMeetingSourceLinks(quorumData: unknown): MeetingSourceLinks {
  if (!isRecord(quorumData)) return {};
  const raw = quorumData.source_links;
  if (!isRecord(raw)) return {};

  const convocatoriaIds = Array.isArray(raw.convocatoria_ids)
    ? unique(raw.convocatoria_ids.map((value) => (typeof value === "string" ? value : null)))
    : [];
  const groupCampaignIds = Array.isArray(raw.group_campaign_ids)
    ? unique(raw.group_campaign_ids.map((value) => (typeof value === "string" ? value : null)))
    : [];
  const agreementIds = Array.isArray(raw.agreement_ids)
    ? unique(raw.agreement_ids.map((value) => (typeof value === "string" ? value : null)))
    : [];

  return {
    convocatoria_id: typeof raw.convocatoria_id === "string" ? raw.convocatoria_id : convocatoriaIds[0] ?? null,
    convocatoria_ids: convocatoriaIds,
    group_campaign_id: typeof raw.group_campaign_id === "string" ? raw.group_campaign_id : groupCampaignIds[0] ?? null,
    group_campaign_ids: groupCampaignIds,
    agreement_ids: agreementIds,
    source: raw.source === "derived" ? "derived" : raw.source === "explicit" ? "explicit" : undefined,
  };
}

/**
 * El emparejamiento legacy por órgano/fecha solo es admisible cuando la
 * reunión todavía no declara una convocatoria de origen. Si ya existe un
 * vínculo explícito o derivado, reutilizarla para otra convocatoria mezcla
 * expedientes distintos que simplemente coinciden en el calendario.
 */
export function canUseLegacyConvocatoriaFallback(
  quorumData: unknown,
  convocatoriaId: string,
) {
  const links = extractMeetingSourceLinks(quorumData);
  const linkedIds = unique([
    links.convocatoria_id,
    ...(links.convocatoria_ids ?? []),
  ]);

  return linkedIds.length === 0 || linkedIds.includes(convocatoriaId);
}

export function sourceLinksFromAgendaPoints(points: MeetingAgendaPoint[]): MeetingSourceLinks {
  const convocatoriaIds = unique(
    points.map((point) => (point.source_table === "convocatorias" ? point.source_id : null))
  );
  const groupCampaignIds = unique(points.map((point) => point.group_campaign_id));
  const agreementIds = unique(points.map((point) => point.agreement_id));

  return {
    convocatoria_id: convocatoriaIds[0] ?? null,
    convocatoria_ids: convocatoriaIds,
    group_campaign_id: groupCampaignIds[0] ?? null,
    group_campaign_ids: groupCampaignIds,
    agreement_ids: agreementIds,
    source: "derived",
  };
}

export function mergeMeetingSourceLinks(existing: unknown, next: MeetingSourceLinks) {
  const current = extractMeetingSourceLinks(existing);
  const convocatoriaIds = unique([
    ...(current.convocatoria_ids ?? []),
    current.convocatoria_id,
    ...(next.convocatoria_ids ?? []),
    next.convocatoria_id,
  ]);
  const groupCampaignIds = unique([
    ...(current.group_campaign_ids ?? []),
    current.group_campaign_id,
    ...(next.group_campaign_ids ?? []),
    next.group_campaign_id,
  ]);
  const agreementIds = unique([
    ...(current.agreement_ids ?? []),
    ...(next.agreement_ids ?? []),
  ]);

  return {
    convocatoria_id: next.convocatoria_id ?? current.convocatoria_id ?? convocatoriaIds[0] ?? null,
    convocatoria_ids: convocatoriaIds,
    group_campaign_id: next.group_campaign_id ?? current.group_campaign_id ?? groupCampaignIds[0] ?? null,
    group_campaign_ids: groupCampaignIds,
    agreement_ids: agreementIds,
    source: next.source ?? current.source ?? "derived",
  } satisfies MeetingSourceLinks;
}

// El retorno se DECLARA porque TypeScript no propaga la firma de indice a
// traves del spread: `{...unRecord}` produce un tipo sin claves conocidas, asi
// que el tipo inferido perdia todo lo que `quorum_data` ya traia. Es un jsonb
// con claves que este modulo no conoce y no debe borrar. Cambio de TIPO: el
// spread en ejecucion es exactamente el mismo.
export function patchQuorumDataSourceLinks(
  quorumData: Record<string, unknown> | null | undefined,
  next: MeetingSourceLinks,
): Record<string, unknown> & { source_links: unknown } {
  const base = (quorumData ?? {}) as Record<string, unknown>;
  const raw = base.source_links as { source?: unknown } | undefined;

  // Un vínculo `explicit` es la atadura AUTORITATIVA de la reunión a una
  // convocatoria EMITIDA, y el servidor la declara inmutable: el trigger
  // `fn_secretaria_guard_meeting_open_transition` rechaza con 42501
  // MEETING_CONVOCATION_BINDING_IMMUTABLE **cualquier** diferencia en
  // `quorum_data->source_links`, no solo un cambio de `source`.
  //
  // Aquí se reescribía siempre, y `sourceLinksFromAgendaPoints` devuelve
  // `source: "derived"` y acumula `agreement_ids`: dos diferencias. El UPDATE
  // ENTERO se caía, así que `point_snapshots` no llegaba nunca a una reunión
  // convocada. Consecuencia medida en Cloud el 2026-09-06: las reuniones
  // `derived` tienen snapshots y la vinculada `ac961a00-…` tiene 0 con 3
  // resoluciones — y sin snapshots `loadActaAgendaContract` no encuentra el
  // resultado de la votación, así que «Confirmar cierre y generar acta» queda
  // deshabilitado PARA SIEMPRE. El acta era inalcanzable en el camino que nace
  // de una convocatoria, que es el camino principal del módulo.
  //
  // No se pierde nada al no reescribirlo: al rechazarse el UPDATE completo, esa
  // acumulación nunca llegó a persistir en una reunión vinculada.
  if (raw && raw.source === "explicit") {
    return base as Record<string, unknown> & { source_links: unknown };
  }

  return {
    ...base,
    source_links: mergeMeetingSourceLinks(quorumData, next),
  };
}

/**
 * Si la reunión está ATADA a una convocatoria emitida. Es el mismo criterio con
 * el que `fn_secretaria_guard_emitted_agenda_dml` decide bloquear cualquier
 * DML directo sobre `agenda_items` (busca el vínculo en `source_links`,
 * `scheduled_from` o `agenda_binding` de `quorum_data`), y con el que
 * `fn_secretaria_guard_meeting_open_transition` declara inmutable la atadura.
 *
 * El cliente lo necesita para NO intentar lo que el servidor va a rechazar:
 * `handleSave` del paso 4 emitía un UPDATE de título/descripción/kind sobre la
 * agenda de una convocatoria emitida, el trigger lo tumbaba con
 * AGENDA_EMITIDA_RPC_REQUIRED y el guardado abortaba ANTES de persistir las
 * constancias — y sin constancias de los puntos no decisorios el acta es
 * inalcanzable («every non-decision point requires a persisted constancia»,
 * medido 2026-09-06 sobre ac961a00).
 */
export function isMeetingBoundToEmittedConvocation(
  quorumData: Record<string, unknown> | null | undefined,
): boolean {
  if (!quorumData) return false;
  const links = quorumData.source_links as { source?: unknown; convocatoria_id?: unknown } | undefined;
  if (links && links.source === "explicit" && typeof links.convocatoria_id === "string") return true;
  const scheduled = quorumData.scheduled_from as { source?: unknown; convocatoria_id?: unknown } | undefined;
  if (scheduled && scheduled.source === "convocatoria" && typeof scheduled.convocatoria_id === "string") return true;
  const binding = quorumData.agenda_binding as { convocatoria_id?: unknown } | undefined;
  return !!binding && typeof binding.convocatoria_id === "string";
}
