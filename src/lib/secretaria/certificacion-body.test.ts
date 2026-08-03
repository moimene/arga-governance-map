import { describe, it, expect } from "vitest";
import {
  buildCertificacionBody,
  buildCertificacionExtractBody,
  CertificacionManifestValidationError,
  validateCertificacionExtractInput,
} from "./certificacion-body";
import {
  buildCompleteArgaLegalArtifactManifest,
  buildDefectiveArgaLegalArtifactManifest,
  buildPreSignatureArgaLegalArtifactManifest,
} from "./__tests__/legal-artifact-manifest.fixture";

describe("buildCertificacionBody", () => {
  const base = {
    certificanteCargoLabel: "Secretario",
    certificanteNombre: "Lucía Paredes Vega",
    entidadNombre: "ARGA Seguros, S.A.",
    organoNombre: "Consejo de Administración",
    numAcuerdos: 3,
    actaApprovalMethod: "aprobación y firma por la Secretaría con el visto bueno de la Presidencia",
    actaApprovalDateISO: "2026-06-12T10:00:00Z",
    fechaISO: "2026-06-13T10:00:00Z",
  };

  it("compone un cuerpo de certificación con certificante, órgano y nº de acuerdos", () => {
    const body = buildCertificacionBody(base);
    expect(body).toContain("CERTIFIC");
    expect(body).toContain("Lucía Paredes Vega");
    expect(body).toContain("Secretario");
    expect(body).toContain("ARGA Seguros, S.A.");
    expect(body).toContain("Consejo de Administración");
    expect(body).toContain("art. 109");
    expect(body).toContain("cargo vigente y en ejercicio");
    expect(body).toContain("aprobación y firma por la Secretaría");
    expect(body).toContain("12 de junio de 2026");
    // el nº de acuerdos certificados aparece
    expect(body).toMatch(/\b3\b/);
  });

  it("incluye el Vº Bº cuando hay visto bueno", () => {
    const body = buildCertificacionBody({
      ...base,
      vistoBuenoCargoLabel: "Presidente",
      vistoBuenoNombre: "Antonio Ríos Valverde",
    });
    expect(body).toMatch(/V\.?º?\s*B\.?º?|Visto bueno/i);
    expect(body).toContain("Antonio Ríos Valverde");
  });

  it("omite el bloque de Vº Bº cuando no hay visto bueno (p.ej. administrador único)", () => {
    const body = buildCertificacionBody({
      certificanteCargoLabel: "Administrador único",
      certificanteNombre: "Pedro Gómez",
      entidadNombre: "Filial ARGA S.L.U.",
      numAcuerdos: 1,
      actaApprovalMethod: "aprobación por el administrador único",
      actaApprovalDateISO: "2026-06-12T10:00:00Z",
      fechaISO: "2026-06-13T10:00:00Z",
    });
    expect(body).toContain("Pedro Gómez");
    expect(body).not.toContain("Visto bueno");
  });

  it("es determinista (no usa la fecha del sistema, usa fechaISO)", () => {
    const a = buildCertificacionBody(base);
    const b = buildCertificacionBody(base);
    expect(a).toBe(b);
    expect(a).toContain("13");
  });

  it("respeta el tratamiento ya resuelto y no duplica Dña.", () => {
    const body = buildCertificacionBody({
      ...base,
      certificanteNombre: "Dña. Lucía Paredes Vega",
      vistoBuenoNombre: "D. Antonio Ríos Valverde",
      vistoBuenoCargoLabel: "Presidente",
    });

    expect(body).toContain("Dña. Lucía Paredes Vega");
    expect(body).not.toMatch(/D\.\/Dña\.|Dña\.\s+Dña\./);
    expect(body).toContain("Visto bueno: D. Antonio Ríos Valverde");
  });
});

function strictInput() {
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

describe("certificación por extracto derivada del manifest aprobado", () => {
  it("traslada circunstancias RRM, lista, acuerdos, votos, aprobación, asiento y expedición sin remisiones genéricas", () => {
    const body = buildCertificacionExtractBody(strictInput());

    expect(body).toContain("arts. 97, 109 y 112 RRM");
    expect(body).toContain("15 vocales elegibles");
    expect(body).toContain("13 presentes, 1 representados y 1 ausentes");
    expect(body).toContain("Acuerdo literal: Aprobar la Política de Continuidad Operativa versión 3.0");
    expect(body).toContain("13 a favor, 1 en contra y 0 abstenciones");
    expect(body).toContain("aprobada realmente");
    expect(body).toContain("entry-2026-008");
    expect(body).toContain("Evidencia de firma: ev-sign-secretary");
    expect(body).not.toMatch(/seg[uú]n (?:consta|el) expediente|consta en el expediente/iu);
    expect(body).not.toMatch(/\d+(?:[,.]\d+)?\s*%/u);
  });

  it("es determinista para el mismo manifest e input de expedición", () => {
    const input = strictInput();
    expect(buildCertificacionExtractBody(input)).toBe(buildCertificacionExtractBody(input));
  });

  it("rechaza el manifest defectuoso observado antes de componer texto certificante", () => {
    const input = strictInput();
    input.manifest = buildDefectiveArgaLegalArtifactManifest();

    const validation = validateCertificacionExtractInput(input);
    expect(validation.ok).toBe(false);
    expect(validation.blockingIssues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "listed_board_legal_person_forbidden",
      "listed_board_capital_percentage_forbidden",
      "manifest_future_meeting_asserted",
    ]));
    expect(() => buildCertificacionExtractBody(input)).toThrow(CertificacionManifestValidationError);
  });

  it("rechaza extractos de acuerdos inexistentes y actas pendientes de aprobación", () => {
    const input = strictInput();
    input.agreementPointIds = ["agenda-inexistente"];
    input.manifest.approval.status = "PENDING";
    input.manifest.approval.dateISO = null;

    const result = validateCertificacionExtractInput(input);
    expect(result.ok).toBe(false);
    expect(result.blockingIssues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "cert_extract_agreement_unknown",
      "manifest_approval_pending",
      "manifest_approval_incomplete",
    ]));
  });

  it("no certifica la proyección PRE_SIGNATURE aunque sea válida para componer el acta", () => {
    const input = strictInput();
    input.manifest = buildPreSignatureArgaLegalArtifactManifest();

    const result = validateCertificacionExtractInput(input);
    expect(result.ok).toBe(false);
    expect(result.blockingIssues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "manifest_approval_pending",
      "manifest_required_signature_missing",
      "manifest_book_entry_missing",
    ]));
  });
});
