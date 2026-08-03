import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720128000_secretaria_informative_matter_taxonomy.sql",
  ),
  "utf8",
);

const executableSql = migration.replace(/^\s*--.*$/gm, "");

describe("Secretaría — taxonomía canónica de puntos informativos", () => {
  it("inserta idempotentemente las dos categorías estables", () => {
    expect(executableSql).toContain("INSERT INTO public.materia_catalog");
    expect(executableSql).toContain("'INFORME_DIRECCION_GENERAL_MARCHA_SOCIEDAD'");
    expect(executableSql).toContain("'INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO'");
    expect(executableSql).toContain("ON CONFLICT (materia) DO UPDATE SET");
  });

  it("las confina como no materializables en agreements y sin efectos accesorios", () => {
    expect(executableSql).toMatch(/matter_class\s*=\s*'ESPECIAL'/);
    expect(executableSql).toMatch(/min_majority_code\s*=\s*null/i);
    expect(executableSql).toMatch(/requires_notary\s*=\s*false/i);
    expect(executableSql).toMatch(/requires_registry\s*=\s*false/i);
    expect(executableSql).toMatch(/inscribable\s*=\s*false/i);
    expect(executableSql).toMatch(/publication_required\s*=\s*false/i);
    expect(executableSql).toMatch(/plazo_inscripcion_dias\s*=\s*null/i);
  });

  it("no crea ni activa rule packs o reglas de mayoría", () => {
    expect(executableSql).not.toMatch(/INSERT\s+INTO\s+public\.rule_packs/i);
    expect(executableSql).not.toMatch(/INSERT\s+INTO\s+public\.rule_pack_versions/i);
    expect(executableSql).not.toMatch(/'SIMPLE'|'REFORZADA|UNANIMIDAD/i);
    expect(executableSql).toContain("un punto informativo no puede tener rule pack");
  });

  it("incorpora una autocomprobación transaccional fail-closed", () => {
    expect(executableSql).toContain("BEGIN;");
    expect(executableSql).toContain("DO $assert$");
    expect(executableSql).toContain("<> 2");
    expect(executableSql).toContain("IF EXISTS (");
    expect(executableSql).toContain("COMMIT;");
  });
});
