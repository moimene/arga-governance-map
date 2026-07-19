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
      discardedValues: {},
    });
    expect(normalizeCapa3Draft(fields, ["valor"] as unknown as Record<string, unknown>)).toEqual({
      values: {},
      emptyKeys: [],
      ignoredKeys: [],
      legacyKeyMap: {},
      discardedValues: {},
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

    it("descarta valores de draft fuera de opciones (lista cerrada)", () => {
      const fields = normalizeCapa3Fields([
        {
          campo: "cargo_convocante",
          obligatoriedad: "OBLIGATORIO",
          descripcion: "Cargo del convocante",
          opciones: ["PRESIDENTE", "CONSEJERO_DESIGNADO"],
        },
      ]);

      // Valor sembrado por expansión de alias legales (firma_organo_administracion
      // → cargo_convocante): fuera de la lista cerrada, debe descartarse para no
      // dejar un <select> "sin seleccionar" con estado inválido invisible.
      const poisoned = normalizeCapa3Draft(fields, {
        cargo_convocante: "Secretaría del órgano convocante",
      });
      expect(poisoned.values.cargo_convocante).toBeUndefined();
      expect(poisoned.emptyKeys).toEqual(["cargo_convocante"]);

      const valid = normalizeCapa3Draft(fields, { cargo_convocante: "PRESIDENTE" });
      expect(valid.values.cargo_convocante).toBe("PRESIDENTE");
    });

    it("buildInitialCapa3Values no siembra valores fuera de la lista cerrada", () => {
      const fields = normalizeCapa3Fields([
        {
          campo: "modalidad_sesion",
          obligatoriedad: "OBLIGATORIO",
          descripcion: "Modalidad de la sesión",
          opciones: ["PRESENCIAL", "TELEMATICA", "MIXTA"],
        },
      ]);

      expect(
        buildInitialCapa3Values(fields, { modalidad_sesion: "TELEMATICA" }),
      ).toEqual({ modalidad_sesion: "TELEMATICA" });
      expect(buildInitialCapa3Values(fields, { modalidad_sesion: "—" })).toEqual({});
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

// Regresión (Codex adversarial 2026-07-18): el filtro por `opciones` desbloquea
// la generación, pero no puede hacer desaparecer datos legítimos en silencio.
describe("capa3 — valores descartados por lista cerrada", () => {
  const fields = normalizeCapa3Fields([
    {
      campo: "modalidad_sesion",
      obligatoriedad: "OBLIGATORIO",
      descripcion: "Modalidad de la sesión",
      tipo: "enum",
      opciones: ["PRESENCIAL", "TELEMATICA", "MIXTA"],
    },
  ]);

  it("descarta el valor fuera de lista pero lo reporta para poder avisar", () => {
    const draft = normalizeCapa3Draft(fields, { modalidad_sesion: "HIBRIDA" });
    // No se cuela en los valores (bloquearía la validación en silencio)...
    expect(draft.values.modalidad_sesion).toBeUndefined();
    // ...pero tampoco se pierde: queda registrado para la UI.
    expect(draft.discardedValues.modalidad_sesion).toBe("HIBRIDA");
  });

  it("un valor válido no se reporta como descartado", () => {
    const draft = normalizeCapa3Draft(fields, { modalidad_sesion: "TELEMATICA" });
    expect(draft.values.modalidad_sesion).toBe("TELEMATICA");
    expect(draft.discardedValues).toEqual({});
  });

  it("un campo simplemente vacío no cuenta como descartado", () => {
    const draft = normalizeCapa3Draft(fields, { modalidad_sesion: "" });
    expect(draft.discardedValues).toEqual({});
    expect(draft.emptyKeys).toContain("modalidad_sesion");
  });
});

describe("Codex adversarial 2ª pasada: la poda parcial de un array también se avisa", () => {
  const fields = normalizeCapa3Fields([
    {
      campo: "asistentes",
      tipo: "array",
      item_schema: { nombre: { tipo: "text" }, cargo: { tipo: "text" } },
    },
  ]);

  it("avisa cuando sobreviven menos filas de las que entraron", () => {
    const draft = normalizeCapa3Draft(fields, {
      asistentes: [
        { nombre: "Ana Ruiz", cargo: "Presidenta" },
        { otro: "campo ajeno al esquema" },
        {},
      ],
    });
    // Las filas válidas se conservan...
    expect(draft.values.asistentes).toEqual([{ nombre: "Ana Ruiz", cargo: "Presidenta" }]);
    // ...y la pérdida de las otras dos NO pasa en silencio.
    expect(draft.discardedValues.asistentes).toBe(
      "2 de 3 fila(s) no compatibles con el formato del campo",
    );
  });

  it("no avisa cuando el array llega íntegro", () => {
    const draft = normalizeCapa3Draft(fields, {
      asistentes: [{ nombre: "Ana Ruiz", cargo: "Presidenta" }],
    });
    expect(draft.discardedValues).toEqual({});
  });

  it("un array que se vacía por completo sigue avisando", () => {
    const draft = normalizeCapa3Draft(fields, { asistentes: [{}, {}] });
    expect(draft.values.asistentes).toBeUndefined();
    expect(draft.discardedValues.asistentes).toBe(
      "2 de 2 fila(s) no compatibles con el formato del campo",
    );
  });

  it("un texto que no es un array se reporta literal", () => {
    const draft = normalizeCapa3Draft(fields, { asistentes: "Ana, Pedro" });
    expect(draft.discardedValues.asistentes).toBe("Ana, Pedro");
  });
});
