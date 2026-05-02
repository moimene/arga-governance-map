import { describe, expect, it } from "vitest";
import { buildAgreementResolverContext } from "../resolver-context";

describe("resolver-context", () => {
  it("pasa compliance_snapshot al resolver para que MOTOR/LEY no queden en placeholders", () => {
    const context = buildAgreementResolverContext(
      {
        id: "agreement-1",
        entity_id: "entity-1",
        body_id: "body-1",
        parent_meeting_id: "meeting-1",
        compliance_snapshot: {
          snapshot_hash: "hash-motor",
          quorumReferencia: "art. 193 LSC",
          ok: true,
        },
      },
      "tenant-1",
    );

    expect(context).toMatchObject({
      agreementId: "agreement-1",
      tenantId: "tenant-1",
      entityId: "entity-1",
      bodyId: "body-1",
      meetingId: "meeting-1",
      complianceSnapshot: {
        snapshot_hash: "hash-motor",
        quorumReferencia: "art. 193 LSC",
      },
    });
  });
});
