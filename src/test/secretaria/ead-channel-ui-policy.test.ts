import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const STEPPER = read("src/pages/secretaria/ConvocatoriasStepper.tsx");
const PASO_ENVIO = read("src/components/secretaria/comunicaciones/PasoEnvioMiembros.tsx");
const DETALLE = read("src/pages/secretaria/ConvocatoriaDetalle.tsx");
const GROUP_CAMPAIGNS = read("src/hooks/useGroupCampaigns.ts");

describe("canal EAD visible y persistido en convocatoria/comunicaciones", () => {
  it("ofrece EAD_INTERPOSITION en nuevas capturas y no ofrece ERDS", () => {
    expect(STEPPER).toContain("EAD_INTERPOSITION_CHANNEL");
    expect(STEPPER).not.toContain('{ value: "ERDS"');
    expect(STEPPER).toContain("channelsForNewCapture(source.publication_channels)");
  });

  it("rechaza códigos históricos antes de aceptar una coincidencia literal de recordatorio", () => {
    const legacyGuard = STEPPER.indexOf(
      "if (isLegacyErdsChannel(selectedValue) || isLegacyErdsChannel(reminderValue)) return false;",
    );
    const equalityGuard = STEPPER.indexOf("if (selectedValue === reminderValue) return true;");
    expect(legacyGuard).toBeGreaterThan(-1);
    expect(equalityGuard).toBeGreaterThan(legacyGuard);
  });

  it("retira BUROFAX_ERDS de los selectores de comunicacion", () => {
    expect(PASO_ENVIO).not.toContain('<option value="BUROFAX_ERDS"');
    expect(PASO_ENVIO).toContain("EAD Trust · interposición sandbox");
  });

  it("normaliza también las convocatorias creadas por campañas de grupo", () => {
    expect(GROUP_CAMPAIGNS).toContain("[EAD_INTERPOSITION_CHANNEL]");
    expect(GROUP_CAMPAIGNS).not.toContain('["ERDS"]');
    expect(GROUP_CAMPAIGNS).toContain("campaignAlertsForNewCapture");
    expect(GROUP_CAMPAIGNS).toContain('services: ["INTERPOSITION", "BASIC_MESSAGING", "E_ARCHIVING"]');
    expect(GROUP_CAMPAIGNS).toContain("external_result_claim: false");
  });

  it("persiste la intencion canonica sin habilitar proveedor ni claim ERDS", () => {
    expect(PASO_ENVIO).toContain("channel_semantics");
    expect(PASO_ENVIO).toContain("mode: EAD_INTERPOSITION_CHANNEL");
    expect(PASO_ENVIO).toContain("provider_contract_evidence: null");
    expect(PASO_ENVIO).toContain("signature_claim: false");
    expect(PASO_ENVIO).toContain("erds_claim: false");
    expect(PASO_ENVIO).toContain("ead_delivery_mode: null");
  });

  it("etiqueta los registros historicos sin presentarlos como capacidad vigente", () => {
    expect(DETALLE).toContain("safeEadChannelLabel");
    expect(DETALLE).toContain("Interposición/mensajería/custodia separada; sin firma ni ERDS");
    expect(DETALLE).not.toContain("Notificación electrónica certificada (ERDS) mediante EAD Trust");
  });
});
