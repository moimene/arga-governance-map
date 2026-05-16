import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";
import {
  normalizeAgendaItemKind,
  normalizeAgendaReportAcceptanceVote,
  resolutionKindForAgendaItem,
  type AgendaItemKind,
  type AgendaItemResolutionKind,
  type AgendaReportAcceptanceVote,
} from "@/lib/rules-engine";

export interface ActaAgendaItemRow {
  id: string;
  meeting_id: string;
  order_number: number;
  title: string;
  description: string | null;
  kind?: string | null;
  requires_vote?: string | null;
  requires_attachments?: boolean | null;
  tenant_id: string;
  created_at?: string | null;
}

export interface ActaMeetingResolutionRow {
  id?: string | null;
  meeting_id: string;
  agenda_item_index: number | null;
  kind_resolution?: string | null;
  status?: string | null;
  resolution_text?: string | null;
  agreement_id?: string | null;
  required_majority_code?: string | null;
}

export interface ActaAgendaConstanciaRow {
  id: string;
  agenda_item_id: string;
  meeting_id: string;
  kind?: string | null;
  summary?: string | null;
  participants?: unknown;
  follow_ups?: unknown;
  attachments?: unknown;
}

export interface ActaAgreementRow {
  id: string;
  parent_meeting_id?: string | null;
  agenda_item_id?: string | null;
  status?: string | null;
}

export interface ActaVoteResult {
  favor: number;
  contra: number;
  abstenciones: number;
  enBlanco: number;
  excluidoConflicto: number;
  baseVoto: number;
  capitalPresente: number;
  capitalTotal: number;
}

export interface ActaDecisionViewModel {
  agreementId: string | null;
  proposedText: string;
  adoptedText: string;
  status: string | null;
  kindResolution: AgendaItemResolutionKind | null;
  voteResult: ActaVoteResult | null;
  majorityApplied: string | null;
  proclamation: string | null;
  snapshot: MeetingAdoptionSnapshot | null;
}

export interface ActaConstanciaViewModel {
  text: string;
  source: "EXPLICIT" | "AGENDA_DESCRIPTION" | "RESOLUTION" | "GENERATED";
  presentedBy?: string | null;
  participants: string[];
  followUps: Array<Record<string, unknown>>;
  attachments: Array<Record<string, unknown>>;
  acceptanceMode: "NONE" | "ASSENT" | "INDICATIVE";
}

export interface ActaAgendaItemViewModel {
  id: string;
  meeting_id: string;
  order_number: number;
  ordinal: number;
  title: string;
  description: string | null;
  kind: AgendaItemKind;
  requiresVote: AgendaReportAcceptanceVote;
  requiresAttachments: boolean;
  treatedAt?: string | null;
  expositionOrder: number;
  kind_resolution: AgendaItemResolutionKind | null;
  status: string | null;
  resolution_text: string | null;
  agreement_id: string | null;
  decisorio: ActaDecisionViewModel | null;
  constancia: ActaConstanciaViewModel | null;
}

export interface ActaAgendaViewModelInput {
  agendaItems: ActaAgendaItemRow[];
  resolutions?: ActaMeetingResolutionRow[];
  constancias?: ActaAgendaConstanciaRow[];
  snapshots?: MeetingAdoptionSnapshot[];
}

export interface ActaLegalStructureIssue {
  code: string;
  severity: "BLOCKING" | "WARNING";
  message: string;
  orderNumber?: number;
}

export interface ActaLegalStructureValidationResult {
  ok: boolean;
  blockingIssues: ActaLegalStructureIssue[];
  warnings: ActaLegalStructureIssue[];
}

export interface ActaLegalStructureValidationInput {
  meetingId: string;
  puntos: ActaAgendaItemViewModel[];
  agendaItems?: ActaAgendaItemRow[];
  agreementRows?: ActaAgreementRow[];
  renderedOrderNumbers?: number[];
}

const VALID_RESOLUTION_KINDS = new Set<AgendaItemResolutionKind>([
  "DECISION",
  "INFORMATION_NOTED",
  "ACKNOWLEDGEMENT_NOTED",
  "DELIBERATION_OUTCOME",
  "REPORT_ACCEPTED",
  "QUESTIONS_ANSWERS",
]);

function normalizeResolutionKind(value: unknown): AgendaItemResolutionKind | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase().trim();
  return VALID_RESOLUTION_KINDS.has(upper as AgendaItemResolutionKind)
    ? (upper as AgendaItemResolutionKind)
    : null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => {
        return typeof item === "object" && item !== null && !Array.isArray(item);
      })
    : [];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        return normalizeString(record.name ?? record.nombre ?? record.full_name ?? record.persona);
      }
      return "";
    })
    .filter(Boolean);
}

function voteResultForSnapshot(snapshot: MeetingAdoptionSnapshot | null): ActaVoteResult | null {
  if (!snapshot) return null;
  return {
    favor: snapshot.vote_summary.favor,
    contra: snapshot.vote_summary.contra,
    abstenciones: snapshot.vote_summary.abstenciones,
    enBlanco: snapshot.vote_summary.en_blanco,
    excluidoConflicto: snapshot.vote_summary.conflict_excluded,
    baseVoto: snapshot.vote_summary.voting_weight,
    capitalPresente: snapshot.vote_summary.present_weight,
    capitalTotal: snapshot.vote_summary.capital_total,
  };
}

function majorityForResolution(
  resolution: ActaMeetingResolutionRow | null,
  snapshot: MeetingAdoptionSnapshot | null,
) {
  return (
    normalizeString(resolution?.required_majority_code) ||
    normalizeString(snapshot?.rule_trace?.rule_pack_version) ||
    (snapshot?.societary_validity.majority_reached ? "Mayoría requerida alcanzada" : null)
  );
}

function proclamationForDecision(
  resolution: ActaMeetingResolutionRow | null,
  snapshot: MeetingAdoptionSnapshot | null,
) {
  const status = resolution?.status ?? snapshot?.status_resolucion ?? null;
  if (status === "ADOPTED") return "La Presidencia proclama aprobado el acuerdo.";
  if (status === "REJECTED") return "La Presidencia proclama no aprobado el acuerdo.";
  return null;
}

export function defaultConstanciaText(kind: AgendaItemKind, title: string) {
  if (kind === "INFORMATIVO") {
    return `Se presenta al órgano la información relativa a "${title}" y se deja constancia de que queda informado.`;
  }
  if (kind === "TOMA_DE_RAZON") {
    return `El órgano toma razón del hecho comunicado en el punto "${title}".`;
  }
  if (kind === "ACEPTACION_INFORME") {
    return `El órgano recibe el informe relativo a "${title}" y deja constancia de su aceptación u observaciones.`;
  }
  if (kind === "RUEGOS_PREGUNTAS") {
    return `Se recogen las intervenciones, ruegos, preguntas y compromisos relativos a "${title}".`;
  }
  return `Se deja constancia del debate mantenido sobre "${title}", sin adopción de acuerdo.`;
}

export function buildAgendaConstanciaSummary(params: {
  kind: AgendaItemKind | string | null | undefined;
  title: string;
  notes?: string | null;
}) {
  const explicitNotes = normalizeString(params.notes);
  if (explicitNotes) return explicitNotes;
  const kind = normalizeAgendaItemKind(params.kind ?? "DELIBERATIVO");
  return defaultConstanciaText(kind, params.title.trim() || "Punto sin título");
}

function acceptanceModeFor(kind: AgendaItemKind, requiresVote: AgendaReportAcceptanceVote) {
  if (kind !== "ACEPTACION_INFORME") return "NONE";
  if (requiresVote === "ASSENT") return "ASSENT";
  if (requiresVote === "BINDING") return "INDICATIVE";
  return "NONE";
}

function buildConstancia(params: {
  item: ActaAgendaItemRow;
  kind: AgendaItemKind;
  requiresVote: AgendaReportAcceptanceVote;
  resolution: ActaMeetingResolutionRow | null;
  constancia: ActaAgendaConstanciaRow | null;
}): ActaConstanciaViewModel {
  const explicit = normalizeString(params.constancia?.summary);
  const description = normalizeString(params.item.description);
  const resolutionText = normalizeString(params.resolution?.resolution_text);
  const text =
    explicit ||
    description ||
    resolutionText ||
    defaultConstanciaText(params.kind, params.item.title);

  return {
    text,
    source: explicit
      ? "EXPLICIT"
      : description
        ? "AGENDA_DESCRIPTION"
        : resolutionText
          ? "RESOLUTION"
          : "GENERATED",
    participants: asStringArray(params.constancia?.participants),
    followUps: asRecordArray(params.constancia?.follow_ups),
    attachments: asRecordArray(params.constancia?.attachments),
    acceptanceMode: acceptanceModeFor(params.kind, params.requiresVote),
  };
}

export function buildActaAgendaViewModel(input: ActaAgendaViewModelInput): ActaAgendaItemViewModel[] {
  const resolutionsByOrder = new Map<number, ActaMeetingResolutionRow>();
  for (const resolution of input.resolutions ?? []) {
    if (typeof resolution.agenda_item_index === "number") {
      resolutionsByOrder.set(resolution.agenda_item_index, resolution);
    }
  }

  const constanciasByItem = new Map<string, ActaAgendaConstanciaRow>();
  for (const constancia of input.constancias ?? []) {
    constanciasByItem.set(constancia.agenda_item_id, constancia);
  }

  const snapshotsByOrder = new Map<number, MeetingAdoptionSnapshot>();
  for (const snapshot of input.snapshots ?? []) {
    snapshotsByOrder.set(snapshot.agenda_item_index, snapshot);
  }

  return [...input.agendaItems]
    .sort((a, b) => a.order_number - b.order_number)
    .map((item, index) => {
      const kind = normalizeAgendaItemKind(item.kind ?? "DELIBERATIVO");
      const requiresVote =
        kind === "ACEPTACION_INFORME"
          ? normalizeAgendaReportAcceptanceVote(item.requires_vote)
          : "NONE";
      const resolution = resolutionsByOrder.get(item.order_number) ?? null;
      const snapshot = snapshotsByOrder.get(item.order_number) ?? null;
      const kindResolution = resolution
        ? normalizeResolutionKind(resolution.kind_resolution) ?? resolutionKindForAgendaItem(kind)
        : null;
      const agreementId = resolution?.agreement_id ?? snapshot?.agreement_id ?? null;
      const resolutionText = resolution?.resolution_text ?? snapshot?.resolution_text ?? null;
      const status = resolution?.status ?? snapshot?.status_resolucion ?? null;
      const decisorio =
        kind === "DECISORIO"
          ? {
              agreementId,
              proposedText: item.description ?? item.title,
              adoptedText: resolutionText ?? item.title,
              status,
              kindResolution,
              voteResult: voteResultForSnapshot(snapshot),
              majorityApplied: majorityForResolution(resolution, snapshot),
              proclamation: proclamationForDecision(resolution, snapshot),
              snapshot,
            }
          : null;
      const constancia =
        kind === "DECISORIO"
          ? null
          : buildConstancia({
              item,
              kind,
              requiresVote,
              resolution,
              constancia: constanciasByItem.get(item.id) ?? null,
            });

      return {
        id: item.id,
        meeting_id: item.meeting_id,
        order_number: item.order_number,
        ordinal: item.order_number,
        title: item.title,
        description: item.description,
        kind,
        requiresVote,
        requiresAttachments: item.requires_attachments === true,
        expositionOrder: index + 1,
        kind_resolution: kindResolution,
        status,
        resolution_text: resolutionText,
        agreement_id: agreementId,
        decisorio,
        constancia,
      };
    });
}

function sameNumberArray(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function addIssue(
  target: ActaLegalStructureIssue[],
  code: string,
  message: string,
  orderNumber?: number,
) {
  target.push({ code, severity: "BLOCKING", message, orderNumber });
}

export function validateActaLegalStructure(
  input: ActaLegalStructureValidationInput,
): ActaLegalStructureValidationResult {
  const blockingIssues: ActaLegalStructureIssue[] = [];
  const warnings: ActaLegalStructureIssue[] = [];
  const expectedOrder = [...(input.agendaItems ?? [])]
    .sort((a, b) => a.order_number - b.order_number)
    .map((item) => item.order_number);
  const renderedOrder = input.renderedOrderNumbers ?? input.puntos.map((point) => point.order_number);

  if (expectedOrder.length > 0 && !sameNumberArray(expectedOrder, renderedOrder)) {
    addIssue(
      blockingIssues,
      "minutes_order_mismatch",
      "El acta no respeta el orden del día de la reunión.",
    );
  }

  const uniqueOrders = new Set<number>();
  for (const point of input.puntos) {
    if (uniqueOrders.has(point.order_number)) {
      addIssue(
        blockingIssues,
        "duplicate_order_number",
        `El punto ${point.order_number} aparece duplicado en el acta.`,
        point.order_number,
      );
    }
    uniqueOrders.add(point.order_number);
  }

  const sortedOrders = [...uniqueOrders].sort((a, b) => a - b);
  for (let i = 0; i < sortedOrders.length; i += 1) {
    if (sortedOrders[i] !== i + 1) {
      addIssue(
        blockingIssues,
        "non_contiguous_order_number",
        "La numeración del acta contiene saltos o no empieza en 1.",
        sortedOrders[i],
      );
      break;
    }
  }

  const pointById = new Map(input.puntos.map((point) => [point.id, point]));
  for (const agreement of input.agreementRows ?? []) {
    if (!agreement.agenda_item_id || !pointById.has(agreement.agenda_item_id)) {
      addIssue(
        blockingIssues,
        "agreement_without_rendered_agenda_item",
        `El acuerdo ${agreement.id} de la reunión no está incluido bajo un punto del orden del día renderizado.`,
      );
      continue;
    }
    const point = pointById.get(agreement.agenda_item_id);
    if (point && point.kind !== "DECISORIO") {
      addIssue(
        blockingIssues,
        "agreement_under_non_decision_item",
        `El acuerdo ${agreement.id} está enlazado a un punto no decisorio.`,
        point.order_number,
      );
    }
  }

  for (const point of input.puntos) {
    if (point.kind === "DECISORIO") {
      if (point.status === "ADOPTED") {
        if (!point.decisorio?.voteResult) {
          addIssue(
            blockingIssues,
            "adopted_decision_without_vote_result",
            "El punto decisorio aprobado no tiene resultado de votación documentado.",
            point.order_number,
          );
        }
        if (!point.decisorio?.majorityApplied) {
          addIssue(
            blockingIssues,
            "adopted_decision_without_majority",
            "El punto decisorio aprobado no identifica la mayoría aplicada.",
            point.order_number,
          );
        }
        if (!point.decisorio?.proclamation) {
          addIssue(
            blockingIssues,
            "adopted_decision_without_proclamation",
            "El punto decisorio aprobado no contiene proclamación de la Presidencia.",
            point.order_number,
          );
        }
      }
      continue;
    }

    if (point.agreement_id || point.kind_resolution === "DECISION" || point.decisorio) {
      addIssue(
        blockingIssues,
        "non_decision_rendered_as_agreement",
        "Un punto no decisorio aparece renderizado como acuerdo.",
        point.order_number,
      );
    }

    if (!point.constancia?.text.trim()) {
      addIssue(
        blockingIssues,
        "non_decision_without_constancia",
        "El punto no decisorio no tiene constancia mínima para el acta.",
        point.order_number,
      );
    }
  }

  return {
    ok: blockingIssues.length === 0,
    blockingIssues,
    warnings,
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function buildCanonicalMinutesPayload(params: {
  meetingId: string;
  puntos: ActaAgendaItemViewModel[];
}) {
  return {
    schema_version: "canonical-minutes.v1",
    meeting_id: params.meetingId,
    agenda_items: params.puntos.map((point) => ({
      order_number: point.order_number,
      title: point.title,
      kind: point.kind,
      requires_vote: point.requiresVote,
      decision: point.decisorio
        ? {
            agreement_id: point.decisorio.agreementId,
            status: point.decisorio.status,
            adopted_text: point.decisorio.adoptedText,
            majority_applied: point.decisorio.majorityApplied,
            vote_result: point.decisorio.voteResult,
            proclamation: point.decisorio.proclamation,
          }
        : null,
      constancia: point.constancia
        ? {
            text: point.constancia.text,
            participants: point.constancia.participants,
            follow_ups: point.constancia.followUps,
            attachments: point.constancia.attachments,
            acceptance_mode: point.constancia.acceptanceMode,
          }
        : null,
    })),
  };
}

async function sha256Hex(input: string) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.subtle) {
    const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return `djb2-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function computeCanonicalMinutesHash(params: {
  meetingId: string;
  puntos: ActaAgendaItemViewModel[];
}) {
  return sha256Hex(canonicalJson(buildCanonicalMinutesPayload(params)));
}

export function renderActaAgendaItemsText(puntos: ActaAgendaItemViewModel[]) {
  return puntos
    .map((point) => {
      const lines = [`${point.order_number}. ${point.title}`];
      if (point.kind === "DECISORIO") {
        const status = point.status === "ADOPTED" ? "APROBADO" : point.status === "REJECTED" ? "RECHAZADO" : "PENDIENTE";
        lines.push(`   Resultado de votación: ${status}.`);
        if (point.decisorio?.majorityApplied) {
          lines.push(`   Mayoría aplicada: ${point.decisorio.majorityApplied}.`);
        }
        if (point.decisorio?.voteResult) {
          const vote = point.decisorio.voteResult;
          lines.push(
            `   Votos: a favor ${vote.favor}, en contra ${vote.contra}, abstenciones ${vote.abstenciones}, excluidos por conflicto ${vote.excluidoConflicto}.`,
          );
        }
        if (point.decisorio?.proclamation) {
          lines.push(`   ${point.decisorio.proclamation}`);
        }
        lines.push(`   Acuerdo adoptado: ${point.decisorio?.adoptedText ?? point.resolution_text ?? point.title}`);
      } else {
        lines.push(`   Constancia: ${point.constancia?.text ?? defaultConstanciaText(point.kind, point.title)}`);
        if (point.constancia?.acceptanceMode === "ASSENT") {
          lines.push("   La aceptación del informe queda documentada por asentimiento.");
        } else if (point.constancia?.acceptanceMode === "INDICATIVE") {
          lines.push("   La aceptación del informe queda documentada por votación indicativa, sin régimen de mayoría LSC.");
        }
      }
      return lines.join("\n");
    })
    .join("\n");
}
