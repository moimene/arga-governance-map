import { describe, expect, it } from "vitest";
import {
  buildCapa3AiAllowedFields,
  suggestCapa3Draft,
} from "../capa3-draft-assistant";
import type { NormalizedCapa3Field } from "@/lib/secretaria/capa3-fields";

const fields: NormalizedCapa3Field[] = [
  { campo: "objeto_informe", obligatoriedad: "OBLIGATORIO", descripcion: "Objeto del informe" },
  { campo: "fecha_emision", obligatoriedad: "OBLIGATORIO", descripcion: "Fecha de emision" },
  { campo: "nif_decisor", obligatoriedad: "OPCIONAL", descripcion: "NIF del decisor" },
];

describe("capa3-draft-assistant", () => {
  it("construye whitelist IA solo para campos Capa 3", () => {
    expect(buildCapa3AiAllowedFields(fields)).toEqual([
      "capa3.objeto_informe",
      "capa3.fecha_emision",
      "capa3.nif_decisor",
    ]);
  });

  it("sugiere borradores sin sobrescribir valores humanos", async () => {
    const result = await suggestCapa3Draft({
      fields,
      currentValues: { fecha_emision: "2026-05-03" },
      baseVariables: { fecha: "2026-06-01" },
      documentType: "INFORME_PRECEPTIVO",
    });

    expect(result.mode).toBe("LOCAL_DEMO");
    expect(result.values.fecha_emision).toBe("2026-05-03");
    expect(result.values.objeto_informe).toContain("Validar la suficiencia documental");
    expect(result.values.nif_decisor).toBe("No informado en demo");
    expect(result.suggestions.every((suggestion) => suggestion.requiresHumanReview)).toBe(true);
  });

  it("limita sugerencias a allowedFields explicitos", async () => {
    const result = await suggestCapa3Draft({
      fields,
      allowedFields: ["capa3.objeto_informe"],
      baseVariables: { fecha: "2026-06-01" },
    });

    expect(result.values.objeto_informe).toBeTruthy();
    expect(result.values.fecha_emision).toBeUndefined();
    expect(result.skippedFields).toEqual(["fecha_emision", "nif_decisor"]);
  });
});
