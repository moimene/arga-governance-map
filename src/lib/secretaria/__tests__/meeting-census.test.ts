import { describe, expect, it } from "vitest";
import {
  evaluateMeetingCensusAvailability,
  meetingCensusSourceForBodyType,
  normalizeMeetingCensusBodyKind,
  selectVotingCapitalHoldings,
  computeVocalPersonIds,
  summarizeMeetingAttendance,
  votingRightsFromCapitalHolding,
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

  it("persists title-based voting rights instead of decimal capital percentages", () => {
    expect(votingRightsFromCapitalHolding({
      numero_titulos: 2_145_754_856,
      porcentaje_capital: 69.69,
      share_class: { votes_per_title: 1 },
    })).toBe(2_145_754_856);
    expect(votingRightsFromCapitalHolding({
      numero_titulos: "1250",
      share_class: { votes_per_title: "2" },
    })).toBe(2500);
  });

  it("rejects incomplete or non-numeric voting-right inputs", () => {
    expect(votingRightsFromCapitalHolding({ numero_titulos: null })).toBeNull();
    expect(votingRightsFromCapitalHolding({ numero_titulos: "not-a-number" })).toBeNull();
  });
});

describe("computeVocalPersonIds (ITEM-028/037)", () => {
  it("excluye al secretario no consejero y al letrado asesor del censo de vocales", () => {
    const vocal = computeVocalPersonIds([
      { person_id: "presidente", tipo_condicion: "PRESIDENTE" },
      { person_id: "consejero-1", tipo_condicion: "CONSEJERO" },
      { person_id: "secretaria", tipo_condicion: "SECRETARIO" },
      { person_id: "vicesecretario", tipo_condicion: "VICESECRETARIO" },
      { person_id: "letrado", tipo_condicion: "LETRADO_ASESOR" },
    ]);
    expect(vocal.has("presidente")).toBe(true);
    expect(vocal.has("consejero-1")).toBe(true);
    expect(vocal.has("secretaria")).toBe(false);
    expect(vocal.has("vicesecretario")).toBe(false);
    expect(vocal.has("letrado")).toBe(false);
  });

  it("un consejero-secretario sigue siendo vocal (dos condiciones, misma persona)", () => {
    const vocal = computeVocalPersonIds([
      { person_id: "consejero-secretario", tipo_condicion: "SECRETARIO" },
      { person_id: "consejero-secretario", tipo_condicion: "CONSEJERO" },
    ]);
    expect(vocal.has("consejero-secretario")).toBe(true);
  });

  it("el cargo de Presidente no crea un segundo asiento para la misma persona", () => {
    const vocal = computeVocalPersonIds([
      { person_id: "presidente", tipo_condicion: "CONSEJERO" },
      { person_id: "presidente", tipo_condicion: "PRESIDENTE" },
    ]);

    expect([...vocal]).toEqual(["presidente"]);
  });

  it("caso CdA ARGA: 8 consejeros presentes de 15 vocales constituyen aunque la secretaria no compute", () => {
    // 16 condiciones: 1 PRESIDENTE + 14 CONSEJERO + 1 SECRETARIO no consejera.
    const rows = [
      { person_id: "presidente", tipo_condicion: "PRESIDENTE" },
      ...Array.from({ length: 14 }, (_, i) => ({ person_id: `consejero-${i}`, tipo_condicion: "CONSEJERO" })),
      { person_id: "secretaria", tipo_condicion: "SECRETARIO" },
    ];
    const vocal = computeVocalPersonIds(rows);
    expect(vocal.size).toBe(15);
    // floor(15/2)+1 = 8: la secretaria puede asistir, pero no altera el denominador.
    const presentesVocales = 8;
    expect(presentesVocales >= Math.floor(vocal.size / 2) + 1).toBe(true);
  });
});

describe("summarizeMeetingAttendance", () => {
  it("reports 16/16 attendees while keeping the non-vocal secretary outside 15/15 quorum", () => {
    const rows = [
      ...Array.from({ length: 15 }, () => ({
        attendance_type: "PRESENCIAL",
        es_vocal: true,
      })),
      { attendance_type: "PRESENCIAL", es_vocal: false },
    ];

    expect(summarizeMeetingAttendance(rows, false)).toEqual({
      attending: 16,
      total: 16,
      absent: 0,
      quorumPresent: 15,
      quorumTotal: 15,
    });
  });

  it("keeps attendance and quorum aligned for Junta census", () => {
    expect(
      summarizeMeetingAttendance(
        [
          { attendance_type: "PRESENCIAL", es_vocal: true },
          { attendance_type: "REPRESENTADO", es_vocal: true },
          { attendance_type: "AUSENTE", es_vocal: true },
        ],
        true,
      ),
    ).toEqual({
      attending: 2,
      total: 3,
      absent: 1,
      quorumPresent: 2,
      quorumTotal: 3,
    });
  });
});
