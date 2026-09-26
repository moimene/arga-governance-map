import { describe, expect, it } from "vitest";
import { buildRegulatoryNotificationInsert } from "../regulatory-notification-insert";

describe("buildRegulatoryNotificationInsert (MOI-149 D-23)", () => {
  it("builds the exact row shape the schema expects, tenant explicit", () => {
    const row = buildRegulatoryNotificationInsert({
      tenantId: "00000000-0000-0000-0000-000000000003",
      authority: "  DGSFP  ",
      notificationType: "Incidente TIC grave",
      notificationDeadline: "2026-10-01T10:00:00.000Z",
      incidentId: "inc-1",
      referenceNumber: "REF-001",
    });
    expect(row).toEqual({
      tenant_id: "00000000-0000-0000-0000-000000000003",
      authority: "DGSFP",
      notification_type: "Incidente TIC grave",
      notification_deadline: "2026-10-01T10:00:00.000Z",
      incident_id: "inc-1",
      reference_number: "REF-001",
    });
  });

  it("uses notification_deadline, never a `deadline` key", () => {
    const row = buildRegulatoryNotificationInsert({
      tenantId: "00000000-0000-0000-0000-000000000001",
      authority: "CNMV",
    });
    expect(row).toHaveProperty("notification_deadline");
    expect(row).not.toHaveProperty("deadline");
  });

  it("rejects a missing tenant instead of letting the insert fall through to a default", () => {
    expect(() =>
      buildRegulatoryNotificationInsert({ tenantId: "", authority: "CNMV" })
    ).toThrow(/tenant/i);
  });

  it("rejects a blank authority (NOT NULL in the schema)", () => {
    expect(() =>
      buildRegulatoryNotificationInsert({
        tenantId: "00000000-0000-0000-0000-000000000001",
        authority: "   ",
      })
    ).toThrow(/autoridad/i);
  });

  it("defaults optional fields to null instead of dropping the keys (no undefined columns)", () => {
    const row = buildRegulatoryNotificationInsert({
      tenantId: "00000000-0000-0000-0000-000000000001",
      authority: "AEPD",
    });
    expect(row.notification_type).toBeNull();
    expect(row.notification_deadline).toBeNull();
    expect(row.incident_id).toBeNull();
    expect(row.reference_number).toBeNull();
  });
});
