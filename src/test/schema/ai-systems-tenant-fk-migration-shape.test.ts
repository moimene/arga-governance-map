import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * MOI-185 (decisión D-06, por delegación: sólo opción a) — forma de la
 * migración ANTES de aplicarla, sobre el fichero en disco.
 *
 * Capa DÉBIL: comprueba que el fichero dice lo que se espera, no que la base
 * de datos ya lo cumpla — esta migración NO se aplica en esta tarea (sólo se
 * prepara y se ensaya revertida). La capa fuerte es el bloque de
 * verificación de la propia migración (aborta con RAISE EXCEPTION) y el
 * ensayo revertido `proposed/*.probe.sql`; ambos se leen aquí en frío, sin
 * tocar Cloud, para no escribir en producción desde un test.
 *
 * Alcance de D-06: SÓLO la FK `ai_systems.tenant_id → tenants(id)`. El CHECK
 * de `status` (opción b) exigiría normalizar las tres grafías de ARGA
 * (`Conforme`, `Pendiente`, `En revision`) y no se decide en este issue — el
 * gate de scope-containment de abajo falla si alguien cuela esa opción aquí.
 */
const MIGRACION = "supabase/migrations/20260926118500_ai_systems_tenant_fk.sql";
const SONDA = "supabase/migrations/proposed/20260926118500_ai_systems_tenant_fk.probe.sql";
// Sobre el SQL EJECUTABLE (sin comentarios) — mismo patrón que
// aims-checks-enlaces-migration-shape.test.ts, para no confundir la prosa
// explicativa (que sí menciona "status" al descartarlo) con la DDL real.
const ejecutable = (texto: string) => texto.replace(/^\s*--.*$/gm, "").trim();
const sqlCrudo = readFileSync(MIGRACION, "utf8");
const probeCrudo = readFileSync(SONDA, "utf8");
const sql = ejecutable(sqlCrudo);
const probe = ejecutable(probeCrudo);

describe("MOI-185 — FK ai_systems.tenant_id → tenants(id)", () => {
  it("el fichero tiene cuerpo (control positivo del instrumento)", () => {
    expect(sql.split("\n").length).toBeGreaterThan(20);
  });

  it("es idempotente: sólo añade la constraint si no existe ya", () => {
    expect(sql).toMatch(
      /if not exists \(\s*select 1 from pg_constraint\s+where conrelid = 'public\.ai_systems'::regclass\s+and conname = 'ai_systems_tenant_id_fkey'\s*\) then/,
    );
  });

  it("añade exactamente la FK esperada, sin ON DELETE (igual que las FK hermanas de la tabla)", () => {
    expect(sql).toMatch(
      /alter table public\.ai_systems\s+add constraint ai_systems_tenant_id_fkey\s+foreign key \(tenant_id\) references public\.tenants\(id\);/,
    );
  });

  it("no toca `status`: D-06 es sólo la FK, el CHECK de estados es la opción (b) no decidida aquí", () => {
    expect(sql.toLowerCase()).not.toContain("status");
    expect(sql.toLowerCase()).not.toMatch(/\bcheck\b/);
  });

  it("no muta ningún dato: sin INSERT/UPDATE/DELETE/TRUNCATE fuera del bloque de verificación", () => {
    const ddl = sql.split("do $verificacion$")[0];
    expect(ddl.length, "control: el DDL precede al bloque de verificación").toBeLessThan(sql.length);
    expect(ddl).not.toMatch(/\b(insert\s+into|update\s+public\.|delete\s+from|truncate)\b/i);
  });

  it("verifica y aborta, con control positivo de que el instrumento ve lo que ya existía", () => {
    expect(sql).toMatch(/do \$verificacion\$/);
    expect((sql.match(/raise exception 'VERIFICACION/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // Positivo: la FK debe apuntar exactamente a tenants(id).
    expect(sql).toContain("FOREIGN KEY (tenant_id) REFERENCES tenants(id)");
    // Control positivo del propio instrumento: una constraint que YA existía
    // antes de esta migración (ai_systems_owner_id_fkey) sigue viéndose —
    // si el instrumento de lectura estuviera roto, este check fallaría también.
    expect(sql).toMatch(/ai_systems_owner_id_fkey/);
    expect(sql).toMatch(/raise notice 'VERIFICACION OK/);
  });

  it("el ensayo revertido aplica, prueba el rechazo y deshace todo (begin ... rollback)", () => {
    expect(probe.trimStart().startsWith("begin;")).toBe(true);
    expect(probe.trimEnd().endsWith("rollback;")).toBe(true);
    // La misma DDL que el fichero real (no una copia divergente).
    expect(probe).toContain("add constraint ai_systems_tenant_id_fkey");
    expect(probe).toContain("foreign key (tenant_id) references public.tenants(id);");
    // Sonda negativa: un grupo inexistente se rechaza por FK, capturada y
    // reportada (no deja la transacción abortada a medias).
    expect(probe).toMatch(/insert into public\.ai_systems \(tenant_id, name\)\s*\n\s*values \('00000000-0000-0000-0000-00000000dead'/);
    expect(probe).toMatch(/when foreign_key_violation then/);
    expect(probe).toContain("savepoint sp_grupo_inexistente;");
    expect(probe).toContain("rollback to savepoint sp_grupo_inexistente;");
    // Control positivo del dato: ARGA sigue con sus 8 sistemas dentro del ensayo.
    expect(probe).toMatch(/tenant_id = '00000000-0000-0000-0000-000000000001'/);
    expect(probe).toContain("v_arga <> 8");
  });
});
