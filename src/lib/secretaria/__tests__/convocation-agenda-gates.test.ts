import { describe, expect, it } from "vitest";
import {
  buildSoleShareholderRepresentativeProposal,
  detectAnnualAccountsExercise,
  evaluateAnnualAccountsTimeliness,
  hasSoleShareholderRepresentativeConditions,
} from "../convocation-agenda-gates";

describe("gates jurídicos reutilizables de la convocatoria", () => {
  it("detecta el ejercicio en el título o en la propuesta sin inventar ante conflicto", () => {
    expect(
      detectAnnualAccountsExercise(
        "Formulación de cuentas anuales del ejercicio 2025",
        null,
      ),
    ).toBe(2025);
    expect(
      detectAnnualAccountsExercise(
        "Formulación de cuentas anuales",
        "Formular las cuentas correspondientes al ejercicio cerrado el 31 de diciembre de 2025.",
      ),
    ).toBe(2025);
    expect(
      detectAnnualAccountsExercise(
        "Cuentas anuales del ejercicio 2024",
        "Formular las cuentas del ejercicio 2025.",
      ),
    ).toBeNull();
  });

  it("bloquea una formulación posterior al 31 de marzo si la propuesta calla la regularización", () => {
    const result = evaluateAnnualAccountsTimeliness({
      sessionDate: "2026-08-09",
      title: "Formulación de cuentas anuales del ejercicio 2025",
      proposal: "Formular las cuentas anuales individuales del ejercicio 2025.",
    });

    expect(result).toMatchObject({
      exerciseYear: 2025,
      deadline: "2026-03-31",
      isLate: true,
      regularizationConditionIncluded: false,
      blocking: true,
    });
    expect(result.message).toContain("art. 253.1 LSC");
    expect(result.message).toContain("regularización");
  });

  it("permite revisión cuando la propuesta reconoce extemporaneidad y regularización", () => {
    const result = evaluateAnnualAccountsTimeliness({
      sessionDate: "2026-08-09",
      title: "Formulación de cuentas anuales del ejercicio 2025",
      proposal:
        "Reconocer que la formulación es extemporánea respecto del plazo del artículo 253.1 LSC y formular las cuentas como medida de regularización, sin convalidar el incumplimiento anterior.",
    });

    expect(result).toMatchObject({
      isLate: true,
      regularizationConditionIncluded: true,
      blocking: false,
    });
  });

  it("no activa el gate extemporáneo si la sesión se celebra como máximo el 31 de marzo", () => {
    expect(
      evaluateAnnualAccountsTimeliness({
        sessionDate: "2026-03-31",
        title: "Formulación de cuentas del ejercicio 2025",
        proposal: "Formular las cuentas anuales del ejercicio 2025.",
      }).blocking,
    ).toBe(false);
  });

  it("genera la representación como propuesta condicionada a las tres evidencias", () => {
    const proposal = buildSoleShareholderRepresentativeProposal({
      shareholderName: "ARGA Seguros, S.A.",
      targetName: "ARGA Digital, S.L.U.",
      representativeName: "Dña. Carmen Delgado Ortiz",
    });

    expect(hasSoleShareholderRepresentativeConditions(proposal)).toBe(true);
    expect(proposal).toContain("poder general en documento público");
    expect(proposal).toContain("artículo 183.1");
    expect(proposal).toContain("100 % del capital");
    expect(proposal).toContain("ausencia de administrador persona jurídica");
    expect(proposal).toContain("no producirá efecto mientras no se incorporen y validen");
    expect(proposal).not.toContain("poder general vigente registrado");
    expect(proposal).not.toContain("título representativo acreditado");
    expect(proposal).toContain("ante ARGA Digital, S.L.U. La propuesta");
    expect(proposal).not.toContain("S.L.U.. La propuesta");
  });

  it("rechaza texto que presenta el registro DEMO como título ya acreditado", () => {
    expect(
      hasSoleShareholderRepresentativeConditions(
        "Designar a Carmen porque consta un poder general vigente registrado y ARGA es socia única.",
      ),
    ).toBe(false);
  });
});
