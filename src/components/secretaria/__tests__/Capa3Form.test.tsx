import { describe, expect, it } from "vitest";
import { validateCapa3 } from "../Capa3Form";

describe("validateCapa3", () => {
  it("devuelve un mapa campo -> mensaje compatible con Object.keys/Object.values", () => {
    const errors = validateCapa3(
      [
        { campo: "observaciones", obligatoriedad: "OBLIGATORIO", descripcion: "Observaciones" },
        { campo: "anexo", obligatoriedad: "OPCIONAL", descripcion: "Anexo" },
      ],
      { observaciones: "", anexo: "" },
    );

    expect(errors).toEqual({
      observaciones: "Observaciones: campo obligatorio.",
    });
    expect(Object.keys(errors)).toEqual(["observaciones"]);
    expect(Object.values(errors)).toEqual(["Observaciones: campo obligatorio."]);
  });

  it("aplica obligatoriedad condicional telematica solo cuando corresponde", () => {
    const fields = [
      { campo: "canal_telematico", obligatoriedad: "OBLIGATORIO_SI_TELEMATICA", descripcion: "Canal telematico" },
    ];

    expect(validateCapa3(fields, {}, false)).toEqual({});
    expect(validateCapa3(fields, {}, true)).toEqual({
      canal_telematico: "Canal telematico: campo obligatorio.",
    });
  });
});
