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
  numero_titulos?: number | string | null;
  share_class?: {
    voting_rights?: boolean | null;
    votes_per_title?: number | string | null;
  } | null;
}

export interface MeetingAttendanceSummaryRow {
  attendance_type?: string | null;
  es_vocal?: boolean | null;
}

export interface MeetingAttendanceSummary {
  attending: number;
  total: number;
  absent: number;
  quorumPresent: number;
  quorumTotal: number;
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

/**
 * Condiciones que asisten con voz pero sin voto en órganos colegiados:
 * el secretario/vicesecretario no consejero y el letrado asesor no son
 * vocales — no computan en el quórum de constitución (arts. 247.1/247.2
 * LSC) ni en la mayoría de votación (art. 248.1 LSC).
 */
export const NON_VOCAL_CONDITION_TYPES = new Set([
  "SECRETARIO",
  "VICESECRETARIO",
  "LETRADO_ASESOR",
]);

/**
 * Devuelve el set de person_id que son vocales del órgano. Una persona es
 * vocal si tiene AL MENOS una condición vigente fuera de
 * NON_VOCAL_CONDITION_TYPES (un consejero-secretario sigue siendo vocal;
 * una secretaria no consejera no lo es).
 */
export function computeVocalPersonIds(
  rows: Array<{ person_id: string; tipo_condicion: string | null | undefined }>
): Set<string> {
  const vocal = new Set<string>();
  for (const row of rows) {
    const tipo = String(row.tipo_condicion ?? "").trim().toUpperCase();
    if (!NON_VOCAL_CONDITION_TYPES.has(tipo)) {
      vocal.add(row.person_id);
    }
  }
  return vocal;
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

/**
 * Las columnas `shares_represented` y `voting_rights` guardan títulos/votos,
 * no el porcentaje de capital. Mezclar ambos conceptos hacía que una posición
 * del 69,69 % intentase persistirse como `69.69` en un contador entero y
 * bloqueaba la celebración de Juntas. La regla soporta clases con más de un
 * voto por título y devuelve null ante datos incompletos o no numéricos.
 */
export function votingRightsFromCapitalHolding(holding: VotingCapitalHoldingLike): number | null {
  if (holding.numero_titulos === null || holding.numero_titulos === undefined || holding.numero_titulos === "") {
    return null;
  }
  const titles = Number(holding.numero_titulos);
  const votesPerTitle = Number(holding.share_class?.votes_per_title ?? 1);
  if (!Number.isFinite(titles) || !Number.isFinite(votesPerTitle)) return null;
  const votingRights = titles * votesPerTitle;
  if (!Number.isFinite(votingRights) || votingRights < 0) return null;
  return votingRights;
}

/**
 * Separa el recuento humano de asistencia del censo legal de quórum.
 *
 * En un órgano colegiado una secretaria no consejera puede asistir con voz y
 * sin voto. Debe figurar en la lista (16/16), aunque no entre en numerador ni
 * denominador del quórum (15/15). En Junta todos los rows del censo ya están
 * filtrados por derecho de voto y ambos recuentos coinciden.
 */
export function summarizeMeetingAttendance(
  rows: MeetingAttendanceSummaryRow[],
  isJuntaCensus: boolean,
): MeetingAttendanceSummary {
  const isPresent = (row: MeetingAttendanceSummaryRow) =>
    String(row.attendance_type ?? "PRESENCIAL").toUpperCase() !== "AUSENTE";
  const quorumRows = isJuntaCensus ? rows : rows.filter((row) => row.es_vocal !== false);
  const attending = rows.filter(isPresent).length;

  return {
    attending,
    total: rows.length,
    absent: rows.length - attending,
    quorumPresent: quorumRows.filter(isPresent).length,
    quorumTotal: quorumRows.length,
  };
}
