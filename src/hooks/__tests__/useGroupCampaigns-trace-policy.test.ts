import { describe, expect, it } from "vitest";
import { campaignExplainForNewCapture } from "../useGroupCampaigns";

describe("group campaign trace policy", () => {
  it("elimina claims legacy anidados antes de añadir la semántica EAD permitida", () => {
    const result = campaignExplainForNewCapture(
      {
        forma_social: "SL",
        nested: {
          erds_claim: true,
          delivery_status: "ENTREGADO",
          provider: {
            qes: "qualified",
            firma_ref: "legacy-signature-ref",
            provider_contract_evidence: true,
            sent_at: "2026-07-21T10:00:00Z",
            safe_reference: "expediente-123",
          },
          notes: ["traza operativa", "acuse legal acreditado"],
        },
      },
      "CONVOCATORIA_JGA",
      "SL",
    );

    expect(result).toMatchObject({
      forma_social: "SL",
      nested: {
        provider: { safe_reference: "expediente-123" },
        notes: ["traza operativa"],
      },
      communication_channel: {
        code: "EAD_INTERPOSITION",
        owner: "EAD Trust",
        services: ["INTERPOSITION", "BASIC_MESSAGING", "E_ARCHIVING"],
        external_result_claim: false,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /ERDS|QES|QTSP|signature|acuse|certified|env[ií]o|send|dispatch|entrega|delivery/i,
    );
  });

  it("sanea también las trazas de materias que no usan interposición EAD", () => {
    const result = campaignExplainForNewCapture(
      {
        safe: "preservado",
        legacy: { dispatch_ref: "legacy-ref" },
      },
      "FORMULACION_CUENTAS",
      "SA",
    );

    expect(result).toEqual({ safe: "preservado", legacy: {} });
  });
});
