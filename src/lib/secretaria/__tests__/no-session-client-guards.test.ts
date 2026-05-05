import { describe, expect, it } from "vitest";
import {
  buildVoteCounterUpdate,
  canMaterializeNoSessionAgreement,
  evaluateNoSessionResult,
  validateVoteWindow,
  type NoSessionVoteState,
} from "../no-session-client-guards";

const NOW = new Date("2026-05-04T12:00:00.000Z");

function state(patch: Partial<NoSessionVoteState> = {}): NoSessionVoteState {
  return {
    status: "VOTING_OPEN",
    requires_unanimity: true,
    votes_for: 0,
    votes_against: 0,
    abstentions: 0,
    total_members: 3,
    voting_deadline: "2026-05-05T12:00:00.000Z",
    ...patch,
  };
}

describe("no-session client guards", () => {
  it("bloquea voto si el plazo ha vencido o la votacion no esta abierta", () => {
    expect(validateVoteWindow(state({ status: "APROBADO" }), NOW)).toEqual({
      ok: false,
      reason: "Votación no activa",
    });
    expect(validateVoteWindow(state({ voting_deadline: "2026-05-04T11:59:59.000Z" }), NOW)).toEqual({
      ok: false,
      reason: "Plazo de votación vencido",
    });
  });

  it("rechaza automaticamente una unanimidad con voto en contra o abstencion", () => {
    const against = buildVoteCounterUpdate(state(), "AGAINST", NOW);
    const abstain = buildVoteCounterUpdate(state(), "ABSTAIN", NOW);

    expect(against.updates).toMatchObject({
      votes_against: 1,
      status: "RECHAZADO",
      closed_at: NOW.toISOString(),
    });
    expect(abstain.updates).toMatchObject({
      abstentions: 1,
      status: "RECHAZADO",
      closed_at: NOW.toISOString(),
    });
  });

  it("aprueba automaticamente unanimidad cuando el ultimo destinatario consiente", () => {
    const result = buildVoteCounterUpdate(state({ votes_for: 2, total_members: 3 }), "FOR", NOW);

    expect(result.ok).toBe(true);
    expect(result.updates).toMatchObject({
      votes_for: 3,
      status: "APROBADO",
      closed_at: NOW.toISOString(),
    });
  });

  it("no materializa aprobados desde estados incompatibles salvo que ya exista agreement", () => {
    expect(canMaterializeNoSessionAgreement({ resultado: "APROBADO", resolutionStatus: "RECHAZADO" })).toEqual({
      ok: false,
      reason: "No se puede materializar un acuerdo aprobado desde estado RECHAZADO.",
    });
    expect(canMaterializeNoSessionAgreement({
      resultado: "APROBADO",
      resolutionStatus: "RECHAZADO",
      existingAgreementId: "agreement-1",
    }).ok).toBe(true);
    expect(canMaterializeNoSessionAgreement({ resultado: "RECHAZADO", resolutionStatus: "VOTING_OPEN" }).ok).toBe(true);
  });

  it("evalua resultados sin sesion de forma compartida entre alta y detalle", () => {
    expect(evaluateNoSessionResult({
      votesFor: 3,
      votesAgainst: 0,
      abstentions: 0,
      totalMembers: 3,
      matterClass: "ORDINARIA",
      requiresUnanimity: true,
    }).aprobado).toBe(true);

    expect(evaluateNoSessionResult({
      votesFor: 2,
      votesAgainst: 1,
      abstentions: 0,
      totalMembers: 3,
      matterClass: "ORDINARIA",
      requiresUnanimity: true,
    }).aprobado).toBe(false);

    expect(evaluateNoSessionResult({
      votesFor: 2,
      votesAgainst: 1,
      abstentions: 0,
      totalMembers: 3,
      matterClass: "ESTRUCTURAL",
      requiresUnanimity: false,
    }).aprobado).toBe(false);
  });
});
