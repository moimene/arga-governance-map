import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const generar = readFileSync(
  join(process.cwd(), "src/pages/secretaria/GenerarDocumentoStepper.tsx"),
  "utf8",
);

const noSessionDetail = readFileSync(
  join(process.cwd(), "src/pages/secretaria/AcuerdoSinSesionDetalle.tsx"),
  "utf8",
);

const erdsHook = readFileSync(
  join(process.cwd(), "src/hooks/useERDSNotification.ts"),
  "utf8",
);

describe("Secretaría · interposición EAD y mensajería sin hardcodes", () => {
  it("el generador no inicia firma ni custodia genérica desde el navegador", () => {
    expect(generar).not.toMatch(/useQTSPSign/);
    expect(generar).not.toMatch(/signMutation/);
    expect(generar).not.toMatch(/providerSignatureType/);
    expect(generar).not.toMatch(/signatureAnchor/);
    expect(generar).not.toMatch(/signedDocumentData/);
    expect(generar).toMatch(/custodia el artefacto jurídico[\s\S]{0,120}expediente autoritativo/i);
    expect(generar).not.toContain("Solicitar firma");
    expect(generar).not.toMatch(/lucia\.martin@arga-seguros\.com/i);
    expect(generar).not.toMatch(/secretaria-demo/);
  });

  it("registers a non-dispatchable EAD interposition draft for body participants", () => {
    expect(noSessionDetail).toContain("useNoSessionParticipants(");
    expect(noSessionDetail).toContain("sourceEntityCandidate");
    expect(noSessionDetail).toMatch(/createInterpositionDraft\.mutateAsync/);
    expect(noSessionDetail).toMatch(/sin envío ni interacción con proveedor/i);
    expect(noSessionDetail).not.toMatch(/destinatario@arga-seguros\.com/i);
    expect(noSessionDetail).not.toMatch(/sendAndTrackNotification/);
  });

  it("keeps the browser outside dispatch, signature and provider fact creation", () => {
    expect(erdsHook).toMatch(/fn_create_ead_interposition_draft/);
    expect(erdsHook).toMatch(/status: "BORRADOR"/);
    expect(erdsHook).toMatch(/providerInteraction: false/);
    expect(erdsHook).toMatch(/deliveryProven: false/);
    expect(erdsHook).toMatch(/providerArchiveProven: false/);
    expect(erdsHook).not.toMatch(/useProgramCommunication/);
    expect(erdsHook).not.toMatch(/BUROFAX_ERDS/);
    expect(erdsHook).not.toMatch(/generateEvidence/);
    expect(erdsHook).not.toMatch(/deliveryRef/);
    expect(erdsHook).not.toMatch(/\.from\(\s*["']no_session_notificaciones["']\s*\)/);
  });
});
