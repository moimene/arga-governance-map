import { describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { validateTemplateForActivation } from "@/lib/secretaria/template-admin/gate-pre";
import {
  buildTemplateLayerGateCandidate,
  capa2RequirementPresentation,
  capa2SourceLabel,
  capa2UsagePresentation,
  classifyTemplateVariableNamespace,
  extractCapa1BlockHelpers,
  extractCapa1VariableReferences,
  listCapa1VariableNames,
  normalizeCapa2Rows,
  normalizeCapa3Rows,
  serializeCapa2Rows,
  serializeCapa3Rows,
  templateFieldTypeLabel,
  tokenizeCapa1,
  validateCapa3Rows,
  variableDeclarationMatchesReference,
} from "../template-layer-ux";

function template(patch: Partial<PlantillaProtegidaRow> = {}): PlantillaProtegidaRow {
  return {
    id: "template",
    tenant_id: "tenant",
    tipo: "MODELO_ACUERDO",
    materia: "AUMENTO_CAPITAL",
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "BORRADOR",
    aprobada_por: null,
    fecha_aprobacion: null,
    contenido_template: null,
    capa1_inmutable: null,
    capa2_variables: null,
    capa3_editables: null,
    referencia_legal: "Arts. 295 a 316 LSC",
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: true,
    adoption_mode: "MEETING",
    organo_tipo: "JUNTA_GENERAL",
    tipo_social: null,
    contrato_variables_version: "1.1",
    created_at: "2026-07-11T00:00:00.000Z",
    materia_acuerdo: "AUMENTO_CAPITAL",
    approval_checklist: null,
    version_history: null,
    ...patch,
  };
}

describe("template-layer-ux · serialización lossless", () => {
  it("preserva aliases, tipos y extensiones desconocidas de Capa 2 sin cambios", () => {
    const raw = [
      {
        name: "entities.name",
        source: "entities.legal_name",
        condition: "SIEMPRE",
        required: true,
        description: "Denominación jurídica",
        fallback: { strategy: "tenant-default", value: null },
        validation: { minLength: 3 },
        legal_note: "Art. 23 LSC",
      },
      {
        variable: "ORGANO.nombre",
        fuente: "governing_bodies.name",
        condicion: null,
        obligatoria: "CONDICIONAL",
        descripcion_juridica: "Órgano que adopta el acuerdo",
        valor_fallback: "Consejo de Administración",
        custom: ["se conserva"],
      },
    ];

    const normalized = normalizeCapa2Rows(raw);

    expect(normalized[0]).toMatchObject({
      variable: "entities.name",
      fuente: "entities.legal_name",
      condicion: "SIEMPRE",
      required: true,
      descripcionJuridica: "Denominación jurídica",
    });
    expect(normalized[1]).toMatchObject({
      variable: "ORGANO.nombre",
      fuente: "governing_bodies.name",
      condicion: "",
      obligatoriedad: "CONDICIONAL",
    });
    expect(serializeCapa2Rows(normalized)).toEqual(raw);
  });

  it("edita sobre el estilo original y conserva todas las claves adicionales", () => {
    const raw = {
      name: "entities.name",
      source: "entities.name",
      condition: "SIEMPRE",
      required: true,
      description: "Nombre",
      fallback: "Sin denominación",
      legal: { authority: "LSC" },
    };
    const row = normalizeCapa2Rows([raw])[0];
    const edited = {
      ...row,
      variable: "entities.legal_name",
      fuente: "entities.legal_name",
      required: false,
      obligatoriedad: "OPCIONAL",
      descripcionJuridica: "Denominación social inscrita",
    };

    expect(serializeCapa2Rows([edited])).toEqual([
      {
        name: "entities.legal_name",
        source: "entities.legal_name",
        condition: "SIEMPRE",
        required: false,
        description: "Denominación social inscrita",
        fallback: "Sin denominación",
        legal: { authority: "LSC" },
      },
    ]);
  });

  it("preserva los shapes campo/name/field, descripciones y extras de Capa 3", () => {
    const raw = [
      {
        campo: "importe",
        descripcion: "Importe del acuerdo",
        obligatoriedad: "OBLIGATORIO",
        tipo: "currency",
        label: "Importe",
        default: 0,
        opciones: [0, 1],
        validacion: { min: 0 },
      },
      {
        field: "observaciones",
        hint: "Motivación jurídica",
        required: false,
        type: "textarea",
        display: "Observaciones",
        options: ["A", "B"],
        unknown_nested: { retained: true },
      },
      {
        name: "fecha_efectos",
        description: "Fecha de efectos",
        requerido: true,
        custom_default: "sin tocar",
      },
    ];

    const normalized = normalizeCapa3Rows(raw);

    expect(normalized[1]).toMatchObject({
      campo: "observaciones",
      descripcion: "Motivación jurídica",
      required: false,
      tipo: "textarea",
      label: "Observaciones",
    });
    expect(normalized[2]).toMatchObject({
      campo: "fecha_efectos",
      descripcion: "Fecha de efectos",
      required: true,
    });
    expect(serializeCapa3Rows(normalized)).toEqual(raw);
  });

  it("actualiza Capa 3 en sus aliases ingleses sin introducir claves paralelas", () => {
    const row = normalizeCapa3Rows([
      {
        field: "nota",
        hint: "Texto original",
        required: true,
        type: "textarea",
        options: ["uno"],
        metadata: { owner: "legal" },
      },
    ])[0];

    const serialized = serializeCapa3Rows([
      {
        ...row,
        campo: "nota_legal",
        descripcion: "Texto actualizado",
        obligatoriedad: "OPCIONAL",
        required: false,
        opciones: ["uno", "dos"],
      },
    ])[0];

    expect(serialized).toEqual({
      field: "nota_legal",
      hint: "Texto actualizado",
      required: false,
      type: "textarea",
      options: ["uno", "dos"],
      metadata: { owner: "legal" },
    });
    expect(serialized).not.toHaveProperty("campo");
    expect(serialized).not.toHaveProperty("descripcion");
    expect(serialized).not.toHaveProperty("obligatoriedad");
  });
});

describe("template-layer-ux · candidato Gate", () => {
  it("convierte aliases legacy a las claves canónicas que consume Gate PRE", () => {
    const capa1 = `${"Texto jurídico protegido. ".repeat(5)}{{entities.name}}`;
    const capa2 = normalizeCapa2Rows([
      { name: "entities.name", source: "entities.legal_name", condition: "SIEMPRE", extra: 1 },
    ]);
    const capa3 = normalizeCapa3Rows([
      { field: "observaciones", hint: "Motivación adicional", required: false, widget: "long-text" },
    ]);

    const candidate = buildTemplateLayerGateCandidate(template(), capa1, capa2, capa3);

    expect(candidate.capa2_variables).toEqual([
      expect.objectContaining({
        variable: "entities.name",
        fuente: "entities.legal_name",
        condicion: "SIEMPRE",
        extra: 1,
      }),
    ]);
    expect(candidate.capa3_editables).toEqual([
      expect.objectContaining({
        campo: "observaciones",
        descripcion: "Motivación adicional",
        obligatoriedad: "OPCIONAL",
        widget: "long-text",
      }),
    ]);

    const gate = validateTemplateForActivation(candidate, {
      tenantId: "tenant",
      existingActiveTemplates: [],
      targetEstado: "BORRADOR",
    });
    expect(gate.issues.some((issue) => issue.code === "CAPA2_VAR_NO_CATALOGADA")).toBe(false);
    expect(gate.issues.some((issue) => issue.code === "CAPA3_PREFIJO_PROTEGIDO")).toBe(false);
  });
});

describe("template-layer-ux · referencias, uso y namespaces", () => {
  const capa1 = [
    "<script>esto sigue siendo texto</script>",
    "{{ENTIDAD.denominacion}}",
    "{{#if entities.active}}Activa{{/if}}",
    "{{#each EXPEDIENTE.items as |item|}}{{this.nombre}}{{/each}}",
    "{{! comentario sin variable }}",
    "{{#helper_no_permitido SISTEMA.fecha}}x{{/helper_no_permitido}}",
  ].join("\n");

  it("extrae referencias directas y argumentos de bloques sin confundir cierres, this o comentarios", () => {
    expect(listCapa1VariableNames(capa1)).toEqual([
      "ENTIDAD.denominacion",
      "entities.active",
      "EXPEDIENTE.items",
      "SISTEMA.fecha",
    ]);
    expect(extractCapa1VariableReferences(capa1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ENTIDAD.denominacion",
          kind: "value",
          helper: null,
        }),
        expect.objectContaining({ name: "entities.active", kind: "block", helper: "if" }),
        expect.objectContaining({ name: "EXPEDIENTE.items", kind: "block", helper: "each" }),
      ]),
    );
    expect(extractCapa1BlockHelpers(capa1).map(({ name, allowed }) => ({ name, allowed }))).toEqual([
      { name: "if", allowed: true },
      { name: "each", allowed: true },
      { name: "helper_no_permitido", allowed: false },
    ]);
  });

  it("resuelve coincidencias exactas y wildcard sin hacer matching por prefijo accidental", () => {
    expect(variableDeclarationMatchesReference("entities.*", "entities.active")).toBe(true);
    expect(variableDeclarationMatchesReference("entities.name", "entities.name")).toBe(true);
    expect(variableDeclarationMatchesReference("entities.name", "entities.name_long")).toBe(false);
    expect(variableDeclarationMatchesReference("entities.*", "entity_settings.name")).toBe(false);

    const references = extractCapa1VariableReferences(capa1);
    expect(capa2UsagePresentation({ variable: "entities.*" }, references)).toEqual({
      used: true,
      mode: "wildcard",
      count: 1,
      references: ["entities.active"],
      label: "Usada por comodín (1)",
    });
    expect(capa2UsagePresentation({ variable: "ENTIDAD.denominacion" }, references)).toMatchObject({
      used: true,
      mode: "exact",
      count: 1,
      label: "Usada una vez",
    });
    expect(capa2UsagePresentation({ variable: "REUNION.fecha" }, references)).toMatchObject({
      used: false,
      mode: "unused",
      label: "No usada en el texto",
    });
  });

  it("tokeniza sin producir HTML y clasifica cada expresión por variable o fuente", () => {
    const capa2 = normalizeCapa2Rows([
      { variable: "entities.*", fuente: "entities.*", condicion: "SIEMPRE" },
    ]);
    const tokens = tokenizeCapa1(capa1, capa2);

    expect(tokens.map((token) => token.text).join("")).toBe(capa1);
    expect(tokens[0]).toMatchObject({
      kind: "text",
      text: "<script>esto sigue siendo texto</script>\n",
    });
    expect(
      tokens.find(
        (token) => token.kind === "expression" && token.text === "{{ENTIDAD.denominacion}}",
      ),
    ).toMatchObject({ namespace: { code: "ENTIDAD", family: "entity" } });
    expect(
      tokens.find(
        (token) => token.kind === "expression" && token.text === "{{#if entities.active}}",
      ),
    ).toMatchObject({ namespace: { code: "ENTIDAD", family: "entity" } });
    expect(
      tokens.find(
        (token) => token.kind === "expression" && token.text === "{{#each EXPEDIENTE.items as |item|}}",
      ),
    ).toMatchObject({ namespace: { code: "EXPEDIENTE", family: "case" } });
  });

  it("clasifica por la fuente cuando la variable no declara namespace", () => {
    expect(classifyTemplateVariableNamespace("entities.legal_name")).toMatchObject({
      code: "ENTIDAD",
      family: "entity",
    });
    expect(classifyTemplateVariableNamespace("denominacion_social", "entities.legal_name")).toEqual({
      code: "ENTIDAD",
      label: "Entidad",
      family: "entity",
    });
    expect(classifyTemplateVariableNamespace("presidencia", "governing_bodies.president")).toMatchObject({
      code: "ORGANO",
      family: "body",
    });
  });

  it("reconoce identificadores Unicode reales y su fuente de introducción manual", () => {
    const text = "Ejercicio {{año_ejercicio}} y cierre {{fecha_cierre_ejercicio}}";
    const rows = normalizeCapa2Rows([
      { variable: "año_ejercicio", fuente: "secretario_manual", condicion: "SIEMPRE" },
      { variable: "fecha_cierre_ejercicio", fuente: "secretario_manual", condicion: "SIEMPRE" },
    ]);

    expect(listCapa1VariableNames(text)).toEqual([
      "año_ejercicio",
      "fecha_cierre_ejercicio",
    ]);
    expect(capa2UsagePresentation(rows[0], text).label).toBe("Usada una vez");
    const expressions = tokenizeCapa1(text, rows).filter(
      (token) => token.kind === "expression",
    );
    expect(expressions[0].namespace).toEqual({
      code: "MANUAL",
      label: "Introducción manual",
      family: "manual",
    });
    expect(capa2SourceLabel(rows[0])).toBe("Introducción manual");
  });
});

describe("template-layer-ux · obligatoriedad y Capa 3", () => {
  it("traduce tipos de campo técnicos al lenguaje jurídico visible", () => {
    expect(templateFieldTypeLabel("numero")).toBe("Número");
    expect(templateFieldTypeLabel("texto_largo")).toBe("Texto largo");
    expect(templateFieldTypeLabel("booleano")).toBe("Sí / No");
    expect(templateFieldTypeLabel("custom_type")).toBe("Custom type");
  });

  it("presenta obligatoriedad explícita y solo infiere desde condición cuando falta", () => {
    const [explicit, always, conditional, unknown] = normalizeCapa2Rows([
      { variable: "a", obligatoria: true },
      { variable: "b", condicion: "SIEMPRE" },
      { variable: "c", condition: "SI_COTIZADA" },
      { variable: "d" },
    ]);

    expect(capa2RequirementPresentation(explicit)).toEqual({
      label: "Obligatoria",
      source: "explicit",
      required: true,
    });
    expect(capa2RequirementPresentation(always)).toMatchObject({
      label: "Siempre",
      source: "condition",
    });
    expect(capa2RequirementPresentation(conditional)).toMatchObject({
      label: "Condicional",
      source: "condition",
    });
    expect(capa2RequirementPresentation(unknown)).toEqual({
      label: "No informada",
      source: "unknown",
      required: null,
    });
  });

  it("prioriza la obligatoriedad textual sobre un booleano legacy sin perderlo", () => {
    const [row] = normalizeCapa3Rows([
      {
        campo: "informe",
        obligatoriedad: "RECOMENDADO",
        requerido: false,
      },
    ]);

    expect(row).toMatchObject({ obligatoriedad: "RECOMENDADO", required: false });
    expect(
      capa2RequirementPresentation({
        obligatoriedad: row.obligatoriedad,
        required: row.required,
        condicion: "",
      }).label,
    ).toBe("Recomendada");
    expect(serializeCapa3Rows([row])[0]).toMatchObject({
      obligatoriedad: "RECOMENDADO",
      requerido: false,
    });
  });

  it("añade semántica textual al editar un requisito legacy solo booleano", () => {
    const [row] = normalizeCapa3Rows([{ field: "nota", required: false }]);
    row.obligatoriedad = "RECOMENDADO";

    expect(serializeCapa3Rows([row])[0]).toEqual({
      field: "nota",
      required: false,
      obligatoriedad: "RECOMENDADO",
    });
  });

  it("valida por fila vacío, duplicado, prefijo protegido y descripción", () => {
    const rows = normalizeCapa3Rows([
      { campo: "", descripcion: "" },
      { campo: "observaciones", descripcion: "Primera definición" },
      { field: " OBSERVACIONES ", hint: "" },
      { name: "entidad.denominacion", description: "No puede ser editable" },
      { field: "nota_legal", hint: "Motivación libre" },
    ]);

    const validations = validateCapa3Rows(rows);

    expect(validations[0]).toMatchObject({ invalid: true });
    expect(validations[0].issues.map((issue) => issue.code)).toEqual([
      "CAPA3_FIELD_REQUIRED",
      "CAPA3_DESCRIPTION_REQUIRED",
    ]);
    expect(validations[1].issues.map((issue) => issue.code)).toContain("CAPA3_DUPLICATE_FIELD");
    expect(validations[2].issues.map((issue) => issue.code)).toEqual([
      "CAPA3_DUPLICATE_FIELD",
      "CAPA3_DESCRIPTION_REQUIRED",
    ]);
    expect(validations[3].issues.map((issue) => issue.code)).toEqual([
      "CAPA3_PROTECTED_PREFIX",
    ]);
    expect(validations[4]).toEqual({
      index: 4,
      campo: "nota_legal",
      invalid: false,
      issues: [],
    });
  });
});
