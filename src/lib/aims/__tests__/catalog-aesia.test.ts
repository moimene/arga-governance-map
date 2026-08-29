import { describe, it, expect } from "bun:test";
import {
  AESIA_RIA_REQUIREMENTS,
  ISO_42001_REQUIREMENTS,
  calculateAdaptationPlan,
  deriveDiagnosisStatus,
  computeAssessmentStats,
  getAllMeasuresForFramework,
} from "../catalog-aesia";

describe("AESIA Guía 16 Catalog & Conversion Engine", () => {
  it("should contain exactly 12 RIA requirements", () => {
    expect(AESIA_RIA_REQUIREMENTS.length).toBe(12);
  });

  it("should contain exactly 84 Medidas Guía (MG) across all 12 requirements", () => {
    const totalMGs = AESIA_RIA_REQUIREMENTS.reduce((sum, r) => sum + r.measures.length, 0);
    expect(totalMGs).toBe(84);
  });

  it("should verify each requirement has the correct number of MGs", () => {
    const counts: Record<string, number> = {};
    AESIA_RIA_REQUIREMENTS.forEach((r) => {
      counts[r.code] = r.measures.length;
    });

    expect(counts["QUALITY_MGMT"]).toBe(11);
    expect(counts["RISK_MGMT"]).toBe(9);
    expect(counts["HUMAN_OVERSIGHT"]).toBe(9);
    expect(counts["DATA_GOVERNANCE"]).toBe(10);
    expect(counts["TRANSPARENCY"]).toBe(11);
    expect(counts["ACCURACY"]).toBe(3);
    expect(counts["ROBUSTNESS"]).toBe(3);
    expect(counts["CYBERSECURITY"]).toBe(4);
    expect(counts["LOGGING"]).toBe(7);
    expect(counts["TECHNICAL_DOC"]).toBe(7);
    expect(counts["POST_MARKET"]).toBe(5);
    expect(counts["INCIDENT_MGMT"]).toBe(5);
  });

  it("should correctly derive Adaptation Plans (PDA) according to Guía 16 rules", () => {
    // L1, L2 -> Plan 01 (Documentar e Implementar)
    expect(calculateAdaptationPlan("L1").code).toBe("01");
    expect(calculateAdaptationPlan("L2").code).toBe("01");

    // L3, L4 -> Plan 02 (Implementar)
    expect(calculateAdaptationPlan("L3").code).toBe("02");
    expect(calculateAdaptationPlan("L4").code).toBe("02");

    // L5 -> Plan 03 (Adaptación Completa)
    expect(calculateAdaptationPlan("L5").code).toBe("03");

    // L6, L7 -> Plan 04 (Documentar)
    expect(calculateAdaptationPlan("L6").code).toBe("04");
    expect(calculateAdaptationPlan("L7").code).toBe("04");

    // L8 -> Plan 05 (Ninguna acción)
    expect(calculateAdaptationPlan("L8").code).toBe("05");

    // Unassigned or invalid
    expect(calculateAdaptationPlan(null).code).toBe("00");
    expect(calculateAdaptationPlan(undefined).code).toBe("00");
    expect(calculateAdaptationPlan("INVALID").code).toBe("00");
  });

  it("should correctly derive diagnosis status", () => {
    expect(deriveDiagnosisStatus("L5")).toBe("01");
    expect(deriveDiagnosisStatus("L1")).toBe("01");
    expect(deriveDiagnosisStatus("")).toBe("00");
    expect(deriveDiagnosisStatus(null)).toBe("00");
    expect(deriveDiagnosisStatus(undefined)).toBe("00");
  });

  it("should calculate assessment statistics and maturity score correctly", () => {
    const allMeasures = getAllMeasuresForFramework("EU_AI_ACT");
    expect(allMeasures.length).toBe(84);

    // Scenario 1: Empty assessments
    const emptyStats = computeAssessmentStats(allMeasures, {});
    expect(emptyStats.totalMeasures).toBe(84);
    expect(emptyStats.diagnosedCount).toBe(0);
    expect(emptyStats.pendingCount).toBe(84);
    expect(emptyStats.maturityScore).toBe(0);

    // Scenario 2: Half L5 (conforming) and half L1 (gap)
    const mixedMap: Record<string, { maturity: string }> = {};
    allMeasures.slice(0, 42).forEach((m) => {
      mixedMap[m.id] = { maturity: "L5" };
    });
    allMeasures.slice(42).forEach((m) => {
      mixedMap[m.id] = { maturity: "L1" };
    });

    const mixedStats = computeAssessmentStats(allMeasures, mixedMap);
    expect(mixedStats.diagnosedCount).toBe(84);
    expect(mixedStats.pendingCount).toBe(0);
    expect(mixedStats.planCounts["03"]).toBe(42);
    expect(mixedStats.planCounts["01"]).toBe(42);
    expect(mixedStats.maturityScore).toBe(50);
    expect(mixedStats.hasGaps).toBe(true);
  });
});
