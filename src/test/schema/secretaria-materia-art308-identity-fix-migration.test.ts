import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MATERIA_CANONICAL_ALIAS,
  MATERIA_PRESENTATION_ALIAS,
} from "@/lib/secretaria/agenda-materias";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260719150000_secretaria_materia_art308_identity_fix.sql",
);

const sql = readFileSync(MIGRATION, "utf8");
const executableSql = sql.replace(/^\s*--.*$/gm, "");

describe("D5 — identidad funcional separada para las materias del art. 308", () => {
  it("mantiene el sinónimo en presentación y lo excluye de los aliases funcionales", () => {
    expect(
      MATERIA_PRESENTATION_ALIAS.EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE,
    ).toBe("SUPRESION_PREFERENTE");
    expect(
      MATERIA_CANONICAL_ALIAS.EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE,
    ).toBeUndefined();
  });

  it("redefine la clave sin colapsar EXCLUSION en SUPRESION", () => {
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_template_functional_key",
    );
    expect(executableSql).not.toContain(
      "WHEN 'EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE' THEN 'SUPRESION_PREFERENTE'",
    );
    expect(executableSql).toContain(
      "WHEN 'APROBACION_PRESUPUESTOS' THEN 'APROBACION_PRESUPUESTO'",
    );
  });

  it("reconstruye el índice funcional y verifica identidades distintas", () => {
    expect(executableSql).toContain(
      "REINDEX INDEX public.ux_plantillas_active_functional_identity",
    );
    expect(executableSql).toContain(
      "D5: EXCLUSION y SUPRESION siguen compartiendo identidad funcional",
    );
    expect(executableSql).toContain("HAVING count(*) > 1");
  });

  it("no borra, renombra ni remapea filas del catálogo o de las plantillas", () => {
    expect(executableSql).not.toMatch(/DELETE\s+FROM/i);
    expect(executableSql).not.toMatch(/UPDATE\s+(?:public\.)?(?:materia_catalog|plantillas_protegidas)/i);
    expect(executableSql).not.toMatch(/ALTER\s+TABLE[\s\S]*RENAME/i);
    expect(executableSql).toContain("v_catalog_rows <> 2");
  });
});
