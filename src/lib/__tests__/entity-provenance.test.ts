import { describe, expect, it } from "vitest";
import { provenanceBadges } from "@/lib/entity-provenance";

describe("provenanceBadges", () => {
  it("null/undefined/shape raro → [] (contrato: ARGA sin cambios)", () => {
    expect(provenanceBadges(null)).toEqual([]);
    expect(provenanceBadges(undefined)).toEqual([]);
    expect(provenanceBadges("cadena")).toEqual([]);
    expect(provenanceBadges(42)).toEqual([]);
  });

  it("fuera de cobertura del motor → badge warning con motivo", () => {
    const badges = provenanceBadges({ cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES", confianza: "CONFIRMADO" });
    expect(badges.some((b) => b.label === "Fuera de cobertura normativa (motor ES)")).toBe(true);
  });

  it("A_CONFIRMAR / PENDIENTE → chip de confianza", () => {
    expect(provenanceBadges({ confianza: "A_CONFIRMAR", cobertura_motor: true })
      .some((b) => b.label === "Datos a confirmar")).toBe(true);
    expect(provenanceBadges({ confianza: "PENDIENTE", cobertura_motor: true })
      .some((b) => b.label === "Participación pendiente de fuente")).toBe(true);
    expect(provenanceBadges({ confianza: "CONFIRMADO", cobertura_motor: true })).toEqual([]);
  });

  it("incidencias → badge con el texto en title", () => {
    const badges = provenanceBadges({
      confianza: "CONFIRMADO", cobertura_motor: true,
      incidencias: ["Dos vehículos mexicanos coexistentes"],
    });
    const inc = badges.find((b) => b.label === "1 incidencia de dato");
    expect(inc?.title).toContain("Dos vehículos mexicanos");
  });
});
