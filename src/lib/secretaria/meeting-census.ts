export type MeetingCensusSource = "capital_holdings" | "condiciones_persona";

export type MeetingCensusBodyKind =
  | "JUNTA_GENERAL"
  | "CONSEJO_ADMIN"
  | "COMISION_DELEGADA"
  | "ORGANO_ADMIN";

export type MeetingCensusIssue = "CENSUS_EMPTY" | null;

export interface MeetingCensusAvailabilityInput {
  sourceCount: number;
  existingAttendeesCount?: number;
}

export interface MeetingCensusAvailability {
  ok: boolean;
  issue: MeetingCensusIssue;
}

export interface VotingCapitalHoldingLike {
  is_treasury?: boolean | null;
  voting_rights?: boolean | null;
  porcentaje_capital?: number | string | null;
  share_class?: {
    voting_rights?: boolean | null;
  } | null;
}

export function normalizeMeetingCensusBodyKind(value: unknown): MeetingCensusBodyKind {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw.includes("JUNTA")) return "JUNTA_GENERAL";
  if (raw.includes("COMISION") || raw.includes("COMIT")) return "COMISION_DELEGADA";
  if (raw.includes("CONSEJO") || raw.includes("CDA")) return "CONSEJO_ADMIN";
  return "ORGANO_ADMIN";
}

export function meetingCensusSourceForBodyType(value: unknown): MeetingCensusSource {
  return normalizeMeetingCensusBodyKind(value) === "JUNTA_GENERAL"
    ? "capital_holdings"
    : "condiciones_persona";
}

export function evaluateMeetingCensusAvailability(
  input: MeetingCensusAvailabilityInput
): MeetingCensusAvailability {
  const sourceCount = Number.isFinite(input.sourceCount) ? input.sourceCount : 0;
  const existingAttendeesCount = Number.isFinite(input.existingAttendeesCount ?? 0)
    ? input.existingAttendeesCount ?? 0
    : 0;
  const ok = sourceCount > 0 || existingAttendeesCount > 0;
  return {
    ok,
    issue: ok ? null : "CENSUS_EMPTY",
  };
}

export function selectVotingCapitalHoldings<T extends VotingCapitalHoldingLike>(holdings: T[]): T[] {
  return holdings.filter((holding) => {
    if (holding.is_treasury) return false;
    if (holding.voting_rights === false) return false;
    if (holding.share_class?.voting_rights === false) return false;
    if (holding.porcentaje_capital !== null && holding.porcentaje_capital !== undefined) {
      if (Number(holding.porcentaje_capital) <= 0) return false;
    }
    return true;
  });
}
