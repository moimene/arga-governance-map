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
    expect(res.articleRef).toBe("Art. 73.2");
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
    expect(res.articleRef).toBe("Art. 33");
    expect(res.dataSubjectNoticeArticleRef).toBe("Art. 34");
  });

  it("calcula las FECHAS de los tres hitos DORA, no sólo sus horas", () => {
    // A6: este test sólo asertaba literales del objeto de retorno — se podía
    // borrar el cálculo de fechas entero y seguía verde.
    //
    // MOI-215: sin clasificación, la inicial ya NO es k+4h (ese era el defecto:
    // esta función trataba el conocimiento como si fuera la clasificación).
    // Unificada con GRC, manda el tope de 24h desde el conocimiento — lectura
    // PROVISIONAL, pendiente de MOI-163 (ver `src/lib/regulatory-deadlines.ts`).
    const res = calculateDoraDeadlines(baseDate);
    const k = new Date(baseDate).getTime();
    const horas = (iso: string) => (new Date(iso).getTime() - k) / 3_600_000;
    expect(res.regime).toBe("DORA");
    expect(horas(res.initialDeadlineDate)).toBe(24);
    expect(res.initialDeadlineHours).toBe(24);
    expect(res.initialRule).toBe("24H_CAP_FROM_KNOWLEDGE");
    expect(horas(res.intermediateDeadlineDate)).toBe(24 + 72);
    // Literal, no recalculado con la misma función: conocimiento 28/08 10:00Z
    // → inicial +24 h = 29/08 10:00Z → intermedio +72 h = 01/09 10:00Z → final
    // un mes natural = 01/10 10:00Z.
    expect(res.intermediateDeadlineDate).toBe("2026-09-01T10:00:00.000Z");
    expect(res.finalDeadlineDate).toBe("2026-10-01T10:00:00.000Z");
  });

  it("evaluates a compound multiregime incident affecting AI, PII and critical ICT infrastructure", () => {
    const clocks = evaluateMultiregimeIncident({
      knowledgeDate: baseDate,
      isAiRelated: true,
      isAiHighRisk: true,
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
