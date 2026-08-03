import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stepper = readFileSync(
  join(process.cwd(), "src/pages/secretaria/AcuerdoSinSesionStepper.tsx"),
  "utf8",
);

describe("acuerdo sin sesión · canal operativo de nueva captura", () => {
  it("ofrece únicamente interposición EAD Trust o email ordinario", () => {
    expect(stepper).toContain("EAD_INTERPOSITION_CHANNEL");
    expect(stepper).toContain('value: "EMAIL_SIMPLE"');
    expect(stepper).toContain(
      "EAD Trust · interposición, mensajería básica y custodia/e-archiving",
    );
    expect(stepper).not.toMatch(/\bERDS\b|\bQES\b|\bQTSP\b/);
  });

  it("persiste una preparación canónica y separa la referencia del destinatario", () => {
    expect(stepper).toContain(
      "`Canal operativo preparado [${communicationChannel}]: ${communicationChannelLabel}`",
    );
    expect(stepper).toContain(
      "`Referencia operativa del destinatario: ${communicationReference.trim()}`",
    );
    expect(stepper).not.toContain("Dirección de notificación:");
    expect(stepper).not.toContain("direccionNotificacion");
  });

  it("no presenta el dato operativo como resultado externo o certificado", () => {
    expect(stepper).toContain(
      "Se guarda únicamente como trazabilidad de preparación interna del canal.",
    );
    expect(stepper).not.toMatch(/acuse|env[ií]o|entrega|certificad[ao]/i);
  });
});
