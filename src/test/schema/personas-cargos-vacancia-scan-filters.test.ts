import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260513_000067_personas_cargos_vacancia_scan_filters.sql",
  ),
  "utf8",
);

const toneMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260513_000068_vacancia_notification_tones.sql",
  ),
  "utf8",
);

describe("Personas/Cargos vacancy scan production filters", () => {
  it("keeps L13-B notifications from targeting synthetic E2E or PRUEBA bodies", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_scan_vacancias_presidencia/i);
    expect(migration).toMatch(/coalesce\(gb\.name, ''\) NOT ILIKE '\[E2E REAL\]%'/i);
    expect(migration).toMatch(/coalesce\(e\.legal_name, ''\) NOT ILIKE 'PRUEBA%'/i);
    expect(migration).toMatch(/coalesce\(ep\.tax_id, ''\) NOT ILIKE 'E2E-%'/i);
    expect(migration).toMatch(/coalesce\(ep\.tax_id, ''\) NOT ILIKE 'ARCHIVED-%'/i);
    expect(migration).toMatch(/'excludes_test_data', true/i);
  });

  it("preserves the signed L13-B behavior: non-blocking D+0/D+60/D+90 owner Secretaría", () => {
    expect(migration).toMatch(/VACANCIA_PRESIDENCIA_D0/i);
    expect(migration).toMatch(/VACANCIA_PRESIDENCIA_D60/i);
    expect(migration).toMatch(/VACANCIA_PRESIDENCIA_D90/i);
    expect(migration).toMatch(/INSERT INTO notifications/i);
    expect(migration).toMatch(/'blocking', false/i);
    expect(migration).toMatch(/Owner operativo: Secretario del CdA o Vicesecretario/i);
  });

  it("stores vacancy notices with the existing UI notification type contract", () => {
    expect(toneMigration).toMatch(/'info' AS ui_type, '\[D\+0\] Vacancia de Presidencia'/i);
    expect(toneMigration).toMatch(/SELECT 60, 'warning'/i);
    expect(toneMigration).toMatch(/SELECT 90, 'error'/i);
    expect(toneMigration).toMatch(/n\.title ILIKE t\.title_prefix \|\| '%'/i);
    expect(toneMigration).toMatch(/'notification_type_contract', 'info_warning_error'/i);
    expect(toneMigration).not.toMatch(/VACANCIA_PRESIDENCIA_D0/i);
  });
});
