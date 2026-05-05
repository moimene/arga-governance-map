import { describe, expect, it } from "vitest";
import { buildCertificationAgreementSourceContract } from "../certification-agreement-source-contract";

describe("certification agreement source contract", () => {
  it("declara lista una certificacion generada desde agreement adoptado", () => {
    const contract = buildCertificationAgreementSourceContract({
      certificationId: "cert-1",
      agreementId: "agreement-1",
      agreementStatus: "ADOPTED",
      adoptionMode: "NO_SESSION",
      entityId: "entity-1",
      bodyId: "body-1",
      decisionDate: "2026-05-04",
      agreementKind: "AUMENTO_CAPITAL",
      decisionText: "Aprobar el aumento de capital.",
      evidenceId: "bundle-1",
      gateHash: "gate-1",
    });

    expect(contract).toMatchObject({
      schema_version: "certification-agreement-source.v1",
      status: "READY",
      source_table: "agreements",
      source_id: "agreement-1",
      agreement_id: "agreement-1",
      agreement_refs: ["agreement-1"],
      point_refs: [],
      blockers: [],
      warnings: [],
    });
  });

  it("bloquea certificaciones sin agreement source adoptado y no genera referencias por punto", () => {
    const contract = buildCertificationAgreementSourceContract({
      certificationId: "cert-1",
      agreementStatus: "DRAFT",
      decisionText: "",
    });

    expect(contract.status).toBe("BLOCKED");
    expect(contract.agreement_refs).toEqual([]);
    expect(contract.point_refs).toEqual([]);
    expect(contract.blockers).toEqual([
      "agreement_id_required",
      "agreement_not_adopted",
      "decision_text_required",
    ]);
  });

  it("mantiene avisos probatorios separados de los blockers societarios", () => {
    const contract = buildCertificationAgreementSourceContract({
      certificationId: "cert-1",
      agreementId: "agreement-1",
      agreementStatus: "APROBADO",
      decisionText: "Acuerdo certificado.",
    });

    expect(contract.status).toBe("READY");
    expect(contract.blockers).toEqual([]);
    expect(contract.warnings).toEqual(["evidence_bundle_not_linked", "gate_hash_not_available"]);
  });
});
