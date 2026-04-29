import { describe, expect, it } from "vitest";
import {
  buildAgreementDocumentTraceFooterLines,
  buildDocumentEvidencePostureFooterLines,
  collectAgreementDocumentIds,
  resolveDocumentEvidencePosture,
  resolveAgreementDocumentTrace,
  type DocumentEvidencePostureStatus,
} from "../agreement-document-contract";

const AGREEMENT_A = "00000000-0000-4000-8000-000000000001";
const AGREEMENT_B = "00000000-0000-4000-8000-000000000002";

describe("agreement-document-contract", () => {
  it("permite documentos PRE sin agreement_id", () => {
    const trace = resolveAgreementDocumentTrace({ kind: "CONVOCATORIA" });

    expect(trace.status).toBe("PRE_AGREEMENT_ALLOWED");
    expect(trace.canExistBeforeAgreement).toBe(true);
    expect(trace.requiresAgreementLink).toBe(false);
  });

  it("exige enlace canonico para documentos finales/dispositivos", () => {
    const trace = resolveAgreementDocumentTrace({ kind: "CERTIFICACION" });

    expect(trace.status).toBe("PENDING_AGREEMENT_LINK");
    expect(trace.requiresAgreementLink).toBe(true);
    expect(trace.isDispositiveDocument).toBe(true);
  });

  it("marca como enlazado cuando recibe agreement_id explicito", () => {
    const trace = resolveAgreementDocumentTrace({
      kind: "DOCUMENTO_REGISTRAL",
      explicitAgreementIds: [AGREEMENT_A],
    });

    expect(trace.status).toBe("AGREEMENT_LINKED");
    expect(trace.agreementIds).toEqual([AGREEMENT_A]);
  });

  it("recoge ids canonicos desde variables y filtra valores no UUID", () => {
    const ids = collectAgreementDocumentIds({
      kind: "ACTA",
      explicitAgreementIds: [AGREEMENT_A, "no-es-uuid"],
      variables: {
        agreement_ids: [AGREEMENT_A, AGREEMENT_B, "borrador"],
        agreementId: AGREEMENT_B,
      },
    });

    expect(ids).toEqual([AGREEMENT_A, AGREEMENT_B]);
  });

  it("genera lineas de trazabilidad para footer documental", () => {
    const linked = buildAgreementDocumentTraceFooterLines(
      resolveAgreementDocumentTrace({ kind: "ACTA", explicitAgreementIds: [AGREEMENT_A] }),
    );
    const pending = buildAgreementDocumentTraceFooterLines(
      resolveAgreementDocumentTrace({ kind: "ACTA" }),
    );

    expect(linked.join("\n")).toContain(AGREEMENT_A);
    expect(pending.join("\n")).toContain("pendiente de enlace");
  });

  it("clasifica documentos finales archivados como evidencia demo no final", () => {
    const trace = resolveAgreementDocumentTrace({
      kind: "CERTIFICACION",
      explicitAgreementIds: [AGREEMENT_A],
    });
    const posture = resolveDocumentEvidencePosture(trace, {
      attempted: true,
      archived: true,
      evidenceBundleIds: ["bundle-1"],
    });

    expect(posture.status).toBe("DEMO_EVIDENCE_BUNDLE_NOT_FINAL");
    expect(posture.finalEvidence).toBe(false);
    expect(buildDocumentEvidencePostureFooterLines(posture).join("\n")).toContain("Evidencia final productiva: no");
  });

  it("mantiene determinismo para la misma entrada", () => {
    const input = {
      kind: "CERTIFICACION",
      explicitAgreementIds: [AGREEMENT_A],
      variables: { certified_agreement_ids: [AGREEMENT_B, "no-es-uuid"] },
    };

    expect(resolveAgreementDocumentTrace(input)).toEqual(resolveAgreementDocumentTrace(input));
    expect(resolveDocumentEvidencePosture(resolveAgreementDocumentTrace(input))).toEqual(
      resolveDocumentEvidencePosture(resolveAgreementDocumentTrace(input)),
    );
  });

  it("cae a no probatorio con entradas desconocidas o incompletas", () => {
    const trace = resolveAgreementDocumentTrace({ kind: "" });
    const posture = resolveDocumentEvidencePosture(trace);

    expect(trace.status).toBe("NOT_AGREEMENT_DOCUMENT");
    expect(posture.status).toBe("NOT_EVIDENCE");
    expect(posture.finalEvidence).toBe(false);
  });

  it("no promociona UUIDs invalidos a enlace canonico", () => {
    const trace = resolveAgreementDocumentTrace({
      kind: "CERTIFICACION",
      explicitAgreementIds: ["agreement-1"],
      variables: {
        agreement_id: "borrador",
        agreementIds: ["meeting:meeting-1:point:2"],
      },
    });

    expect(trace.status).toBe("PENDING_AGREEMENT_LINK");
    expect(trace.agreementIds).toHaveLength(0);
  });

  it("trata archivo sin bundle como no final", () => {
    const posture = resolveDocumentEvidencePosture(
      resolveAgreementDocumentTrace({ kind: "CERTIFICACION", explicitAgreementIds: [AGREEMENT_A] }),
      { attempted: true, archived: true, evidenceBundleIds: [], errors: ["bundle missing"] },
    );

    expect(posture.status).toBe("ARCHIVE_FAILED_NOT_FINAL");
    expect(posture.finalEvidence).toBe(false);
    expect(posture.requiresArchive).toBe(true);
  });

  it("ninguna postura actual declara evidencia final productiva", () => {
    const postures: DocumentEvidencePostureStatus[] = [
      "NOT_EVIDENCE",
      "PRE_OPERATIVE_DOCUMENT",
      "LINK_REQUIRED_NOT_FINAL",
      "READY_TO_ARCHIVE",
      "ARCHIVE_FAILED_NOT_FINAL",
      "DEMO_EVIDENCE_BUNDLE_NOT_FINAL",
    ];

    for (const status of postures) {
      const trace =
        status === "NOT_EVIDENCE"
          ? resolveAgreementDocumentTrace({ kind: "NO_APLICA" })
          : status === "PRE_OPERATIVE_DOCUMENT"
            ? resolveAgreementDocumentTrace({ kind: "INFORME_PRECEPTIVO" })
            : status === "LINK_REQUIRED_NOT_FINAL"
              ? resolveAgreementDocumentTrace({ kind: "CERTIFICACION" })
              : resolveAgreementDocumentTrace({ kind: "CERTIFICACION", explicitAgreementIds: [AGREEMENT_A] });
      const archive =
        status === "ARCHIVE_FAILED_NOT_FINAL"
          ? { attempted: true, archived: false, errors: ["archive failed"] }
          : status === "DEMO_EVIDENCE_BUNDLE_NOT_FINAL"
            ? { attempted: true, archived: true, evidenceBundleIds: ["bundle-1"] }
            : null;

      expect(resolveDocumentEvidencePosture(trace, archive).finalEvidence).toBe(false);
    }
  });

  it("no considera final un documento dispositivo sin agreement_id", () => {
    const posture = resolveDocumentEvidencePosture(
      resolveAgreementDocumentTrace({ kind: "DOCUMENTO_REGISTRAL" })
    );

    expect(posture.status).toBe("LINK_REQUIRED_NOT_FINAL");
    expect(posture.requiresAgreementLink).toBe(true);
    expect(posture.finalEvidence).toBe(false);
  });
});
