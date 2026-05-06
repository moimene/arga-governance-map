import { describe, expect, it } from "vitest";
import { buildInitialCapa3Values, normalizeCapa3Draft, normalizeCapa3Fields } from "../capa3-fields";

describe("capa3-fields", () => {
  it("normaliza campos Cloud y modelos legacy con label/tipo", () => {
    expect(
      normalizeCapa3Fields([
        { campo: "fundamento_legal", obligatoriedad: "OBLIGATORIO", descripcion: "Fundamento legal" },
        { campo: "observaciones", obligatoriedad: " recomendado ", tipo: "textarea", label: "Observaciones del secretario" },
        { campo: "observaciones", descripcion: "duplicado" },
        { campo: "campo no seguro", descripcion: "sin campo seguro" },
        null,
        "legacy",
        {},
        { campo: "", descripcion: "sin campo" },
      ]),
    ).toEqual([
      {
        campo: "fundamento_legal",
        obligatoriedad: "OBLIGATORIO",
        descripcion: "Fundamento legal",
      },
      {
        campo: "observaciones",
        obligatoriedad: "RECOMENDADO",
        descripcion: "Observaciones del secretario",
      },
    ]);
  });

  it("precarga valores directos y valores estructurados expandidos", () => {
    const fields = normalizeCapa3Fields([
      { campo: "denominacion_social", obligatoriedad: "OBLIGATORIO", descripcion: "Sociedad" },
      { campo: "presidente", obligatoriedad: "RECOMENDADO", descripcion: "Presidente" },
      { campo: "total_votos", obligatoriedad: "OPCIONAL", descripcion: "Total votos" },
    ]);

    const values = buildInitialCapa3Values(fields, {
      denominacion_social: "ARGA Seguros, S.A.",
      presidente_nombre: "Presidenta del consejo",
      total_votos: 10,
    });

    expect(values).toEqual({
      denominacion_social: "ARGA Seguros, S.A.",
      presidente: "Presidenta del consejo",
      total_votos: "10",
    });
  });

  it("precarga textos Capa 3 desde listas estructuradas ya cargadas", () => {
    const fields = normalizeCapa3Fields([
      { campo: "orden_dia_texto", obligatoriedad: "OBLIGATORIO", descripcion: "Orden" },
      { campo: "acuerdos_texto", obligatoriedad: "OBLIGATORIO", descripcion: "Acuerdos" },
      { campo: "miembros_presentes_texto", obligatoriedad: "OBLIGATORIO", descripcion: "Asistentes" },
    ]);

    const values = buildInitialCapa3Values(fields, {
      orden_dia: [
        { ordinal: "1", descripcion_punto: "Aprobación de cuentas" },
        { ordinal: "2", descripcion_punto: "Distribución de dividendos" },
      ],
      snapshot_puntos: [
        { agenda_item_index: 1, resolution_text: "Se aprueban las cuentas" },
        { agenda_item_index: 2, resolution_text: "Se aprueba la distribución" },
      ],
      attendees: [
        { full_name: "Lucía Paredes" },
        { full_name: "Antonio Ríos" },
      ],
    });

    expect(values).toEqual({
      orden_dia_texto: "1. Aprobación de cuentas\n2. Distribución de dividendos",
      acuerdos_texto: "1. Se aprueban las cuentas\n2. Se aprueba la distribución",
      miembros_presentes_texto: "1. Lucía Paredes\n2. Antonio Ríos",
    });
  });

  it("normaliza borradores parciales, legacy y valores inesperados de forma determinista", () => {
    const fields = normalizeCapa3Fields([
      { campo: "materia_acuerdo", obligatoriedad: "OBLIGATORIO", descripcion: "Materia" },
      { campo: "objeto_informe", obligatoriedad: "OBLIGATORIO", descripcion: "Objeto" },
      { campo: "total_votos", obligatoriedad: "OPCIONAL", descripcion: "Votos" },
    ]);

    const draft = normalizeCapa3Draft(fields, {
      "Materia Acuerdo": "  APROBACION_CUENTAS  ",
      objeto_informe: null,
      "total-votos": 15,
      inesperado: "no debe persistir",
      otra_cosa: { nested: true },
    });

    expect(draft.values).toEqual({
      materia_acuerdo: "APROBACION_CUENTAS",
      total_votos: "15",
    });
    expect(draft.emptyKeys).toEqual(["objeto_informe"]);
    expect(draft.ignoredKeys).toEqual(["inesperado", "otra_cosa"]);
    expect(draft.legacyKeyMap).toEqual({
      "Materia Acuerdo": "materia_acuerdo",
      "total-votos": "total_votos",
    });
  });

  it("descarta entradas null o no objeto sin inventar valores", () => {
    const fields = normalizeCapa3Fields([
      { campo: "conclusion_informe", obligatoriedad: "OBLIGATORIO", descripcion: "Conclusion" },
    ]);

    expect(normalizeCapa3Draft(fields, null)).toEqual({
      values: {},
      emptyKeys: [],
      ignoredKeys: [],
      legacyKeyMap: {},
    });
    expect(normalizeCapa3Draft(fields, ["valor"] as unknown as Record<string, unknown>)).toEqual({
      values: {},
      emptyKeys: [],
      ignoredKeys: [],
      legacyKeyMap: {},
    });
  });
});
