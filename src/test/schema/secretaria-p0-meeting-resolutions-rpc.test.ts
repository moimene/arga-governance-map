import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260505093000_000056_secretaria_meeting_resolutions_transactional.sql"),
  "utf8",
);

const hook = readFileSync(
  join(process.cwd(), "src/hooks/useReunionSecretaria.ts"),
  "utf8",
);

describe("Secretaria P0 meeting resolutions transactional RPC", () => {
  it("defines a SECURITY DEFINER RPC with tenant and role guards", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_save_meeting_resolutions/i);
    expect(migration).toMatch(/SECURITY DEFINER/i);
    expect(migration).toMatch(/SET search_path = public/i);
    expect(migration).toMatch(/fn_secretaria_assert_role_allowed\(p_tenant_id, ARRAY\['SECRETARIO', 'ADMIN_TENANT'\]\)/);
  });

  it("keeps meeting point persistence atomic across agreements, resolutions, votes and rule results", () => {
    expect(migration).toMatch(/FOR UPDATE OF m/i);
    expect(migration).toMatch(/INSERT INTO agreements/i);
    expect(migration).toMatch(/UPDATE agreements/i);
    expect(migration).toMatch(/DELETE FROM meeting_votes/i);
    expect(migration).toMatch(/DELETE FROM meeting_resolutions/i);
    expect(migration).toMatch(/INSERT INTO meeting_resolutions/i);
    expect(migration).toMatch(/INSERT INTO meeting_votes/i);
    expect(migration).toMatch(/INSERT INTO rule_evaluation_results/i);
  });

  it("adds idempotency indexes for meeting point and agreement materialization", () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS ux_meeting_resolutions_point/i);
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS ux_agreements_meeting_agenda_point/i);
  });

  it("uses the RPC from the hook and avoids direct multi-step writes in the client", () => {
    expect(hook).toMatch(/rpc\("fn_save_meeting_resolutions"/);
    expect(hook).not.toMatch(/from\("meeting_resolutions"\)\s*\.delete\(/);
    expect(hook).not.toMatch(/from\("meeting_votes"\)\s*\.delete\(/);
    expect(hook).not.toMatch(/from\("meeting_resolutions"\)\s*\.insert\(/);
    expect(hook).not.toMatch(/from\("meeting_votes"\)\s*\.insert\(/);
  });
});
