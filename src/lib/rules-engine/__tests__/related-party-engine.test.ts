import { describe, expect, it } from "vitest";
import {
  computeRelatedPartyCouncilExclusion,
  computeRelatedPartyShareholderVote,
  evaluateRelatedPartyOperation,
} from "../related-party-engine";

describe("related-party-engine", () => {
  it("operación >10% activos en cotizada exige informe previo de Comisión de Auditoría", () => {
    const result = evaluateRelatedPartyOperation({
      listedCompany: true,
      assetPct: 12,
      auditCommitteeReport: false,
    });

    expect(result.material).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain("related_party_audit_committee_report_missing");
  });

  it("giro ordinario y condiciones de mercado permite exención del procedimiento reforzado", () => {
    const result = evaluateRelatedPartyOperation({
      listedCompany: true,
      assetPct: 15,
      ordinaryCourse: true,
      marketTerms: true,
    });

    expect(result.exempt).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("acumula operaciones de 12 meses y activa umbral reforzado", () => {
    const result = evaluateRelatedPartyOperation({
      listedCompany: true,
      assetPct: 4,
      accumulatedPct12m: 11,
      auditCommitteeReport: true,
    });

    expect(result.material).toBe(true);
    expect(result.warnings).toContain("related_party_accumulated_12m_threshold");
  });

  it("consejero vinculado se excluye de deliberación y puede romper quórum", () => {
    const result = computeRelatedPartyCouncilExclusion({
      totalMembers: 7,
      presentMembers: 4,
      conflictedMembers: 1,
    });

    expect(result.deliberationMembers).toBe(3);
    expect(result.quorumReached).toBe(false);
    expect(result.blocking_issues).toContain("related_party_council_quorum_not_met_after_exclusion");
  });

  it("socio vinculado en junta no computa en mayoría del punto", () => {
    const result = computeRelatedPartyShareholderVote({
      capitalPresent: 70,
      linkedShareholderCapital: 30,
      votesFavor: 25,
    });

    expect(result.adjustedCapital).toBe(40);
    expect(result.majorityReached).toBe(true);
    expect(result.warnings).toContain("related_party_shareholder_capital_excluded");
  });
});
