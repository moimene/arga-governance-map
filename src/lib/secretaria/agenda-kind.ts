import {
  normalizeAgendaItemKind,
  type AgendaItemKind,
} from "@/lib/rules-engine";

export {
  AGENDA_ITEM_KINDS,
  NON_DECISION_AGENDA_ITEM_KINDS,
  isDecisionAgendaItem,
  normalizeAgendaItemKind,
  normalizeAgendaReportAcceptanceVote,
  resolutionKindForAgendaItem,
  shouldRunAgreementGatesForAgendaItem,
} from "@/lib/rules-engine";
export type {
  AgendaDecisionSubtype,
  AgendaItemKind,
  AgendaReportAcceptanceVote,
  AgendaItemResolutionKind as ResolutionKind,
} from "@/lib/rules-engine";

export interface AgendaKindMerged {
  effective: AgendaItemKind;       // valor actual autoritative (P4 SSOT)
  snapshot: AgendaItemKind | null; // valor en snapshot de convocatoria (warning si drift)
  drift: boolean;
}

export function mergeAgendaKindSources(params: {
  fromTable: AgendaItemKind | null | undefined;
  fromConvocatoriaSnapshot: unknown;
}): AgendaKindMerged {
  const effective = normalizeAgendaItemKind(params.fromTable ?? "DELIBERATIVO");
  const snapshot = params.fromConvocatoriaSnapshot != null
    ? normalizeAgendaItemKind(params.fromConvocatoriaSnapshot)
    : null;
  return { effective, snapshot, drift: snapshot !== null && snapshot !== effective };
}
