import { describe, expect, it } from "vitest";
import { buildCapa3OverridePayload } from "../useCapa3Overrides";

describe("buildCapa3OverridePayload", () => {
  it("construye payload válido con default, opciones y obligatoriedad", () => {
    expect(
      buildCapa3OverridePayload({
        defaultValue: "A",
        opciones: "A, B",
        obligatoriedad: "OBLIGATORIO",
        motivo: "Ajuste demo sociedad cotizada",
      }),
    ).toEqual({
      ok: true,
      payload: {
        defaultValueOverride: "A",
        opcionesOverride: ["A", "B"],
        obligatoriedadOverride: "OBLIGATORIO",
        motivo: "Ajuste demo sociedad cotizada",
      },
    });
  });

  it("rechaza motivo corto", () => {
    expect(
      buildCapa3OverridePayload({
        defaultValue: "A",
        opciones: "",
        obligatoriedad: "",
        motivo: "corto",
      }),
    ).toEqual({
      ok: false,
      message: "El motivo debe tener al menos 10 caracteres.",
    });
  });

  it("rechaza default fuera de opciones", () => {
    expect(
      buildCapa3OverridePayload({
        defaultValue: "C",
        opciones: "A, B",
        obligatoriedad: "",
        motivo: "Ajuste demo sociedad cotizada",
      }),
    ).toEqual({
      ok: false,
      message: "El default debe estar incluido en las opciones.",
    });
  });

  it("rechaza filas sin ningún override", () => {
    expect(
      buildCapa3OverridePayload({
        defaultValue: "",
        opciones: "",
        obligatoriedad: "",
        motivo: "Ajuste demo sociedad cotizada",
      }),
    ).toEqual({
      ok: false,
      message: "Define al menos un override o elimina la fila existente.",
    });
  });
});
