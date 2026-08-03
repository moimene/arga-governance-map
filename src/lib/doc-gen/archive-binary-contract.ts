export type ArchivedBufferKind =
  | "ORIGINAL_DOCX"
  | "ORIGINAL_PDF"
  | "QTSP_SIGNED_DOCX"
  | "QTSP_SIGNED_PDF";

export interface ArchiveBinaryDescriptor {
  baseFilename: string;
  extension: ".docx" | ".pdf";
  mimeType: string;
  artifactType: "DOCX" | "PDF";
  signedQtspArtifact: boolean;
}

export function resolveArchiveBinaryDescriptor(
  filename: string,
  kind: ArchivedBufferKind = "ORIGINAL_DOCX",
): ArchiveBinaryDescriptor {
  const pdf = kind === "ORIGINAL_PDF" || kind === "QTSP_SIGNED_PDF" || /\.pdf$/i.test(filename);
  return {
    baseFilename: filename.replace(/\.(?:docx|pdf)$/i, ""),
    extension: pdf ? ".pdf" : ".docx",
    mimeType: pdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    artifactType: pdf ? "PDF" : "DOCX",
    signedQtspArtifact: kind === "QTSP_SIGNED_DOCX" || kind === "QTSP_SIGNED_PDF",
  };
}
