import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Forma de las dos migraciones del refactor AIMS del 2026-09-08 ANTES de
 * aplicarlas. Se asierta sobre el SQL EJECUTABLE (sin comentarios): documentar
 * por qué se retira algo no es lo mismo que hacerlo.
 *
 * Es la capa DÉBIL (un regex sobre SQL comprueba que el fichero dice lo que
 * esperabas, no que haga lo que esperabas). La capa fuerte es la sonda
 * revertida contra Cloud registrada en el ledger y, tras aplicar, el test
 * vivo `aims-cuestionario-live.test.ts`.
 */
const CUESTIONARIO = "supabase/migrations/20260908120000_aims_cuestionario_calificacion.sql";
const PRIVILEGIOS = "supabase/migrations/20260908130000_ai_aims_revoca_privilegios_heredados.sql";
const ejecutable = (ruta: string) => readFileSync(ruta, "utf8").replace(/^\s*--.*$/gm, "");

describe("20260908120000 — cuestionario guiado de calificación", () => {
  const sql = ejecutable(CUESTIONARIO);
  const politicas = sql.match(/create policy[\s\S]*?;/gi) ?? [];

  it("el fichero tiene cuerpo (control positivo del instrumento)", () => {
    expect(sql.split("\n").length).toBeGreaterThan(200);
    expect(politicas.length).toBe(3);
  });

  it("crea la tabla con RLS, y su FK al sistema arrastra el historial", () => {
    expect(sql).toMatch(/create table if not exists public\.aims_classification_questionnaires/);
    expect(sql).toMatch(/alter table public\.aims_classification_questionnaires enable row level security/);
    expect(sql).toMatch(/references public\.ai_systems\(id\) on delete cascade/);
  });

  it("las tres políticas van a authenticated, por el tenant de sesión, y ninguna es de DELETE ni se anula", () => {
    for (const pol of politicas) {
      expect(pol).toMatch(/to authenticated/);
      expect((pol.match(/fn_current_tenant_id\(\)/g) ?? []).length).toBeGreaterThanOrEqual(1);
      expect(/\bor\s+true\b|using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(pol), `política anulada: ${pol.slice(0, 80)}`).toBe(false);
      expect(/for delete/i.test(pol), "hay política de DELETE").toBe(false);
    }
    // Y cada CREATE lleva su DROP IF EXISTS: la migración se puede reaplicar.
    expect((sql.match(/drop policy if exists/gi) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("revoca lo que no concede: anon fuera, y DELETE/TRUNCATE/REFERENCES/TRIGGER fuera de authenticated", () => {
    expect(sql).toMatch(/revoke all on table public\.aims_classification_questionnaires from public, anon/);
    expect(sql).toMatch(/revoke delete, truncate, references, trigger on table public\.aims_classification_questionnaires from authenticated/);
  });

  it("la huella se calcula en servidor con SHA-512 y las dos RPC son security definer sin acceso anónimo", () => {
    expect((sql.match(/sha512\(/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((sql.match(/security definer/gi) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(sql).toMatch(/revoke all on function public\.fn_aims_completar_cuestionario\(uuid\) from public, anon/);
    expect(sql).toMatch(/revoke all on function public\.fn_aims_registrar_sistema\(jsonb, jsonb\) from public, anon/);
  });

  it("codifica lo que la spec exige: art. 6.3 obligatorio, prohibido bloquea, inmutabilidad y clasificación sólo por RPC", () => {
    for (const marca of [
      "ART63_MOTIVACION_OBLIGATORIA",
      "PRACTICA_PROHIBIDA_BLOQUEA",
      "CUESTIONARIO_COMPLETADO_INMUTABLE",
      "CUESTIONARIO_SUPERSEDIDO_INMUTABLE",
      "COMPLETAR_SOLO_POR_RPC",
      "CLASIFICACION_SOLO_POR_CUESTIONARIO",
      "ALTA_SOLO_POR_CUESTIONARIO",
      "CLASIFICACION_INCOHERENTE",
    ]) {
      expect(sql, `falta ${marca}`).toContain(`'${marca}`);
    }
    expect(sql).toMatch(/set_config\('aims\.clasificacion_rpc', 'on', true\)/);
    expect(sql).toMatch(/where status = 'COMPLETED'/);
    // `current_setting(…, true)` devuelve NULL sin flag, y NULL = 'on' no es
    // false: la sonda revertida del 2026-09-08 encontró los dos triggers sin
    // bloquear nada por eso. El coalesce es lo que los hace funcionar.
    expect((sql.match(/coalesce\(current_setting\('aims\.clasificacion_rpc', true\), ''\) = 'on'/g) ?? []).length).toBe(2);
    expect(/current_setting\('aims\.clasificacion_rpc', true\) = 'on'/.test(sql.replace(/coalesce\(current_setting\('aims\.clasificacion_rpc', true\), ''\) = 'on'/g, "")),
      "queda una comparación del flag sin coalesce").toBe(false);
    // Y las dos RPC apagan el flag al terminar: en una transacción larga no
    // debe seguir abriendo puertas.
    expect((sql.match(/set_config\('aims\.clasificacion_rpc', 'off', true\)/g) ?? []).length).toBe(2);
  });

  it("el servidor re-deriva desde las RESPUESTAS y no se fía de la conclusión del cliente", () => {
    // Revisión adversarial 2026-09-08 (lentes 1 y 2): la práctica prohibida se
    // validaba contra `computed_risk_level`, que manda el cliente.
    expect(sql).toMatch(/coalesce\(\(v_row\.phase2_responses->>'Q2_1'\)::boolean, false\)/);
    for (const fn of ["fn_aims_derivar_rol(p jsonb)", "fn_aims_derivar_nivel(p jsonb)", "fn_aims_perfil_catalogo(p_rol text, p_nivel text)"]) {
      expect(sql, `falta ${fn}`).toContain(`create or replace function public.${fn}`);
    }
    expect(sql).toMatch(/v_row\.computed_role is distinct from v_rol_derivado/);
    expect(sql).toMatch(/v_row\.computed_risk_level is distinct from v_nivel_derivado/);
    // Y el DRAFT no puede reescribir su versión de cuestionario ni su autor.
    expect(sql).toMatch(/new\.questionnaire_version is distinct from old\.questionnaire_version/);
    expect(sql).toMatch(/new\.created_by is distinct from old\.created_by/);
  });

  it("el tenant del alta sale de la sesión, nunca del cliente", () => {
    const registrar = sql.slice(sql.indexOf("fn_aims_registrar_sistema(p_sistema jsonb"), sql.indexOf("revoke all on function public.fn_aims_registrar_sistema"));
    expect(registrar).not.toMatch(/p_sistema->>'tenant_id'/);
    expect(registrar).toMatch(/v_tenant uuid := public\.fn_current_tenant_id\(\)/);
  });

  it("sincroniza ai_systems desde la RPC y el trigger impide hacerlo por otro camino", () => {
    expect(sql).toMatch(/update public\.ai_systems s\s+set regulatory_role = v_row\.computed_role,\s+risk_level = v_row\.computed_risk_level/);
    expect(sql).toMatch(/before insert or update of regulatory_role, risk_level on public\.ai_systems/);
  });

  it("verifica y aborta, con control positivo del instrumento", () => {
    expect(sql).toMatch(/do \$verificacion\$/);
    expect(sql).toContain("constraint_que_no_existe_jamas");
    expect((sql.match(/raise exception 'VERIFICACION/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });
});

describe("20260908130000 — privilegios heredados del backbone", () => {
  const sql = ejecutable(PRIVILEGIOS);
  const TABLAS_28 = [
    "ai_systems", "ai_incidents", "ai_risk_assessments", "ai_compliance_checks",
    "aims_change_requests", "aims_component_inventory", "aims_control_catalog", "aims_control_tests",
    "aims_dataset_registry", "aims_evidence_packs", "aims_fria_affected_groups", "aims_fria_assessments",
    "aims_fria_dpia_cross_references", "aims_fria_fundamental_rights_risks", "aims_fria_process_map",
    "aims_fria_remediation_governance", "aims_fria_use_profile", "aims_incident_evidence_packs",
    "aims_incident_regimes", "aims_incident_reports", "aims_model_registry", "aims_monitoring_indicators",
    "aims_post_market_plans", "aims_regulatory_clocks", "aims_requirement_catalog", "aims_requirement_checks",
    "aims_system_versions", "aims_technical_file_sections",
  ];
  const TABLAS_MUERTAS_20 = TABLAS_28.filter((t) =>
    !["ai_systems", "ai_incidents", "ai_risk_assessments", "ai_compliance_checks",
      "aims_technical_file_sections", "aims_system_versions", "aims_monitoring_indicators",
      "aims_incident_regimes"].includes(t));

  it("el fichero tiene cuerpo (control positivo)", () => {
    expect(sql.split("\n").length).toBeGreaterThan(60);
    expect(TABLAS_MUERTAS_20.length).toBe(20);
  });

  it("anon pierde todo y authenticated pierde TRUNCATE/REFERENCES/TRIGGER en las 28, enumeradas y no por LIKE", () => {
    for (const t of TABLAS_28) {
      expect(sql, `${t}: anon sigue dentro`).toMatch(new RegExp(`revoke all on table public\\.${t} from anon`));
      expect(sql, `${t}: authenticated conserva truncate`).toMatch(
        new RegExp(`revoke truncate, references, trigger on table public\\.${t} from authenticated`),
      );
    }
    expect(/like\s+'aims\\?_%'/i.test(sql), "el revoke se apoya en un LIKE en vez de enumerar").toBe(false);
  });

  it("las 20 tablas sin camino de escritura en el producto pierden INSERT/UPDATE/DELETE, y las de destino (a) no", () => {
    for (const t of TABLAS_MUERTAS_20) {
      expect(sql, `${t}: escritura no revocada`).toMatch(
        new RegExp(`revoke insert, update, delete on table public\\.${t} from authenticated`),
      );
    }
    for (const t of ["ai_systems", "aims_technical_file_sections", "aims_incident_regimes"]) {
      expect(sql, `${t}: se le ha revocado la escritura que el producto usa`).not.toMatch(
        new RegExp(`revoke insert, update, delete on table public\\.${t} from authenticated`),
      );
    }
  });

  it("retira el EXECUTE de la RPC de cierre del expediente (inalcanzable y sin botón) y verifica abortando", () => {
    expect(sql).toMatch(/revoke execute on function public\.fn_aims_close_technical_file\(uuid, text, text, text\) from authenticated/);
    expect(sql).toMatch(/do \$verificacion\$/);
    expect((sql.match(/raise exception 'VERIFICACION/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // Control positivo dentro de la propia verificación: un grant que DEBE quedar.
    expect(sql).toMatch(/privilege_type = 'INSERT'[\s\S]*?ai_systems|ai_systems[\s\S]*?privilege_type = 'INSERT'/);
  });
});
