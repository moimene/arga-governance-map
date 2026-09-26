import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * MOI-148 (decisión D-21, por delegación) — forma de la migración y de su
 * ensayo revertido ANTES de aplicarlos. La migración NO se aplica en esta
 * tarea (solo se prepara y se ensaya revertida en `proposed/*.probe.sql`),
 * a la espera de autorización escrita de Moisés (issue, paso 6).
 *
 * Capa DÉBIL: comprueba que el fichero dice lo que se espera, no que la base
 * de datos ya lo cumpla — mismo patrón que
 * `ai-systems-tenant-fk-migration-shape.test.ts` y
 * `aims-cuestionario-migration-shape.test.ts`. La capa fuerte es el bloque
 * de verificación de la propia migración (aborta con RAISE EXCEPTION) y el
 * ensayo revertido, ambos leídos aquí en frío, sin tocar Cloud.
 */
const MIGRACION = "supabase/migrations/20260926114800_secretaria_editar_estructura_grupo.sql";
const SONDA = "supabase/migrations/proposed/20260926114800_secretaria_editar_estructura_grupo.probe.sql";
const ejecutable = (texto: string) => texto.replace(/^\s*--.*$/gm, "").trim();
const sql = ejecutable(readFileSync(MIGRACION, "utf8"));
const probe = ejecutable(readFileSync(SONDA, "utf8"));

describe("MOI-148 — fn_secretaria_actualizar_estructura_grupo", () => {
  it("el fichero tiene cuerpo (control positivo del instrumento)", () => {
    expect(sql.split("\n").length).toBeGreaterThan(40);
  });

  it("es SECURITY DEFINER con tenant y rol exigidos desde la sesión, nunca del cliente", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION fn_secretaria_actualizar_estructura_grupo\(\s*p_tenant_id uuid,\s*p_entity_id uuid,\s*p_parent_entity_id uuid,\s*p_ownership_percentage numeric\s*\) RETURNS jsonb/,
    );
    expect(sql).toMatch(/LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = public/);
    expect(sql).toMatch(/PERFORM fn_secretaria_assert_tenant_access\(p_tenant_id\)/);
    expect(sql).toMatch(/PERFORM fn_secretaria_assert_role_allowed\(p_tenant_id, ARRAY\['SECRETARIO', 'ADMIN_TENANT'\]\)/);
  });

  it("bloquea la fila del tenant correcto antes de leer el valor anterior", () => {
    expect(sql).toMatch(/FROM entities\s+WHERE id = p_entity_id\s+AND tenant_id = p_tenant_id\s+FOR UPDATE/);
  });

  it("valida rango 0-100, auto-referencia y ciclos antes de escribir", () => {
    expect(sql).toMatch(/p_ownership_percentage < 0 OR p_ownership_percentage > 100/);
    expect(sql).toMatch(/p_parent_entity_id = p_entity_id THEN\s+RAISE EXCEPTION 'an entity cannot be its own parent'/);
    expect(sql).toMatch(/would create a cycle in the group structure/);
    expect(sql).toMatch(/v_depth < 50/);
  });

  it("el UPDATE toca solo matriz y porcentaje, scoped a tenant, y no crea tabla de histórico nueva", () => {
    expect(sql).toMatch(
      /UPDATE entities\s+SET parent_entity_id = p_parent_entity_id,\s+ownership_percentage = p_ownership_percentage\s+WHERE id = p_entity_id\s+AND tenant_id = p_tenant_id;/,
    );
    expect(sql.toUpperCase()).not.toContain("CREATE TABLE");
  });

  it("devuelve el valor anterior en la respuesta, para que la pantalla pueda mostrarlo", () => {
    expect(sql).toMatch(/'previous_parent_entity_id', v_entity\.parent_entity_id/);
    expect(sql).toMatch(/'previous_ownership_percentage', v_entity\.ownership_percentage/);
  });

  it("revoca lo que no concede: anon fuera, authenticated y service_role dentro", () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION fn_secretaria_actualizar_estructura_grupo\(uuid, uuid, uuid, numeric\) FROM PUBLIC, anon;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION fn_secretaria_actualizar_estructura_grupo\(uuid, uuid, uuid, numeric\)\s+TO authenticated, service_role;/,
    );
  });

  it("verifica y aborta, con control positivo de que el trigger WORM que da el histórico sigue existiendo", () => {
    expect(sql).toMatch(/DO \$verificacion\$/);
    expect((sql.match(/RAISE EXCEPTION 'VERIFICACION/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(sql).toMatch(/trg_audit_worm_entities/);
    expect(sql).toMatch(/RAISE NOTICE 'VERIFICACION OK/);
  });

  it("el ensayo revertido aplica, prueba el positivo y cinco rechazos, y deshace todo (begin ... rollback)", () => {
    expect(probe.trimStart().startsWith("begin;")).toBe(true);
    expect(probe.trimEnd().endsWith("rollback;")).toBe(true);
    // Misma DDL que el fichero real (no una copia divergente).
    expect(probe).toContain("CREATE OR REPLACE FUNCTION fn_secretaria_actualizar_estructura_grupo");
    expect(probe).toContain("would create a cycle in the group structure");
    // Sesión real del tenant Grupo Nuevo, vía request.jwt.claims local a la transacción.
    expect(probe).toMatch(/set_config\(\s*'request\.jwt\.claims',\s*json_build_object\('tenant_id', '00000000-0000-0000-0000-000000000003', 'role_code', 'SECRETARIO'\)/);
    // Los cinco rechazos: auto-referencia, ciclo, rango, rol y tenant cruzado.
    for (const marca of [
      "cannot be its own parent",
      "would create a cycle",
      "between 0 and 100",
      "role is required",
      "set local role authenticated",
      "tenant access denied",
    ]) {
      expect(probe, `falta la sonda negativa de "${marca}"`).toContain(marca);
    }
    expect((probe.match(/^savepoint sp_/gm) ?? []).length).toBe(5);
    expect((probe.match(/^rollback to savepoint sp_/gm) ?? []).length).toBe(5);
    // Control positivo del dato: ARGA no se toca en ningún momento del ensayo.
    expect(probe).toMatch(/6d7ed736-f263-4531-a59d-c6ca0cd41602/);
    expect(probe).toContain("v_parent is not null or v_pct is not null");
  });
});
