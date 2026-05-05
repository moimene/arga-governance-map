import { describe, expect, it } from "vitest";
import {
  evaluateAnnualAccountsDeadlines,
  evaluateAuditorOpinion,
  evaluateChallengeDeadline,
  evaluateConvocationExpiry,
  evaluateCreditorOpposition,
  evaluateDividendSeparationWarning,
  evaluateInformationRequestWindow,
  evaluateNoticePeriod,
  evaluateRegistryDeadline,
  evaluateSeparationRight,
} from "../plazos-engine";
import type { RuleParamOverride } from "../types";

describe("plazos-engine — convocatoria", () => {
  it("SA no cotizada falla si la convocatoria tiene menos de 30 días de antelación", () => {
    const result = evaluateNoticePeriod({
      tipoSocial: "SA",
      fechaConvocatoria: "2026-05-01",
      fechaJunta: "2026-05-25",
    });

    expect(result.ok).toBe(false);
    expect(result.antelacionDiasComputada).toBe(24);
    expect(result.blocking_issues).toContain("notice_period_insufficient");
  });

  it("SA cotizada exige CNMV/BORME/web y computa el mes desde la última publicación", () => {
    const result = evaluateNoticePeriod({
      tipoSocial: "SA",
      esCotizada: true,
      fechaConvocatoria: "2026-05-01",
      fechaJunta: "2026-06-05",
      publicaciones: [
        { canal: "BORME", fecha: "2026-05-01" },
        { canal: "CNMV", fecha: "2026-05-03" },
      ],
    });

    expect(result.fechaComputo).toBe("2026-05-03");
    expect(result.canalesFaltantes).toEqual(["WEB_SOCIEDAD"]);
    expect(result.blocking_issues).toContain("listed_company_publication_channels_missing");
  });

  it("SL aplica plazo estatutario superior y rule_param_overrides puede elevarlo", () => {
    const override: RuleParamOverride = {
      id: "ov-sl-25",
      entity_id: "entity-1",
      materia: "CONVOCATORIA",
      clave: "antelacion.sl",
      valor: 25,
      fuente: "ESTATUTOS",
    };
    const result = evaluateNoticePeriod({
      tipoSocial: "SL",
      fechaConvocatoria: "2026-05-01",
      fechaJunta: "2026-05-31",
      plazoEstatutarioDias: 20,
      overrides: [override],
    });

    expect(result.ok).toBe(true);
    expect(result.antelacionDiasRequerida).toBe(25);
  });

  it("rechaza override estatutario que acorta por debajo del mínimo legal", () => {
    const override: RuleParamOverride = {
      id: "ov-short",
      entity_id: "entity-1",
      materia: "CONVOCATORIA",
      clave: "antelacion.sl",
      valor: 7,
      fuente: "ESTATUTOS",
    };
    const result = evaluateNoticePeriod({
      tipoSocial: "SL",
      fechaConvocatoria: "2026-05-01",
      fechaJunta: "2026-05-16",
      overrides: [override],
    });

    expect(result.ok).toBe(true);
    expect(result.antelacionDiasRequerida).toBe(15);
  });

  it("segunda convocatoria debe estar al menos 24 horas después de la primera", () => {
    const result = evaluateNoticePeriod({
      tipoSocial: "SA",
      fechaConvocatoria: "2026-05-01",
      fechaJunta: "2026-06-05",
      fechaPrimeraConvocatoria: "2026-06-05",
      fechaSegundaConvocatoria: "2026-06-05",
    });

    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain("second_call_gap_less_than_24h");
  });
});

describe("plazos-engine — caducidad, información e impugnación", () => {
  it("caduca la convocatoria no celebrada y bloquea generación de acta", () => {
    const result = evaluateConvocationExpiry({
      fechaJunta: "2026-05-10",
      fechaSegundaConvocatoria: "2026-05-11",
      ahora: "2026-05-12",
    });

    expect(result.estado).toBe("CADUCADO");
    expect(result.canGenerateMinute).toBe(false);
    expect(result.blocking_issues).toContain("convocation_expired_no_minute_allowed");
  });

  it("marca como extemporánea la solicitud de información fuera de los 5 días previos", () => {
    const result = evaluateInformationRequestWindow({
      fechaConvocatoria: "2026-05-01",
      fechaJunta: "2026-05-30",
      fechaSolicitud: "2026-05-27",
    });

    expect(result.extemporanea).toBe(true);
    expect(result.warnings).toContain("information_request_extemporaneous");
  });

  it("calcula plazo de impugnación de un año y advierte proximidad de vencimiento", () => {
    const result = evaluateChallengeDeadline({
      fechaAcuerdo: "2025-06-01",
      ahora: "2026-05-20",
      tipo: "ANULABLE",
      warningDays: 20,
    });

    expect(result.deadline).toBe("2026-06-01");
    expect(result.warnings).toContain("challenge_deadline_near_expiry");
  });

  it("no aplica caducidad a acuerdos potencialmente nulos por orden público", () => {
    const result = evaluateChallengeDeadline({
      fechaAcuerdo: "2020-01-01",
      ahora: "2026-05-04",
      tipo: "ORDEN_PUBLICO",
    });

    expect(result.noCaducidad).toBe(true);
    expect(result.ok).toBe(true);
  });
});

describe("plazos-engine — separación, oposición y cuentas", () => {
  it("genera gate de derecho de separación en modificación sustancial", () => {
    const result = evaluateSeparationRight({
      materia: "MODIFICACION_OBJETO_SOCIAL",
      fechaPublicacion: "2026-05-04",
      separationNoticeDocumented: false,
    });

    expect(result.ok).toBe(false);
    expect(result.deadline).toBe("2026-06-03");
    expect(result.blocking_issues).toContain("separation_right_notice_missing");
  });

  it("advierte derecho de separación por no reparto de dividendos en 3 ejercicios", () => {
    const result = evaluateDividendSeparationWarning({
      rejectedMinimumDividend: true,
      consecutiveProfitableYears: 3,
    });

    expect(result.severity).toBe("WARNING");
    expect(result.warnings).toContain("dividend_separation_right_risk");
  });

  it("reducción por pérdidas no exige oposición de acreedores", () => {
    const result = evaluateCreditorOpposition({
      materia: "REDUCCION_CAPITAL",
      causa: "PERDIDAS",
      fechaPublicacion: "2026-05-01",
      ahora: "2026-05-02",
    });

    expect(result.ok).toBe(true);
    expect(result.blocking_issues).toHaveLength(0);
  });

  it("fusión bloquea certificación mientras no transcurra o se renuncie la oposición", () => {
    const result = evaluateCreditorOpposition({
      materia: "FUSION",
      fechaPublicacion: "2026-05-01",
      ahora: "2026-05-20",
    });

    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain("creditor_opposition_period_open");
  });

  it("pipeline de cuentas advierte formulación tardía, junta fuera de semestre y depósito vencido", () => {
    const result = evaluateAnnualAccountsDeadlines({
      fiscalYearEnd: "2025-12-31",
      formulationDate: "2026-04-15",
      ordinaryMeetingDate: "2026-07-10",
      approvalDate: "2026-07-10",
      now: "2026-08-15",
    });

    expect(result.warnings).toContain("accounts_formulation_late");
    expect(result.warnings).toContain("ordinary_meeting_after_six_months");
    expect(result.warnings).toContain("accounts_deposit_overdue");
  });

  it("cuentas con salvedades advierten y opinión denegada/desfavorable bloquea", () => {
    expect(evaluateAuditorOpinion({ opinion: "SALVEDADES" }).warnings).toContain("auditor_qualifications_warning");
    expect(evaluateAuditorOpinion({ opinion: "DENEGADA" }).blocking_issues).toContain("auditor_opinion_reinforced_attention");
  });
});

describe("plazos-engine — registro y depósito demo", () => {
  it("nombramiento/cese genera reminder registral de 10 días", () => {
    const result = evaluateRegistryDeadline({
      materia: "NOMBRAMIENTO_CONSEJERO",
      fechaBase: "2026-05-01",
      ahora: "2026-05-05",
    });

    expect(result.deadline).toBe("2026-05-11");
    expect(result.status).toBe("PENDIENTE");
  });

  it("modificación estatutaria recuerda inscripción y publicación BORME sin implicar envío real", () => {
    const result = evaluateRegistryDeadline({
      materia: "MODIFICACION_ESTATUTOS",
      fechaBase: "2026-05-01",
      ahora: "2026-05-10",
    });

    expect(result.warnings).toContain("borme_publication_reminder");
    expect(result.explain[0].mensaje).toContain("no implica envio");
  });

  it("depósito de cuentas vencido y cierre registral tras un año se reflejan como warning", () => {
    const result = evaluateRegistryDeadline({
      materia: "DEPOSITO_CUENTAS",
      fechaBase: "2025-01-01",
      ahora: "2026-05-04",
    });

    expect(result.status).toBe("VENCIDO");
    expect(result.warnings).toContain("registry_closure_risk_art_282_lsc");
  });
});
