import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration70 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260515045355_agenda_item_v31_taxonomy_fast_track.sql"),
  "utf8",
);

const migration71 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260515070447_agenda_item_legacy_synthetic_anchors.sql"),
  "utf8",
);

const actaMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260515070446_agenda_driven_minutes_contract.sql"),
  "utf8",
);

const constanciasRlsMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260515132026_agenda_item_constancias_multi_tenant_rls.sql"),
  "utf8",
);

const migrationNames = [
  "20260515045355_agenda_item_v31_taxonomy_fast_track.sql",
  "20260515070446_agenda_driven_minutes_contract.sql",
  "20260515070447_agenda_item_legacy_synthetic_anchors.sql",
].sort();

describe("agenda item v3.1 migration contract", () => {
  it("keeps agreement_requires_decisorio consolidated in the agenda taxonomy migration", () => {
    expect(migration70).toMatch(/CREATE OR REPLACE FUNCTION agreement_requires_decisorio\(\)/i);
    expect(migration70).toMatch(/requiere agenda_item_id o execution_mode\.agenda_item_index/i);
    expect(actaMigration).not.toMatch(/CREATE OR REPLACE FUNCTION agreement_requires_decisorio\(\)/i);
  });

  it("keeps deployment order explicit: acta contract, strict trigger, legacy anchors", () => {
    expect(migrationNames).toEqual([
      "20260515045355_agenda_item_v31_taxonomy_fast_track.sql",
      "20260515070446_agenda_driven_minutes_contract.sql",
      "20260515070447_agenda_item_legacy_synthetic_anchors.sql",
    ]);
  });

  it("keeps the pre-backfill trigger strict for orphan meeting agreements", () => {
    expect(migration70).toMatch(
      /IF v_agenda_item_index IS NULL THEN\s+RAISE EXCEPTION 'agreement\.parent_meeting_id requiere agenda_item_id o execution_mode\.agenda_item_index';\s+END IF;/i,
    );
    expect(migration70).not.toMatch(/IF v_agenda_item_index IS NULL THEN\s+RETURN NEW;\s+END IF;/i);
    expect(migration71).toMatch(/a\.parent_meeting_id IS NOT NULL\s+AND a\.agenda_item_id IS NULL/i);
    expect(migration71).toMatch(/legacy_migrated,\s+legacy_source_agreement_id/i);
  });

  it("uses multi-tenant RLS for agenda item constancias", () => {
    expect(migration70).toMatch(/fn_secretaria_current_tenant_id\(\)/);
    expect(migration70).toMatch(/fn_secretaria_is_service_role\(\)/);
    expect(migration70).not.toMatch(/tenant_id = '00000000-0000-0000-0000-000000000001'::uuid/);
  });

  it("keeps the cloud RLS follow-up scoped to agenda item constancias policies", () => {
    expect(constanciasRlsMigration).toMatch(/DROP POLICY IF EXISTS agenda_item_constancias_tenant_read/i);
    expect(constanciasRlsMigration).toMatch(/DROP POLICY IF EXISTS agenda_item_constancias_tenant_write/i);
    expect(constanciasRlsMigration).toMatch(/fn_secretaria_current_tenant_id\(\)/);
    expect(constanciasRlsMigration).toMatch(/fn_secretaria_is_service_role\(\)/);
    expect(constanciasRlsMigration).not.toMatch(/tenant_id = '00000000-0000-0000-0000-000000000001'::uuid/);
    expect(constanciasRlsMigration).not.toMatch(/ALTER TABLE agreements/i);
    expect(constanciasRlsMigration).not.toMatch(/CREATE OR REPLACE FUNCTION agreement_requires_decisorio/i);
  });

  it("makes synthetic legacy anchors retry-safe", () => {
    expect(migration71).toMatch(/ON CONFLICT DO NOTHING/i);
    expect(migration71).toMatch(/legacy_source_agreement_id/);
  });

  it("documents why uniqueness is limited to MEETING adoption mode", () => {
    expect(migration70).toMatch(/COMMENT ON INDEX ux_agreements_agenda_item_id/i);
    expect(migration70).toMatch(/UNIVERSAL queda fuera/i);
  });
});
