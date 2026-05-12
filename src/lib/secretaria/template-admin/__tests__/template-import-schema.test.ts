/**
 * Tests del schema `TemplateImportSchema` (Commit 6, Task 6.1).
 *
 * Cobertura mínima:
 *  - Payload válido base parsea OK.
 *  - `.strict()` rechaza entity_id / id / sociedad / tenant_id en raíz.
 *  - VARIABLE_PATTERN rechaza single-segment, acepta multi-segment.
 *  - FuenteEnum acepta legacy `ENTIDAD`.
 *  - SEMVER rechaza `v1`, acepta build metadata `1.0.0+sl`.
 *  - REF_LEGAL_PATTERN rechaza texto sin ley.
 *  - MateriaEnum rechaza materias inventadas.
 */

import { describe, it, expect } from "vitest";
import { TemplateImportSchema } from "../template-import-schema";

const validPayload = {
  schema_version: "secretaria.template_import.v1" as const,
  template: {
    tipo: "MODELO_ACUERDO",
    materia: "APROBACION_CUENTAS",
    jurisdiccion: "ES",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Art. 160 LSC",
  },
  capa1_inmutable: "PRIMERO.- Aprobar las cuentas anuales de {{entities.name}}.".padEnd(
    150,
    "x",
  ),
  capa2_variables: [
    { variable: "entities.name", fuente: "entities.*", condicion: "SIEMPRE" },
  ],
  capa3_editables: [],
};

describe("TemplateImportSchema", () => {
  it("acepta payload válido", () => {
    const r = TemplateImportSchema.safeParse(validPayload);
    expect(r.success).toBe(true);
  });

  it("rechaza entity_id en raíz (strict)", () => {
    const r = TemplateImportSchema.safeParse({ ...validPayload, entity_id: "x" });
    expect(r.success).toBe(false);
  });

  it("rechaza id en raíz (strict)", () => {
    const r = TemplateImportSchema.safeParse({ ...validPayload, id: "x" });
    expect(r.success).toBe(false);
  });

  it("rechaza tenant_id en raíz (strict)", () => {
    const r = TemplateImportSchema.safeParse({ ...validPayload, tenant_id: "x" });
    expect(r.success).toBe(false);
  });

  it("rechaza variable con espacios o barras (notación documental)", () => {
    // Calibración D15: el pattern original pedía multi-segment estrictamente,
    // pero Cloud usa también single-segment (`nombre_entidad`) en plantillas
    // productivas. El rechazo se aplica ahora sobre patrones documentales
    // (con `/`, espacios, `+`) que no son variables ejecutables.
    const r = TemplateImportSchema.safeParse({
      ...validPayload,
      capa2_variables: [
        {
          variable: "ACUERDO.fecha / medio_circulacion",
          fuente: "entities.*",
          condicion: "SIEMPRE",
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("acepta variable multi-segment", () => {
    const r = TemplateImportSchema.safeParse({
      ...validPayload,
      capa1_inmutable: validPayload.capa1_inmutable.replace(
        "entities.name",
        "meetings.junta.orden_del_dia",
      ),
      capa2_variables: [
        {
          variable: "meetings.junta.orden_del_dia",
          fuente: "meetings.*",
          condicion: "SIEMPRE",
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("acepta legacy ENTIDAD como fuente", () => {
    const r = TemplateImportSchema.safeParse({
      ...validPayload,
      capa2_variables: [
        { variable: "ENTIDAD.cosa", fuente: "ENTIDAD", condicion: "SIEMPRE" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza version no semver", () => {
    const r = TemplateImportSchema.safeParse({
      ...validPayload,
      template: { ...validPayload.template, version: "v1" },
    });
    expect(r.success).toBe(false);
  });

  it("acepta semver con build metadata", () => {
    const r = TemplateImportSchema.safeParse({
      ...validPayload,
      template: { ...validPayload.template, version: "1.0.0+sl" },
    });
    expect(r.success).toBe(true);
  });

  it("rechaza referencia_legal sin Art. ni ley", () => {
    const r = TemplateImportSchema.safeParse({
      ...validPayload,
      template: { ...validPayload.template, referencia_legal: "ver doc adjunto" },
    });
    expect(r.success).toBe(false);
  });

  it("rechaza materia desconocida", () => {
    const r = TemplateImportSchema.safeParse({
      ...validPayload,
      template: {
        ...validPayload.template,
        materia: "MATERIA_INVENTADA" as unknown as string,
      },
    });
    expect(r.success).toBe(false);
  });
});
