import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260526195638_libros_societarios_registros_v2.sql"),
  "utf8",
);

describe("libros societarios v2 migration", () => {
  it("amplia mandatory_books con metadatos de libro y registro auxiliar", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS body_id");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS book_group");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS legal_basis");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS custodian_role");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS supervision_tags");
  });

  it("siembra libros por organo, contables y registros auxiliares sectoriales", () => {
    expect(migration).toContain("LIBRO_ACTAS_JUNTA_GENERAL");
    expect(migration).toContain("LIBRO_ACTAS_CONSEJO_ADMINISTRACION");
    expect(migration).toContain("LIBRO_ACTAS_COMISION_RIESGOS");
    expect(migration).toContain("LIBRO_DIARIO");
    expect(migration).toContain("LIBRO_INVENTARIOS_CUENTAS_ANUALES");
    expect(migration).toContain("REGISTRO_IDONEIDAD_FIT_PROPER");
    expect(migration).toContain("REGISTRO_SOLVENCIA_II_SUPERVISION");
  });

  it("mantiene compatibilidad con LIBRO_ACTAS legacy esperado por E2E", () => {
    expect(migration).toMatch(/Legacy compatibility[\s\S]+LIBRO_ACTAS/);
    expect(migration).toContain("trg_governing_bodies_seed_mandatory_book");
  });
});
