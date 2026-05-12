import { describe, it, expect } from "vitest";
import { evaluateSemanticRules } from "../gate-pre-semantic";
import type { PlantillaCandidate } from "../types";

const template = (over: Partial<PlantillaCandidate>): PlantillaCandidate => ({
  id: "t",
  tipo: "MODELO_ACUERDO",
  materia: "FUSION_ESCISION",
  materia_acuerdo: null,
  jurisdiccion: "ES",
  version: "1.0.0",
  estado: "BORRADOR",
  organo_tipo: "JUNTA_GENERAL",
  adoption_mode: "MEETING",
  aprobada_por: "X",
  fecha_aprobacion: "2026-01-01",
  referencia_legal: "Art. 1 LSC",
  capa1_inmutable: "",
  capa2_variables: [],
  capa3_editables: [],
  ...over,
});

describe("gate-pre-semantic", () => {
  it("SEM_FUSION_EXPERTO_CONDICIONAL: FUSION sin {{#if requiere_experto}} → BLOCKING", () => {
    const r = evaluateSemanticRules(
      template({
        materia: "FUSION_ESCISION",
        capa1_inmutable: "Aprobar fusión sin condicionales".padEnd(150, "x"),
      }),
    );
    expect(r.some((i) => i.code === "SEM_FUSION_EXPERTO_CONDICIONAL")).toBe(true);
  });

  it("SEM_FUSION_EXPERTO_CONDICIONAL: FUSION CON condicional → OK", () => {
    const r = evaluateSemanticRules(
      template({
        materia: "FUSION_ESCISION",
        capa1_inmutable: "...{{#if requiere_experto}}informe{{else}}no exigible{{/if}}...".padEnd(160, "x"),
      }),
    );
    expect(r.some((i) => i.code === "SEM_FUSION_EXPERTO_CONDICIONAL")).toBe(false);
  });

  it("SEM_RATIFICACION_IDENTIFICACION: RATIFICACION sin campo identificación → BLOCKING", () => {
    const r = evaluateSemanticRules(
      template({
        materia: "RATIFICACION_ACTOS",
        capa3_editables: [],
      }),
    );
    expect(r.some((i) => i.code === "SEM_RATIFICACION_IDENTIFICACION")).toBe(true);
  });

  it("SEM_RATIFICACION_IDENTIFICACION: con campo enumeracion_actos OBLIGATORIO → OK", () => {
    const r = evaluateSemanticRules(
      template({
        materia: "RATIFICACION_ACTOS",
        capa3_editables: [
          { campo: "enumeracion_actos", obligatoriedad: "OBLIGATORIO", descripcion: "..." } as never,
        ],
      }),
    );
    expect(r.some((i) => i.code === "SEM_RATIFICACION_IDENTIFICACION")).toBe(false);
  });
});
