import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrato del camino de firma: se firma un PDF generado por nosotros.
 *
 * Antes se enviaba el DOCX y el proveedor lo convertía por su cuenta, de modo
 * que se hasheaba un documento y se firmaba otro: el hash que quedaba como
 * evidencia no correspondía al artefacto firmado, y de ese artefacto no había
 * ni copia ni hash. Para un acta o una certificación eso rompe la cadena.
 *
 * Estos pines evitan que una refactorización devuelva el DOCX al camino de firma
 * sin que nadie se dé cuenta.
 */
function read(p: string) {
  return readFileSync(resolve(process.cwd(), p), "utf8");
}

const STEPPER = "src/pages/secretaria/GenerarDocumentoStepper.tsx";
const PROXY = "supabase/functions/qtsp-proxy/index.ts";

describe("lo hasheado, lo archivado y lo firmado son el mismo documento", () => {
  const stepper = read(STEPPER);

  it("el stepper genera el PDF antes de solicitar la firma", () => {
    expect(stepper).toContain("const pdf = await generatePdf({");
    expect(stepper).toContain('from "@/lib/doc-gen/pdf-generator"');
  });

  it("el PDF sale del MISMO texto renderizado que el DOCX", () => {
    // Si divergieran, el PDF firmado y el DOCX de trabajo dejarían de ser el
    // mismo documento aunque ambos se llamaran igual.
    expect(stepper).toMatch(/generatePdf\(\{[\s\S]{0,200}renderedText:\s*compositionResult\.document\.renderedText/);
  });

  it("lo que se envía a firmar es el PDF, con extensión .pdf", () => {
    expect(stepper).toMatch(/documentName:\s*`\$\{selectedPlantilla\.tipo\}_\$\{agreement\.id\.slice\(0, 8\)\}\.pdf`/);
    expect(stepper).toContain("documentData: pdfBuffer,");
    // Y ya no se manda el buffer DOCX al firmar.
    expect(stepper).not.toMatch(/documentData:\s*docxBuffer\.buffer\.slice/);
  });

  it("el proxy respeta un PDF entrante y no lo reconvierte", () => {
    // Si reconvirtiera, volveríamos a firmar bytes distintos de los hasheados.
    expect(read(PROXY)).toContain('convertToPdf: !documentName.toLowerCase().endsWith(".pdf")');
  });
});

describe("el estado de firma que se muestra es el real", () => {
  const stepper = read(STEPPER);

  it("solo se marca firmado cuando el proveedor lo acredita", () => {
    expect(stepper).toContain('setSigningStatus(result.signatureProduced ? "signed" : "requested")');
  });

  it("existe un estado propio para 'solicitada', distinto de 'firmada'", () => {
    expect(stepper).toContain('"requested"');
    expect(stepper).toContain("Solicitud de firma enviada — pendiente de firma");
    expect(stepper).toContain("Documento firmado por todos los firmantes");
  });

  it("ninguna cadena de esta pantalla afirma firma cualificada", () => {
    const visible = stepper.match(/"[^"]{4,}"|>[^<>{}]{4,}</g) ?? [];
    const infractoras = visible.filter(
      (t) => /\bQES\b/.test(t) || /firma\s+(electr[óo]nica\s+)?cualificada/i.test(t),
    );
    expect(infractoras).toEqual([]);
  });
});

describe("lo archivado es lo firmado (Codex adversarial)", () => {
  const stepper = read(STEPPER);

  it("se conserva el PDF exacto que se envió a firmar", () => {
    // Se enviaba el PDF a firmar y se archivaba el DOCX: la evidencia apuntaba
    // a un artefacto distinto del firmado, que es el defecto que este camino
    // vino a corregir, solo que desplazado un paso.
    expect(stepper).toContain("setSignedPdfBuffer(pdfBuffer);");
  });

  it("el archivado prefiere el firmado, luego el PDF enviado, y solo al final el DOCX", () => {
    expect(stepper).toMatch(
      /archiveBuffer\s*=\s*qesResult\?\.signedDocumentData[\s\S]{0,220}signedPdfBuffer[\s\S]{0,220}docxBuffer/,
    );
  });

  it("el nombre del archivo sigue al artefacto real", () => {
    expect(stepper).toMatch(/signedPdfBuffer\s*\?\s*"\.pdf"\s*:\s*""/);
  });
});

describe("la hora de firma nunca se fabrica (Codex adversarial)", () => {
  const hook = read("src/hooks/useQTSPSign.ts");

  it("ningún camino real sella con el reloj local", () => {
    // El reloj del navegador no acredita cuándo se firmó. La fecha real llega
    // del proveedor al reconciliar.
    const camposFecha = hook.match(/signed_at:\s*[^,\n]+/g) ?? [];
    const fabricados = camposFecha.filter((c) => c.includes("new Date()"));
    // Solo el adaptador sandbox, que es un simulador declarado y cuya evidencia
    // el gate degrada siempre, puede tener una fecha sintética.
    expect(fabricados.length).toBeLessThanOrEqual(1);
    expect(hook).toContain("signed_at: null,");
  });

  it("el camino directo también comprueba el estado antes de dar por firmada", () => {
    expect(hook).toContain("const producidaDirecta = isSignatureProduced(result.srStatus);");
  });
});

describe("el sello va donde el generador dice (Codex adversarial)", () => {
  it("el stepper propaga el ancla calculada sobre el PDF real", () => {
    // Fijar página 1 a ciegas colocaba la firma sobre el cuerpo del acuerdo en
    // documentos de varias páginas.
    expect(read(STEPPER)).toContain("signatureAnchor: pdf.signatureAnchor,");
  });

  it("el cliente lo transmite al proxy", () => {
    const client = read("src/lib/qtsp/qtsp-proxy-client.ts");
    expect(client).toContain("signaturePage: input.signatureAnchor?.page,");
    expect(client).toContain("signatureX: input.signatureAnchor?.x,");
    expect(client).toContain("signatureY: input.signatureAnchor?.y,");
  });
});
