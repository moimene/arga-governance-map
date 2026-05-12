import { describe, expect, it } from "vitest";
import { validateCapa3 } from "@/lib/secretaria/capa3-form-validation";

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

  describe("Codex P2 round 5: valida lista cerrada de opciones", () => {
    it("acepta valor dentro de opciones", () => {
      const fields = [
        {
          campo: "modalidad",
          obligatoriedad: "OBLIGATORIO",
          descripcion: "Modalidad",
          opciones: ["PRESENCIAL", "TELEMATICA"],
        },
      ];
      expect(validateCapa3(fields, { modalidad: "PRESENCIAL" })).toEqual({});
    });

    it("rechaza valor fuera de opciones", () => {
      const fields = [
        {
          campo: "modalidad",
          obligatoriedad: "OBLIGATORIO",
          descripcion: "Modalidad",
          opciones: ["PRESENCIAL", "TELEMATICA"],
        },
      ];
      expect(validateCapa3(fields, { modalidad: "MIXTA" })).toEqual({
        modalidad:
          "Modalidad: valor fuera de las opciones permitidas (PRESENCIAL, TELEMATICA).",
      });
    });

    it("campo opcional con valor fuera de opciones también se rechaza", () => {
      const fields = [
        {
          campo: "modalidad",
          obligatoriedad: "OPCIONAL",
          descripcion: "Modalidad",
          opciones: ["PRESENCIAL", "TELEMATICA"],
        },
      ];
      expect(validateCapa3(fields, { modalidad: "OTRA" })).toHaveProperty("modalidad");
    });

    it("campo opcional sin valor no dispara validación de opciones", () => {
      const fields = [
        {
          campo: "modalidad",
          obligatoriedad: "OPCIONAL",
          descripcion: "Modalidad",
          opciones: ["PRESENCIAL", "TELEMATICA"],
        },
      ];
      expect(validateCapa3(fields, { modalidad: "" })).toEqual({});
    });

    it("opciones vacío no aplica validación de lista cerrada", () => {
      const fields = [
        {
          campo: "modalidad",
          obligatoriedad: "OPCIONAL",
          descripcion: "Modalidad",
          opciones: [],
        },
      ];
      expect(validateCapa3(fields, { modalidad: "CUALQUIERA" })).toEqual({});
    });
  });
});
