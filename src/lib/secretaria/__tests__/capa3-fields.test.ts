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
        tipo: "textarea",
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

  describe("Codex P2 round 5: preserva default + opciones", () => {
    it("preserva field.default cuando viene en el row", () => {
      const fields = normalizeCapa3Fields([
        { campo: "modalidad", obligatoriedad: "OBLIGATORIO", descripcion: "Modalidad", default: "PRESENCIAL" },
      ]);
      expect(fields).toHaveLength(1);
      expect(fields[0].default).toBe("PRESENCIAL");
    });

    it("preserva field.opciones cuando es array de strings", () => {
      const fields = normalizeCapa3Fields([
        {
          campo: "modalidad",
          obligatoriedad: "OBLIGATORIO",
          descripcion: "Modalidad",
          opciones: ["PRESENCIAL", "TELEMATICA", "MIXTA"],
        },
      ]);
      expect(fields[0].opciones).toEqual(["PRESENCIAL", "TELEMATICA", "MIXTA"]);
    });

    it("acepta opciones numéricas convertidas a string", () => {
      const fields = normalizeCapa3Fields([
        { campo: "numero", obligatoriedad: "OPCIONAL", descripcion: "Número", opciones: [1, 2, 3] },
      ]);
      expect(fields[0].opciones).toEqual(["1", "2", "3"]);
    });

    it("rechaza opciones que no son strings ni números", () => {
      const fields = normalizeCapa3Fields([
        {
          campo: "x",
          obligatoriedad: "OPCIONAL",
          descripcion: "x",
          opciones: ["valido", { foo: "bar" }, null, true, "tambien_valido"],
        },
      ]);
      expect(fields[0].opciones).toEqual(["valido", "tambien_valido"]);
    });

    it("descarta default si no está incluido en opciones (defensa)", () => {
      const fields = normalizeCapa3Fields([
        {
          campo: "modalidad",
          obligatoriedad: "OBLIGATORIO",
          descripcion: "Modalidad",
          default: "RAREZA",
          opciones: ["PRESENCIAL", "TELEMATICA"],
        },
      ]);
      expect(fields[0].default).toBeUndefined();
      expect(fields[0].opciones).toEqual(["PRESENCIAL", "TELEMATICA"]);
    });

    it("preserva default + opciones consistentes", () => {
      const fields = normalizeCapa3Fields([
        {
          campo: "modalidad",
          obligatoriedad: "OBLIGATORIO",
          descripcion: "Modalidad",
          default: "PRESENCIAL",
          opciones: ["PRESENCIAL", "TELEMATICA"],
        },
      ]);
      expect(fields[0].default).toBe("PRESENCIAL");
      expect(fields[0].opciones).toEqual(["PRESENCIAL", "TELEMATICA"]);
    });

    it("opciones vacío se descarta (sin renderizar select vacío)", () => {
      const fields = normalizeCapa3Fields([
        { campo: "x", obligatoriedad: "OPCIONAL", descripcion: "x", opciones: [] },
      ]);
      expect(fields[0].opciones).toBeUndefined();
    });
  });

  describe("array repeatable", () => {
    it("normaliza item_schema y conserva array JSON como valor estructurado", () => {
      const fields = normalizeCapa3Fields([
        {
          campo: "lista_actos",
          tipo: "array_repeatable",
          obligatoriedad: "OBLIGATORIO",
          descripcion: "Lista de actos",
          min_items: 1,
          item_schema: {
            fecha_acto: { tipo: "date", requerido: true, label: "Fecha del acto" },
            descripcion: { tipo: "textarea", requerido: true, min_length: 20, label: "Descripción" },
            fundamento_acto: {
              tipo: "select",
              requerido: true,
              label: "Tipo de acto",
              options: ["GESTION_ORDINARIA", "ACTO_NO_RATIFICADO"],
            },
          },
        },
      ]);

      expect(fields[0]).toMatchObject({
        campo: "lista_actos",
        tipo: "array_repeatable",
        min_items: 1,
        item_schema: {
          fecha_acto: { key: "fecha_acto", tipo: "date", requerido: true },
          descripcion: { key: "descripcion", tipo: "textarea", min_length: 20 },
          fundamento_acto: { options: ["GESTION_ORDINARIA", "ACTO_NO_RATIFICADO"] },
        },
      });

      const draft = normalizeCapa3Draft(fields, {
        lista_actos: JSON.stringify([
          {
            fecha_acto: "2026-05-17",
            descripcion: "Contrato de arrendamiento de oficina principal",
            fundamento_acto: "GESTION_ORDINARIA",
          },
          { fecha_acto: "", descripcion: "" },
        ]),
      });

      expect(draft.values.lista_actos).toEqual([
        {
          fecha_acto: "2026-05-17",
          descripcion: "Contrato de arrendamiento de oficina principal",
          fundamento_acto: "GESTION_ORDINARIA",
        },
      ]);
    });
  });
});
