import { describe, expect, it } from "vitest";
import { resolveArchiveBinaryDescriptor } from "./archive-binary-contract";

describe("contrato binario del archivo documental", () => {
  it("mantiene el borrador de trabajo como DOCX", () => {
    expect(
      resolveArchiveBinaryDescriptor("MODELO_ACUERDO_77ea.docx", "ORIGINAL_DOCX"),
    ).toEqual({
      baseFilename: "MODELO_ACUERDO_77ea",
      extension: ".docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      artifactType: "DOCX",
      signedQtspArtifact: false,
    });
  });

  it("archiva el PDF enviado a firma con extensión y MIME PDF, sin afirmar QES", () => {
    expect(
      resolveArchiveBinaryDescriptor("MODELO_ACUERDO_77ea.pdf", "ORIGINAL_PDF"),
    ).toEqual({
      baseFilename: "MODELO_ACUERDO_77ea",
      extension: ".pdf",
      mimeType: "application/pdf",
      artifactType: "PDF",
      signedQtspArtifact: false,
    });
  });

  it("solo marca artefacto QTSP cuando el buffer archivado es el firmado", () => {
    expect(
      resolveArchiveBinaryDescriptor("MODELO_ACUERDO_77ea.pdf", "QTSP_SIGNED_PDF")
        .signedQtspArtifact,
    ).toBe(true);
  });
});
