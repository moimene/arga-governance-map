import { describe, expect, it } from "vitest";
import { buildCertificacionExtractBody } from "../certificacion-body";
import {
  canonicalizeLegalArtifactManifest,
  validateApprovedRecordLegalArtifactManifest,
  validateLegalArtifactManifest,
  validatePreSignatureLegalArtifactManifest,
  validateRenderedLegalArtifactAgainstManifest,
} from "../legal-artifact-manifest";
import {
  buildCompleteArgaLegalArtifactManifest,
  buildDefectiveArgaLegalArtifactManifest,
  buildPreSignatureArgaLegalArtifactManifest,
} from "./legal-artifact-manifest.fixture";

function certificationInput() {
  const manifest = buildCompleteArgaLegalArtifactManifest();
  return {
    manifest,
    agreementPointIds: ["agenda-1"],
    certifier: {
      ...manifest.chair.secretary,
      evidenceId: "ev-sign-secretary",
    },
    seenBy: {
      ...manifest.chair.president,
      evidenceId: "ev-sign-president",
    },
    issuePlace: "Madrid",
    issueDateISO: "2026-08-09T09:00:00Z",
  };
}

describe("legal-artifact-manifest — modelo documental legal canónico", () => {
  it("acepta el expediente ARGA completo con 15 vocales PF y quórum por vocales", () => {
    const manifest = buildCompleteArgaLegalArtifactManifest();
    const result = validateLegalArtifactManifest(manifest);

    expect(result).toEqual({ ok: true, blockingIssues: [], warnings: [] });
    expect(manifest.quorum).toMatchObject({
      denominatorKind: "BOARD_SEATS",
      eligibleCount: 15,
      presentCount: 13,
      representedCount: 1,
      absentCount: 1,
      capitalPercentage: null,
    });
  });

  it("produce el mismo canon aunque las colecciones no semánticas lleguen en otro orden", () => {
    const original = buildCompleteArgaLegalArtifactManifest();
    const reordered = buildCompleteArgaLegalArtifactManifest();
    reordered.census.participants.reverse();
    reordered.evidences.reverse();
    reordered.approval.approvedBy.reverse();
    reordered.chair.evidenceIds.reverse();

    expect(canonicalizeLegalArtifactManifest(reordered)).toBe(canonicalizeLegalArtifactManifest(original));
  });

  it("separa la proyección pre-firma del registro aprobado sin crear un ciclo imposible", () => {
    const preSignature = buildPreSignatureArgaLegalArtifactManifest();
    const preResult = validatePreSignatureLegalArtifactManifest(preSignature);
    const approvedResult = validateApprovedRecordLegalArtifactManifest(preSignature);

    expect(preResult).toEqual({ ok: true, blockingIssues: [], warnings: [] });
    expect(approvedResult.ok).toBe(false);
    expect(approvedResult.blockingIssues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "manifest_approval_pending",
      "manifest_approval_incomplete",
      "manifest_required_signature_missing",
      "manifest_book_entry_missing",
    ]));
  });

  it("cierra en fallo ante el artefacto ARGA defectuoso: hechos futuros, PJ, capital, votos y remisión genérica", () => {
    const defectiveManifest = buildDefectiveArgaLegalArtifactManifest();
    const result = validateLegalArtifactManifest(defectiveManifest);
    const codes = result.blockingIssues.map((issue) => issue.code);

    expect(result.ok).toBe(false);
    expect(codes).toEqual(expect.arrayContaining([
      "manifest_convocation_text_placeholder",
      "listed_board_denominator_invalid",
      "listed_board_capital_percentage_forbidden",
      "listed_board_legal_person_forbidden",
      "manifest_vote_denominator_mismatch",
      "manifest_future_approval_asserted",
      "manifest_future_meeting_asserted",
    ]));
  });

  it("detecta que el DOCX defectuoso no traslada el manifest y usa capital en Consejo", () => {
    const manifest = buildDefectiveArgaLegalArtifactManifest();
    const defectiveDocxText = [
      "ACTA DEL CONSEJO DE ADMINISTRACIÓN DE ARGA SEGUROS, S.A.",
      "La convocatoria consta en el expediente.",
      "Quórum: 100,0 % del capital presente.",
      "Asiste ARGA Capital Inversiones, S.L.",
      "Resultado: 16 votos a favor.",
    ].join("\n");
    const result = validateRenderedLegalArtifactAgainstManifest(defectiveDocxText, manifest);
    const codes = result.blockingIssues.map((issue) => issue.code);

    expect(result.ok).toBe(false);
    expect(codes).toContain("render_placeholder_forbidden");
    expect(codes).toContain("render_listed_board_capital_forbidden");
    expect(codes).toContain("render_manifest_fact_missing");
  });

  it("acepta un texto completo derivado del manifest aprobado", () => {
    const input = certificationInput();
    const completeText = buildCertificacionExtractBody(input);
    const result = validateRenderedLegalArtifactAgainstManifest(completeText, input.manifest);

    expect(result).toEqual({ ok: true, blockingIssues: [], warnings: [] });
  });
});
