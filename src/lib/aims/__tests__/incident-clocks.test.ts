import { describe, it, expect } from "bun:test";
import {
  calculateRiaDeadline,
  calculateGdprDeadline,
  calculateDoraDeadlines,
  evaluateMultiregimeIncident,
  formatRemainingTime,
} from "@/lib/aims/incident-clocks";

describe("Multiregime Incident Clocks & Coordination Engine", () => {
  const baseDate = "2026-08-28T10:00:00.000Z";

  it("calculates RIA Art. 73 ordinary serious incident deadline as 15 calendar days (360 hours)", () => {
    const res = calculateRiaDeadline(baseDate, "ORDINARY_SERIOUS");
    expect(res.regime).toBe("RIA");
    expect(res.deadlineHours).toBe(360);
    expect(res.articleRef).toBe("Art. 73.1");
    expect(res.isUrgent).toBe(false);
    
    const diffHours = (new Date(res.deadlineDate).getTime() - new Date(baseDate).getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(360);
  });

  it("calculates RIA Art. 73.3 widespread infringement deadline as 2 calendar days (48 hours)", () => {
    const res = calculateRiaDeadline(baseDate, "WIDESPREAD_INFRINGEMENT");
    expect(res.deadlineHours).toBe(48);
    expect(res.articleRef).toBe("Art. 73.3");
    expect(res.isUrgent).toBe(true);
  });

  it("calculates RIA Art. 73.4 death incident deadline as 10 calendar days (240 hours)", () => {
    const res = calculateRiaDeadline(baseDate, "DEATH_INCIDENT");
    expect(res.deadlineHours).toBe(240);
    expect(res.articleRef).toBe("Art. 73.4");
    expect(res.isUrgent).toBe(false);
  });

  it("calculates GDPR Art. 33 deadline as strictly 72 hours", () => {
    const res = calculateGdprDeadline(baseDate, false);
    expect(res.regime).toBe("GDPR");
    expect(res.deadlineHours).toBe(72);
    expect(res.articleRef).toBe("Art. 33");
    expect(res.requiresDataSubjectNotice).toBe(false);
  });

  it("calculates GDPR Art. 34 with high risk requiring communication to data subjects", () => {
    const res = calculateGdprDeadline(baseDate, true);
    expect(res.requiresDataSubjectNotice).toBe(true);
    expect(res.articleRef).toBe("Art. 34");
  });

  it("calculates DORA Art. 19 deadlines (initial 4h/24h, intermediate 72h, final 30d)", () => {
    const res = calculateDoraDeadlines(baseDate);
    expect(res.regime).toBe("DORA");
    expect(res.initialDeadlineHours).toBe(4);
    expect(res.intermediateDeadlineHours).toBe(72);
    expect(res.finalDeadlineDays).toBe(30);
  });

  it("evaluates a compound multiregime incident affecting AI, PII and critical ICT infrastructure", () => {
    const clocks = evaluateMultiregimeIncident({
      knowledgeDate: baseDate,
      isAiRelated: true,
      riaSeverity: "ORDINARY_SERIOUS",
      affectsPersonalData: true,
      isHighRiskToSubjects: true,
      isIctRelated: true,
      affectsCriticalFunction: true,
    });

    expect(clocks.ria).toBeDefined();
    expect(clocks.ria?.deadlineHours).toBe(360);

    expect(clocks.gdpr).toBeDefined();
    expect(clocks.gdpr?.deadlineHours).toBe(72);
    expect(clocks.gdpr?.requiresDataSubjectNotice).toBe(true);

    expect(clocks.dora).toBeDefined();
    expect(clocks.dora?.intermediateDeadlineHours).toBe(72);
  });

  it("formats remaining time correctly for future and past deadlines", () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const futureResult = formatRemainingTime(futureDate);
    expect(futureResult.isExpired).toBe(false);
    expect(futureResult.label).toContain("días restantes");

    const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const pastResult = formatRemainingTime(pastDate);
    expect(pastResult.isExpired).toBe(true);
    expect(pastResult.label).toBe("Vencido");
  });
});
