import { describe, it, expect } from "bun:test";
import {
  calculateAdaptationPlan,
  deriveDiagnosisStatus,
  computeAssessmentStats,
  AESIA_RIA_REQUIREMENTS,
  ISO_42001_REQUIREMENTS,
  getAllMeasuresForFramework,
  getRequirementsForFramework,
} from "@/lib/aims/catalog-aesia";

describe("AI Governance / AIMS 360 Logic and Hook Contracts", () => {
  it("should provide full 12 requirements for EU_AI_ACT framework", () => {
    const reqs = getRequirementsForFramework("EU_AI_ACT");
    expect(reqs.length).toBe(12);
    expect(reqs[0].code).toBe("QUALITY_MGMT");
    expect(reqs[11].code).toBe("INCIDENT_MGMT");
  });

  it("should provide ISO 42001 requirements when framework is ISO_42001", () => {
    const reqs = getRequirementsForFramework("ISO_42001");
    expect(reqs.length).toBe(4);
    expect(reqs[0].code).toBe("ISO_POLICIES");
  });

  it("should calculate exact statistics for a fully compliant evaluation", () => {
    const measures = getAllMeasuresForFramework("EU_AI_ACT");
    const evalMap: Record<string, { maturity: string }> = {};
    measures.forEach((m) => {
      evalMap[m.id] = { maturity: "L5" };
    });

    const stats = computeAssessmentStats(measures, evalMap);
    expect(stats.totalMeasures).toBe(84);
    expect(stats.diagnosedCount).toBe(84);
    expect(stats.pendingCount).toBe(0);
    expect(stats.maturityScore).toBe(100);
    expect(stats.planCounts["03"]).toBe(84);
    expect(stats.hasGaps).toBe(false);
  });

  it("should calculate non-compliant evaluation statistics and flag Gaps for GRC handoff", () => {
    const measures = getAllMeasuresForFramework("EU_AI_ACT");
    const evalMap: Record<string, { maturity: string }> = {};
    measures.forEach((m, idx) => {
      evalMap[m.id] = { maturity: idx < 10 ? "L1" : "L5" };
    });

    const stats = computeAssessmentStats(measures, evalMap);
    expect(stats.diagnosedCount).toBe(84);
    expect(stats.planCounts["01"]).toBe(10);
    expect(stats.planCounts["03"]).toBe(74);
    expect(stats.hasGaps).toBe(true);
    expect(stats.gapMeasures.length).toBe(10);
  });
});
