import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateDocx } from "../docx-generator";

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("docx-generator", () => {
  it("genera DOCX byte-estable cuando el contenido y generatedAt son iguales", async () => {
    const input = {
      renderedText: "ACTA DEMO\n\nTexto demo.",
      title: "ACTA DEMO",
      templateTipo: "ACTA",
      templateVersion: "1.0.0",
      generatedAt: "2026-05-02",
      contentHash: "abc123",
      entityName: "ARGA Seguros S.A.",
      editableFields: [
        { key: "observaciones", label: "Observaciones", value: "Sin incidencias" },
      ],
    };

    const first = await generateDocx(input);
    const second = await generateDocx(input);

    expect(first.length).toBeGreaterThan(0);
    expect(sha256(first)).toBe(sha256(second));
    expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0);
  });
});
