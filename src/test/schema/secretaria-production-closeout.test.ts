import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260514181001_secretaria_production_sprint_closeout.sql"),
  "utf8",
);

describe("Secretaria production closeout migration", () => {
  it("removes anon execution from sensitive Personas/Cargos RPCs", () => {
    for (const fn of [
      "fn_designar_cargo",
      "fn_update_persona",
      "fn_cesar_cargo",
      "fn_upsert_representante_admin_pj",
      "fn_scan_vacancias_presidencia",
      "fn_secretaria_assert_caller_authority_rm",
    ]) {
      expect(migration).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*FROM PUBLIC, anon`));
    }
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_consolidate_person\(uuid, uuid, uuid, text, text\)\s+FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_consolidate_person\(uuid, uuid, uuid, text, text\)\s+TO service_role/,
    );
  });

  it("adds an import RPC with PERSON_WRITE guard and no anon grant", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_import_persona_row/);
    expect(migration).toMatch(/fn_secretaria_assert_capability\(p_tenant_id, 'PERSON_WRITE'\)/);
    expect(migration).toMatch(/operation = 'fn_import_persona_row'/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.fn_import_persona_row[\s\S]*FROM PUBLIC, anon/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.fn_import_persona_row[\s\S]*TO authenticated, service_role/);
  });

  it("adds meeting-scoped representation RPCs with LSC coherence checks", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_upsert_representacion_puntual/);
    expect(migration).toMatch(/p_scope NOT IN \('JUNTA_PROXY', 'CONSEJO_DELEGACION'\)/);
    expect(migration).toMatch(/p_meeting_id IS NULL/);
    expect(migration).toMatch(/represented person must be a vigente shareholder\/socio for JUNTA_PROXY/);
    expect(migration).toMatch(/represented person must be a vigente board member for CONSEJO_DELEGACION/);
    expect(migration).toMatch(/representative person must be a vigente board member for CONSEJO_DELEGACION/);
    expect(migration).toMatch(/ON CONFLICT \(\s*tenant_id,\s*entity_id,\s*represented_person_id,\s*scope,/);
  });

  it("closes meeting-scoped representations by effective_to and never deletes them", () => {
    const closeBlock = migration.match(
      /CREATE OR REPLACE FUNCTION public\.fn_close_representacion_puntual[\s\S]*?REVOKE ALL ON FUNCTION public\.fn_close_representacion_puntual/,
    )?.[0] ?? "";
    expect(closeBlock).toMatch(/SET effective_to = v_effective_to/);
    expect(closeBlock).toMatch(/only meeting-scoped representations can be closed by this RPC/);
    expect(closeBlock).not.toMatch(/DELETE\s+FROM\s+representaciones/i);
  });
});
