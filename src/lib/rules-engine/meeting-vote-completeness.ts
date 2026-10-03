export type MeetingVoteValue = "FAVOR" | "CONTRA" | "ABSTENCION" | "";

export interface MeetingVoteCompletenessRow {
  id: string;
  vote: MeetingVoteValue;
  conflict_flag?: boolean;
  conflict_reason?: string | null;
}

export interface MeetingVoteCompleteness {
  complete: boolean;
  missing_vote_ids: string[];
  missing_conflict_reason_ids: string[];
  ignored_conflict_vote_ids: string[];
}

export function evaluateMeetingVoteCompleteness(rows: MeetingVoteCompletenessRow[]): MeetingVoteCompleteness {
  const missingVoteIds: string[] = [];
  const missingConflictReasonIds: string[] = [];
  const ignoredConflictVoteIds: string[] = [];

  for (const row of rows) {
    const conflicted = row.conflict_flag === true;
    const hasVote = row.vote !== "";
    const hasConflictReason = !!row.conflict_reason?.trim();

    if (conflicted) {
      if (!hasConflictReason) missingConflictReasonIds.push(row.id);
      if (hasVote) ignoredConflictVoteIds.push(row.id);
      continue;
    }

    if (!hasVote) missingVoteIds.push(row.id);
  }

  return {
    complete: missingVoteIds.length === 0 && missingConflictReasonIds.length === 0,
    missing_vote_ids: missingVoteIds,
    missing_conflict_reason_ids: missingConflictReasonIds,
    ignored_conflict_vote_ids: ignoredConflictVoteIds,
  };
}

export interface MeetingVotePersistenceRow extends MeetingVoteCompletenessRow {
  /** `meeting_attendees.id`; null si el votante no está anclado a una persona. */
  attendee_id: string | null;
}

export interface MeetingVotePersistedRow {
  attendee_id: string | null;
  vote_value: Exclude<MeetingVoteValue, "">;
  conflict_flag: boolean;
  reason: string | null;
}

/**
 * Filas de `meeting_votes` que deben persistirse para un punto: una por cada
 * asiento con voto expreso Y una por cada asiento excluido por conflicto.
 *
 * H-54 (MOI-15, medido 2026-10-03 sobre la reunión `81a4de74…`): el criterio
 * de completitud de arriba da por completo a un votante con conflicto sin
 * voto (`vote: ""`), pero el envío filtraba `vote !== ""`, así que ese asiento
 * nunca llegaba a `meeting_votes`. El servidor (`fn_secretaria_server_resolution_
 * evaluation`, 20260720122000) exige exactamente una fila por asiento
 * concurrente y solo entonces lo descuenta como excluido —
 * `SERVER_VOTE_EXACTLY_ONE_VOTE_REQUIRED: attendee=… count=0`— y el acta
 * quedaba inalcanzable para cualquier reunión con un conflicto declarado. El
 * asiento excluido viaja como ABSTENCION con `conflict_flag` y motivo: el
 * servidor no lo computa en favor/contra/abstención, solo lo descuenta de la
 * base (art. 228.c LSC: deber de abstenerse).
 */
export function votesForPersistence(rows: readonly MeetingVotePersistenceRow[]): MeetingVotePersistedRow[] {
  const out: MeetingVotePersistedRow[] = [];
  for (const row of rows) {
    const conflicted = row.conflict_flag === true;
    if (!conflicted && row.vote === "") continue;
    out.push({
      attendee_id: row.attendee_id,
      vote_value: row.vote === "" ? "ABSTENCION" : row.vote,
      conflict_flag: conflicted,
      reason: row.conflict_reason?.trim() || null,
    });
  }
  return out;
}
