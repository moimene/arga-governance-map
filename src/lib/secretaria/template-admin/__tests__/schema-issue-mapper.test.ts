/**
 * Tests del `mapSchemaIssues` (ITEM-088).
 *
 * El wizard de importación mostraba `JSON.stringify(error.issues)` crudo:
 * paths como ["template","referencia_legal"], código 'invalid_string' y
 * mensajes en inglés de Zod. Estos tests garantizan que el mapper produce
 * mensajes en castellano legibles para el Comité Legal (perfil no técnico).
 *
 * Usa `parseImport` para generar ZodIssues reales del schema en lugar de
 * hardcodear el shape, de modo que el test detecta regresiones de Zod.
 */

import { describe, it, expect } from "vitest";
import { parseImport } from "../template-importer";
import { mapSchemaIssues } from "../schema-issue-mapper";

const base = {
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
  capa1_inmutable:
    "PRIMERO.- Aprobar las cuentas anuales de {{entities.name}}.".padEnd(150, "x"),
  capa2_variables: [
    { variable: "entities.name", fuente: "entities.*", condicion: "SIEMPRE" },
  ],
  capa3_editables: [],
};

function issuesFor(mutate: (p: typeof base) => unknown) {
  const r = parseImport(mutate(structuredClone(base)));
  expect(r.ok).toBe(false);
  return mapSchemaIssues((r as { ok: false; error: { issues: unknown[] } }).error.issues);
}

describe("mapSchemaIssues", () => {
  it("traduce materia inválida con valores válidos en la pista", () => {
    const out = issuesFor((p) => {
      (p.template as Record<string, unknown>).materia = "MATERIA_INVENTADA";
      return p;
    });
    const issue = out.find((i) => i.code.includes("materia"));
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("materia");
    expect(issue!.message).not.toMatch(/invalid_enum_value/);
    expect(issue!.hint).toContain("APROBACION_CUENTAS");
  });

  it("traduce versión con formato semver inválido", () => {
    const out = issuesFor((p) => {
      (p.template as Record<string, unknown>).version = "v1";
      return p;
    });
    const issue = out.find((i) => i.code.includes("version"));
    expect(issue).toBeDefined();
    expect(issue!.hint).toMatch(/semver/i);
  });

  it("traduce referencia legal sin ley reconocida", () => {
    const out = issuesFor((p) => {
      (p.template as Record<string, unknown>).referencia_legal = "texto libre sin ley";
      return p;
    });
    const issue = out.find((i) => i.code.includes("referencia_legal"));
    expect(issue).toBeDefined();
    expect(issue!.hint).toContain("LSC");
  });

  it("traduce claves no permitidas en la raíz (.strict)", () => {
    const out = issuesFor((p) => {
      (p as Record<string, unknown>).tenant_id = "x";
      return p;
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((i) => /no permitidas/.test(i.message))).toBe(true);
  });

  it("indexa elementos de array en base 1 para humanos", () => {
    const out = issuesFor((p) => {
      (p as Record<string, unknown>).capa3_editables = [
        { campo: "fecha", obligatoriedad: "NO_EXISTE" },
      ];
      return p;
    });
    const issue = out.find((i) => i.code.includes("capa3_editables"));
    expect(issue).toBeDefined();
    expect(issue!.code).toContain("[1]");
  });

  it("devuelve [] ante entradas malformadas (defensivo)", () => {
    expect(mapSchemaIssues(null)).toEqual([]);
    expect(mapSchemaIssues(undefined)).toEqual([]);
    expect(mapSchemaIssues("no soy issues")).toEqual([]);
    expect(mapSchemaIssues({ foo: 1 })).toEqual([]);
  });

  it("acepta también un objeto tipo ZodError con .issues", () => {
    const r = parseImport({ ...structuredClone(base), template: { ...base.template, version: "v1" } });
    const err = (r as { ok: false; error: { issues: unknown[] } }).error;
    const out = mapSchemaIssues(err);
    expect(out.length).toBeGreaterThan(0);
  });
});
