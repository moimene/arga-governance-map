import { describe, expect, it } from "vitest";
import {
  resolveAgreementDocumentLegalDate,
  resolveWorkflowDateTimeInputParts,
  resolveMinuteApprovalTimeline,
  resolveRegistryEventTimelineDate,
} from "../workflow-date-semantics";

describe("workflow date semantics", () => {
  it("conserva la hora local al reconstruir una convocatoria clonada", () => {
    expect(resolveWorkflowDateTimeInputParts(
      "2026-08-09T08:00:00.000Z",
      "Europe/Madrid",
    )).toEqual({
      date: "2026-08-09",
      time: "10:00",
    });
  });

  it("genera el documento del acuerdo con su fecha jurídica, no con la fecha técnica", () => {
    expect(resolveAgreementDocumentLegalDate({
      effectiveDate: null,
      decisionDate: "2026-08-08",
    })).toBe("2026-08-08");

    expect(resolveAgreementDocumentLegalDate({
      effectiveDate: "2026-08-10",
      decisionDate: "2026-08-08",
    })).toBe("2026-08-10");
  });

  it("separa la fecha societaria futura de la traza técnica de una demo", () => {
    expect(resolveMinuteApprovalTimeline({
      signedAt: "2026-07-19T21:00:00.000Z",
      meetingScheduledAt: "2026-08-20T08:00:00.000Z",
    })).toEqual({
      legalEffectiveAt: "2026-08-20T08:00:00.000Z",
      recordedAt: "2026-07-19T21:00:00.000Z",
      isSimulatedFuture: true,
    });
  });

  it("usa la firma como fecha efectiva cuando la reunión ya se celebró", () => {
    expect(resolveMinuteApprovalTimeline({
      signedAt: "2026-08-21T09:30:00.000Z",
      meetingScheduledAt: "2026-08-20T08:00:00.000Z",
    })).toEqual({
      legalEffectiveAt: "2026-08-21T09:30:00.000Z",
      recordedAt: "2026-08-21T09:30:00.000Z",
      isSimulatedFuture: false,
    });
  });

  it("muestra la fecha de presentación sin alterar el evento WORM", () => {
    expect(resolveRegistryEventTimelineDate({
      eventType: "PRESENTACION_ASENTADA",
      effectiveAt: "2026-07-19T21:00:00.000Z",
      payload: { presentation_date: "2026-08-22" },
    })).toEqual({
      businessDate: "2026-08-22",
      businessDateLabel: "Fecha de presentación declarada",
      recordedAt: "2026-07-19T21:00:00.000Z",
    });
  });

  it("usa la fecha de escritura del expediente en su evento de preparación", () => {
    expect(resolveRegistryEventTimelineDate({
      eventType: "EXPEDIENTE_PREPARADO",
      effectiveAt: "2026-07-19T20:00:00.000Z",
      deedDate: "2026-08-21",
    }).businessDateLabel).toBe("Fecha de escritura declarada");
  });
});
