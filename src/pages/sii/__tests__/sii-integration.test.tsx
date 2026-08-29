import { describe, expect, it } from "vitest";
import {
  computeWhistleblowingDeadlines,
  evaluateSubcasePerimeter,
  sanitizeMetadata,
  evaluateConflictOfInterest,
  evaluateAntiRetaliationRisk,
  validateCaseCloseoutGuard,
  generateLibroRegistroEntry,
} from "@/lib/sii/whistleblowing-engine";
import { INITIAL_SII_REPORTS } from "@/hooks/useWhistleblowing";

describe("SII Integration & Regulatory Compliance (Harvey Canal Denuncia Mandate)", () => {
  it("initial seed cases have valid structure, statutory clocks and autonomous subcases", () => {
    expect(INITIAL_SII_REPORTS.length).toBeGreaterThanOrEqual(3);

    for (const report of INITIAL_SII_REPORTS) {
      expect(report.id).toBeDefined();
      expect(report.code).toMatch(/^SII-\d{4}-\d{2}-\d{3}$/);
      expect(report.trackingToken).toMatch(/^SEC-[A-Z0-9]+-[A-Z0-9]+/);
      expect(report.subcases.length).toBeGreaterThan(0);
      expect(report.evidences.length).toBeGreaterThan(0);

      const deadlines = computeWhistleblowingDeadlines(
        report.intakeDate,
        report.acknowledgmentSentDate,
        report.extensionApproved
      );

      expect(deadlines.ackDeadline7d).toBeInstanceOf(Date);
      expect(deadlines.resolutionDeadline3m).toBeInstanceOf(Date);
      expect(deadlines.libroRetention10y).toBeInstanceOf(Date);
    }
  });

  it("handles multi-regime case: DORA + Penal + RGPD simultaneously", () => {
    const res = evaluateSubcasePerimeter({
      category: "Fraude y Ciberseguridad",
      summary: "Filtración masiva de datos personales por soborno a administrador de sistemas core TIC",
      detailedDescription: "Un empleado recibió comisión para desactivar controles DORA y extraer base de datos RGPD.",
      affectsPersonalData: true,
      affectsICT: true,
    });

    const regimes = res.subcasesToCreate.map((s) => s.regime);
    expect(regimes).toContain("PENAL_31BIS");
    expect(regimes).toContain("RGPD_BREACH");
    expect(regimes).toContain("DORA_ICT");
  });

  it("handles AI Act case with high risk algorithm bias", () => {
    const res = evaluateSubcasePerimeter({
      category: "Inteligencia Artificial",
      summary: "Discriminación algorítmica en cálculo de primas",
      detailedDescription: "El modelo de IA entrenado genera sesgo por género y estado de salud.",
      affectsAI: true,
    });

    const regimes = res.subcasesToCreate.map((s) => s.regime);
    expect(regimes).toContain("AIMS_AI");
    expect(res.subcasesToCreate.find((s) => s.regime === "AIMS_AI")?.authorityTarget).toContain("AESIA");
  });

  it("enforces closeout guard: blocks closure if subcase is open, allows when all closed", () => {
    const baseReport = { ...INITIAL_SII_REPORTS[0] };
    
    // Subexpedientes en instrucción -> canClose = false
    const guardBlocked = validateCaseCloseoutGuard(baseReport);
    expect(guardBlocked.canClose).toBe(false);
    expect(guardBlocked.openSubcasesCount).toBeGreaterThan(0);

    // Subexpedientes resueltos -> canClose = true
    const closedSubcases = baseReport.subcases.map((s) => ({
      ...s,
      status: "CERRADO" as const,
      closedAt: new Date().toISOString(),
      closingReason: "Resuelto favorablemente",
    }));

    const guardAllowed = validateCaseCloseoutGuard({
      ...baseReport,
      subcases: closedSubcases,
    });

    expect(guardAllowed.canClose).toBe(true);
    expect(guardAllowed.blockingReasons.length).toBe(0);
  });
});
