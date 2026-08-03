import { describe, expect, it } from "vitest";
import { authoritativeNoSessionRecipients } from "../no-session-recipient-eligibility";

const base = {
  body_id: "body-cda",
  start_date: "2024-01-01",
  end_date: "2028-01-01",
  status: "Activo",
  source_status: "VIGENTE",
  seat_semantics: "PRIMARY",
};

describe("censo autoritativo de acuerdos sin sesión", () => {
  it("incluye asientos del Consejo, deduplica y excluye Secretaría sin asiento", () => {
    const recipients = authoritativeNoSessionRecipients([
      { ...base, id: "1", person_id: "p1", role: "PRESIDENTE" },
      { ...base, id: "2", person_id: "p1", role: "SECRETARIO" },
      { ...base, id: "3", person_id: "p2", role: "CONSEJERO" },
      { ...base, id: "4", person_id: "secretary", role: "SECRETARIO" },
      { ...base, id: "5", person_id: "accessory", role: "CONSEJERO", seat_semantics: "ACCESSORY" },
    ], "CDA", "body-cda");

    expect(recipients.map((recipient) => recipient.person_id)).toEqual(["p1", "p2"]);
  });

  it("incluye socios vigentes aunque la condición no tenga body_id", () => {
    const recipients = authoritativeNoSessionRecipients([
      { ...base, id: "1", body_id: "", person_id: "holder", role: "SOCIO" },
      { ...base, id: "2", body_id: "", person_id: "admin", role: "ADMIN_UNICO" },
    ], "JUNTA_GENERAL", "body-jga");

    expect(recipients.map((recipient) => recipient.person_id)).toEqual(["holder"]);
  });
});
