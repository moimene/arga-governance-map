import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260515153057_secretaria_normative_maintenance_cloud.sql"),
  "utf8",
);

describe("secretaria normative maintenance cloud migration", () => {
  it("creates the persisted backfill status and append-only event tables", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS secretaria_normative_framework_status/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS secretaria_normative_event_log/i);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS secretaria_normative_backfill_runs/i);
    expect(migration).toMatch(/profile_hash text/i);
    expect(migration).toMatch(/trg_secretaria_normative_event_log_worm_update/i);
    expect(migration).toMatch(/trg_secretaria_normative_backfill_runs_worm_delete/i);
  });

  it("uses tenant-scoped RLS helpers instead of demo tenant constants", () => {
    expect(migration).toMatch(/fn_secretaria_current_tenant_id\(\)/);
    expect(migration).toMatch(/fn_secretaria_is_service_role\(\)/);
    expect(migration).toMatch(/fn_secretaria_assert_tenant_access\(v_tenant_id\)/);
    expect(migration).not.toMatch(/tenant_id = '00000000-0000-0000-0000-000000000001'::uuid/);
  });

  it("records UI events through the shared audit_log backbone", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_record_normative_event\(p_event jsonb\)/i);
    expect(migration).toMatch(/INSERT INTO audit_log\s*\(\s*tenant_id,\s*action,\s*object_type,\s*object_id,\s*delta\s*\)/i);
    expect(migration).toMatch(/INSERT INTO secretaria_normative_event_log/i);
    expect(migration).toMatch(/SECRETARIA_NORMATIVE_/);
  });

  it("supports dry-run and apply modes for legacy society backfill", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_backfill_normative_framework/i);
    expect(migration).toMatch(/p_apply boolean DEFAULT false/i);
    expect(migration).toMatch(/run_mode text NOT NULL CHECK \(run_mode IN \('DRY_RUN', 'APPLY'\)\)/i);
    expect(migration).toMatch(/ON CONFLICT \(entity_id\)\s+DO UPDATE SET/i);
    expect(migration).toMatch(/SECRETARIA_NORMATIVE_BACKFILL_DRY_RUN/);
    expect(migration).toMatch(/SECRETARIA_NORMATIVE_BACKFILL_APPLIED/);
  });
});
