import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildPrintableDocumentHtml, generateDocx } from "../docx-generator";

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

  it("genera HTML imprimible escapando contenido de plantilla", () => {
    const html = buildPrintableDocumentHtml({
      title: "ACTA <DEMO>",
      renderedText: "ACTA DEMO\n\nTexto con <script>alert('x')</script>",
      contentHash: "abc1234567890",
      generatedAt: "2026-05-03",
    });

    expect(html).toContain("ACTA &lt;DEMO&gt;");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("Hash: abc1234567890");
  });
});
