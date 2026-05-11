export type AgendaItemKind = "INFORMATIVO" | "DELIBERATIVO" | "DECISORIO";
export type AgendaDecisionSubtype = "CONSTITUTIVE" | "RATIFICATORY" | "ELEVATION" | "ACKNOWLEDGEMENT";
export type ResolutionKind = "DECISION" | "DELIBERATION_OUTCOME" | "INFORMATION_NOTED";

const VALID_KINDS = new Set<AgendaItemKind>(["INFORMATIVO", "DELIBERATIVO", "DECISORIO"]);

export function normalizeAgendaItemKind(value: unknown): AgendaItemKind {
  if (typeof value !== "string") return "DELIBERATIVO";
  const upper = value.toUpperCase().trim();
  return VALID_KINDS.has(upper as AgendaItemKind) ? (upper as AgendaItemKind) : "DELIBERATIVO";
}

export function isDecisionAgendaItem(kind: AgendaItemKind): boolean {
  return kind === "DECISORIO";
}

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
