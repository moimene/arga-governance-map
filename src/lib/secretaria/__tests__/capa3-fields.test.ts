import { describe, expect, it } from "vitest";
import {
  buildInitialCapa3Values,
  capa3ValueHasContent,
  capa3ValueToText,
  isBooleanCapa3Field,
  isNumberCapa3Field,
  normalizeBooleanDraftValue,
  normalizeCapa3Draft,
  normalizeCapa3Fields,
  normalizeNumberDraftValue,
  resolveNumberDraftInput,
} from "../capa3-fields";

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

// MOI-206: campos boolean/booleano y number/numero guardan su tipo real en
// vez de String(value). Handlebars trata cualquier texto no vacío ("No"
// incluido) como verdadero — sin esta conversión el documento puede imprimir
// la cláusula contraria a la contestada.
describe("MOI-206 — campos boolean/booleano y number/numero con tipo real", () => {
  describe("isBooleanCapa3Field / isNumberCapa3Field", () => {
    it("reconoce las dos grafías (inglés y castellano), sin distinguir mayúsculas", () => {
      expect(isBooleanCapa3Field({ tipo: "boolean" })).toBe(true);
      expect(isBooleanCapa3Field({ tipo: "Booleano" })).toBe(true);
      expect(isBooleanCapa3Field({ tipo: "BOOLEAN" })).toBe(true);
      expect(isBooleanCapa3Field({ tipo: "number" })).toBe(false);
      expect(isBooleanCapa3Field({ tipo: undefined })).toBe(false);

      expect(isNumberCapa3Field({ tipo: "number" })).toBe(true);
      expect(isNumberCapa3Field({ tipo: "Numero" })).toBe(true);
      expect(isNumberCapa3Field({ tipo: "NUMBER" })).toBe(true);
      expect(isNumberCapa3Field({ tipo: "boolean" })).toBe(false);
    });
  });

  describe("normalizeBooleanDraftValue — lectura de texto legacy", () => {
    it("lee 'No' y 'false' como falso, exactamente el defecto que describe el issue", () => {
      expect(normalizeBooleanDraftValue("No")).toBe(false);
      expect(normalizeBooleanDraftValue("no")).toBe(false);
      expect(normalizeBooleanDraftValue("NO")).toBe(false);
      expect(normalizeBooleanDraftValue("false")).toBe(false);
    });

    it("lee las variantes de 'sí' como verdadero", () => {
      expect(normalizeBooleanDraftValue("Sí")).toBe(true);
      expect(normalizeBooleanDraftValue("SI")).toBe(true);
      expect(normalizeBooleanDraftValue("sí")).toBe(true);
      expect(normalizeBooleanDraftValue("true")).toBe(true);
    });

    it("un booleano real pasa sin cambios", () => {
      expect(normalizeBooleanDraftValue(true)).toBe(true);
      expect(normalizeBooleanDraftValue(false)).toBe(false);
    });

    it("texto irreconocible o vacío es 'sin contestar', nunca 'no'", () => {
      expect(normalizeBooleanDraftValue("")).toBeUndefined();
      expect(normalizeBooleanDraftValue("tal vez")).toBeUndefined();
      expect(normalizeBooleanDraftValue(null)).toBeUndefined();
      expect(normalizeBooleanDraftValue(undefined)).toBeUndefined();
    });
  });

  describe("normalizeNumberDraftValue — lectura de texto legacy", () => {
    it("parsea texto legacy, incluida coma decimal española", () => {
      expect(normalizeNumberDraftValue("42")).toBe(42);
      expect(normalizeNumberDraftValue("3,5")).toBe(3.5);
      expect(normalizeNumberDraftValue("-10")).toBe(-10);
    });

    it("un número real pasa sin cambios", () => {
      expect(normalizeNumberDraftValue(0)).toBe(0);
      expect(normalizeNumberDraftValue(1234.5)).toBe(1234.5);
    });

    it("texto no numérico o vacío es 'sin contestar'", () => {
      expect(normalizeNumberDraftValue("")).toBeUndefined();
      expect(normalizeNumberDraftValue("no aplica")).toBeUndefined();
      expect(normalizeNumberDraftValue(null)).toBeUndefined();
    });
  });

  describe("resolveNumberDraftInput — MOI-206 (revisión): tecleo intermedio no se descarta", () => {
    it("conserva el '-' inicial de un negativo en vez de descartarlo", () => {
      // Regresión: handleNumberChange comprobaba Number.isFinite(Number(raw))
      // antes de guardar, así que un "-" (Number("-") es NaN) no actualizaba
      // el borrador y el <input> controlado revertía al valor anterior en
      // cada pulsación — imposible teclear un negativo pese a que field.min
      // puede ser negativo (p.ej. un importe).
      expect(resolveNumberDraftInput("-")).toBe("-");
    });

    it("conserva un decimal a medio escribir ('3.')", () => {
      expect(resolveNumberDraftInput("3.")).toBe("3.");
      expect(resolveNumberDraftInput("-5.")).toBe("-5.");
    });

    it("un número completo, positivo o negativo, pasa igual", () => {
      expect(resolveNumberDraftInput("-5")).toBe("-5");
      expect(resolveNumberDraftInput("42")).toBe("42");
    });

    it("solo el texto vacío (o solo espacios) se trata como 'sin contestar'", () => {
      expect(resolveNumberDraftInput("")).toBeUndefined();
      expect(resolveNumberDraftInput("   ")).toBeUndefined();
    });
  });

  describe("normalizeCapa3Draft — conversión end-to-end por tipo", () => {
    const fields = normalizeCapa3Fields([
      { campo: "entidad_cotizada", tipo: "boolean", obligatoriedad: "OBLIGATORIO", descripcion: "Cotizada" },
      { campo: "es_parte_vinculada", tipo: "booleano", obligatoriedad: "OPCIONAL", descripcion: "Vinculada" },
      { campo: "importe_operacion", tipo: "number", obligatoriedad: "OBLIGATORIO", descripcion: "Importe", min: 0, max: 1000000 },
      { campo: "plazo_mandato", tipo: "numero", obligatoriedad: "OPCIONAL", descripcion: "Plazo" },
    ]);

    it("añade min/max al contrato del campo number", () => {
      expect(fields.find((f) => f.campo === "importe_operacion")).toMatchObject({
        tipo: "number",
        min: 0,
        max: 1000000,
      });
    });

    it("un borrador legacy con 'No' se lee como booleano false, no como texto", () => {
      const draft = normalizeCapa3Draft(fields, { entidad_cotizada: "No" });
      expect(draft.values.entidad_cotizada).toBe(false);
      expect(typeof draft.values.entidad_cotizada).toBe("boolean");
    });

    it("un borrador legacy con 'false' (texto) también se lee como false", () => {
      const draft = normalizeCapa3Draft(fields, { entidad_cotizada: "false" });
      expect(draft.values.entidad_cotizada).toBe(false);
    });

    it("un borrador legacy con 'SÍ' se lee como true", () => {
      const draft = normalizeCapa3Draft(fields, { es_parte_vinculada: "SÍ" });
      expect(draft.values.es_parte_vinculada).toBe(true);
    });

    it("el nuevo control tri-estado ya guarda un booleano real, sin conversión con pérdida", () => {
      const draft = normalizeCapa3Draft(fields, { entidad_cotizada: false, es_parte_vinculada: true });
      expect(draft.values).toEqual({ entidad_cotizada: false, es_parte_vinculada: true });
    });

    it("un número legacy en texto se lee como number real", () => {
      const draft = normalizeCapa3Draft(fields, { importe_operacion: "150000" });
      expect(draft.values.importe_operacion).toBe(150000);
      expect(typeof draft.values.importe_operacion).toBe("number");
    });

    it("0 es una respuesta válida (has content), no 'sin contestar'", () => {
      const draft = normalizeCapa3Draft(fields, { plazo_mandato: 0 });
      expect(draft.values.plazo_mandato).toBe(0);
      expect(draft.emptyKeys).not.toContain("plazo_mandato");
    });

    it("texto irreconocible en un booleano no se guarda como 'no'; queda sin contestar", () => {
      const draft = normalizeCapa3Draft(fields, { entidad_cotizada: "quizás" });
      expect(draft.values.entidad_cotizada).toBeUndefined();
      expect(draft.emptyKeys).toContain("entidad_cotizada");
    });
  });

  describe("capa3ValueHasContent / capa3ValueToText con el tipo real", () => {
    it("una respuesta 'No' (false) cuenta como contestada, no como campo vacío", () => {
      expect(capa3ValueHasContent(false)).toBe(true);
      expect(capa3ValueHasContent(true)).toBe(true);
    });

    it("una respuesta numérica 0 cuenta como contestada", () => {
      expect(capa3ValueHasContent(0)).toBe(true);
    });

    it("capa3ValueToText muestra Sí/No en castellano para lectura humana", () => {
      expect(capa3ValueToText(true)).toBe("Sí");
      expect(capa3ValueToText(false)).toBe("No");
    });
  });
});
