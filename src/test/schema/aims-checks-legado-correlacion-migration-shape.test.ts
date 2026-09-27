import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * MOI-181 (deuda 5 del ledger de cobertura RIA) — forma de la migración de la
 * vista de correlación ANTES de aplicarla, sobre el SQL EJECUTABLE (sin
 * comentarios).
 *
 * Capa DÉBIL: un regex comprueba que el fichero dice lo que se espera, no que
 * lo haga contra Cloud (esta migración no está aplicada — requiere
 * autorización y un canal de escritura que este agente no tiene). La capa
 * fuerte es el bloque DO $verificacion$ de la propia migración, que aborta si
 * la vista no queda como se describe, y que se ejecutará cuando se aplique.
 *
 * Lo que vigila por encima de todo es la regla F11.T4 («0 UPDATE sobre el
 * legado»): esta migración NUNCA debe escribir en `ai_compliance_checks` ni en
 * `ai_risk_assessments`, solo leerlas desde una vista.
 */
const RUTA = "supabase/migrations/20260928140000_aims_checks_legado_correlacion_view.sql";
const VISTA = "v_aims_checks_legado_correlacion";

function ejecutable(ruta: string): string {
  return readFileSync(ruta, "utf8").replace(/^\s*--.*$/gm, "");
}

describe("MOI-181 — vista de correlación de comprobaciones legacy", () => {
  it("la migración existe en supabase/migrations", () => {
    expect(() => readFileSync(RUTA, "utf8")).not.toThrow();
  });

  it("crea la vista con security_invoker=true (sin esto, la RLS de tenant se evaluaría con el dueño, no con quien llama)", () => {
    const sql = ejecutable(RUTA);
    expect(sql).toMatch(new RegExp(`create\\s+or\\s+replace\\s+view\\s+public\\.${VISTA}`, "i"));
    expect(sql).toMatch(/with\s*\(\s*security_invoker\s*=\s*true\s*\)/i);
  });

  it("nunca escribe en las tablas base — regla dura F11.T4, 0 UPDATE sobre el legado", () => {
    const sql = ejecutable(RUTA).toLowerCase();
    for (const tabla of ["ai_compliance_checks", "ai_risk_assessments"]) {
      expect(sql).not.toMatch(new RegExp(`update\\s+(public\\.)?${tabla}\\b`));
      expect(sql).not.toMatch(new RegExp(`insert\\s+into\\s+(public\\.)?${tabla}\\b`));
      expect(sql).not.toMatch(new RegExp(`delete\\s+from\\s+(public\\.)?${tabla}\\b`));
    }
  });

  it("correla solo dentro del mismo sistema (mismo criterio que el trigger de M01) y excluye lo ya enlazado", () => {
    const sql = ejecutable(RUTA);
    expect(sql).toMatch(/a\.system_id\s*=\s*c\.system_id/);
    expect(sql).toMatch(/where\s+c\.assessment_id\s+is\s+null/i);
    // El nombre de columna deja claro que es derivado, nunca el enlace real:
    // la vista renombra `assessment_id` (id interno de la CTE) a
    // `probable_assessment_id` en su proyección final.
    expect(sql).toMatch(/assessment_id\s+as\s+probable_assessment_id/i);
  });

  it("desempata por proximidad de fecha y elige un único candidato por comprobación", () => {
    const sql = ejecutable(RUTA);
    expect(sql).toMatch(/dias_diferencia/);
    expect(sql).toMatch(/row_number\(\)\s+over\s*\(\s*partition\s+by\s+check_id/i);
    expect(sql).toMatch(/where\s+orden\s*=\s*1/i);
  });

  it("anon sin privilegio y authenticated solo con SELECT sobre la vista", () => {
    const sql = ejecutable(RUTA);
    expect(sql).toMatch(new RegExp(`revoke\\s+all\\s+on\\s+public\\.${VISTA}\\s+from\\s+anon,\\s*authenticated`, "i"));
    expect(sql).toMatch(new RegExp(`grant\\s+select\\s+on\\s+public\\.${VISTA}\\s+to\\s+authenticated`, "i"));
    // Nunca un grant de escritura a authenticated sobre esta vista en el mismo fichero.
    expect(sql).not.toMatch(new RegExp(`grant\\s+(insert|update|delete)[^;]*on\\s+public\\.${VISTA}`, "i"));
  });

  it("trae su propio bloque de verificación que aborta la migración", () => {
    const sql = ejecutable(RUTA);
    expect(sql).toMatch(/do\s+\$verificacion\$/i);
    expect(sql).toMatch(/raise\s+exception\s+'VERIFICACION:/i);
    // Comprueba explícitamente que el recuento de legacy no cambió (0 UPDATE).
    expect(sql).toMatch(/v_legacy_antes/);
    expect(sql).toMatch(/v_legacy_despues/);
  });
});
