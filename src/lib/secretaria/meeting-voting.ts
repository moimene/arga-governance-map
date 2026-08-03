/** Build persisted voting snapshots only for indices already classified as decisory. */
export function buildDecisionAgendaSnapshots<T>(
  decisionPointIndices: number[],
  buildSnapshot: (pointIndex: number) => T,
): T[] {
  return decisionPointIndices.map(buildSnapshot);
}

/** Non-decisory agenda points have no snapshot and therefore no voting matter. */
export function votingMatterFromSnapshot(
  snapshot?: { materia?: string | null } | null,
): string | null {
  return snapshot?.materia ?? null;
}
