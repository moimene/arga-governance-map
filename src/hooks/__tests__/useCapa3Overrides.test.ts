import { describe, expect, it } from "vitest";
import { buildCapa3OverridePayload } from "../useCapa3Overrides";

describe("buildCapa3OverridePayload", () => {
  it("normaliza defaults, opciones y obligatoriedad", () => {
    expect(
      buildCapa3OverridePayload({
        defaultValue: "  Consejo  ",
        opciones: "Consejo, Junta",
        obligatoriedad: "RECOMENDADO",
        motivo: "Ajuste societario de ARGA",
      }),
    ).toEqual({
      ok: true,
      payload: {
        defaultValueOverride: "Consejo",
        opcionesOverride: ["Consejo", "Junta"],
        obligatoriedadOverride: "RECOMENDADO",
        motivo: "Ajuste societario de ARGA",
      },
    });
  });

  it("rechaza motivos demasiado cortos", () => {
    expect(
      buildCapa3OverridePayload({
        defaultValue: "Consejo",
        opciones: "",
        obligatoriedad: "",
        motivo: "corto",
      }),
    ).toEqual({
      ok: false,
      message: "El motivo debe tener al menos 10 caracteres.",
    });
  });

  it("rechaza defaults fuera de las opciones declaradas", () => {
    expect(
      buildCapa3OverridePayload({
        defaultValue: "Consejo",
        opciones: "Junta, Socio unico",
        obligatoriedad: "",
        motivo: "Motivo suficiente",
      }),
    ).toEqual({
      ok: false,
      message: "El default debe estar incluido en las opciones.",
    });
  });

  it("exige al menos un override efectivo", () => {
    expect(
      buildCapa3OverridePayload({
        defaultValue: "",
        opciones: "",
        obligatoriedad: "",
        motivo: "Motivo suficiente",
      }),
    ).toEqual({
      ok: false,
      message: "Define al menos un override o elimina la fila existente.",
    });
  });
});
