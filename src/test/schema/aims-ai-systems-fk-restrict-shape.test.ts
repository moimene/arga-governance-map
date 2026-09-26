import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Forma de la migración MOI-210 (decisión D-12) ANTES de aplicarla en Cloud.
 *
 * Es la capa DÉBIL (un regex sobre SQL comprueba que el fichero dice lo que
 * esperábamos, no que haga lo que esperábamos). La capa fuerte es el ensayo
 * revertido (`supabase/migrations/proposed/<mismo_nombre>.probe.sql`) y, tras
 * aplicar, la sonda revertida archivada
 * `docs/superpowers/plans/2026-09-26-moi-210-sonda-revertida-post-restrict.sql`.
 */
const MIGRACION = "supabase/migrations/20260926121000_aims_ai_systems_fk_restrict.sql";
const ejecutable = (ruta: string) => readFileSync(ruta, "utf8").replace(/^\s*--.*$/gm, "");

const TABLAS_PROTEGIDAS = [
  "aims_classification_questionnaires",
  "aims_system_versions",
  "aims_technical_file_sections",
  "aims_monitoring_indicators",
];

describe("20260926121000 — 4 FK de ai_systems pasan de CASCADE a RESTRICT (MOI-210, D-12)", () => {
  const sql = ejecutable(MIGRACION);

  it("el fichero tiene cuerpo (control positivo del instrumento)", () => {
    expect(sql.split("\n").length).toBeGreaterThan(50);
  });

  it("las 4 tablas que cita el issue pasan a on delete restrict, y ninguna se queda en cascade", () => {
    for (const tabla of TABLAS_PROTEGIDAS) {
      const bloque = sql.match(new RegExp(`conrelid\\s*=\\s*'public\\.${tabla}'::regclass[\\s\\S]{0,400}`, "i"))?.[0] ?? "";
      expect(bloque, `no se encontró el bloque de ${tabla}`).not.toBe("");
      expect(bloque, `${tabla} no queda en RESTRICT`).toMatch(/on delete restrict/i);
      expect(bloque, `${tabla} sigue mencionando cascade`).not.toMatch(/on delete cascade/i);
    }
  });

  it("no toca el grant de DELETE de ai_systems (la decisión fue opción b: mantenerlo)", () => {
    expect(sql).not.toMatch(/revoke\s+delete[\s\S]*?ai_systems/i);
    expect(sql).not.toMatch(/grant\s+delete[\s\S]*?ai_systems/i);
  });

  it("la verificación final aborta si alguna de las 4 FK no quedó en RESTRICT", () => {
    expect(sql).toMatch(/raise exception[\s\S]*?4 fk en restrict/i);
    expect(sql).toMatch(/v_restrict_count\s*<>\s*4/);
  });

  it("tiene control positivo del propio instrumento (una FK que NO toca debe seguir en CASCADE)", () => {
    expect(sql).toMatch(/aims_evidence_packs/);
    expect(sql).toMatch(/control positivo fallido/i);
  });

  it("no cambia datos: sin insert, update ni delete de filas", () => {
    expect(sql).not.toMatch(/\binsert into\b/i);
    expect(sql).not.toMatch(/\bupdate\s+public\./i);
    expect(sql).not.toMatch(/\bdelete from\b/i);
  });

  it("es idempotente: cada alteración se guarda tras localizar el conname por catálogo, no por nombre fijo", () => {
    // Las 4 alteraciones van dentro de un único bloque `do $$ ... end $$;` que
    // resuelve el nombre real de cada FK por pg_constraint antes de tocarla,
    // así que reaplicar la migración no falla por un nombre que ya cambió.
    expect((sql.match(/select\s+conname\s+into\s+v_conname/gi) ?? []).length).toBe(4);
    expect((sql.match(/if\s+v_conname\s+is\s+not\s+null\s+then/gi) ?? []).length).toBe(4);
  });
});
