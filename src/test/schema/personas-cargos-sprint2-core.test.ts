import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260512171059_personas_cargos_sprint2_core.sql"),
  "utf8",
);

function functionBlock(name: string): string {
  const match = migration.match(
    new RegExp(`CREATE OR REPLACE FUNCTION ${name}[\\s\\S]*?\\n\\$\\$;`, "i"),
  );
  expect(match, `${name} block should exist`).not.toBeNull();
  return match![0];
}

describe("Personas/Cargos Sprint 2 core migration contract", () => {
  it("extends capability_matrix for cargo and consolidation RPCs", () => {
    expect(migration).toMatch(/DROP CONSTRAINT IF EXISTS capability_matrix_action_check/i);
    expect(migration).toMatch(/'CARGO_MANAGEMENT'/);
    expect(migration).toMatch(/'PERSON_WRITE'/);
    expect(migration).toMatch(/'PERSON_CONSOLIDATE'/);
    expect(migration).toMatch(/'REPRESENTATION_MANAGEMENT'/);
    expect(migration).toMatch(/\('SECRETARIO', 'CARGO_MANAGEMENT', true/i);
    expect(migration).toMatch(/\('SECRETARIO', 'PERSON_WRITE', true/i);
    expect(migration).toMatch(/\('CONSEJERO', 'CARGO_MANAGEMENT', false/i);
    expect(migration).toMatch(/\('CONSEJERO', 'PERSON_WRITE', false/i);
  });

  it("marks persons.representative_person_id as deprecated legacy state", () => {
    expect(migration).toMatch(/COMMENT ON COLUMN persons\.representative_person_id/i);
    expect(migration).toMatch(/DEPRECATED Sprint 2 Personas\/Cargos/i);
    expect(migration).toMatch(/representaciones\(scope=ADMIN_PJ_REPRESENTANTE\)/i);
  });

  it("implements L12-C hard singleton indexes without VICESECRETARIO or VICEPRESIDENTE", () => {
    const bodySingleton = migration.match(
      /CREATE UNIQUE INDEX IF NOT EXISTS ux_condicion_singleton_body_vigente_l12c[\s\S]*?;/i,
    )?.[0];
    expect(bodySingleton).toBeTruthy();
    expect(bodySingleton).toContain("PRESIDENTE");
    expect(bodySingleton).toContain("SECRETARIO");
    expect(bodySingleton).toContain("CONSEJERO_COORDINADOR");
    expect(bodySingleton).not.toContain("VICESECRETARIO");
    expect(bodySingleton).not.toContain("VICEPRESIDENTE");

    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS ux_condicion_admin_unico_entity_vigente_l12c/i,
    );
    expect(migration).toMatch(/AND tipo_condicion = 'ADMIN_UNICO'/i);
  });

  it("hardens fn_designar_cargo with tenant, capability, authority, locks, and historified cese", () => {
    const fn = functionBlock("fn_designar_cargo");
    expect(fn).toMatch(/SECURITY DEFINER/i);
    expect(fn).toMatch(/SET search_path = public, extensions/i);
    expect(fn).toMatch(/fn_secretaria_assert_tenant_access\(p_tenant_id\)/i);
    expect(fn).toMatch(/fn_secretaria_assert_capability\(p_tenant_id, 'CARGO_MANAGEMENT'\)/i);
    expect(fn).toMatch(/fn_secretaria_assert_caller_authority_rm\(p_tenant_id, p_entity_id, p_body_id\)/i);
    expect(fn).toMatch(/pg_advisory_xact_lock/i);
    expect(fn).toMatch(/UPDATE condiciones_persona[\s\S]*estado = 'CESADO'/i);
    expect(fn).toMatch(/INSERT INTO condiciones_persona/i);
    expect(fn).toMatch(/INSERT INTO representaciones/i);
    expect(fn).toMatch(/fn_refresh_parte_votante_body\(p_body_id\)/i);
    expect(fn).not.toMatch(/DELETE\s+FROM\s+condiciones_persona/i);
  });

  it("keeps cese and persona edits behind SECURITY DEFINER RPCs", () => {
    const updateFn = functionBlock("fn_update_persona");
    expect(updateFn).toMatch(/SECURITY DEFINER/i);
    expect(updateFn).toMatch(/SET search_path = public, extensions/i);
    expect(updateFn).toMatch(/fn_secretaria_assert_capability\(p_tenant_id, 'PERSON_WRITE'\)/i);
    expect(updateFn).toMatch(/fn_secretaria_assert_caller_authority_rm\(p_tenant_id, NULL, NULL\)/i);
    expect(updateFn).toMatch(/ARCHIVED markers are reserved for fn_consolidate_person/i);
    expect(updateFn).not.toMatch(/person_type\s*=/i);

    const ceseFn = functionBlock("fn_cesar_cargo");
    expect(ceseFn).toMatch(/SECURITY DEFINER/i);
    expect(ceseFn).toMatch(/SET search_path = public, extensions/i);
    expect(ceseFn).toMatch(/fn_secretaria_assert_capability\(p_tenant_id, 'CARGO_MANAGEMENT'\)/i);
    expect(ceseFn).toMatch(/fn_secretaria_assert_caller_authority_rm\(\s*p_tenant_id,\s*v_condicion\.entity_id,\s*v_condicion\.body_id\s*\)/i);
    expect(ceseFn).toMatch(/UPDATE condiciones_persona[\s\S]*estado = 'CESADO'/i);
    expect(ceseFn).not.toMatch(/DELETE\s+FROM\s+condiciones_persona/i);
  });

  it("moves standalone PJ representative management into a hardened RPC", () => {
    const fn = functionBlock("fn_upsert_representante_admin_pj");
    expect(fn).toMatch(/SECURITY DEFINER/i);
    expect(fn).toMatch(/SET search_path = public, extensions/i);
    expect(fn).toMatch(/fn_secretaria_assert_capability\(p_tenant_id, 'REPRESENTATION_MANAGEMENT'\)/i);
    expect(fn).toMatch(/fn_secretaria_assert_caller_authority_rm\(p_tenant_id, p_entity_id, NULL\)/i);
    expect(fn).toMatch(/v_represented\.person_type <> 'PJ'/i);
    expect(fn).toMatch(/v_representative\.person_type <> 'PF'/i);
    expect(fn).toMatch(/represented PJ has no vigente administrator\/consejero condition/i);
    expect(fn).toMatch(/pg_advisory_xact_lock/i);
    expect(fn).toMatch(/INSERT INTO representaciones/i);
  });

  it("scopes body-level authority to Secretario/Vicesecretario evidence for that body", () => {
    const fn = functionBlock("fn_secretaria_assert_caller_authority_rm");
    const bodyBranch = fn.match(/p_body_id IS NOT NULL[\s\S]*?ae\.cargo IN \('SECRETARIO', 'VICESECRETARIO'\)/i)?.[0];
    expect(bodyBranch).toBeTruthy();
    expect(bodyBranch).toMatch(/ae\.body_id = p_body_id/i);
    expect(fn).not.toMatch(/OR ae\.body_id IS NULL/i);
    expect(bodyBranch).not.toMatch(/'ADMIN_UNICO'/i);
  });

  it("keeps VICESECRETARIO as warning-only instead of hard singleton", () => {
    const fn = functionBlock("fn_designar_cargo");
    expect(fn).toMatch(/MULTIPLE_VICESECRETARIO_REVIEW_STATUTES/i);
    expect(fn).toMatch(/representative_person_id is only valid for PJ administrators\/consejeros/i);
    expect(fn).not.toMatch(/tipo_condicion IN \('VICESECRETARIO'\)/i);
  });

  it("implements fn_consolidate_person as transactional SECURITY DEFINER with WORM skips", () => {
    const fn = functionBlock("fn_consolidate_person");
    const skippedTables = fn.match(/v_skipped_tables text\[\] := ARRAY\[[\s\S]*?\];/i)?.[0] ?? "";
    expect(fn).toMatch(/SECURITY DEFINER/i);
    expect(fn).toMatch(/SET search_path = public, extensions/i);
    expect(fn).toMatch(/fn_secretaria_assert_capability\(p_tenant_id, 'PERSON_CONSOLIDATE'\)/i);
    expect(fn).toMatch(/fn_secretaria_assert_caller_authority_rm\(p_tenant_id, NULL, NULL\)/i);
    expect(fn).toMatch(/pg_constraint/i);
    expect(fn).toMatch(/con\.confrelid = 'public\.persons'::regclass/i);
    expect(skippedTables).toMatch(/no_session_notificaciones/i);
    expect(skippedTables).toMatch(/no_session_respuestas/i);
    expect(skippedTables).not.toMatch(/no_session_expedientes/i);
    expect(skippedTables).toMatch(/capital_movements/i);
    expect(skippedTables).toMatch(/person_consolidation_operations/i);
    expect(fn).toMatch(/WORM historical FK preserved/i);
    expect(fn).toMatch(/historical idempotency ledger FK preserved/i);
    expect(fn).toMatch(/ARCHIVED-/i);
    expect(fn).not.toMatch(/session_replication_role/i);
  });

  it("preflights consolidation collisions before FK rewrites", () => {
    const fn = functionBlock("fn_consolidate_person");
    expect(fn).toMatch(/both persons are linked to entities\.person_id/i);
    expect(fn).toMatch(/active condiciones_persona colliding/i);
    expect(fn).toMatch(/active capital_holdings in the same entity/i);
    expect(fn).toMatch(/active representaciones\.represented_person_id collision/i);
    expect(fn).toMatch(/active authority_evidence collision/i);
    expect(fn).toMatch(/left non-WORM references to duplicate/i);
    expect(fn).toMatch(/already used for a different person consolidation pair/i);
  });

  it("adds L13-B presidential vacancy notifications without blocking operations", () => {
    const fn = functionBlock("fn_scan_vacancias_presidencia");
    expect(fn).toMatch(/fn_secretaria_assert_role_allowed\(p_tenant_id, ARRAY\['SECRETARIO', 'ADMIN_TENANT'\]\)/i);
    expect(fn).toMatch(/VACANCIA_PRESIDENCIA_D0/i);
    expect(fn).toMatch(/VACANCIA_PRESIDENCIA_D60/i);
    expect(fn).toMatch(/VACANCIA_PRESIDENCIA_D90/i);
    expect(fn).toMatch(/INSERT INTO notifications/i);
    expect(fn).toMatch(/VACANCIA_PRESIDENCIA_D0[\s\S]*created_at::date/i);
    expect(fn).toMatch(/gb\.created_at::date/i);
    expect(fn).toMatch(/'blocking', false/i);
    expect(fn).toMatch(/Owner operativo: Secretario del CdA o Vicesecretario/i);
  });
});
