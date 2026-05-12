/**
 * Tests para `resolveAttachmentMime` — guard de seguridad del upload de
 * adjuntos de convocatoria.
 *
 * Cubre A2 de la revisión adversarial:
 *   - MIME declarado válido → pasa
 *   - MIME declarado no permitido → throws
 *   - MIME vacío + extensión válida → sniff devuelve MIME canónico
 *   - MIME vacío + extensión desconocida → throws (NO admite octet-stream)
 *   - MIME vacío + sin extensión → throws
 *   - file.type con mayúsculas o whitespace → normaliza
 */

import { describe, it, expect } from "vitest";
import { resolveAttachmentMime } from "../useConvocatorias";

describe("resolveAttachmentMime", () => {
  describe("file.type declarado", () => {
    it("acepta application/pdf", () => {
      expect(resolveAttachmentMime({ name: "x.pdf", type: "application/pdf" })).toBe(
        "application/pdf",
      );
    });

    it("acepta DOCX (openxmlformats)", () => {
      const mime =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      expect(resolveAttachmentMime({ name: "x.docx", type: mime })).toBe(mime);
    });

    it("rechaza application/octet-stream incluso si tiene extensión válida", () => {
      expect(() =>
        resolveAttachmentMime({ name: "x.pdf", type: "application/octet-stream" }),
      ).toThrow(/no permitido/i);
    });

    it("rechaza application/x-msdownload (ejecutable Windows)", () => {
      expect(() =>
        resolveAttachmentMime({ name: "virus.exe", type: "application/x-msdownload" }),
      ).toThrow(/no permitido/i);
    });

    it("rechaza application/x-sh", () => {
      expect(() =>
        resolveAttachmentMime({ name: "script.sh", type: "application/x-sh" }),
      ).toThrow(/no permitido/i);
    });

    it("normaliza mayúsculas: APPLICATION/PDF → application/pdf", () => {
      expect(resolveAttachmentMime({ name: "x.pdf", type: "APPLICATION/PDF" })).toBe(
        "application/pdf",
      );
    });

    it("trimea whitespace en el declared type", () => {
      expect(resolveAttachmentMime({ name: "x.pdf", type: "  application/pdf  " })).toBe(
        "application/pdf",
      );
    });
  });

  describe("file.type vacío — sniff por extensión", () => {
    it("PDF: tipo='' + name='x.pdf' → application/pdf", () => {
      expect(resolveAttachmentMime({ name: "informe.pdf", type: "" })).toBe(
        "application/pdf",
      );
    });

    it("DOCX: tipo='' + extension docx → MIME canónico Word", () => {
      expect(resolveAttachmentMime({ name: "borrador.docx", type: "" })).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    });

    it("XLSX: tipo='' + extension xlsx → MIME canónico Excel", () => {
      expect(resolveAttachmentMime({ name: "cuentas.xlsx", type: "" })).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    });

    it("JPEG: tipo='' + extension jpg → image/jpeg", () => {
      expect(resolveAttachmentMime({ name: "foto.jpg", type: "" })).toBe("image/jpeg");
    });

    it("Extensión en mayúsculas: PDF → application/pdf", () => {
      expect(resolveAttachmentMime({ name: "FACTURA.PDF", type: "" })).toBe(
        "application/pdf",
      );
    });
  });

  describe("rechazo cuando sniff no encuentra MIME", () => {
    it("rechaza tipo='' + extension desconocida (.dat)", () => {
      expect(() => resolveAttachmentMime({ name: "x.dat", type: "" })).toThrow(
        /extensión "dat" no admitida/i,
      );
    });

    it("rechaza tipo='' + extension ejecutable (.exe)", () => {
      expect(() => resolveAttachmentMime({ name: "x.exe", type: "" })).toThrow(
        /extensión "exe" no admitida/i,
      );
    });

    it("rechaza tipo='' + extension script (.sh)", () => {
      expect(() => resolveAttachmentMime({ name: "x.sh", type: "" })).toThrow(
        /no admitida/i,
      );
    });

    it("rechaza tipo='' + sin extensión", () => {
      expect(() => resolveAttachmentMime({ name: "archivosolo", type: "" })).toThrow(
        /sin extensión/i,
      );
    });

    it("rechaza tipo='' + nombre vacío", () => {
      expect(() => resolveAttachmentMime({ name: "", type: "" })).toThrow(
        /no admitida/i,
      );
    });
  });

  describe("propiedad de seguridad: nunca devuelve octet-stream", () => {
    it("nunca devuelve octet-stream con MIME declarado", () => {
      expect(() =>
        resolveAttachmentMime({ name: "x.pdf", type: "application/octet-stream" }),
      ).toThrow();
    });

    it("nunca devuelve octet-stream sniffeado", () => {
      // Si en algún momento añadimos un MIME al map debe estar en la allowlist
      const result = resolveAttachmentMime({ name: "x.pdf", type: "" });
      expect(result).not.toBe("application/octet-stream");
    });
  });
});
