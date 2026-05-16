import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260512190500_personas_cargos_security_followups.sql"),
  "utf8",
);

const designarBlock = migration.match(
  /CREATE OR REPLACE FUNCTION fn_designar_cargo\([\s\S]*?REVOKE ALL ON FUNCTION fn_designar_cargo/,
)?.[0] ?? "";

const updateBlock = migration.match(
  /CREATE OR REPLACE FUNCTION fn_update_persona\([\s\S]*?REVOKE ALL ON FUNCTION fn_update_persona/,
)?.[0] ?? "";

const upsertRepBlock = migration.match(
  /CREATE OR REPLACE FUNCTION fn_upsert_representante_admin_pj\([\s\S]*?REVOKE ALL ON FUNCTION fn_upsert_representante_admin_pj/,
)?.[0] ?? "";

describe("Personas/Cargos Sprint 2 security follow-ups", () => {
  it("tenant-scopes the vigente representaciones unique index and conflict targets", () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX ux_representaciones_vigente/);
    expect(migration).toMatch(/ON representaciones\(\s*tenant_id,\s*entity_id,\s*represented_person_id,\s*scope,/);
    expect(designarBlock).toMatch(/ON CONFLICT \(\s*tenant_id,\s*entity_id,\s*represented_person_id,\s*scope,/);
    expect(upsertRepBlock).toMatch(/ON CONFLICT \(\s*tenant_id,\s*entity_id,\s*represented_person_id,\s*scope,/);
  });

  it("rejects backdated singleton replacement that would create invalid historical ranges", () => {
    expect(designarBlock).toMatch(/cp\.fecha_inicio > p_fecha_inicio - 1/);
    expect(designarBlock).toMatch(/would close existing singleton cargo before its fecha_inicio/);
    expect(designarBlock).toMatch(/would close existing ADMIN_UNICO before its fecha_inicio/);
  });

  it("freezes legal identity fields once a person has societary or evidentiary references", () => {
    expect(updateBlock).toMatch(/v_legal_identity_changed/);
    expect(updateBlock).toMatch(/FROM condiciones_persona/);
    expect(updateBlock).toMatch(/FROM authority_evidence/);
    expect(updateBlock).toMatch(/FROM no_session_respuestas/);
    expect(updateBlock).toMatch(/legal identity fields are immutable/);
  });

  it("removes broad PUBLIC execution and restricts consolidation to service_role", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION fn_designar_cargo[\s\S]*FROM PUBLIC/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION fn_update_persona[\s\S]*FROM PUBLIC/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION fn_upsert_representante_admin_pj[\s\S]*FROM PUBLIC/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION fn_consolidate_person\(uuid, uuid, uuid, text, text\) FROM PUBLIC/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION fn_consolidate_person\(uuid, uuid, uuid, text, text\) FROM authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION fn_consolidate_person\(uuid, uuid, uuid, text, text\) TO service_role/);
  });
});
