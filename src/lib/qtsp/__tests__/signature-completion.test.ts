import { describe, expect, it } from "vitest";
import {
  isSignatureProduced,
  resolveSignatureOutcome,
  signatureOutcomeLabel,
  signatureTypeLabel,
} from "../signature-completion";
import { resolveSandboxSafeEvidencePersistence } from "@/lib/secretaria/evidence-sandbox-gate";

/**
 * El flujo de EAD Trust termina en `activate`, y ahí la solicitud queda `ACTIVE`:
 * los firmantes han recibido el enlace y NADIE ha firmado. El sistema daba eso
 * por firma completada, fabricaba la hora y sellaba evidencia WORM.
 *
 * Vocabulario del proveedor verificado en producción (playbook de integración):
 * `DRAFT → ACTIVE → PARTIALLY_SIGNED → COMPLETED`.
 */

describe("resolveSignatureOutcome — solo COMPLETED acredita firma", () => {
  it("ACTIVE es solicitud, no firma: es el caso que producía el daño", () => {
    expect(resolveSignatureOutcome("ACTIVE")).toBe("SOLICITADA");
    expect(isSignatureProduced("ACTIVE")).toBe(false);
  });

  it("DRAFT tampoco", () => {
    expect(isSignatureProduced("DRAFT")).toBe(false);
  });

  it("PARTIALLY_SIGNED no basta: faltan firmantes", () => {
    expect(resolveSignatureOutcome("PARTIALLY_SIGNED")).toBe("PARCIAL");
    expect(isSignatureProduced("PARTIALLY_SIGNED")).toBe(false);
  });

  it("COMPLETED es el único que acredita", () => {
    expect(resolveSignatureOutcome("completed")).toBe("COMPLETADA");
    expect(isSignatureProduced("COMPLETED")).toBe(true);
  });

  it("anulada o caducada no acreditan", () => {
    expect(isSignatureProduced("CANCELLED")).toBe(false);
    expect(isSignatureProduced("EXPIRED")).toBe(false);
  });

  it("un estado desconocido nunca acredita firma", () => {
    expect(isSignatureProduced("LO_QUE_SEA")).toBe(false);
    expect(isSignatureProduced(null)).toBe(false);
    expect(isSignatureProduced(undefined)).toBe(false);
  });

  it("las etiquetas describen el hecho sin adjetivar su eficacia", () => {
    expect(signatureOutcomeLabel("SOLICITADA")).toBe("Firma solicitada — pendiente de firma");
    expect(signatureOutcomeLabel("COMPLETADA")).toBe("Firmado por todos los firmantes");
  });
});

describe("nivel de firma — no se puede rotular QES en este camino", () => {
  it("INTERPOSITION es firma simple, no cualificada", () => {
    // EAD Enterprise Suite 1.4.2 no expone tipo cualificado; su máximo es
    // ADVANCED. Nuestro proxy emite INTERPOSITION, que es art. 25.1 eIDAS.
    const etiqueta = signatureTypeLabel("INTERPOSITION");
    expect(etiqueta).toContain("simple");
    expect(etiqueta).toContain("25.1");
    expect(etiqueta).not.toContain("cualificada");
    expect(etiqueta).not.toContain("QES");
  });

  it("ADVANCED es avanzada con OTP, tampoco cualificada", () => {
    const etiqueta = signatureTypeLabel("ADVANCED");
    expect(etiqueta).toContain("avanzada");
    expect(etiqueta).not.toContain("cualificada");
  });
});

describe("gate de evidencia — no se sella lo que no está firmado", () => {
  const manifest = { doc: "acta" };

  it("firma real ACTIVE no puede sellarse: era el agujero", () => {
    const r = resolveSandboxSafeEvidencePersistence({
      sandbox: false,
      srStatus: "ACTIVE",
      status: "SEALED",
      manifest,
    });
    expect(r.status).toBe("OPEN");
    expect(r.manifest.signature_outcome).toBe("SOLICITADA");
    expect(r.manifest.signature_provider_status).toBe("ACTIVE");
    expect(String(r.manifest.pending_signature_reason)).toContain("aun no se ha producido");
  });

  it("firma completada sí sella", () => {
    const r = resolveSandboxSafeEvidencePersistence({
      sandbox: false,
      srStatus: "COMPLETED",
      status: "SEALED",
      manifest,
    });
    expect(r.status).toBe("SEALED");
  });

  it("el sandbox sigue degradando, con su propio motivo", () => {
    const r = resolveSandboxSafeEvidencePersistence({
      sandbox: true,
      srStatus: "COMPLETED",
      status: "SEALED",
      manifest,
    });
    expect(r.status).toBe("OPEN");
    expect(r.manifest.sandbox).toBe(true);
  });

  it("sin dato de estado se conserva el comportamiento previo", () => {
    // Los callers que aún no informan del estado no cambian de conducta; el
    // gate solo endurece cuando SABE que la firma no se ha producido.
    const r = resolveSandboxSafeEvidencePersistence({ sandbox: false, status: "SEALED", manifest });
    expect(r.status).toBe("SEALED");
  });
});

describe("gate de evidencia — bordes que deciden si se sella o no", () => {
  const manifest = { doc: "acta" };

  it("srStatus AUSENTE conserva el comportamiento previo; srStatus NULL no sella", () => {
    // Distinción deliberada y fácil de romper sin querer:
    //  · ausente  = el caller no informa → no se cambia su conducta;
    //  · null     = el caller informa que NO hay estado → no se puede acreditar.
    const ausente = resolveSandboxSafeEvidencePersistence({ status: "SEALED", manifest });
    expect(ausente.status).toBe("SEALED");

    const nulo = resolveSandboxSafeEvidencePersistence({ srStatus: null, status: "SEALED", manifest });
    expect(nulo.status).toBe("OPEN");
    expect(nulo.manifest.signature_outcome).toBe("NO_SOLICITADA");
  });

  it("una firma parcial no sella: faltan firmantes", () => {
    const r = resolveSandboxSafeEvidencePersistence({
      srStatus: "PARTIALLY_SIGNED",
      status: "SEALED",
      manifest,
    });
    expect(r.status).toBe("OPEN");
    expect(r.manifest.signature_outcome).toBe("PARCIAL");
  });

  it("una solicitud anulada o caducada no sella", () => {
    for (const estado of ["CANCELLED", "EXPIRED"]) {
      const r = resolveSandboxSafeEvidencePersistence({ srStatus: estado, status: "SEALED", manifest });
      expect(r.status).toBe("OPEN");
      expect(r.manifest.signature_outcome).toBe("SIN_EFECTO");
    }
  });

  it("un estado desconocido del proveedor NUNCA sella (falla cerrado)", () => {
    // Si EAD introdujera un estado nuevo, el defecto debe ser no acreditar.
    const r = resolveSandboxSafeEvidencePersistence({
      srStatus: "ALGO_NUEVO_DEL_PROVEEDOR",
      status: "SEALED",
      manifest,
    });
    expect(r.status).toBe("OPEN");
  });

  it("el sandbox manda sobre el estado de firma", () => {
    // Aunque el proveedor dijera COMPLETED, un resultado sandbox no es real.
    const r = resolveSandboxSafeEvidencePersistence({
      sandbox: true,
      srStatus: "COMPLETED",
      status: "SEALED",
      manifest,
    });
    expect(r.status).toBe("OPEN");
    expect(r.manifest.sandbox).toBe(true);
  });

  it("no pisa el manifest original al añadir la traza", () => {
    const original = { doc: "acta", cadena: ["a"] };
    const r = resolveSandboxSafeEvidencePersistence({
      srStatus: "ACTIVE",
      status: "SEALED",
      manifest: original,
    });
    expect(r.manifest.doc).toBe("acta");
    expect(r.manifest.cadena).toEqual(["a"]);
    expect(original).not.toHaveProperty("signature_outcome");
  });
});
