import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MATERIA_CANONICAL_ALIAS } from "@/lib/secretaria/agenda-materias";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260718090000_secretaria_materia_alias_presupuesto.sql",
);

const sql = readFileSync(MIGRATION, "utf8");
const executableSql = sql.replace(/^\s*--.*$/gm, "");

/**
 * B7 Lote 3 — el alias de materia debe existir en los DOS lados: cliente
 * (MATERIA_CANONICAL_ALIAS, identidad funcional y filtros) y servidor
 * (fn_secretaria_template_functional_key, índice único de una sola ACTIVA).
 * Si divergen, el filtro de Plantillas y el índice de Cloud dejan de contar
 * lo mismo — exactamente el defecto que este lote cerró.
 */
describe("alias de materia APROBACION_PRESUPUESTOS — paridad cliente/servidor", () => {
  it("el cliente canonicaliza el plural al singular", () => {
    expect(MATERIA_CANONICAL_ALIAS.APROBACION_PRESUPUESTOS).toBe("APROBACION_PRESUPUESTO");
  });

  it("la función de identidad funcional del servidor aplica el mismo alias", () => {
    expect(executableSql).toContain(
      "WHEN 'APROBACION_PRESUPUESTOS' THEN 'APROBACION_PRESUPUESTO'",
    );
    expect(executableSql).toContain("CREATE OR REPLACE FUNCTION public.fn_secretaria_template_functional_key");
  });

  it("todos los alias del cliente están espejados en la función del servidor", () => {
    for (const [alias, canonical] of Object.entries(MATERIA_CANONICAL_ALIAS)) {
      expect(executableSql).toContain(`WHEN '${alias}' THEN '${canonical}'`);
    }
  });

  it("reconstruye el índice único tras cambiar la semántica de la función", () => {
    expect(executableSql).toContain(
      "REINDEX INDEX public.ux_plantillas_active_functional_identity",
    );
  });

  it("archiva el duplicado sin borrar filas y deja traza en el historial", () => {
    expect(executableSql).toContain("SET estado = 'ARCHIVADA'");
    expect(executableSql).not.toMatch(/DELETE\s+FROM\s+public\.plantillas_protegidas/i);
    expect(executableSql).toContain("INSERT INTO public.plantilla_changelog");
    expect(executableSql).toContain("'STATE_CHANGE'");
  });

  it("falla cerrado ante drift y comprueba el estado final", () => {
    expect(executableSql).toContain("RAISE EXCEPTION 'B7: drift en la plantilla plural %'");
    expect(executableSql).toContain("RAISE EXCEPTION 'B7: drift en la plantilla singular %'");
    expect(executableSql).toContain("dependencias; abortando sin remapear");
    expect(executableSql).toContain(
      "RAISE EXCEPTION 'B7: quedan % identidades funcionales con más de una ACTIVA'",
    );
  });

  it("usa el canal de transición gobernado en vez de saltarse el guard de estado", () => {
    expect(executableSql).toContain("app.secretaria_template_state_transition");
  });
});
