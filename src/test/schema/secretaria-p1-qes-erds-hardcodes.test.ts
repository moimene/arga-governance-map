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

describe("Secretaria QES and ERDS hardcode regression", () => {
  it("uses current person as QES signer instead of a demo literal", () => {
    expect(generar).toMatch(/usePersonaCanonical\(personId/);
    expect(generar).toMatch(/createdBy: personId/);
    expect(generar).not.toMatch(/lucia\.martin@arga-seguros\.com/i);
    expect(generar).not.toMatch(/secretaria-demo/);
  });

  it("sends ERDS to body participants without mutating WORM notification rows from detail", () => {
    expect(noSessionDetail).toMatch(/useMeetingParticipants\(data\?\.body_id\)/);
    expect(noSessionDetail).toMatch(/sendCertifiedNotification\.mutateAsync/);
    expect(noSessionDetail).not.toMatch(/destinatario@arga-seguros\.com/i);
    expect(noSessionDetail).not.toMatch(/sendAndTrackNotification/);
  });

  it("keeps ERDS status values aligned with the database contract", () => {
    expect(erdsHook).toMatch(/COMPLETED/);
    expect(erdsHook).not.toMatch(/erdsStatus: 'DELIVERED'/);
    expect(erdsHook).not.toMatch(/updated_at/);
  });
});
