import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260711123000_secretaria_formulacion_cuentas_binding.sql",
);

const sql = readFileSync(MIGRATION, "utf8");
const executableSql = sql.replace(/^\s*--.*$/gm, "");

describe("FORMULACION_CUENTAS binding migration", () => {
  it("reancla el binding real a la plantilla v1.2.0 activa con contexto canónico", () => {
    expect(sql).toContain("babd5bda-0b6c-4cd4-b081-48bb58eabd80");
    expect(sql).toContain("bc49965f-2c0b-4778-9751-163f87fcbff6");
    expect(sql).toContain("'FORMULACION_CUENTAS'");
    expect(sql).toContain("'CONSEJO_ADMIN'");
    expect(sql).toContain("'MEETING'");
    expect(sql).toContain("p.version = '1.2.0'");
    expect(sql).toContain("p.estado = 'ACTIVA'");
    expect(sql).toContain("template_id = v_target_template_id");
  });

  it("falla cerrado ante drift del target o del binding observado", () => {
    expect(sql).toContain("FOR SHARE");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("IF NOT FOUND THEN");
    expect(sql).toContain("binding canónico % ausente o con contexto distinto del verificado");
    expect(sql).toContain("target % no es la plantilla CONSEJO_ADMIN/MEETING v1.2.0 ACTIVA esperada");
  });

  it("es forward-only e idempotente y deja una sola fila activa canónica", () => {
    expect(sql).toContain("AND id <> v_binding_id");
    expect(sql).toContain("SET active = false");
    expect(sql).toContain("IF v_active_count <> 1 THEN");
    expect(sql).toContain("b.template_id = v_target_template_id");
    expect(executableSql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("solo muta materia_template_binding y preserva plantillas y materias", () => {
    const mutatedTables = [
      ...executableSql.matchAll(
        /\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi,
      ),
    ].map((match) => match[1].toLowerCase());

    expect(new Set(mutatedTables)).toEqual(new Set(["materia_template_binding"]));
    expect(executableSql).not.toMatch(/\bUPDATE\s+(?:public\.)?plantillas_protegidas\b/i);
    expect(executableSql).not.toMatch(/\bUPDATE\s+(?:public\.)?materia_catalog\b/i);
    expect(sql).toContain("La plantilla v1.1.0 ARCHIVADA se conserva intacta");
  });
});
