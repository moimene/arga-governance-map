import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260515160345_secretaria_p2_normative_governance.sql"),
  "utf8",
);

describe("secretaria P2 normative governance migration", () => {
  it("creates governed persistence tables for organs, statutes, overrides, bindings and effective rules", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS secretaria_organ_rules/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS secretaria_statute_versions/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS secretaria_statute_clause_mappings/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS secretaria_normative_overrides/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS secretaria_pacto_clause_mappings/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS materia_template_binding/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS secretaria_effective_rule_matrix/i);
  });

  it("enforces tenant-scoped RLS without demo tenant constants", () => {
    const tables = [
      "secretaria_organ_rules",
      "secretaria_statute_versions",
      "secretaria_normative_overrides",
      "materia_template_binding",
      "secretaria_effective_rule_matrix",
    ];
    for (const table of tables) {
      expect(migration).toMatch(new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, "i"));
    }
    expect(migration).toMatch(/fn_secretaria_current_tenant_id\(\)/);
    expect(migration).toMatch(/fn_secretaria_assert_tenant_access\(v_tenant_id\)/);
    expect(migration).not.toMatch(/tenant_id = '00000000-0000-0000-0000-000000000001'::uuid/);
  });

  it("publishes governed changes through SECURITY DEFINER RPCs with fixed search path", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_upsert_organ_rule\(p_payload jsonb\)/i);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_publish_statute_version\(p_payload jsonb\)/i);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_publish_normative_override\(p_payload jsonb\)/i);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_assign_template_binding\(p_payload jsonb\)/i);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_materialize_effective_rule_matrix/i);
    expect(migration.match(/SECURITY DEFINER\s+SET search_path = public, extensions/gi)?.length).toBeGreaterThanOrEqual(5);
  });

  it("blocks lowering legal minimums and requires documentary references", () => {
    expect(migration).toMatch(/fn_validar_no_rebaja_ley\(v_majority_code, v_matter, v_entity_form\)/);
    expect(migration).toMatch(/Cada override exige referencia documental y justificación/);
    expect(migration).toMatch(/mapping_coverage >= 80/);
    expect(migration).toMatch(/source_ref text NOT NULL/);
  });

  it("adds event idempotency and deterministic template selection reason", () => {
    expect(migration).toMatch(/event_dedupe_key text/);
    expect(migration).toMatch(/ux_secretaria_normative_event_log_dedupe/);
    expect(migration).toMatch(/selection_reason text NOT NULL/);
    expect(migration).toMatch(/ux_materia_template_binding_active_priority/);
  });
});
