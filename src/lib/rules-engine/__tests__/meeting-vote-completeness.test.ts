import { describe, expect, it } from "vitest";
import { evaluateMeetingVoteCompleteness } from "../meeting-vote-completeness";

describe("evaluateMeetingVoteCompleteness", () => {
  it("exige voto expreso de cada votante no conflictuado", () => {
    const result = evaluateMeetingVoteCompleteness([
      { id: "a1", vote: "FAVOR" },
      { id: "a2", vote: "" },
    ]);

    expect(result.complete).toBe(false);
    expect(result.missing_vote_ids).toEqual(["a2"]);
  });

  it("permite excluir a un conflictuado si consta motivo", () => {
    const result = evaluateMeetingVoteCompleteness([
      { id: "a1", vote: "FAVOR" },
      { id: "conflict", vote: "", conflict_flag: true, conflict_reason: "Operacion vinculada" },
    ]);

    expect(result.complete).toBe(true);
    expect(result.missing_vote_ids).toEqual([]);
    expect(result.missing_conflict_reason_ids).toEqual([]);
  });

  it("marca el voto de conflictuado como ignorado y exige motivo", () => {
    const result = evaluateMeetingVoteCompleteness([
      { id: "conflict", vote: "FAVOR", conflict_flag: true, conflict_reason: "" },
    ]);

    expect(result.complete).toBe(false);
    expect(result.ignored_conflict_vote_ids).toEqual(["conflict"]);
    expect(result.missing_conflict_reason_ids).toEqual(["conflict"]);
  });
});
