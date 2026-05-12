import { describe, it, expect } from "vitest";
import { validateTemplateForActivation } from "../gate-pre";
import type { PlantillaCandidate } from "../types";

const baseTemplate = (overrides: Partial<PlantillaCandidate> = {}): PlantillaCandidate => ({
  id: "t1",
  tipo: "MODELO_ACUERDO",
  materia: "APROBACION_CUENTAS",
  materia_acuerdo: null,
  jurisdiccion: "ES",
  version: "1.0.0",
  estado: "BORRADOR",
  organo_tipo: "JUNTA_GENERAL",
  adoption_mode: "MEETING",
  aprobada_por: "Comité Legal Garrigues",
  fecha_aprobacion: "2026-05-01",
  referencia_legal: "Art. 160 LSC",
  capa1_inmutable: "PRIMERO.- ".padEnd(120, "x"),
  capa2_variables: [],
  capa3_editables: [],
  ...overrides,
});

const emptyCtx = { tenantId: "t", existingActiveTemplates: [] };

describe("gate-pre — metadata BLOCKING", () => {
  it("META_ORGANO_NULL bloquea si organo_tipo es null", () => {
    const r = validateTemplateForActivation(baseTemplate({ organo_tipo: null }), emptyCtx);
    expect(r.issues.some((i) => i.code === "META_ORGANO_NULL" && i.severity === "BLOCKING")).toBe(true);
  });

  it("META_ORGANO_NULL bloquea si organo_tipo no es canónico", () => {
    const r = validateTemplateForActivation(baseTemplate({ organo_tipo: "ALGO_RARO" }), emptyCtx);
    expect(r.issues.some((i) => i.code === "META_ORGANO_NULL" && i.severity === "BLOCKING")).toBe(true);
  });

  it("META_VERSION_SEMVER bloquea si version no es semver", () => {
    const r = validateTemplateForActivation(baseTemplate({ version: "v1" }), emptyCtx);
    expect(r.issues.some((i) => i.code === "META_VERSION_SEMVER")).toBe(true);
  });

  it("META_REF_LEGAL_FORMAT bloquea si referencia_legal no menciona ley", () => {
    const r = validateTemplateForActivation(baseTemplate({ referencia_legal: "n/a" }), emptyCtx);
    expect(r.issues.some((i) => i.code === "META_REF_LEGAL_FORMAT")).toBe(true);
  });

  it("META_APROBADA_POR bloquea si aprobada_por es null", () => {
    const r = validateTemplateForActivation(baseTemplate({ aprobada_por: null }), emptyCtx);
    expect(r.issues.some((i) => i.code === "META_APROBADA_POR")).toBe(true);
  });

  it("plantilla válida no produce issues de META", () => {
    const r = validateTemplateForActivation(baseTemplate(), emptyCtx);
    const metaIssues = r.issues.filter((i) => i.code.startsWith("META_"));
    expect(metaIssues).toEqual([]);
  });
});

describe("gate-pre — capas BLOCKING", () => {
  it("CAPA1_LENGTH bloquea si capa1_inmutable < 100 chars", () => {
    const r = validateTemplateForActivation(baseTemplate({ capa1_inmutable: "corto" }), emptyCtx);
    expect(r.issues.some((i) => i.code === "CAPA1_LENGTH")).toBe(true);
  });

  it("CAPA2_VAR_NO_CATALOGADA bloquea variable usada en capa1 que no está en capa2", () => {
    const r = validateTemplateForActivation(
      baseTemplate({
        capa1_inmutable:
          "Este texto usa {{entities.name}} y {{rule_pack.junta.fecha}} pero capa2 está vacía aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.",
        capa2_variables: [],
      }),
      emptyCtx,
    );
    expect(r.issues.some((i) => i.code === "CAPA2_VAR_NO_CATALOGADA")).toBe(true);
  });

  it("CAPA2_HELPER_PROHIBIDO bloquea helper fuera del allowlist", () => {
    const r = validateTemplateForActivation(
      baseTemplate({
        capa1_inmutable:
          "{{#format }}xx{{/format}} y aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.",
      }),
      emptyCtx,
    );
    expect(r.issues.some((i) => i.code === "CAPA2_HELPER_PROHIBIDO")).toBe(true);
  });

  it("CAPA3_PREFIJO_PROTEGIDO bloquea campo capa3 con prefijo reservado", () => {
    const r = validateTemplateForActivation(
      baseTemplate({
        capa3_editables: [
          { campo: "ENTIDAD.cosa", obligatoriedad: "OBLIGATORIO", descripcion: "x" } as never,
        ],
      }),
      emptyCtx,
    );
    expect(r.issues.some((i) => i.code === "CAPA3_PREFIJO_PROTEGIDO")).toBe(true);
  });

  it("ENTITY_REF_FORBIDDEN bloquea variable usada con prefijo entity_id", () => {
    // Esta regla se aplica al payload del importador (sec 5), pero el motor también lo detecta
    // cuando una variable referencia entity_id directamente
    const r = validateTemplateForActivation(
      baseTemplate({
        capa1_inmutable:
          "{{entity_id.x}} aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.",
        capa2_variables: [{ variable: "entity_id.x", fuente: "entities.*", condicion: "SIEMPRE" }],
      }),
      emptyCtx,
    );
    expect(r.issues.some((i) => i.code === "ENTITY_REF_FORBIDDEN")).toBe(true);
  });
});

describe("gate-pre — duplicado funcional", () => {
  it("DUP_ACTIVE_FUNCTIONAL_KEY bloquea si otra ACTIVA tiene misma clave funcional", () => {
    const existing: PlantillaCandidate[] = [
      baseTemplate({ id: "other", estado: "ACTIVA" }),
    ];
    const candidate = baseTemplate({ id: "new" });
    const r = validateTemplateForActivation(candidate, {
      tenantId: "t",
      existingActiveTemplates: existing,
    });
    expect(r.issues.some((i) => i.code === "DUP_ACTIVE_FUNCTIONAL_KEY")).toBe(true);
  });

  it("no marca duplicado si la misma plantilla está en el array (mismo id)", () => {
    const existing = [baseTemplate({ id: "same", estado: "ACTIVA" })];
    const candidate = baseTemplate({ id: "same" });
    const r = validateTemplateForActivation(candidate, {
      tenantId: "t",
      existingActiveTemplates: existing,
    });
    expect(r.issues.some((i) => i.code === "DUP_ACTIVE_FUNCTIONAL_KEY")).toBe(false);
  });
});

describe("gate-pre — WARNING e INFO", () => {
  it("GEN_IF_COUNT WARNING si >3 ramas {{#if}} en capa1", () => {
    const capa1 = "{{#if a}}1{{/if}}{{#if b}}2{{/if}}{{#if c}}3{{/if}}{{#if d}}4{{/if}}{{#if e}}5{{/if}}".padEnd(150, "x");
    const r = validateTemplateForActivation(baseTemplate({ capa1_inmutable: capa1 }), emptyCtx);
    expect(r.issues.some((i) => i.code === "GEN_IF_COUNT" && i.severity === "WARNING")).toBe(true);
  });

  it("LEGACY_FUENTE_ENTIDAD WARNING para fuente ENTIDAD literal", () => {
    const r = validateTemplateForActivation(
      baseTemplate({
        capa2_variables: [{ variable: "ENTIDAD.denominacion", fuente: "ENTIDAD", condicion: "SIEMPRE" }],
      }),
      emptyCtx,
    );
    expect(r.issues.some((i) => i.code === "LEGACY_FUENTE_ENTIDAD" && i.severity === "WARNING")).toBe(true);
  });

  it("CAPA2_UNUSED_VARIABLE INFO si variable declarada y no usada en capa1", () => {
    const r = validateTemplateForActivation(
      baseTemplate({
        capa2_variables: [{ variable: "entities.name", fuente: "entities.*", condicion: "SIEMPRE" }],
        capa1_inmutable: "Texto sin variables".padEnd(150, "x"),
      }),
      emptyCtx,
    );
    expect(r.issues.some((i) => i.code === "CAPA2_UNUSED_VARIABLE" && i.severity === "INFO")).toBe(true);
  });

  it("plantilla limpia produce result.ok = true", () => {
    const r = validateTemplateForActivation(
      baseTemplate({
        capa1_inmutable: "Aprobar cuentas de {{entities.name}}".padEnd(150, "x"),
        capa2_variables: [{ variable: "entities.name", fuente: "entities.*", condicion: "SIEMPRE" }],
      }),
      emptyCtx,
    );
    expect(r.ok).toBe(true);
    expect(r.summary.blocking).toBe(0);
  });
});
