import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720148000_secretaria_ead_interposition_system_policy.sql",
  ),
  "utf8",
);

const perimeter = migration.match(
  /ALTER TABLE public\.no_session_respuestas ENABLE ROW LEVEL SECURITY;[\s\S]*?\$assert\$;/,
)?.[0] ?? "";

describe("no-session responses RPC-only perimeter", () => {
  it("removes every historical policy before rebuilding one read-only policy", () => {
    expect(perimeter).toContain(
      "policy.polrelid = 'public.no_session_respuestas'::regclass",
    );
    expect(perimeter).toContain(
      "'DROP POLICY %I ON public.no_session_respuestas'",
    );
    expect(perimeter.match(/CREATE POLICY/g)).toHaveLength(1);
    expect(perimeter).toContain(
      "CREATE POLICY no_session_respuestas_authenticated_select",
    );
    expect(perimeter).toMatch(/FOR SELECT TO authenticated/);
    expect(perimeter).toContain("auth.uid() IS NOT NULL");
    expect(perimeter).toContain(
      "tenant_id = public.fn_current_tenant_id()",
    );
    expect(perimeter).not.toMatch(/FOR (?:ALL|INSERT|UPDATE|DELETE) TO authenticated/);
  });

  it("revokes direct client DML while preserving tenant reads", () => {
    expect(perimeter).toMatch(
      /REVOKE ALL ON TABLE public\.no_session_respuestas\s+FROM PUBLIC, anon, authenticated, service_role;/,
    );
    expect(perimeter).toContain(
      "GRANT SELECT ON TABLE public.no_session_respuestas TO authenticated",
    );
    expect(perimeter).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE|ALL)[^;]*TO authenticated/,
    );
    expect(perimeter).not.toMatch(/GRANT [^;]+ TO anon/);
    expect(perimeter).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.no_session_respuestas",
    );
    expect(perimeter).toContain("TO service_role");
  });

  it("fails migration if inherited client privileges or mutating policies survive", () => {
    expect(perimeter).toContain("policy.polcmd <> 'r'");
    for (const privilege of ["INSERT", "UPDATE", "DELETE"]) {
      expect(perimeter).toContain(
        `'authenticated', 'public.no_session_respuestas', '${privilege}'`,
      );
      expect(perimeter).toContain(
        `'anon', 'public.no_session_respuestas', '${privilege}'`,
      );
    }
    expect(perimeter).toContain(
      "NO_SESSION_RESPONSES_RPC_ONLY_PERIMETER_INVALID",
    );
  });

  it("keeps vote mutation available only through the governed SECURITY DEFINER RPC", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.fn_no_session_cast_response[\s\S]*?SECURITY DEFINER/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_no_session_cast_response\([\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_no_session_cast_response\([\s\S]*?TO authenticated, service_role;/,
    );
  });
});
