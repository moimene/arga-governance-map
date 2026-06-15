import { describe, it, expect } from "vitest";
import { evaluarTransmisionConsentimiento as ev } from "./transmision-consentimiento";

const base = {
  esSL: true,
  tipoTransmision: "" as const,
  excepcionLibre: null,
  referenciaEstatutaria: "",
  consentimientoRef: "",
  restriccionEstatutariaSA: false,
  destinoEsSocio: false,
};

// A.1 (Comité Legal): transmisión de participaciones SL — art. 106-107 LSC.
// Warning resoluble durante el flujo; BLOQUEO en cierre si no consta una de las
// tres vías: libre soportada, consentimiento social, o excepción estatutaria.
describe("evaluarTransmisionConsentimiento (A.1 / art. 107 LSC)", () => {
  it("SL sin régimen indicado → warning resoluble + bloquea cierre", () => {
    const r = ev(base);
    expect(r.severity).toBe("WARNING");
    expect(r.blockingAtClose).toBe(true);
  });

  it("SL onerosa con consentimiento social → OK", () => {
    const r = ev({ ...base, tipoTransmision: "ONEROSA", consentimientoRef: "ACUERDO-JGE-2026-07" });
    expect(r.severity).toBe("OK");
    expect(r.blockingAtClose).toBe(false);
  });

  it("SL onerosa sin consentimiento → bloquea cierre (art. 107.2)", () => {
    const r = ev({ ...base, tipoTransmision: "ONEROSA" });
    expect(r.blockingAtClose).toBe(true);
  });

  it("SL libre 'entre socios' con adquirente que SÍ es socio → OK", () => {
    const r = ev({ ...base, tipoTransmision: "LIBRE", excepcionLibre: "ENTRE_SOCIOS", destinoEsSocio: true });
    expect(r.severity).toBe("OK");
    expect(r.blockingAtClose).toBe(false);
  });

  it("SL libre 'entre socios' pero el adquirente NO es socio → bloquea (inconsistencia)", () => {
    const r = ev({ ...base, tipoTransmision: "LIBRE", excepcionLibre: "ENTRE_SOCIOS", destinoEsSocio: false });
    expect(r.blockingAtClose).toBe(true);
  });

  it("SL libre estatutaria sin referencia → bloquea cierre", () => {
    const r = ev({ ...base, tipoTransmision: "LIBRE", excepcionLibre: "ESTATUTARIA", referenciaEstatutaria: "" });
    expect(r.blockingAtClose).toBe(true);
  });

  it("SL libre estatutaria con referencia → OK", () => {
    const r = ev({ ...base, tipoTransmision: "LIBRE", excepcionLibre: "ESTATUTARIA", referenciaEstatutaria: "Art. 9 estatutos" });
    expect(r.severity).toBe("OK");
  });

  it("SL libre marcada sin excepción → bloquea cierre", () => {
    const r = ev({ ...base, tipoTransmision: "LIBRE", excepcionLibre: null });
    expect(r.blockingAtClose).toBe(true);
  });

  it("SA libre por defecto → OK (no bloquea)", () => {
    const r = ev({ ...base, esSL: false });
    expect(r.severity).toBe("OK");
    expect(r.blockingAtClose).toBe(false);
  });

  it("SA con restricción estatutaria sin referencia → warning, no bloquea", () => {
    const r = ev({ ...base, esSL: false, restriccionEstatutariaSA: true });
    expect(r.severity).toBe("WARNING");
    expect(r.blockingAtClose).toBe(false);
  });
});
