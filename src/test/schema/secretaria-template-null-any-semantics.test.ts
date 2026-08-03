import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260719160000_secretaria_template_null_any_semantics.sql"),
  "utf8",
);

describe("Secretaría — semántica NULL y ANY", () => {
  it("mantiene NULL tipado en la plantilla sin convertir órgano ausente en wildcard", () => {
    expect(migration).toContain("tipo_social NULL = todos los tipos sociales");
    expect(migration).toContain("organo_tipo NULL = dato ausente; nunca wildcard");
    expect(migration).toContain("adoption_mode NULL = ausente en documentos adoptables");
    expect(migration).not.toMatch(/UPDATE public\.plantillas_protegidas/i);
  });

  it("hace explícitos los tres ejes gobernados del binding", () => {
    for (const axis of ["organo_tipo", "tipo_social", "adoption_mode"]) {
      expect(migration).toMatch(new RegExp(`ALTER COLUMN ${axis} SET DEFAULT 'ANY'`, "i"));
      expect(migration).toMatch(new RegExp(`ALTER COLUMN ${axis} SET NOT NULL`, "i"));
    }
    expect(migration).toContain("materia_template_binding_axes_not_blank");
  });

  it("no borra ni renombra filas de catálogo", () => {
    expect(migration).not.toMatch(/DELETE FROM public\.materia_catalog/i);
    expect(migration).not.toMatch(/UPDATE public\.materia_catalog/i);
  });
});
