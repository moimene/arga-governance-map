import { describe, expect, it } from "vitest";
import { allowedReviewStateTransitions, transitionReviewState } from "../review-state-machine";

describe("review-state-machine", () => {
  it("permite el camino esperado hasta promocion", () => {
    expect(transitionReviewState({ from: "DRAFT", to: "PENDING_REVIEW" }).ok).toBe(true);
    expect(transitionReviewState({ from: "PENDING_REVIEW", to: "IN_REVIEW" }).ok).toBe(true);
    expect(transitionReviewState({ from: "IN_REVIEW", to: "APPROVED" }).ok).toBe(true);
    expect(transitionReviewState({ from: "APPROVED", to: "PROMOTED" }).ok).toBe(true);
  });

  it("bloquea transiciones invalidas y exige reason para rechazo", () => {
    expect(transitionReviewState({ from: "DRAFT", to: "PROMOTED" }).ok).toBe(false);
    expect(transitionReviewState({ from: "IN_REVIEW", to: "REJECTED" }).ok).toBe(false);
    expect(
      transitionReviewState({
        from: "IN_REVIEW",
        to: "REJECTED",
        reason: "Falta acuerdo certificado.",
      }).ok,
    ).toBe(true);
  });

  it("expone transiciones permitidas sin mutar la tabla interna", () => {
    const transitions = allowedReviewStateTransitions("REJECTED");
    transitions.push("PROMOTED");

    expect(allowedReviewStateTransitions("REJECTED")).toEqual(["REGENERATION_NEEDED", "ARCHIVED"]);
  });
});
