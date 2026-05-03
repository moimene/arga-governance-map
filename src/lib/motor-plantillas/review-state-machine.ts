import type {
  ReviewState,
  ReviewStateTransitionInput,
  ReviewStateTransitionResult,
} from "./types";

const ALLOWED_TRANSITIONS: Record<ReviewState, ReviewState[]> = {
  DRAFT: ["PENDING_REVIEW", "ARCHIVED"],
  PENDING_REVIEW: ["IN_REVIEW", "REJECTED", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "REJECTED", "PENDING_REVIEW", "ARCHIVED"],
  APPROVED: ["PROMOTED", "REJECTED", "ARCHIVED"],
  PROMOTED: ["ARCHIVED"],
  ARCHIVED: [],
  REJECTED: ["REGENERATION_NEEDED", "ARCHIVED"],
  REGENERATION_NEEDED: ["DRAFT", "ARCHIVED"],
};

const REASON_REQUIRED = new Set<ReviewState>([
  "REJECTED",
  "REGENERATION_NEEDED",
  "ARCHIVED",
]);

function isoDate(value?: string | Date) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function transitionReviewState(
  input: ReviewStateTransitionInput,
): ReviewStateTransitionResult {
  const allowed = ALLOWED_TRANSITIONS[input.from] ?? [];
  if (!allowed.includes(input.to)) {
    return {
      ok: false,
      from: input.from,
      to: input.to,
      issue: `Transicion no permitida: ${input.from} -> ${input.to}.`,
    };
  }

  const reason = input.reason?.trim() || null;
  if (REASON_REQUIRED.has(input.to) && !reason) {
    return {
      ok: false,
      from: input.from,
      to: input.to,
      issue: `La transicion a ${input.to} requiere reason.`,
    };
  }

  return {
    ok: true,
    from: input.from,
    to: input.to,
    event: {
      from: input.from,
      to: input.to,
      actor_id: input.actorId ?? null,
      reason,
      at: isoDate(input.at),
      metadata: input.metadata ?? {},
    },
  };
}

export function allowedReviewStateTransitions(from: ReviewState): ReviewState[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}
