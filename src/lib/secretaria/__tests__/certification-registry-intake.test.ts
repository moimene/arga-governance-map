import { describe, expect, it } from "vitest";
import {
  buildCertificationRegistryIntake,
  isUuidReference,
  parseMeetingPointReference,
} from "../certification-registry-intake";

describe("certification registry intake", () => {
  it("separa UUIDs de acuerdos y referencias estables por punto", () => {
    const intake = buildCertificationRegistryIntake({
      id: "cert-1",
      signatureStatus: "SIGNED",
      evidenceId: "bundle-1",
      agreementId: null,
      agreementsCertified: [
        "5905ee89-3fb4-4a03-9cda-7523d45f75d4",
        "meeting:meeting-1:point:2",
      ],
    });

    expect(intake.agreementIds).toEqual(["5905ee89-3fb4-4a03-9cda-7523d45f75d4"]);
    expect(intake.explicitAgreementIds).toEqual(["5905ee89-3fb4-4a03-9cda-7523d45f75d4"]);
    expect(intake.pointReferences).toEqual(["meeting:meeting-1:point:2"]);
    expect(intake.unresolvedPointReferences).toEqual(["meeting:meeting-1:point:2"]);
    expect(intake.warnings).toContain("point_references_without_agreement_id");
    expect(intake.warnings).not.toContain("no_registry_agreement_reference");
  });

  it("resuelve referencias por punto a agreement_id sin mutar la certificacion original", () => {
    const intake = buildCertificationRegistryIntake({
      id: "cert-1",
      signatureStatus: "SIGNED",
      evidenceId: "bundle-1",
      agreementsCertified: ["meeting:meeting-1:point:2"],
      resolvedPointAgreementIds: ["5905ee89-3fb4-4a03-9cda-7523d45f75d4"],
      unresolvedPointReferences: [],
    });

    expect(intake.references).toEqual(["meeting:meeting-1:point:2"]);
    expect(intake.agreementIds).toEqual(["5905ee89-3fb4-4a03-9cda-7523d45f75d4"]);
    expect(intake.resolvedPointAgreementIds).toEqual(["5905ee89-3fb4-4a03-9cda-7523d45f75d4"]);
    expect(intake.pointReferences).toEqual(["meeting:meeting-1:point:2"]);
    expect(intake.unresolvedPointReferences).toHaveLength(0);
    expect(intake.warnings).toContain("point_references_resolved_to_agreement_id");
    expect(intake.warnings).not.toContain("point_references_without_agreement_id");
    expect(intake.warnings).not.toContain("no_registry_agreement_reference");
  });

  it("avisa cuando la certificacion no tiene expediente registral enlazable", () => {
    const intake = buildCertificationRegistryIntake({
      id: "cert-1",
      signatureStatus: "SIGNED",
      agreementsCertified: ["meeting:meeting-1:point:1"],
    });

    expect(intake.agreementIds).toHaveLength(0);
    expect(intake.warnings).toContain("no_registry_agreement_reference");
    expect(intake.warnings).toContain("evidence_bundle_not_linked");
  });

  it("reconoce UUIDs v4/v5 validos", () => {
    expect(isUuidReference("5905ee89-3fb4-4a03-9cda-7523d45f75d4")).toBe(true);
    expect(isUuidReference("meeting:abc:point:1")).toBe(false);
  });

  it("parsea referencias estables por punto", () => {
    expect(parseMeetingPointReference("meeting:meeting-1:point:12")).toEqual({
      meetingId: "meeting-1",
      agendaItemIndex: 12,
    });
    expect(parseMeetingPointReference("meeting:meeting-1:point:0")).toBeNull();
    expect(parseMeetingPointReference("agreement-1")).toBeNull();
  });
});
