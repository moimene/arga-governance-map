import { describe, expect, it } from "vitest";
import {
  computeAttendanceWithDelegations,
  computeBoardRepresentation,
} from "../capital-voting";

describe("computeAttendanceWithDelegations — junta general", () => {
  it("acepta representación por poder escrito y computa capital del representado", () => {
    const result = computeAttendanceWithDelegations({
      holders: [
        { holder_id: "socio-a", capital: 60, present: true },
        { holder_id: "socio-b", capital: 40, present: false },
      ],
      delegations: [{ from_holder_id: "socio-b", to_representative_id: "socio-a", capital: 40, delegacion_tipo: "PODER_ESCRITO" }],
    });

    expect(result.concurrentCapital).toBe(100);
    expect(result.delegatedCapital).toBe(40);
    expect(result.votesByChannel.DELEGADO).toBe(40);
  });

  it("delegación electrónica computa en canal distancia", () => {
    const result = computeAttendanceWithDelegations({
      holders: [
        { holder_id: "representante", capital: 10, present: true, channel: "TELEMATICO" },
        { holder_id: "socio-b", capital: 30, present: false },
      ],
      delegations: [{ from_holder_id: "socio-b", to_representative_id: "representante", capital: 30, delegacion_tipo: "ELECTRONICA" }],
    });

    expect(result.concurrentCapital).toBe(40);
    expect(result.votesByChannel.TELEMATICO).toBe(10);
    expect(result.votesByChannel.DISTANCIA).toBe(30);
  });

  it("rechaza la cuarta representación si estatutos limitan a 3", () => {
    const result = computeAttendanceWithDelegations({
      holders: [
        { holder_id: "rep", capital: 1, present: true },
        ...Array.from({ length: 4 }, (_, index) => ({ holder_id: `socio-${index}`, capital: 10, present: false })),
      ],
      delegations: Array.from({ length: 4 }, (_, index) => ({
        from_holder_id: `socio-${index}`,
        to_representative_id: "rep",
        capital: 10,
        delegacion_tipo: "PODER_ESCRITO" as const,
      })),
      maxDelegationsPerRepresentative: 3,
    });

    expect(result.rejectedDelegations).toHaveLength(1);
    expect(result.concurrentCapital).toBe(31);
    expect(result.warnings).toContain("delegation_limit_exceeded:rep");
  });

  it("conflicto del representante excluye el voto delegado solo en el punto afectado", () => {
    const result = computeAttendanceWithDelegations({
      holders: [
        { holder_id: "rep", capital: 20, present: true },
        { holder_id: "socio-b", capital: 30, present: false },
      ],
      delegations: [{
        from_holder_id: "socio-b",
        to_representative_id: "rep",
        capital: 30,
        delegacion_tipo: "PODER_ESCRITO",
        conflictAgendaItemIds: ["punto-2"],
      }],
      agendaItemId: "punto-2",
    });

    expect(result.concurrentCapital).toBe(50);
    expect(result.adjustedVotingCapital).toBe(20);
    expect(result.conflictExcludedCapital).toBe(30);
  });

  it("asistencia personal revoca automáticamente el poder previo", () => {
    const result = computeAttendanceWithDelegations({
      holders: [
        { holder_id: "rep", capital: 20, present: true },
        { holder_id: "socio-b", capital: 30, present: true },
      ],
      delegations: [{ from_holder_id: "socio-b", to_representative_id: "rep", capital: 30, delegacion_tipo: "PODER_ESCRITO" }],
    });

    expect(result.revokedDelegations).toHaveLength(1);
    expect(result.concurrentCapital).toBe(50);
  });
});

describe("computeBoardRepresentation — consejo", () => {
  it("permite delegación entre consejeros y computa quórum", () => {
    const result = computeBoardRepresentation({
      totalMembers: 5,
      members: [
        { member_id: "c1", present: true },
        { member_id: "c2", present: true },
        { member_id: "c3", present: false, delegated_to: "c1" },
        { member_id: "c4", present: false },
        { member_id: "c5", present: false },
      ],
    });

    expect(result.quorumCount).toBe(3);
    expect(result.quorumReached).toBe(true);
  });

  it("rechaza representación de consejo a terceros no consejeros", () => {
    const result = computeBoardRepresentation({
      totalMembers: 3,
      members: [
        { member_id: "c1", present: true },
        { member_id: "c2", present: false, delegated_to: "tercero" },
        { member_id: "c3", present: false },
      ],
    });

    expect(result.rejectedDelegations).toEqual(["c2"]);
    expect(result.warnings[0]).toContain("board_delegation_to_non_director");
  });

  it("en cotizadas no computa delegación en materias indelegables", () => {
    const result = computeBoardRepresentation({
      totalMembers: 5,
      isListedCompany: true,
      indelegableMatter: true,
      members: [
        { member_id: "c1", present: true },
        { member_id: "c2", present: true },
        { member_id: "c3", present: false, delegated_to: "c1" },
        { member_id: "c4", present: false },
        { member_id: "c5", present: false },
      ],
    });

    expect(result.quorumCount).toBe(2);
    expect(result.quorumReached).toBe(false);
    expect(result.warnings).toContain("listed_board_indelegable_requires_personal_presence:c3");
  });
});
