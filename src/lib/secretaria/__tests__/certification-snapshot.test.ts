import { describe, expect, it } from "vitest";
import { buildCertificationPlan } from "../certification-snapshot";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";

function snapshot(overrides: Partial<MeetingAdoptionSnapshot>): MeetingAdoptionSnapshot {
  return {
    agenda_item_index: 1,
    resolution_text: "Aprobar acuerdo",
    materia: "APROBACION_CUENTAS",
    materia_clase: "ORDINARIA",
    status_resolucion: "ADOPTED",
    vote_summary: {
      favor: 60,
      contra: 40,
      abstenciones: 0,
      en_blanco: 0,
      conflict_excluded: 0,
      present_weight: 100,
      voting_weight: 100,
      capital_total: 100,
    },
    voters: [],
    societary_validity: {
      ok: true,
      severity: "OK",
      quorum_reached: true,
      majority_reached: true,
      agreement_proclaimable: true,
      statutory_veto_active: false,
      blocking_issues: [],
      warnings: [],
      explain: [],
      voting: {
        etapa: "VOTACION",
        ok: true,
        severity: "OK",
        explain: [],
        blocking_issues: [],
        warnings: [],
        acuerdoProclamable: true,
        mayoriaAlcanzada: true,
      },
    },
    pacto_compliance: {
      ok: true,
      severity: "OK",
      pactos_evaluados: 0,
      pactos_aplicables: 0,
      pactos_incumplidos: 0,
      blocking_issues: [],
      warnings: [],
      explain: [],
    },
    evaluated_at: "2026-04-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildCertificationPlan", () => {
  it("certifica solo snapshots societariamente proclamables", () => {
    const plan = buildCertificationPlan({
      meetingId: "meeting-1",
      quorumData: {
        point_snapshots: [
          snapshot({ agenda_item_index: 1 }),
          snapshot({
            agenda_item_index: 2,
            status_resolucion: "REJECTED",
            societary_validity: {
              ...snapshot({}).societary_validity,
              ok: false,
              blocking_issues: ["majority_not_achieved"],
            },
          }),
        ],
      },
      resolutions: [
        { id: "r1", agenda_item_index: 1, agreement_id: "agreement-1", resolution_text: "A", status: "ADOPTED" },
        { id: "r2", agenda_item_index: 2, agreement_id: "agreement-2", resolution_text: "B", status: "REJECTED" },
      ],
    });

    expect(plan.refs).toEqual(["agreement-1"]);
    expect(plan.agreementRefs).toEqual(["agreement-1"]);
    expect(plan.pointRefs).toHaveLength(0);
    expect(plan.requiresAgreementLink).toBe(false);
    expect(plan.evidenceReadiness).toBe("FINAL_READY");
    expect(plan.blockedSnapshots).toHaveLength(1);
    expect(plan.warnings).toContain("excluded_non_proclaimable_point_2");
  });

  it("usa referencia estable por punto si no existe agreement_id", () => {
    const plan = buildCertificationPlan({
      meetingId: "meeting-1",
      quorumData: { point_snapshots: [snapshot({ agenda_item_index: 3 })] },
      resolutions: [
        { id: "r3", agenda_item_index: 3, agreement_id: null, resolution_text: "C", status: "ADOPTED" },
      ],
    });

    expect(plan.refs).toEqual(["meeting:meeting-1:point:3"]);
    expect(plan.agreementRefs).toHaveLength(0);
    expect(plan.pointRefs).toEqual(["meeting:meeting-1:point:3"]);
    expect(plan.referenceDetails[0]).toMatchObject({
      agenda_item_index: 3,
      kind: "meeting_point",
      materializedAgreement: false,
    });
    expect(plan.requiresAgreementLink).toBe(true);
    expect(plan.evidenceReadiness).toBe("CERTIFIABLE_WITH_POINT_REFS");
    expect(plan.warnings).toContain("certifiable_point_without_agreement_id_3");
  });

  it("marca pactos como warning contractual, no como exclusion societaria", () => {
    const plan = buildCertificationPlan({
      meetingId: "meeting-1",
      quorumData: {
        point_snapshots: [
          snapshot({
            pacto_compliance: {
              ok: false,
              severity: "WARNING",
              pactos_evaluados: 1,
              pactos_aplicables: 1,
              pactos_incumplidos: 1,
              blocking_issues: ["PACTO INCUMPLIDO"],
              warnings: [],
              explain: [],
            },
          }),
        ],
      },
      resolutions: [
        { id: "r1", agenda_item_index: 1, agreement_id: "agreement-1", resolution_text: "A", status: "ADOPTED" },
      ],
    });

    expect(plan.refs).toEqual(["agreement-1"]);
    expect(plan.contractualWarnings).toHaveLength(1);
    expect(plan.blockedSnapshots).toHaveLength(0);
    expect(plan.evidenceReadiness).toBe("FINAL_READY");
  });

  it("bloquea plan nuevo sin point_snapshots", () => {
    const plan = buildCertificationPlan({
      meetingId: "meeting-1",
      quorumData: { quorum: { reached: true } },
      resolutions: [
        { id: "r1", agenda_item_index: 1, agreement_id: "agreement-1", resolution_text: "A", status: "ADOPTED" },
      ],
    });

    expect(plan.refs).toHaveLength(0);
    expect(plan.hasPointSnapshots).toBe(false);
    expect(plan.warnings).toContain("missing_point_snapshots");
    expect(plan.evidenceReadiness).toBe("BLOCKED");
  });
});
