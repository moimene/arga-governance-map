import { describe, expect, it } from "vitest";
import {
  auditTemplateInventory,
  classifyTemplateClosureBlock,
  extractCapa2Sources,
  findCapa2Capa3Duplicates,
  PHASE4_LEGACY_TEMPLATE_BLOCKS,
  type TemplateInventoryRow,
} from "../template-inventory-audit";

function template(patch: Partial<TemplateInventoryRow> & Pick<TemplateInventoryRow, "id" | "materia_acuerdo">): TemplateInventoryRow {
  return {
    id: patch.id,
    tipo: "MODELO_ACUERDO",
    estado: "ACTIVA",
    materia_acuerdo: patch.materia_acuerdo,
    version: "1.0.0",
    aprobada_por: "Comite Legal ARGA",
    fecha_aprobacion: "2026-05-04T00:00:00.000Z",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "LSC",
    capa1_inmutable: "Contenido final",
    capa2_variables: [],
    capa3_editables: [],
    ...patch,
  };
}

function pendingLegacyFixture(): TemplateInventoryRow[] {
  return [
    template({ id: "68da89bc", materia_acuerdo: "APROBACION_PLAN_NEGOCIO", version: "0.1.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "2d814072", materia_acuerdo: "AUMENTO_CAPITAL", version: "0.1.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "ba214d42", materia_acuerdo: "CESE_CONSEJERO", organo_tipo: "CONSEJO_ADMINISTRACION", version: "1.0.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "433da411", materia_acuerdo: "CESE_CONSEJERO", version: "1.0.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "313e7609", materia_acuerdo: "COMITES_INTERNOS", version: "1", aprobada_por: null, fecha_aprobacion: null, organo_tipo: null, adoption_mode: null, referencia_legal: null }),
    template({ id: "a09cc4bf", materia_acuerdo: "DISTRIBUCION_CARGOS", version: "1", aprobada_por: null, fecha_aprobacion: null, organo_tipo: null, adoption_mode: null, referencia_legal: null }),
    template({ id: "395ca996", materia_acuerdo: "DISTRIBUCION_DIVIDENDOS", version: "0.1.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "e3697ad9", materia_acuerdo: "FUSION_ESCISION", version: "1", aprobada_por: null, fecha_aprobacion: null, organo_tipo: null, adoption_mode: null, referencia_legal: "arts. 22-30 LSC", capa1_inmutable: "Fusion o escision con informe de experto obligatorio." }),
    template({ id: "29739424", materia_acuerdo: "MODIFICACION_ESTATUTOS", version: "0.1.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "e64ce755", materia_acuerdo: "NOMBRAMIENTO_AUDITOR", version: "0.1.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "27be9063", materia_acuerdo: "NOMBRAMIENTO_CONSEJERO", organo_tipo: "CONSEJO_ADMINISTRACION", version: "1.0.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "10f90d59", materia_acuerdo: "NOMBRAMIENTO_CONSEJERO", version: "1.0.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "ee72efde", materia_acuerdo: "POLITICA_REMUNERACION", version: "1", aprobada_por: null, fecha_aprobacion: null, organo_tipo: null, adoption_mode: null, referencia_legal: null }),
    template({ id: "b846bb03", materia_acuerdo: "POLITICAS_CORPORATIVAS", version: "1", aprobada_por: null, fecha_aprobacion: null, organo_tipo: null, adoption_mode: null, referencia_legal: null }),
    template({ id: "edd5c389", materia_acuerdo: "RATIFICACION_ACTOS", organo_tipo: "CONSEJO_ADMINISTRACION", version: "0.1.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "c06957aa", materia_acuerdo: "REDUCCION_CAPITAL", version: "0.1.0", aprobada_por: null, fecha_aprobacion: null }),
    template({ id: "df75cda9", materia_acuerdo: "SEGUROS_RESPONSABILIDAD", version: "1", aprobada_por: null, fecha_aprobacion: null, organo_tipo: null, adoption_mode: null, referencia_legal: null }),
  ];
}

describe("template-inventory-audit — Fase 4", () => {
  it("mantiene el inventario consolidado de 17 plantillas legacy clasificadas en 4 bloques", () => {
    const rows = pendingLegacyFixture();
    const result = auditTemplateInventory(rows);

    expect(Object.keys(PHASE4_LEGACY_TEMPLATE_BLOCKS)).toHaveLength(15);
    expect(result.summary.legacyPending).toBe(17);
    expect(result.summary.byBlock.CRITICAS).toBe(3);
    expect(result.summary.byBlock.METADATOS_NULL).toBe(4);
    expect(result.summary.byBlock.MATERIA_SUBSTANTIVA).toBe(4);
    expect(result.summary.byBlock.CIERRE_RUTINARIO).toBe(6);
  });

  it("clasifica FUSION_ESCISION, RATIFICACION_ACTOS y SEGUROS_RESPONSABILIDAD como criticas", () => {
    expect(classifyTemplateClosureBlock(template({ id: "fusion", materia_acuerdo: "FUSION_ESCISION" }))).toBe("CRITICAS");
    expect(classifyTemplateClosureBlock(template({ id: "ratificacion", materia_acuerdo: "RATIFICACION_ACTOS" }))).toBe("CRITICAS");
    expect(classifyTemplateClosureBlock(template({ id: "seguros", materia_acuerdo: "SEGUROS_RESPONSABILIDAD" }))).toBe("CRITICAS");
  });

  it("detecta plantillas ACTIVA sin firma formal post-cierre", () => {
    const result = auditTemplateInventory([
      template({ id: "sin-firma", materia_acuerdo: "AUMENTO_CAPITAL", aprobada_por: null, fecha_aprobacion: null }),
    ]);

    expect(result.issues.map((issue) => issue.code)).toContain("ACTIVE_TEMPLATE_MISSING_FORMAL_SIGNATURE");
  });

  it("respeta excepciones de soporte interno para aprobada_por y fecha_aprobacion", () => {
    const result = auditTemplateInventory([
      {
        ...template({ id: "pre", materia_acuerdo: "CONVOCATORIA_PRE" }),
        tipo: "INFORME_PRECEPTIVO",
        aprobada_por: null,
        fecha_aprobacion: null,
        organo_tipo: null,
        adoption_mode: null,
      },
    ]);

    expect(result.issues).toEqual([]);
  });

  it("respeta INFORME_GESTION como soporte interno sin organo ni adoption_mode", () => {
    const result = auditTemplateInventory([
      {
        ...template({ id: "gestion", materia_acuerdo: "GESTION_SOCIEDAD" }),
        tipo: "INFORME_GESTION",
        organo_tipo: null,
        adoption_mode: null,
      },
    ]);

    expect(result.issues).toEqual([]);
  });

  it("detecta metadatos de organo y adoption_mode faltantes", () => {
    const result = auditTemplateInventory([
      template({ id: "comite", materia_acuerdo: "COMITES_INTERNOS", organo_tipo: null, adoption_mode: null }),
    ]);

    expect(result.issues.map((issue) => issue.code)).toContain("ACTIVE_TEMPLATE_MISSING_OWNER_METADATA");
  });

  it("detecta versiones no semver como version legacy no firmable", () => {
    const result = auditTemplateInventory([
      template({ id: "version-legacy", materia_acuerdo: "FUSION_ESCISION", version: "1" }),
    ]);

    expect(result.issues.map((issue) => issue.code)).toContain("TEMPLATE_VERSION_NOT_SEMVER");
  });

  it("exige RDL 5/2023 y condicional requiere_experto en FUSION_ESCISION", () => {
    const result = auditTemplateInventory([
      template({
        id: "fusion",
        materia_acuerdo: "FUSION_ESCISION",
        referencia_legal: "arts. 22-30 LSC",
        capa1_inmutable: "TERCERO. Se incorpora informe de experto independiente.",
      }),
    ]);

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "FUSION_ESCISION_RDL_5_2023_REQUIRED",
      "FUSION_ESCISION_EXPERT_CONDITIONAL_REQUIRED",
    ]));
  });

  it("exige campo de enumeracion de actos en RATIFICACION_ACTOS", () => {
    const result = auditTemplateInventory([
      template({ id: "ratificacion", materia_acuerdo: "RATIFICACION_ACTOS", capa3_editables: [] }),
    ]);

    expect(result.issues.map((issue) => issue.code)).toContain("RATIFICACION_ACTOS_LIST_REQUIRED");
  });

  it("exige flag y bloque de conflicto intra-grupo en SEGUROS_RESPONSABILIDAD", () => {
    const result = auditTemplateInventory([
      template({ id: "seguros", materia_acuerdo: "SEGUROS_RESPONSABILIDAD", capa3_editables: [], capa1_inmutable: "Poliza D&O." }),
    ]);

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "SEGUROS_GROUP_INSURER_FLAG_REQUIRED",
      "SEGUROS_GROUP_CONFLICT_BLOCK_REQUIRED",
    ]));
  });

  it("probe post-cierre pasa con metadatos, semver, firma y contenido critico completos", () => {
    const cleanRows = [
      template({
        id: "fusion-ok",
        materia_acuerdo: "FUSION_ESCISION",
        referencia_legal: "RDL 5/2023",
        capa1_inmutable: "{{#if requiere_experto}}Informe de experto.{{/if}}",
      }),
      template({
        id: "ratificacion-ok",
        materia_acuerdo: "RATIFICACION_ACTOS",
        capa3_editables: [{ campo: "enumeracion_actos", obligatoriedad: "OBLIGATORIO" }],
      }),
      template({
        id: "seguros-ok",
        materia_acuerdo: "SEGUROS_RESPONSABILIDAD",
        capa3_editables: [{ campo: "aseguradora_del_grupo", obligatoriedad: "OBLIGATORIO" }],
        capa1_inmutable: "{{#if aseguradora_del_grupo}}Bloque de conflicto intra-grupo.{{/if}}",
      }),
    ];

    const result = auditTemplateInventory(cleanRows);

    expect(result.summary.blocking).toBe(0);
    expect(result.issues).toEqual([]);
  });

  it("extrae fuentes no canonicas ENTIDAD para pruebas de normalizacion resolver", () => {
    const row = template({
      id: "aumento",
      materia_acuerdo: "AUMENTO_CAPITAL",
      capa2_variables: [
        { variable: "denominacion_social", fuente: "ENTIDAD" },
        { variable: "tipo_social", fuente: "entities.tipo_social" },
      ],
    });

    expect(extractCapa2Sources(row.capa2_variables)).toEqual(["ENTIDAD", "entities.tipo_social"]);
  });

  it("detecta duplicidad Capa 2/Capa 3 para documentar prevalencia", () => {
    const row = template({
      id: "nombramiento",
      materia_acuerdo: "NOMBRAMIENTO_CONSEJERO",
      capa2_variables: [
        { variable: "consejero_nombre", fuente: "persons.full_name" },
        { variable: "nif_consejero", fuente: "persons.nif" },
      ],
      capa3_editables: [
        { campo: "nif_consejero", obligatoriedad: "OBLIGATORIO" },
        { campo: "consejero_nombre", obligatoriedad: "OBLIGATORIO" },
      ],
    });

    expect(findCapa2Capa3Duplicates(row)).toEqual(["consejero_nombre", "nif_consejero"]);
  });
});
