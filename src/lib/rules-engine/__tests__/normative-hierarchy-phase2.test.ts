import { describe, expect, it } from "vitest";
import { evaluarPactosParasociales, type PactoParasocial } from "../pactos-engine";
import { resolverReglaEfectiva } from "../jerarquia-normativa";
import type { ReglaParametro, RuleParamOverride } from "../types";

describe("jerarquía normativa completa — Fase 2", () => {
  it("LEY prevalece sobre ESTATUTOS si los estatutos intentan rebajar quórum cualificado", () => {
    const legal: ReglaParametro<number> = {
      valor: 0.5,
      fuente: "LEY",
      referencia: "art. 194 LSC",
    };
    const overrides: RuleParamOverride[] = [
      {
        id: "ov-low-quorum",
        entity_id: "entity-arga",
        materia: "AUMENTO_CAPITAL",
        clave: "constitucion.quorum.SA_1a",
        valor: 0.1,
        fuente: "ESTATUTOS",
        referencia: "estatutos demo inválidos",
      },
    ];

    const result = resolverReglaEfectiva(legal, overrides, "mayor");

    expect(result.valor).toBe(0.5);
    expect(result.fuente).toBe("LEY");
  });

  it("ESTATUTOS prevalecen sobre REGLAMENTO si el reglamento rebaja plazo de convocatoria", () => {
    const estatutos: ReglaParametro<number> = {
      valor: 30,
      fuente: "ESTATUTOS",
      referencia: "estatutos art. convocatoria",
    };
    const overrides: RuleParamOverride[] = [
      {
        id: "ov-reglamento-plazo",
        entity_id: "entity-arga",
        materia: "CONVOCATORIA",
        clave: "convocatoria.antelacionDias",
        valor: 15,
        fuente: "REGLAMENTO",
        referencia: "reglamento junta",
      },
    ];

    const result = resolverReglaEfectiva(estatutos, overrides, "mayor");

    expect(result.valor).toBe(30);
    expect(result.fuente).toBe("ESTATUTOS");
  });

  it("PACTO_PARASOCIAL contradictorio genera warning contractual sin invalidar el acuerdo societario", () => {
    const pacto: PactoParasocial = {
      id: "pacto-sindicacion",
      titulo: "Sindicación de voto",
      tipo_clausula: "SINDICACION_VOTO",
      firmantes: [{ nombre: "Fundación ARGA", tipo: "SOCIO", capital_pct: 69.69 }],
      materias_aplicables: ["APROBACION_CUENTAS"],
      estado: "VIGENTE",
    };

    const result = evaluarPactosParasociales([pacto], {
      materias: ["APROBACION_CUENTAS"],
      capitalPresente: 100,
      capitalTotal: 100,
      votosFavor: 40,
      votosContra: 60,
      consentimientosPrevios: [],
      vetoRenunciado: [],
    });

    expect(result.pacto_ok).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.blocking_issues).toHaveLength(0);
  });
});
