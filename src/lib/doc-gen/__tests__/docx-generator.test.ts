import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPrintableDocumentHtml,
  downloadDocx,
  generateDocx,
  removeDuplicateLeadingTitle,
  temporalDemoNotice,
} from "../docx-generator";

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("docx-generator", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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
    expect(html).not.toContain("Hash: abc1234567890");
    expect(html).toContain("DEMO / NO OFICIAL");
    expect(html).toContain("Motor documental v1.1.0");
  });

  it("elimina el encabezado inicial cuando duplica el título de portada", () => {
    expect(
      removeDuplicateLeadingTitle(
        "ACUERDO DEL CONSEJO\n\nPRIMERO.- Se acuerda...",
        "Acuerdo del Consejo",
      ),
    ).toBe("PRIMERO.- Se acuerda...");
  });

  it("separa la fecha jurídica futura de la generación técnica demo", () => {
    expect(temporalDemoNotice("2026-08-08", "2026-07-20T09:00:00Z")).toContain(
      "fecha societaria declarada 8 de agosto de 2026",
    );
    expect(temporalDemoNotice("2026-07-19", "2026-07-20T09:00:00Z")).toBeNull();
  });

  it("mantiene vivo el blob hasta el siguiente ciclo y anuncia la descarga tras el click", () => {
    vi.useFakeTimers();
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:convocatoria-docx");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const downloaded: string[] = [];
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ filename?: string }>).detail;
      if (detail?.filename) downloaded.push(detail.filename);
    };
    window.addEventListener("tgms:docx-download", listener);

    downloadDocx(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "convocatoria_demo.docx");

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(downloaded).toEqual(["convocatoria_demo.docx"]);
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:convocatoria-docx");
    window.removeEventListener("tgms:docx-download", listener);
  });
});
