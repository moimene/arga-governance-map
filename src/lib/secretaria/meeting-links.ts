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

export function patchQuorumDataSourceLinks(quorumData: Record<string, unknown> | null | undefined, next: MeetingSourceLinks) {
  return {
    ...(quorumData ?? {}),
    source_links: mergeMeetingSourceLinks(quorumData, next),
  };
}
