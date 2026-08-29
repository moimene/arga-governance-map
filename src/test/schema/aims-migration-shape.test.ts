import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * B1 — Forma de la migración multirrégimen/FRIA antes de aplicarla.
 *
 * Esta migración estuvo commiteada y sin aplicar durante un día con un P0:
 * sus diez políticas RLS hardcodeaban el tenant de ARGA, de modo que el tenant
 * Garrigues habría quedado fuera de sus propias tablas. La migración que debía
 * habilitar el módulo era la que se lo impedía.
 *
 * El gate asierta sobre el SQL EJECUTABLE, no sobre los comentarios: documentar
 * por qué se retiró algo es valioso y no es lo mismo que hacerlo.
 */
const RUTA = "supabase/migrations/20260828190000_aims_multiregime_incidents_and_fria.sql";
const sqlEjecutable = () => readFileSync(RUTA, "utf8").replace(/^\s*--.*$/gm, "");

const TABLAS = [
  "aims_incident_regimes", "aims_regulatory_clocks", "aims_incident_reports",
  "aims_fria_assessments", "aims_fria_process_map", "aims_fria_use_profile",
  "aims_fria_affected_groups", "aims_fria_fundamental_rights_risks",
  "aims_fria_remediation_governance", "aims_fria_dpia_cross_references",
];

describe("B1 — la migración aísla por el tenant de la sesión", () => {
  it("ninguna política hardcodea un tenant", () => {
    expect(/tenant_id\s*=\s*'00000000-/.test(sqlEjecutable()),
      "hay una política con el tenant en duro").toBe(false);
  });

  it("las diez tablas tienen política con fn_current_tenant_id y TO authenticated", () => {
    const sql = sqlEjecutable();
    for (const t of TABLAS) {
      const m = sql.match(new RegExp(`CREATE POLICY ${t}_tenant_isolation[\\s\\S]*?;`));
      expect(m, `${t} no tiene política de aislamiento`).not.toBeNull();
      const pol = m![0];
      expect(/TO authenticated/.test(pol), `${t}: la política se crea contra PUBLIC`).toBe(true);
      expect((pol.match(/fn_current_tenant_id\(\)/g) ?? []).length,
        `${t}: falta USING o WITH CHECK con el tenant de sesión`).toBeGreaterThanOrEqual(2);
    }
  });

  it("RLS habilitada en las diez tablas", () => {
    const sql = sqlEjecutable();
    for (const t of TABLAS) {
      expect(sql, `${t} sin RLS`).toContain(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    }
  });
});

describe("B1 — no se hornean capacidades que no existen", () => {
  it("no hay columnas de sello ni canal de entrega certificada", () => {
    const sql = sqlEjecutable();
    // El módulo no llama a ningún prestador de confianza: 0 imports de cliente,
    // 0 fetch, 0 functions.invoke. Declararlo en el schema lo daba por hecho.
    for (const re of [/qseal_token/, /tsq_token/, /ERDS/]) {
      expect(re.test(sql), `el schema sigue horneando ${re}`).toBe(false);
    }
  });

  it("el órgano de gobierno es una arista, no un rótulo", () => {
    const sql = sqlEjecutable();
    expect(/governance_body_id\s+uuid\s+REFERENCES\s+governing_bodies/.test(sql),
      "el órgano no es FK contra governing_bodies").toBe(true);
    expect(/DEFAULT\s+'COMITE_RIESGOS'/.test(sql),
      "sobrevive el default de ownership de otro tenant").toBe(false);
  });
});
