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
