import { describe, expect, it } from "vitest";
import {
  buildRegistryFilingCertificationLink,
  computeRegistryFilingCertificationLinkHash,
} from "../registry-certification-link";
import type { CertificationRegistryIntake } from "../certification-registry-intake";

const certification: CertificationRegistryIntake = {
  id: "cert-1",
  minuteId: "minute-1",
  signatureStatus: "SIGNED",
  evidenceId: "bundle-1",
  gateHash: "gate-1",
  entityId: "entity-1",
  bodyId: "body-1",
  meetingId: "meeting-1",
  references: ["agreement-1", "meeting:meeting-1:point:2"],
  agreementIds: ["agreement-1"],
  pointReferences: ["meeting:meeting-1:point:2"],
  signed: true,
  hasEvidenceBundle: true,
  warnings: ["point_references_without_agreement_id"],
};

describe("registry certification link", () => {
  it("construye un vínculo probatorio estable certificacion -> filing", () => {
    const link = buildRegistryFilingCertificationLink({
      tenantId: "tenant-1",
      registryFilingId: "filing-1",
      agreementId: "agreement-1",
      certification,
      linkedAt: "2026-04-27T00:00:00.000Z",
    });

    expect(link).toMatchObject({
      schema_version: "registry_certification_link.v1",
      registry_filing_id: "filing-1",
      agreement_id: "agreement-1",
      certification_id: "cert-1",
      evidence_id: "bundle-1",
      gate_hash: "gate-1",
    });
    expect(link.agreement_refs).toEqual(["agreement-1"]);
    expect(link.point_refs).toEqual(["meeting:meeting-1:point:2"]);
  });

  it("hash canónico no depende del orden de claves del objeto", async () => {
    const link = buildRegistryFilingCertificationLink({
      tenantId: "tenant-1",
      registryFilingId: "filing-1",
      agreementId: "agreement-1",
      certification,
      linkedAt: "2026-04-27T00:00:00.000Z",
    });

    await expect(computeRegistryFilingCertificationLinkHash(link)).resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(computeRegistryFilingCertificationLinkHash({ ...link })).resolves.toBe(
      await computeRegistryFilingCertificationLinkHash(link),
    );
  });
});
