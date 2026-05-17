import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260517045127_secretaria_p2_functional_restore.sql"),
  "utf8",
);

describe("secretaria P2 functional restore migration", () => {
  it("adds operational organ maintenance and source-link persistence", () => {
    expect(migration).toMatch(/fn_secretaria_upsert_organ_profile\(p_payload jsonb\)/i);
    expect(migration).toMatch(/INSERT INTO public\.governing_bodies/i);
    expect(migration).toMatch(/UPDATE public\.governing_bodies/i);
    expect(migration).toMatch(/Toda competencia exige fuente documental/);
    expect(migration).toMatch(/INSERT INTO public\.secretaria_organ_source_links/i);
    expect(migration).toMatch(/fn_secretaria_materialize_effective_rule_matrix\(v_tenant_id, v_entity_id\)/);
  });

  it("makes statute publication document-backed and immutable", () => {
    expect(migration).toMatch(/fn_secretaria_guard_statute_version_immutability/i);
    expect(migration).toMatch(/trg_secretaria_statute_versions_immutable/i);
    expect(migration).toMatch(/Publicar estatutos exige referencia documental y hash/);
    expect(migration).toMatch(/La referencia documental demo no es publicable/);
    expect(migration).toMatch(/cobertura crítica mínima del 80/);
    expect(migration).toMatch(/Publicar estatutos exige al menos una cláusula mapeada/);
    expect(migration).toMatch(/event_name', 'clause_mapped'/);
    expect(migration).not.toMatch(/ON CONFLICT \(entity_id, version_label\)[\s\S]*DO UPDATE SET/i);
  });

  it("keeps template binding and overrides governed", () => {
    expect(migration).toMatch(/Solo se pueden vincular plantillas activas/);
    expect(migration).toMatch(/La asignación exige razón jurídica de selección/);
    expect(migration).toMatch(/Cada override exige referencia documental y justificación/);
    expect(migration).toMatch(/fn_validar_no_rebaja_ley\(v_majority_code, v_matter, v_entity_form\)/);
    expect(migration).toMatch(/matrix_recalculated', true/);
  });

  it("materializes effective rules from all P2 layers", () => {
    expect(migration).toMatch(/secretaria_statute_versions sv/);
    expect(migration).toMatch(/secretaria_statute_clause_mappings scm/);
    expect(migration).toMatch(/secretaria_normative_overrides no/);
    expect(migration).toMatch(/materia_template_binding b/);
    expect(migration).toMatch(/secretaria_pacto_clause_mappings pm/);
    expect(migration).toMatch(/'type', 'PLANTILLA'/);
    expect(migration).toMatch(/P2_EFFECTIVE_RULE_MATRIX_RESTORED/);
  });

  it("keeps RPCs tenant-scoped and security definer", () => {
    expect(migration.match(/SECURITY DEFINER\s+SET search_path = public, extensions/gi)?.length).toBeGreaterThanOrEqual(7);
    expect(migration.match(/fn_secretaria_assert_tenant_access\(v_tenant_id\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(migration).not.toMatch(/00000000-0000-0000-0000-000000000001/);
  });
});
