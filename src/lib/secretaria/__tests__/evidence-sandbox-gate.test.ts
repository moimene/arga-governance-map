import { describe, expect, it } from "vitest";
import {
  resolveSandboxSafeEvidencePersistence,
  isFinalSealedEvidence,
  SANDBOX_EVIDENCE_STATUS,
  SANDBOX_EVIDENCE_REASON,
} from "@/lib/secretaria/evidence-sandbox-gate";

// Codex adversarial review #2: una firma/notificación QTSP en modo sandbox NUNCA
// debe persistirse como evidencia SEALED/WORM final. El gate centralizado degrada
// a OPEN y marca el manifest. Estos tests prueban esa garantía a nivel de unidad.
describe("evidence sandbox gate (Codex #2)", () => {
  const baseManifest = {
    incident_id: "inc-1",
    qtsp_transaction_id: "SR-SANDBOX-123456",
    document_hash: "deadbeef",
  };

  it("degrada a OPEN (nunca SEALED) cuando el resultado de firma es sandbox", () => {
    // Simula el resultado de useQTSPSign en fallback: { ok: true, sandbox: true }
    const signRes = { ok: true, sandbox: true } as const;

    const resolved = resolveSandboxSafeEvidencePersistence({
      sandbox: signRes.sandbox,
      status: "SEALED",
      manifest: baseManifest,
    });

    expect(resolved.status).toBe("OPEN");
    expect(resolved.status).not.toBe("SEALED");
    expect(resolved.manifest.sandbox).toBe(true);
    expect(resolved.manifest.sandbox_reason).toBe(SANDBOX_EVIDENCE_REASON);
    // Conserva los campos originales del manifest
    expect(resolved.manifest.qtsp_transaction_id).toBe("SR-SANDBOX-123456");
    expect(resolved.manifest.incident_id).toBe("inc-1");
  });

  it("aunque el caller pida SEALED explícitamente, sandbox lo anula", () => {
    const resolved = resolveSandboxSafeEvidencePersistence({
      sandbox: true,
      status: "SEALED",
      manifest: {},
    });
    expect(resolved.status).toBe(SANDBOX_EVIDENCE_STATUS);
    expect(resolved.status).not.toBe("SEALED");
  });

  it("respeta SEALED cuando la firma es real (sandbox=false)", () => {
    const resolved = resolveSandboxSafeEvidencePersistence({
      sandbox: false,
      status: "SEALED",
      manifest: baseManifest,
    });
    expect(resolved.status).toBe("SEALED");
    expect(resolved.manifest.sandbox).toBeUndefined();
    expect(resolved.manifest.sandbox_reason).toBeUndefined();
  });

  it("respeta SEALED por defecto cuando sandbox es undefined", () => {
    const resolved = resolveSandboxSafeEvidencePersistence({
      manifest: baseManifest,
    });
    expect(resolved.status).toBe("SEALED");
    expect(resolved.manifest.sandbox).toBeUndefined();
  });

  it("el status sandbox forzado es válido según el CHECK de evidence_bundles (OPEN|SEALED|VERIFIED)", () => {
    expect(["OPEN", "SEALED", "VERIFIED"]).toContain(SANDBOX_EVIDENCE_STATUS);
  });
});

describe("isFinalSealedEvidence — gate UI (Codex #2-UI)", () => {
  it("SEALED y VERIFIED son evidencia final", () => {
    expect(isFinalSealedEvidence("SEALED")).toBe(true);
    expect(isFinalSealedEvidence("VERIFIED")).toBe(true);
  });

  it("OPEN (status de sandbox) NO es final → la UI no debe rotularlo SEALED/QSeal", () => {
    expect(isFinalSealedEvidence("OPEN")).toBe(false);
  });

  it("status nulo/indefinido/desconocido no es final", () => {
    expect(isFinalSealedEvidence(null)).toBe(false);
    expect(isFinalSealedEvidence(undefined)).toBe(false);
    expect(isFinalSealedEvidence("DRAFT")).toBe(false);
  });

  it("un bundle resultante de una firma sandbox no se considera evidencia final", () => {
    // Cadena completa: firma sandbox → gate degrada a OPEN → UI lo trata como NO final.
    const resolved = resolveSandboxSafeEvidencePersistence({ sandbox: true, status: "SEALED", manifest: {} });
    expect(isFinalSealedEvidence(resolved.status)).toBe(false);
  });
});
