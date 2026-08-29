import { describe, it, expect } from "bun:test";
import {
  computeDoraDeadlines,
  computeNis2Deadlines,
  computeGdprBreachDeadlines,
  computeDsarSla,
  evaluateEntityPerimeter,
  evaluateTprmConcentration,
  classifyDoraIncident,
} from "../regulatory-clocks";

describe("regulatory-clocks — DORA incident deadlines", () => {
  it("calculates initial deadline as max 4h from classification when classified within 24h", () => {
    const knowledge = new Date("2026-08-28T10:00:00Z");
    const classification = new Date("2026-08-28T12:00:00Z"); // 2h after knowledge

    const deadlines = computeDoraDeadlines(knowledge, classification);
    
    // 4h from classification = 16:00:00Z (before 24h from knowledge which would be 2026-08-29T10:00:00Z)
    expect(deadlines.initialNotificationDeadline.toISOString()).toBe("2026-08-28T16:00:00.000Z");
    // Intermediate is 72h from initial notification (16:00 + 72h = 2026-08-31T16:00:00Z)
    expect(deadlines.intermediateReportDeadline.toISOString()).toBe("2026-08-31T16:00:00.000Z");
    // Final is 1 month from intermediate
    expect(deadlines.finalReportDeadline.getMonth()).toBe((deadlines.intermediateReportDeadline.getMonth() + 1) % 12);
  });

  it("caps initial deadline at max 24h from knowledge even if classification happens at 22h", () => {
    const knowledge = new Date("2026-08-28T10:00:00Z");
    const classification = new Date("2026-08-29T08:00:00Z"); // 22h after knowledge

    const deadlines = computeDoraDeadlines(knowledge, classification);
    // 4h from classification would be 2026-08-29T12:00:00Z, but capped at 24h from knowledge: 2026-08-29T10:00:00Z
    expect(deadlines.initialNotificationDeadline.toISOString()).toBe("2026-08-29T10:00:00.000Z");
  });
});

describe("regulatory-clocks — NIS2 deadlines", () => {
  it("calculates 24h early warning and 72h notification", () => {
    const knowledge = new Date("2026-08-28T10:00:00Z");
    const deadlines = computeNis2Deadlines(knowledge);

    expect(deadlines.earlyWarningDeadline.toISOString()).toBe("2026-08-29T10:00:00.000Z");
    expect(deadlines.incidentNotificationDeadline.toISOString()).toBe("2026-08-31T10:00:00.000Z");
  });
});

describe("regulatory-clocks — GDPR Breach & DSAR SLA", () => {
  it("calculates 72h for authority notification and flags high risk subject notification", () => {
    const knowledge = new Date("2026-08-28T10:00:00Z");
    const deadlines = computeGdprBreachDeadlines(knowledge, true);

    expect(deadlines.authorityNotificationDeadline.toISOString()).toBe("2026-08-31T10:00:00.000Z");
    expect(deadlines.requiresSubjectCommunication).toBe(true);
  });

  it("calculates 1 calendar month DSAR SLA and handles 2 months extension", () => {
    const receipt = new Date("2026-01-15T00:00:00Z");
    const slaOrdinary = computeDsarSla(receipt, false);
    const slaExtended = computeDsarSla(receipt, true);

    expect(slaOrdinary.initialSlaDate.getMonth()).toBe(1); // February
    expect(slaExtended.effectiveDeadline.getMonth()).toBe(3); // April
  });
});

describe("regulatory-clocks — Perimeter Engine (DORA vs NIS2)", () => {
  it("routes financial entities to DORA, displacing NIS2", () => {
    const decision = evaluateEntityPerimeter({
      entityType: "aseguradora",
      isFinancialEntityDoraCovered: true,
      isEssentialOrImportantNis2: false,
      hasPersonalDataProcessing: true,
    });

    expect(decision.regime).toBe("DORA");
    expect(decision.appliesDoraClocks).toBe(true);
    expect(decision.appliesNis2Clocks).toBe(false);
    expect(decision.appliesGdprClocks).toBe(true);
  });

  it("routes non-financial essential entity to NIS2", () => {
    const decision = evaluateEntityPerimeter({
      entityType: "servicios_tecnologicos",
      isFinancialEntityDoraCovered: false,
      isEssentialOrImportantNis2: true,
      hasPersonalDataProcessing: false,
    });

    expect(decision.regime).toBe("NIS2");
    expect(decision.appliesDoraClocks).toBe(false);
    expect(decision.appliesNis2Clocks).toBe(true);
  });
});

describe("regulatory-clocks — TPRM Concentration & DORA Classification", () => {
  it("flags CTPP and high concentration for Board escalation and tested exit plan", () => {
    const evalResult = evaluateTprmConcentration({
      isCriticalOrImportantFunction: true,
      contractsCountWithProviderGroup: 5,
      technicalLockInScore: 4,
      migrationTimeMonths: 18,
      subcontractorsInThirdCountries: true,
      isDesignatedCtpp: true,
    });

    expect(evalResult.overallRiskLevel).toBe("Crítico");
    expect(evalResult.requiresBoardEscalation).toBe(true);
    expect(evalResult.requiresTestedExitPlan).toBe(true);
  });

  it("classifies major DORA incident when multiple criteria are met", () => {
    const classification = classifyDoraIncident({
      clientsAffectedPct: 15,
      durationHours: 3.5,
      economicImpactEuros: 150000,
      affectsCriticalFunctions: true,
      dataIntegrityLoss: false,
      thirdPartyImpact: true,
    });

    expect(classification.isMajorIncident).toBe(true);
    expect(classification.severityLevel).toBe("Grave TIC (Mayor DORA)");
    expect(classification.requiresSupervisoryNotification).toBe(true);
    expect(classification.requiresClientNotification).toBe(true);
  });
});
