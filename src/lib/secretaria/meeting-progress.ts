/**
 * Optimistic cache patch used after persisting quorum_data.
 *
 * The meeting stepper derives its gates from the `byId` query. Updating that
 * exact cache entry synchronously makes the newly confirmed quorum observable
 * in the same render; the subsequent invalidation still reconciles against the
 * database as source of truth.
 */
export function patchMeetingQuorumCache<T>(
  current: T,
  quorumData: Record<string, unknown>,
): T {
  if (typeof current !== "object" || current === null || Array.isArray(current)) {
    return current;
  }

  return {
    ...current,
    quorum_data: quorumData,
  } as T;
}
