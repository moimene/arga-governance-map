import { detectOrphanNamespaces } from "../gate-pre-semantic";
import { describe, it, expect } from "vitest";
import { evaluateSemanticRules , detectOrphanNamespaces } from "../gate-pre-semantic";
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

  it("SEM_ACTIVA_CAMPOS_REQUERIDOS: MODELO_ACUERDO ACTIVA con organo_tipo NULL → BLOCKING", () => {
    const r = evaluateSemanticRules(
      template({
        tipo: "MODELO_ACUERDO",
        estado: "ACTIVA",
        organo_tipo: null as never,
        materia: "NOMBRAMIENTO_CONSEJERO",
        capa1_inmutable: "ok",
      }),
    );
    expect(r.some((i) => i.code === "SEM_ACTIVA_CAMPOS_REQUERIDOS")).toBe(true);
  });

  it("SEM_ACTIVA_CAMPOS_REQUERIDOS: ACTA ACTIVA con adoption_mode vacío → BLOCKING", () => {
    const r = evaluateSemanticRules(
      template({
        tipo: "ACTA",
        estado: "ACTIVA",
        adoption_mode: "" as never,
        materia: "NOMBRAMIENTO_CONSEJERO",
      }),
    );
    expect(r.some((i) => i.code === "SEM_ACTIVA_CAMPOS_REQUERIDOS")).toBe(true);
  });

  it("SEM_ACTIVA_CAMPOS_REQUERIDOS: DECISION ACTIVA con referencia_legal NULL → BLOCKING", () => {
    const r = evaluateSemanticRules(
      template({
        tipo: "DECISION",
        estado: "ACTIVA",
        referencia_legal: null as never,
        materia: "NOMBRAMIENTO_CONSEJERO",
      }),
    );
    expect(r.some((i) => i.code === "SEM_ACTIVA_CAMPOS_REQUERIDOS")).toBe(true);
  });

  it("SEM_ACTIVA_CAMPOS_REQUERIDOS: MODELO_ACUERDO ACTIVA con todos los campos OK → no fires", () => {
    const r = evaluateSemanticRules(
      template({
        tipo: "MODELO_ACUERDO",
        estado: "ACTIVA",
        organo_tipo: "JUNTA_GENERAL",
        adoption_mode: "MEETING",
        referencia_legal: "Art. 160 LSC",
        materia: "NOMBRAMIENTO_CONSEJERO",
      }),
    );
    expect(r.some((i) => i.code === "SEM_ACTIVA_CAMPOS_REQUERIDOS")).toBe(false);
  });

  it("SEM_ACTIVA_CAMPOS_REQUERIDOS: tipo no en (MODELO_ACUERDO|ACTA|DECISION) → regla no aplica", () => {
    const r = evaluateSemanticRules(
      template({
        tipo: "CONVOCATORIA" as never,
        estado: "ACTIVA",
        organo_tipo: null as never,
        adoption_mode: null as never,
        referencia_legal: null as never,
      }),
    );
    expect(r.some((i) => i.code === "SEM_ACTIVA_CAMPOS_REQUERIDOS")).toBe(false);
  });

  it("SEM_ACTIVA_CAMPOS_REQUERIDOS: estado BORRADOR no dispara la regla aunque falten campos", () => {
    const r = evaluateSemanticRules(
      template({
        tipo: "MODELO_ACUERDO",
        estado: "BORRADOR",
        organo_tipo: null as never,
      }),
    );
    expect(r.some((i) => i.code === "SEM_ACTIVA_CAMPOS_REQUERIDOS")).toBe(false);
  });
});

describe("SEM_NAMESPACE_SIN_PROVEEDOR (ITEM-026)", () => {
  it("detecta namespaces huérfanos en capa1 y los lista ordenados", () => {
    const orphans = detectOrphanNamespaces(
      "Acta: {{DECISION.fecha}} en {{ENTIDAD.domicilio_social}} — {{REGISTRO.tomo}} {{#if ACUERDO.unanime}}x{{/if}} {{QTSP.sello}}"
    );
    expect(orphans).toEqual(["ACUERDO", "DECISION", "REGISTRO"]);
  });

  it("no marca los namespaces soportados ni QTSP", () => {
    expect(
      detectOrphanNamespaces("{{ENTIDAD.nif}} {{REUNION.hora_cierre}} {{QTSP.timestamp}} {{USUARIO.cargo}}")
    ).toEqual([]);
  });
});
