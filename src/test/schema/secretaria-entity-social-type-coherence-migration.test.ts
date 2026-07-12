import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260711154500_secretaria_entity_social_type_coherence.sql",
);

const sql = readFileSync(MIGRATION, "utf8");
const executableSql = sql.replace(/^\s*--.*$/gm, "");

describe("coherencia del tipo social de entidades demo", () => {
  it("corrige únicamente las dos S.L. españolas observadas en Cloud", () => {
    expect(sql).toContain("f653c44c-15ce-4428-b3d3-f4ed17efe93b");
    expect(sql).toContain("5248f1a8-5821-413e-a716-1ab2e145747a");
    expect(sql).toContain("SET tipo_social = 'SL'");
    expect(sql).toContain("AND jurisdiction = 'ES'");
    expect(sql).toContain("AND legal_form IN ('SL', 'S.L.', 'S.L')");
    expect(sql).toContain("AND tipo_social = 'SA'");
  });

  it("es forward-only, idempotente y no toca materias ni plantillas", () => {
    expect(executableSql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(executableSql).not.toMatch(/\bUPDATE\s+(?:public\.)?materia_catalog\b/i);
    expect(executableSql).not.toMatch(/\bUPDATE\s+(?:public\.)?plantillas_protegidas\b/i);

    const mutatedTables = [
      ...executableSql.matchAll(
        /\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi,
      ),
    ].map((match) => match[1].toLowerCase());
    expect(new Set(mutatedTables)).toEqual(new Set(["entities"]));
  });
});
