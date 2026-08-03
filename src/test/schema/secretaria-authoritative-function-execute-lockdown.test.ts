import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720130000_secretaria_authoritative_function_execute_lockdown.sql",
  ),
  "utf8",
);

const internalHelpers = [
  "fn_secretaria_qtsp_request_source_guard",
  "fn_secretaria_evidence_bundle_insert_guard",
  "fn_secretaria_freeze_minute_source_facts",
  "fn_secretaria_annual_accounts_append_only_guard",
  "fn_secretaria_annual_accounts_minute_gate",
  "fn_secretaria_guard_convocation_agenda_binding",
];

describe("authoritative trigger function EXECUTE lockdown", () => {
  it.each(internalHelpers)("removes browser-facing EXECUTE from %s", (name) => {
    expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${name}()`);
    expect(sql).toMatch(
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${name}\\(\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated`,
      ),
    );
    expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${name}()`);
  });

  it("fails closed if anon/authenticated retain access or service_role loses it", () => {
    expect(sql).toContain("has_function_privilege('anon', v_function, 'EXECUTE')");
    expect(sql).toContain("has_function_privilege('authenticated', v_function, 'EXECUTE')");
    expect(sql).toContain("NOT has_function_privilege('service_role', v_function, 'EXECUTE')");
    expect(sql).toContain("authoritative helper EXECUTE lockdown failed");
  });
});
