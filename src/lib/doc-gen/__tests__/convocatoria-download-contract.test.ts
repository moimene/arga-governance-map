import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const legacySource = readFileSync(
  resolve(process.cwd(), "src/lib/doc-gen/process-documents.ts"),
  "utf8",
);
const motorSource = readFileSync(
  resolve(process.cwd(), "src/lib/motor-plantillas/process-generator.ts"),
  "utf8",
);

describe("ConvocatoriaDetalle — contrato de descarga DOCX", () => {
  it("descarga también cuando el archivo remoto se reutiliza por hash", () => {
    expect(legacySource).toContain(
      "downloadDocx(deliveredBuffer ?? buffer, deliveredFilename);",
    );
    expect(legacySource).toContain("authoritativeDocumentData");
    expect(legacySource).not.toContain("precommitConvocationFinalCandidate");
    expect(motorSource).toContain(
      'if (input.kind === "CONVOCATORIA" || !archive.reused) {',
    );
    expect(motorSource).toContain(
      "downloadDocx(composition.docxBuffer, composition.filename);",
    );
  });
});
