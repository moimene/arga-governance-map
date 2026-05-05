import { describe, expect, it } from "vitest";
import {
  validateAgreementDependencies,
  validateDelegationOfPowersVote,
} from "../agreement-dependency-validator";

describe("agreement-dependency-validator — coherencia temporal", () => {
  it("advierte aprobación de cuentas sin auditor nombrado cuando hay obligación", () => {
    const result = validateAgreementDependencies(
      [{ id: "agr-cuentas", materia: "APROBACION_CUENTAS", ejercicio: 2025 }],
      { auditRequired: true, auditorAppointed: false },
    );

    expect(result.severity).toBe("WARNING");
    expect(result.issues[0].code).toBe("accounts_approval_without_required_auditor");
  });

  it("bloquea distribución de dividendo sin aprobación de cuentas del mismo ejercicio", () => {
    const result = validateAgreementDependencies([
      { id: "agr-div", materia: "DISTRIBUCION_DIVIDENDOS", ejercicio: 2025 },
      { id: "agr-cuentas-prev", materia: "APROBACION_CUENTAS", ejercicio: 2024 },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("dividend_distribution_without_accounts_approval");
  });

  it("permite dividendo si consta aprobación de cuentas del mismo ejercicio", () => {
    const result = validateAgreementDependencies([
      { id: "agr-cuentas", materia: "APROBACION_CUENTAS", ejercicio: 2025 },
      { id: "agr-div", materia: "DISTRIBUCION_DIVIDENDOS", ejercicio: 2025 },
    ]);

    expect(result.ok).toBe(true);
  });

  it("cese de consejero con cargo exige redistribución de cargos", () => {
    const result = validateAgreementDependencies([
      { id: "agr-cese", materia: "CESE_CONSEJERO", heldOffice: "PRESIDENTE" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("dismissal_requires_office_redistribution");
  });
});

describe("agreement-dependency-validator — dependencias intra-sesión", () => {
  it("aumento de capital exige modificación del artículo estatutario de capital social", () => {
    const result = validateAgreementDependencies([
      { id: "agr-aumento", materia: "AUMENTO_CAPITAL" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("capital_increase_requires_statutes_capital_article");
  });

  it("aumento de capital queda cubierto si la modificación estatutaria figura en agenda", () => {
    const result = validateAgreementDependencies([
      { id: "agr-aumento", materia: "AUMENTO_CAPITAL" },
      { id: "agr-mod", materia: "MODIFICACION_ESTATUTOS_CAPITAL" },
    ]);

    expect(result.ok).toBe(true);
  });

  it("fusión por absorción genera gate documental para disolución de absorbida", () => {
    const result = validateAgreementDependencies([
      { id: "agr-fusion", materia: "FUSION_ABSORCION", absorbsEntityId: "absorbed-1" },
    ]);

    expect(result.severity).toBe("WARNING");
    expect(result.issues[0].code).toBe("merger_requires_absorbed_company_dissolution_gate");
  });
});

describe("agreement-dependency-validator — delegación y solidarios", () => {
  it("detecta facultades indelegables en el texto de delegación", () => {
    const result = validateAgreementDependencies([
      {
        id: "agr-del",
        materia: "DELEGACION_FACULTADES",
        text: "Se delega la formulacion de cuentas y otras facultades.",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe("delegation_contains_indelegable_powers");
  });

  it("valida mayoría de 2/3 del consejo para delegación de facultades", () => {
    const fail = validateDelegationOfPowersVote({ totalBoardMembers: 9, votesFavor: 5 });
    const pass = validateDelegationOfPowersVote({ totalBoardMembers: 9, votesFavor: 6 });

    expect(fail.ok).toBe(false);
    expect(fail.issues[0].code).toBe("delegation_faculties_two_thirds_not_reached");
    expect(pass.ok).toBe(true);
  });

  it("advierte actuaciones contradictorias de administradores solidarios", () => {
    const result = validateAgreementDependencies([
      { id: "solid-1", materia: "CONTRATO_FINANCIACION", adoptionMode: "SOLIDARIO", actorId: "admin-1", date: "2026-05-04", text: "Aprobar" },
      { id: "solid-2", materia: "CONTRATO_FINANCIACION", adoptionMode: "SOLIDARIO", actorId: "admin-2", date: "2026-05-04", text: "Rechazar" },
    ]);

    expect(result.severity).toBe("WARNING");
    expect(result.issues[0].code).toBe("solidary_admins_contradictory_actions");
  });
});
