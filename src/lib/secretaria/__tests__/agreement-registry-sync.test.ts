import { describe, expect, it } from "vitest";
import { registryPendingNotice } from "../agreement-registry-sync";

/**
 * Casos tomados del dato real de `governance_OS` (2026-09-05).
 */
describe("mesa de control — inscripción registral", () => {
  it("no dice «pendiente» sobre un acto que el Registro ya inscribió", () => {
    // Garrigues: expediente INSCRITA con asiento 960 y acuerdo en ADOPTED.
    const texto = registryPendingNotice({
      registryRequired: true,
      filingStatus: "INSCRITA",
      inscriptionNumber: "960",
      agreementStatus: "ADOPTED",
    });
    expect(texto).not.toBeNull();
    expect(texto).not.toMatch(/Inscripción registral pendiente/);
    expect(texto).toMatch(/960/);
    expect(texto).toMatch(/sin sincronización acreditada/i);
  });

  it("calla cuando expediente y acuerdo coinciden", () => {
    // ARGA: expediente INSCRITA con acuerdo REGISTERED.
    expect(
      registryPendingNotice({
        registryRequired: true,
        filingStatus: "INSCRITA",
        inscriptionNumber: "16",
        agreementStatus: "REGISTERED",
      }),
    ).toBeNull();
  });

  it("sigue diciendo «pendiente» cuando de verdad lo está", () => {
    expect(
      registryPendingNotice({
        registryRequired: true,
        filingStatus: "PRESENTADA",
        agreementStatus: "CERTIFIED",
      }),
    ).toBe("Inscripción registral pendiente");
    expect(
      registryPendingNotice({ registryRequired: true, filingStatus: null, agreementStatus: "ADOPTED" }),
    ).toBe("Inscripción registral pendiente");
  });

  it("los terminales que no son inscripción también cuentan", () => {
    for (const terminal of ["DEPOSITADA", "LEGALIZADA", "PUBLICADA"]) {
      const texto = registryPendingNotice({
        registryRequired: true,
        filingStatus: terminal,
        agreementStatus: "ADOPTED",
      });
      expect(texto).not.toMatch(/pendiente/i);
    }
  });

  it("no dice nada si la materia no exige inscripción", () => {
    expect(registryPendingNotice({ registryRequired: false, filingStatus: "PRESENTADA" })).toBeNull();
    expect(registryPendingNotice({})).toBeNull();
  });
});
