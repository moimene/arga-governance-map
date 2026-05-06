import { describe, expect, it } from "vitest";
import {
  evaluateMeetingCensusAvailability,
  meetingCensusSourceForBodyType,
  normalizeMeetingCensusBodyKind,
  selectVotingCapitalHoldings,
} from "../meeting-census";

describe("meeting-census", () => {
  it("uses capital_holdings for Junta General census", () => {
    expect(meetingCensusSourceForBodyType("JUNTA_GENERAL")).toBe("capital_holdings");
    expect(meetingCensusSourceForBodyType("Junta General de Accionistas")).toBe("capital_holdings");
  });

  it("uses condiciones_persona for Consejo and delegated committees", () => {
    expect(normalizeMeetingCensusBodyKind("CONSEJO_ADMINISTRACION")).toBe("CONSEJO_ADMIN");
    expect(meetingCensusSourceForBodyType("CONSEJO_ADMINISTRACION")).toBe("condiciones_persona");
    expect(meetingCensusSourceForBodyType("COMISION_DELEGADA")).toBe("condiciones_persona");
  });

  it("reports CENSUS_EMPTY only when source rows and persisted attendees are both missing", () => {
    expect(evaluateMeetingCensusAvailability({ sourceCount: 0, existingAttendeesCount: 0 })).toEqual({
      ok: false,
      issue: "CENSUS_EMPTY",
    });
    expect(evaluateMeetingCensusAvailability({ sourceCount: 0, existingAttendeesCount: 2 })).toEqual({
      ok: true,
      issue: null,
    });
    expect(evaluateMeetingCensusAvailability({ sourceCount: 2, existingAttendeesCount: 0 })).toEqual({
      ok: true,
      issue: null,
    });
  });

  it("excludes treasury and no-vote holdings from Junta census", () => {
    const holdings = selectVotingCapitalHoldings([
      { id: "a", is_treasury: false, voting_rights: true, share_class: { voting_rights: true } },
      { id: "treasury", is_treasury: true, voting_rights: true, share_class: { voting_rights: true } },
      { id: "no-vote-holding", is_treasury: false, voting_rights: false, share_class: { voting_rights: true } },
      { id: "no-vote-class", is_treasury: false, voting_rights: true, share_class: { voting_rights: false } },
    ]);

    expect(holdings.map((holding) => holding.id)).toEqual(["a"]);
  });
});
